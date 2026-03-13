export const securityDecisionEventSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  title: "SecurityDecisionEvent",
  type: "object",
  required: [
    "schema_version",
    "event_type",
    "trace_id",
    "hook",
    "decision",
    "reason_codes",
    "risk_score",
    "latency_ms",
    "ts"
  ],
  properties: {
    schema_version: { type: "string" },
    event_type: { const: "SecurityDecisionEvent" },
    trace_id: { type: "string" },
    hook: { type: "string" },
    decision: { type: "string" },
    reason_codes: { type: "array", items: { type: "string" } },
    risk_score: { type: "number" },
    latency_ms: { type: "number" },
    ts: { type: "string", format: "date-time" }
  }
} as const;
