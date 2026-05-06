-- ============================================================
-- credit_collections schema (Postgres)
-- Run once on a fresh database before loading seed data.
-- ============================================================

CREATE SCHEMA IF NOT EXISTS credit_collections;
SET search_path TO credit_collections, public;

-- ---------- Master ----------
CREATE TABLE IF NOT EXISTS customer (
    customer_id            BIGINT PRIMARY KEY,
    legal_name             VARCHAR(255) NOT NULL,
    dba_name               VARCHAR(255),
    duns_number            VARCHAR(20),
    tax_id                 VARCHAR(50),
    industry_code          VARCHAR(20),
    country_code           CHAR(2),
    parent_customer_id     BIGINT REFERENCES customer(customer_id),
    status                 VARCHAR(20) CHECK (status IN ('ACTIVE','INACTIVE','BLOCKED')),
    created_at             TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP
);

CREATE TABLE IF NOT EXISTS contact (
    contact_id         BIGINT PRIMARY KEY,
    customer_id        BIGINT NOT NULL REFERENCES customer(customer_id),
    name               VARCHAR(255),
    role               VARCHAR(50),
    email              VARCHAR(255),
    phone              VARCHAR(50),
    preferred_channel  VARCHAR(20),
    is_active          BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS contract (
    contract_id            BIGINT PRIMARY KEY,
    customer_id            BIGINT NOT NULL REFERENCES customer(customer_id),
    contract_value         DECIMAL(18,2),
    start_date             DATE,
    end_date               DATE,
    payment_terms_override VARCHAR(50),
    strategic_flag         BOOLEAN DEFAULT FALSE
);

-- ---------- Credit & Risk ----------
CREATE TABLE IF NOT EXISTS credit_profile (
    credit_profile_id      BIGINT PRIMARY KEY,
    customer_id            BIGINT NOT NULL REFERENCES customer(customer_id),
    internal_rating        VARCHAR(10),
    external_score         INT,
    risk_class             VARCHAR(20),
    probability_of_default DECIMAL(5,4),
    last_review_date       DATE
);

CREATE TABLE IF NOT EXISTS credit_limit (
    limit_id           BIGINT PRIMARY KEY,
    credit_profile_id  BIGINT NOT NULL REFERENCES credit_profile(credit_profile_id),
    limit_type         VARCHAR(20),
    approved_limit     DECIMAL(18,2),
    temporary_limit    DECIMAL(18,2),
    effective_date     DATE,
    expiry_date        DATE
);

CREATE TABLE IF NOT EXISTS risk_event (
    risk_event_id      BIGINT PRIMARY KEY,
    credit_profile_id  BIGINT NOT NULL REFERENCES credit_profile(credit_profile_id),
    event_type         VARCHAR(50),
    event_date         DATE,
    source             VARCHAR(100),
    severity           VARCHAR(20)
);

-- ---------- AR ----------
CREATE TABLE IF NOT EXISTS account (
    account_id        BIGINT PRIMARY KEY,
    customer_id       BIGINT NOT NULL REFERENCES customer(customer_id),
    currency_code     CHAR(3),
    payment_terms     VARCHAR(50),
    billing_cycle     VARCHAR(20),
    credit_hold_flag  BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS invoice (
    invoice_id          BIGINT PRIMARY KEY,
    account_id          BIGINT NOT NULL REFERENCES account(account_id),
    invoice_date        DATE,
    due_date            DATE,
    invoice_amount      DECIMAL(18,2),
    outstanding_amount  DECIMAL(18,2),
    aging_bucket        VARCHAR(20),
    status              VARCHAR(20) CHECK (status IN ('OPEN','CLOSED','DISPUTED'))
);

CREATE TABLE IF NOT EXISTS payment (
    payment_id        BIGINT PRIMARY KEY,
    account_id        BIGINT NOT NULL REFERENCES account(account_id),
    payment_date      DATE,
    payment_amount    DECIMAL(18,2),
    payment_method    VARCHAR(20),
    remittance_id     VARCHAR(100)
);

-- ---------- Collections & Disputes ----------
CREATE TABLE IF NOT EXISTS dispute (
    dispute_id        BIGINT PRIMARY KEY,
    invoice_id        BIGINT NOT NULL REFERENCES invoice(invoice_id),
    dispute_type      VARCHAR(50),
    dispute_amount    DECIMAL(18,2),
    status            VARCHAR(20),
    resolution_date   DATE,
    root_cause        VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS collection_activity (
    activity_id           BIGINT PRIMARY KEY,
    invoice_id            BIGINT NOT NULL REFERENCES invoice(invoice_id),
    activity_type         VARCHAR(50),
    activity_date         TIMESTAMP,
    promise_to_pay_date   DATE,
    status                VARCHAR(20),
    collector_id          VARCHAR(50)
);

-- ---------- SOX ----------
CREATE TABLE IF NOT EXISTS audit_log (
    audit_id           BIGINT PRIMARY KEY,
    entity_name        VARCHAR(50),
    entity_id          BIGINT,
    field_name         VARCHAR(50),
    old_value          VARCHAR(500),
    new_value          VARCHAR(500),
    changed_by         VARCHAR(100),
    change_timestamp   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    approval_reference VARCHAR(100)
);

CREATE TABLE IF NOT EXISTS approval (
    approval_id        BIGINT PRIMARY KEY,
    entity_name        VARCHAR(50),
    entity_id          BIGINT,
    approval_type      VARCHAR(50),
    requested_by       VARCHAR(100),
    approved_by        VARCHAR(100),
    approval_status    VARCHAR(20),
    approval_timestamp TIMESTAMP
);

-- ---------- Analytics ----------
CREATE TABLE IF NOT EXISTS customer_ar_summary (
    customer_id            BIGINT PRIMARY KEY REFERENCES customer(customer_id),
    total_ar_balance       DECIMAL(18,2),
    total_overdue_amount   DECIMAL(18,2),
    oldest_invoice_date    DATE,
    avg_days_to_pay        INT,
    delinquency_flag       BOOLEAN,
    last_updated           TIMESTAMP
);

-- ---------- Sequences for app-inserted rows ----------
CREATE SEQUENCE IF NOT EXISTS collection_activity_seq_workbench START 9000000;
CREATE SEQUENCE IF NOT EXISTS audit_log_seq_workbench           START 9500000;

-- ---------- Indexes ----------
CREATE INDEX IF NOT EXISTS idx_invoice_account     ON invoice(account_id);
CREATE INDEX IF NOT EXISTS idx_invoice_due_date    ON invoice(due_date);
CREATE INDEX IF NOT EXISTS idx_invoice_status      ON invoice(status);
CREATE INDEX IF NOT EXISTS idx_invoice_aging       ON invoice(aging_bucket);
CREATE INDEX IF NOT EXISTS idx_payment_account     ON payment(account_id);
CREATE INDEX IF NOT EXISTS idx_dispute_invoice     ON dispute(invoice_id);
CREATE INDEX IF NOT EXISTS idx_activity_invoice    ON collection_activity(invoice_id);
CREATE INDEX IF NOT EXISTS idx_audit_entity        ON audit_log(entity_name, entity_id);
CREATE INDEX IF NOT EXISTS idx_customer_parent     ON customer(parent_customer_id);
CREATE INDEX IF NOT EXISTS idx_account_customer    ON account(customer_id);
CREATE INDEX IF NOT EXISTS idx_credit_profile_cust ON credit_profile(customer_id);
