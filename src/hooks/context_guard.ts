import type { BeforePromptBuildInput, GuardComputation, SecurityContext } from "../types.ts";

export function runContextGuard(
  input: BeforePromptBuildInput,
  policyVersion: string,
  traceId: string,
  nowIso: string,
): GuardComputation<BeforePromptBuildInput> {
  const untrusted = input.source === "external";
  const tags = [...(input.tags ?? [])];
  if (untrusted && !tags.includes("untrusted")) {
    tags.push("untrusted");
  }
  const securityContext: SecurityContext = {
    trace_id: traceId,
    actor_id: input.actor_id,
    workspace: input.workspace,
    policy_version: policyVersion,
    untrusted,
    tags,
    created_at: nowIso
  };
  return {
    mutated_payload: {
      ...input,
      tags,
      trace_id: traceId,
      prompt: input.prompt,
      security_context: securityContext
    } as BeforePromptBuildInput,
    decision: "allow",
    reason_codes: [untrusted ? "CONTENT_MARKED_UNTRUSTED" : "CONTEXT_INJECTED"],
    sanitization_actions: [],
    security_context: securityContext
  };
}
