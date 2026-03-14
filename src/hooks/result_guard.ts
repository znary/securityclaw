import type { AfterToolCallInput, DlpFinding, GuardComputation, SanitizationAction, SchemaExpectation, SecurityContext } from "../types.ts";
import type { DlpEngine } from "../engine/dlp_engine.ts";

function buildSecurityContext(input: AfterToolCallInput, traceId: string, policyVersion: string, nowIso: string): SecurityContext {
  return {
    trace_id: input.security_context?.trace_id ?? traceId,
    actor_id: input.actor_id,
    workspace: input.workspace,
    policy_version: input.security_context?.policy_version ?? policyVersion,
    untrusted: input.security_context?.untrusted ?? false,
    tags: [...(input.security_context?.tags ?? [])],
    created_at: input.security_context?.created_at ?? nowIso
  };
}

function matchesType(value: unknown, expected: SchemaExpectation["type"]): boolean {
  if (expected === "array") {
    return Array.isArray(value);
  }
  if (expected === "object") {
    return value !== null && typeof value === "object" && !Array.isArray(value);
  }
  return typeof value === expected;
}

function validateSchema(value: unknown, schema: SchemaExpectation, path = "result"): string[] {
  const errors: string[] = [];
  if (!matchesType(value, schema.type)) {
    errors.push(`SCHEMA_TYPE_MISMATCH:${path}`);
    return errors;
  }
  if (schema.type === "object" && schema.required && value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    for (const [key, child] of Object.entries(schema.required)) {
      if (!(key in record)) {
        errors.push(`SCHEMA_MISSING_FIELD:${path}.${key}`);
        continue;
      }
      errors.push(...validateSchema(record[key], child, `${path}.${key}`));
    }
  }
  return errors;
}

function findingsToActions(findings: DlpFinding[]): SanitizationAction[] {
  return findings.map((finding) => ({
    path: finding.path,
    action: finding.action,
    detail: `${finding.pattern_name}:${finding.type}`
  }));
}

export function runResultGuard(
  input: AfterToolCallInput,
  traceId: string,
  policyVersion: string,
  nowIso: string,
  dlpEngine: DlpEngine,
): GuardComputation<AfterToolCallInput> {
  const securityContext = buildSecurityContext(input, traceId, policyVersion, nowIso);
  const schemaErrors = input.expected_schema ? validateSchema(input.result, input.expected_schema) : [];
  const findings = dlpEngine.scan(input.result);
  const hasSchemaErrors = schemaErrors.length > 0;
  const hasFindings = findings.length > 0;
  const decision =
    hasSchemaErrors || dlpEngine.config.on_dlp_hit === "block"
      ? hasFindings || hasSchemaErrors
        ? "block"
        : "allow"
      : hasFindings
        ? dlpEngine.config.on_dlp_hit === "warn"
          ? "warn"
          : "allow"
        : "allow";

  const sanitizedResult =
    hasFindings && dlpEngine.config.on_dlp_hit === "sanitize"
      ? dlpEngine.sanitize(input.result, findings, "sanitize")
      : input.result;

  return {
    mutated_payload: { ...input, result: sanitizedResult, security_context: securityContext } as AfterToolCallInput,
    decision,
    reason_codes: [...schemaErrors, ...(hasFindings ? ["DLP_HIT"] : ["RESULT_OK"])],
    sanitization_actions: findingsToActions(findings),
    security_context: securityContext
  };
}
