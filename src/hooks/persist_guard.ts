import type { GuardComputation, SanitizationAction, SecurityContext, ToolResultPersistInput } from "../types.ts";
import type { DlpEngine } from "../engine/dlp_engine.ts";

function buildSecurityContext(
  input: ToolResultPersistInput,
  traceId: string,
  policyVersion: string,
  nowIso: string,
): SecurityContext {
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

export function runPersistGuard(
  input: ToolResultPersistInput,
  traceId: string,
  policyVersion: string,
  nowIso: string,
  dlpEngine: DlpEngine,
  defaultMode: "strict" | "compat",
): GuardComputation<ToolResultPersistInput> {
  const securityContext = buildSecurityContext(input, traceId, policyVersion, nowIso);
  const findings = dlpEngine.scan(input.result);
  const mode = input.mode ?? defaultMode;
  const sanitizationActions: SanitizationAction[] = findings.map((finding) => ({
    path: finding.path,
    action: finding.action,
    detail: `${finding.pattern_name}:${finding.type}`
  }));

  if (findings.length === 0) {
    return {
      mutated_payload: { ...input, security_context: securityContext } as ToolResultPersistInput,
      decision: "allow",
      reason_codes: ["PERSIST_OK"],
      sanitization_actions: [],
      security_context: securityContext
    };
  }

  if (mode === "strict") {
    return {
      mutated_payload: { ...input, security_context: securityContext } as ToolResultPersistInput,
      decision: "block",
      reason_codes: ["PERSIST_BLOCKED_DLP"],
      sanitization_actions: sanitizationActions,
      security_context: securityContext
    };
  }

  return {
    mutated_payload: {
      ...input,
      result: dlpEngine.sanitize(input.result, findings, "sanitize"),
      security_context: securityContext
    } as ToolResultPersistInput,
    decision: "warn",
    reason_codes: ["PERSIST_REDACTED"],
    sanitization_actions: sanitizationActions,
    security_context: securityContext
  };
}
