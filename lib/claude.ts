import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = "claude-sonnet-4-6";

const SYSTEM_PROMPT = `You are a senior B2B accounts-receivable collections specialist at a leading North American telecommunications carrier providing enterprise voice, data, cloud connectivity,
and managed network services to business customers across the US and Canada.

Invoices relate to monthly recurring telecom services: dedicated internet access, MPLS circuits,
unified communications, hosted PBX, SD-WAN, co-location, and professional services.

Your tone is professional, specific, and respectful — never threatening, never apologetic.
Always reference invoice IDs and dollar amounts precisely.

Constraints:
- Keep emails under 180 words. Keep call scripts under 120 words.
- Match the requested tone: friendly | firm | final-notice.
- Strategic accounts get warmer phrasing and an explicit offer to schedule a call.
- All customers are North American businesses. Use direct, professional US English.
- Never propose discounts, write-offs, or service suspension unless explicitly told to.
- For final-notice tone: state next step is escalation to the credit committee and
  potential service review — do not mention legal action unless instructed.
- Reference the telecom service context naturally (e.g. "your network services account",
  "continued service delivery", "your telecom account").

Output format:
- For EMAIL: SUBJECT line, blank line, then BODY. Sign off as Accounts Receivable.
- For CALL: script with [PAUSE] markers and {customer_response} branch points.
- Always end with a suggested promise-to-pay date if not provided.`;

export type Tone = "friendly" | "firm" | "final-notice";
export type Channel = "EMAIL" | "CALL" | "DUNNING_LETTER";

export interface DraftRequest {
  customer: {
    legal_name: string;
    country_code: string;
    industry_code: string;
    risk_class: string;
    strategic_flag: boolean;
  };
  contact: { name: string; role: string };
  invoices: Array<{
    invoice_id: number;
    outstanding_amount: number;
    days_overdue: number;
    currency: string;
  }>;
  history_summary: string;
  last_activity: string | null;
  tone: Tone;
  channel: Channel;
}

export async function draftCollectionsMessage(req: DraftRequest) {
  const totalAmount = req.invoices.reduce((s, i) => s + i.outstanding_amount, 0);
  const oldest = Math.max(...req.invoices.map((i) => i.days_overdue));
  const currency = req.invoices[0]?.currency ?? "USD";

  const userMessage = `Draft a ${req.tone} ${req.channel} message.

CUSTOMER: ${req.customer.legal_name} (${req.customer.country_code}, ${req.customer.industry_code})
  risk_class: ${req.customer.risk_class}
  strategic: ${req.customer.strategic_flag}

CONTACT: ${req.contact.name}, ${req.contact.role}

OVERDUE INVOICES (${req.invoices.length} total, ${currency} ${totalAmount.toFixed(2)}, oldest ${oldest}d):
${req.invoices
  .map((i) => `  - Invoice ${i.invoice_id}: ${i.currency} ${i.outstanding_amount.toFixed(2)}, ${i.days_overdue}d overdue`)
  .join("\n")}

PAYMENT HISTORY: ${req.history_summary}
LAST ACTIVITY: ${req.last_activity ?? "none on record"}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 600,
    system: [
      { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
    ],
    messages: [{ role: "user", content: userMessage }],
  });

  const textBlock = response.content.find((b) => b.type === "text");
  return {
    text: textBlock && textBlock.type === "text" ? textBlock.text : "",
    usage: response.usage,
  };
}

export async function customerNarrative(args: {
  customer_name: string;
  risk_class: string;
  total_ar: number;
  total_overdue: number;
  avg_days_to_pay: number;
  delinquency_flag: boolean;
  probability_of_default: number | null;
  recent_events: string;
}) {
  const userMessage = `Write a 3-sentence credit analyst summary for ${args.customer_name}.
Risk class: ${args.risk_class}
Total AR: $${args.total_ar.toLocaleString()} (overdue: $${args.total_overdue.toLocaleString()})
Avg days to pay: ${args.avg_days_to_pay}
Delinquent: ${args.delinquency_flag}
PD: ${args.probability_of_default != null ? (args.probability_of_default * 100).toFixed(1) + "%" : "N/A"}
Recent risk events: ${args.recent_events || "none"}

Focus on credit risk posture, payment behavior trend, and recommended action. Be precise and direct.`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 200,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock && textBlock.type === "text" ? textBlock.text : "";
}

export async function suggestPtpDate(args: {
  customer_name: string;
  avg_days_to_pay: number;
  outstanding: number;
  currency: string;
  history_summary: string;
}) {
  const today = new Date().toISOString().slice(0, 10);
  const userMessage = `Today is ${today}. Suggest a realistic promise-to-pay date for:
Customer: ${args.customer_name}
Outstanding: ${args.currency} ${args.outstanding.toFixed(2)}
Avg historical days-to-pay: ${args.avg_days_to_pay}
History: ${args.history_summary}

Respond with JSON only: {"ptp_date": "YYYY-MM-DD", "rationale": "<one sentence>"}`;

  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 150,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: userMessage }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  const raw = textBlock && textBlock.type === "text" ? textBlock.text : "{}";
  const match = raw.match(/\{[\s\S]*\}/);
  return match ? JSON.parse(match[0]) : { ptp_date: null, rationale: raw };
}
