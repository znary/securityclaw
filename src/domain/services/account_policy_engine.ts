import type { AccountPolicyMode, AccountPolicyRecord } from "../../types.ts";

export type AccountDecisionOverride = {
  decision: "allow";
  decision_source: "account";
  reason_codes: string[];
  policy: AccountPolicyRecord;
};

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeMode(value: unknown): AccountPolicyMode {
  return value === "default_allow" ? "default_allow" : "apply_rules";
}

function normalizePolicyEntry(value: unknown): AccountPolicyRecord | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }

  const subject = normalizeString((value as { subject?: unknown }).subject);
  if (!subject) {
    return undefined;
  }

  const record: AccountPolicyRecord = {
    subject,
    mode: normalizeMode((value as { mode?: unknown }).mode),
    is_admin: (value as { is_admin?: unknown }).is_admin === true,
    admin_allow_all: (value as { admin_allow_all?: unknown }).admin_allow_all === true,
  };

  const optionalFields = [
    "label",
    "session_key",
    "session_id",
    "agent_id",
    "channel",
    "chat_type",
    "updated_at",
  ] as const;

  for (const field of optionalFields) {
    const normalized = normalizeString((value as Record<string, unknown>)[field]);
    if (normalized) {
      record[field] = normalized;
    }
  }

  return record;
}

export function sanitizeAccountPolicies(input: unknown): AccountPolicyRecord[] {
  if (!Array.isArray(input)) {
    return [];
  }

  const deduped = new Map<string, AccountPolicyRecord>();
  for (const entry of input) {
    const normalized = normalizePolicyEntry(entry);
    if (!normalized) {
      continue;
    }
    deduped.set(normalized.subject, normalized);
  }
  return Array.from(deduped.values());
}

export function canonicalizeAccountPolicies(input: unknown): AccountPolicyRecord[] {
  return sanitizeAccountPolicies(input)
    .map((policy) => {
      const canonical: AccountPolicyRecord = {
        subject: policy.subject,
        mode: policy.mode,
        is_admin: policy.is_admin,
        admin_allow_all: policy.admin_allow_all,
      };

      const optionalFields = [
        "label",
        "session_key",
        "session_id",
        "agent_id",
        "channel",
        "chat_type",
        "updated_at",
      ] as const;

      for (const field of optionalFields) {
        if (policy[field]) {
          canonical[field] = policy[field];
        }
      }

      return canonical;
    })
    .sort((left, right) => left.subject.localeCompare(right.subject));
}

export class AccountPolicyEngine {
  #policiesBySubject: Map<string, AccountPolicyRecord>;

  constructor(policies: unknown) {
    this.#policiesBySubject = new Map(
      sanitizeAccountPolicies(policies).map((policy) => [policy.subject, policy]),
    );
  }

  getPolicy(subject: string | undefined): AccountPolicyRecord | undefined {
    if (!subject) {
      return undefined;
    }
    return this.#policiesBySubject.get(subject);
  }

  evaluate(subject: string | undefined): AccountDecisionOverride | undefined {
    const policy = this.getPolicy(subject);
    if (!policy) {
      return undefined;
    }
    if (policy.is_admin && policy.admin_allow_all) {
      return {
        decision: "allow",
        decision_source: "account",
        reason_codes: ["ACCOUNT_ADMIN_ALLOW_ALL"],
        policy
      };
    }
    if (policy.mode === "default_allow") {
      return {
        decision: "allow",
        decision_source: "account",
        reason_codes: ["ACCOUNT_DEFAULT_ALLOW"],
        policy
      };
    }
    return undefined;
  }

  static sanitize(input: unknown): AccountPolicyRecord[] {
    return sanitizeAccountPolicies(input);
  }

  static canonicalize(input: unknown): AccountPolicyRecord[] {
    return canonicalizeAccountPolicies(input);
  }
}
