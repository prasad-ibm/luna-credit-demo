-- ============================================================
-- Materialized views + analytical views powering the 3 tabs.
-- Run after schema.sql + seed data load.
-- ============================================================

SET search_path TO credit_collections, public;

-- ------------------------------------------------------------
-- 1. PARENT EXPOSURE ROLLUP (Tab 1)
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_parent_exposure_rollup CASCADE;
CREATE MATERIALIZED VIEW mv_parent_exposure_rollup AS
WITH RECURSIVE hier AS (
    SELECT customer_id, parent_customer_id, customer_id AS root_id, 0 AS depth
    FROM customer WHERE parent_customer_id IS NULL
    UNION ALL
    SELECT c.customer_id, c.parent_customer_id, h.root_id, h.depth + 1
    FROM customer c JOIN hier h ON c.parent_customer_id = h.customer_id
),
limits_active AS (
    SELECT cp.customer_id, SUM(cl.approved_limit) AS approved_limit
    FROM credit_profile cp
    JOIN credit_limit cl ON cl.credit_profile_id = cp.credit_profile_id
    WHERE cl.effective_date <= CURRENT_DATE
      AND (cl.expiry_date IS NULL OR cl.expiry_date >= CURRENT_DATE)
    GROUP BY cp.customer_id
)
SELECT
    h.root_id AS root_customer_id,
    c.legal_name AS root_legal_name,
    COUNT(DISTINCT h.customer_id) AS entity_count,
    COALESCE(SUM(s.total_ar_balance), 0)     AS consolidated_ar_balance,
    COALESCE(SUM(s.total_overdue_amount), 0) AS consolidated_overdue,
    COALESCE(SUM(la.approved_limit), 0)      AS consolidated_limit,
    CASE WHEN COALESCE(SUM(la.approved_limit), 0) > 0
         THEN ROUND(SUM(s.total_ar_balance) / SUM(la.approved_limit) * 100, 2)
         ELSE NULL END AS utilization_pct
FROM hier h
JOIN customer c                      ON c.customer_id = h.root_id
LEFT JOIN customer_ar_summary s      ON s.customer_id = h.customer_id
LEFT JOIN limits_active la           ON la.customer_id = h.customer_id
GROUP BY h.root_id, c.legal_name;

CREATE INDEX ON mv_parent_exposure_rollup (utilization_pct DESC);

-- ------------------------------------------------------------
-- 2. COLLECTIONS WORKLIST (Tab 2)
-- ------------------------------------------------------------
DROP MATERIALIZED VIEW IF EXISTS mv_collections_worklist CASCADE;
CREATE MATERIALIZED VIEW mv_collections_worklist AS
WITH last_activity AS (
    SELECT invoice_id,
           MAX(activity_date) AS last_activity_date,
           MAX(CASE WHEN promise_to_pay_date IS NOT NULL
                    THEN promise_to_pay_date END) AS last_ptp_date
    FROM collection_activity GROUP BY invoice_id
),
risk AS (
    SELECT cp.customer_id, cp.risk_class, cp.probability_of_default
    FROM credit_profile cp
)
SELECT
    i.invoice_id,
    a.customer_id,
    c.legal_name,
    c.country_code,
    c.industry_code,
    r.risk_class,
    r.probability_of_default,
    i.invoice_date,
    i.due_date,
    i.invoice_amount,
    i.outstanding_amount,
    i.aging_bucket,
    i.status,
    a.currency_code,
    GREATEST((CURRENT_DATE - i.due_date), 0) AS days_overdue,
    la.last_activity_date,
    la.last_ptp_date,
    CASE WHEN la.last_ptp_date IS NOT NULL
              AND la.last_ptp_date < CURRENT_DATE
              AND i.outstanding_amount > 0
         THEN TRUE ELSE FALSE END AS broken_ptp_flag,
    EXISTS(SELECT 1 FROM contract ct
           WHERE ct.customer_id = a.customer_id AND ct.strategic_flag = TRUE) AS strategic_flag,
    ROUND((
        i.outstanding_amount
        * CASE r.risk_class WHEN 'WATCH' THEN 3.0 WHEN 'HIGH' THEN 2.0
                            WHEN 'MEDIUM' THEN 1.2 ELSE 1.0 END
        * LN(GREATEST((CURRENT_DATE - i.due_date), 0) + 2)
        * CASE WHEN EXISTS(SELECT 1 FROM contract ct
                           WHERE ct.customer_id = a.customer_id AND ct.strategic_flag)
               THEN 1.4 ELSE 1.0 END
        * CASE WHEN la.last_ptp_date IS NOT NULL
                    AND la.last_ptp_date < CURRENT_DATE
                    AND i.outstanding_amount > 0
               THEN 1.6 ELSE 1.0 END
    )::numeric, 2) AS priority_score
FROM invoice i
JOIN account a              ON a.account_id = i.account_id
JOIN customer c             ON c.customer_id = a.customer_id
LEFT JOIN risk r            ON r.customer_id = a.customer_id
LEFT JOIN last_activity la  ON la.invoice_id = i.invoice_id
WHERE i.status IN ('OPEN','DISPUTED')
  AND i.outstanding_amount > 0
  AND i.due_date < CURRENT_DATE;

CREATE INDEX ON mv_collections_worklist (priority_score DESC);
CREATE INDEX ON mv_collections_worklist (customer_id);

-- ------------------------------------------------------------
-- 3. SOX VIOLATIONS (Tab 3)
-- ------------------------------------------------------------
DROP VIEW IF EXISTS v_sox_violations CASCADE;
CREATE VIEW v_sox_violations AS

SELECT
    'MASTER_DATA_NO_APPROVAL'  AS violation_code,
    'HIGH'                     AS severity,
    'Master data change without approval reference' AS description,
    al.audit_id                AS evidence_id,
    al.entity_name, al.entity_id, al.changed_by AS actor,
    al.change_timestamp        AS occurred_at
FROM audit_log al
WHERE al.approval_reference IS NULL
  AND al.entity_name IN ('account','customer','credit_limit','contract')

UNION ALL

SELECT
    'SOD_SELF_APPROVAL', 'CRITICAL',
    'Same user requested and approved a change',
    ap.approval_id, ap.entity_name, ap.entity_id,
    ap.requested_by, ap.approval_timestamp
FROM approval ap
WHERE ap.requested_by = ap.approved_by
  AND ap.approval_status = 'APPROVED'

UNION ALL

SELECT
    'STALE_CREDIT_REVIEW', 'MEDIUM',
    'Credit profile not reviewed in over 12 months',
    cp.credit_profile_id, 'credit_profile', cp.customer_id,
    NULL, cp.last_review_date::timestamp
FROM credit_profile cp
WHERE cp.last_review_date < CURRENT_DATE - INTERVAL '12 months'

UNION ALL

SELECT
    'BROKEN_PTP_NO_ESCALATION', 'MEDIUM',
    'Promise-to-pay missed without escalation activity',
    ca.activity_id, 'collection_activity', ca.invoice_id,
    ca.collector_id, ca.activity_date
FROM collection_activity ca
WHERE ca.promise_to_pay_date IS NOT NULL
  AND ca.promise_to_pay_date < CURRENT_DATE - INTERVAL '7 days'
  AND NOT EXISTS (
      SELECT 1 FROM collection_activity ca2
      WHERE ca2.invoice_id = ca.invoice_id
        AND ca2.activity_type IN ('ESCALATION','LEGAL')
        AND ca2.activity_date > ca.activity_date
  )

UNION ALL

SELECT
    'DISPUTE_SLA_BREACH', 'MEDIUM',
    'Dispute open beyond 30-day SLA',
    d.dispute_id, 'dispute', d.invoice_id, NULL,
    (CURRENT_DATE - INTERVAL '30 days')::timestamp
FROM dispute d
JOIN invoice i ON i.invoice_id = d.invoice_id
WHERE d.status IN ('OPEN','UNDER_REVIEW')
  AND i.invoice_date < CURRENT_DATE - INTERVAL '30 days';

-- ------------------------------------------------------------
-- 4. PORTFOLIO HEATMAP FEED
-- ------------------------------------------------------------
DROP VIEW IF EXISTS v_portfolio_heatmap CASCADE;
CREATE VIEW v_portfolio_heatmap AS
SELECT
    c.customer_id, c.legal_name, c.industry_code, c.country_code,
    cp.risk_class, cp.probability_of_default,
    s.total_ar_balance, s.total_overdue_amount,
    s.delinquency_flag,
    EXISTS(SELECT 1 FROM contract ct
           WHERE ct.customer_id = c.customer_id AND ct.strategic_flag) AS strategic_flag
FROM customer c
LEFT JOIN credit_profile cp        ON cp.customer_id = c.customer_id
LEFT JOIN customer_ar_summary s    ON s.customer_id = c.customer_id
WHERE c.status = 'ACTIVE';
