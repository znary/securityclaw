import type { GuardComputation, MessageSendingInput, SanitizationAction, SecurityContext } from "../types.ts";
import type { DlpEngine } from "../engine/dlp_engine.ts";

function buildSecurityContext(input: MessageSendingInput, traceId: string, policyVersion: string, nowIso: string): SecurityContext {
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

function redactRestrictedTerms(message: unknown, restrictedTerms: string[]): { output: unknown; actions: SanitizationAction[] } {
  if (typeof message !== "string" || restrictedTerms.length === 0) {
    return { output: message, actions: [] };
  }
  let output = message;
  const actions: SanitizationAction[] = [];
  for (const term of restrictedTerms) {
    if (output.includes(term)) {
      output = output.split(term).join("[REDACTED]");
      actions.push({
        path: "root",
        action: "mask",
        detail: `restricted_term:${term}`
      });
    }
  }
  return { output, actions };
}

export function runOutputGuard(
  input: MessageSendingInput,
  traceId: string,
  policyVersion: string,
  nowIso: string,
  dlpEngine: DlpEngine,
): GuardComputation<MessageSendingInput> {
  const securityContext = buildSecurityContext(input, traceId, policyVersion, nowIso);
  const restricted = redactRestrictedTerms(input.message, input.restricted_terms ?? []);
  const findings = dlpEngine.scan(restricted.output);
  const sanitized = findings.length > 0 ? dlpEngine.sanitize(restricted.output, findings, "sanitize") : restricted.output;
  const dlpActions: SanitizationAction[] = findings.map((finding) => ({
    path: finding.path,
    action: finding.action,
    detail: `${finding.pattern_name}:${finding.type}`
  }));

  return {
    mutated_payload: {
      ...input,
      message: sanitized,
      security_context: securityContext
    } as MessageSendingInput,
    decision: findings.length > 0 || restricted.actions.length > 0 ? "warn" : "allow",
    reason_codes:
      findings.length > 0 || restricted.actions.length > 0
        ? ["MESSAGE_SANITIZED"]
        : ["MESSAGE_OK"],
    sanitization_actions: [...restricted.actions, ...dlpActions],
    security_context: securityContext
  };
}
