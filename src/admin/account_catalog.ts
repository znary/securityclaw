import { AccountPolicyEngine } from "../domain/services/account_policy_engine.ts";
import type { AccountPolicyRecord } from "../types.ts";
import type { OpenClawChatSession } from "./openclaw_session_catalog.ts";

export const DEFAULT_MAIN_ADMIN_SESSION_KEY = "agent:main:main";

function isDefaultMainSession(session: OpenClawChatSession | AccountPolicyRecord): boolean {
  return session.session_key === DEFAULT_MAIN_ADMIN_SESSION_KEY || session.subject === DEFAULT_MAIN_ADMIN_SESSION_KEY;
}

export function createAccountPolicyDraftFromSession(
  session: OpenClawChatSession | undefined,
  subject: string,
): AccountPolicyRecord {
  if (!session) {
    return {
      subject,
      mode: "apply_rules",
      is_admin: false,
    };
  }
  return {
    subject: session.subject,
    mode: "apply_rules",
    is_admin: false,
    ...(session.label ? { label: session.label } : {}),
    ...(session.session_key ? { session_key: session.session_key } : {}),
    ...(session.session_id ? { session_id: session.session_id } : {}),
    ...(session.agent_id ? { agent_id: session.agent_id } : {}),
    ...(session.channel ? { channel: session.channel } : {}),
    ...(session.chat_type ? { chat_type: session.chat_type } : {}),
  };
}

function createAccountDisplayEntry(
  session: OpenClawChatSession | undefined,
  policy: AccountPolicyRecord | undefined,
): AccountPolicyRecord {
  const subject = policy?.subject ?? session?.subject ?? "";
  const merged: AccountPolicyRecord = {
    ...(session ? createAccountPolicyDraftFromSession(session, session.subject) : {
      subject,
      mode: policy?.mode === "default_allow" ? "default_allow" : "apply_rules",
      is_admin: policy?.is_admin === true,
    }),
    ...(policy ?? {}),
    subject,
    mode: policy?.mode === "default_allow" ? "default_allow" : "apply_rules",
    is_admin: policy?.is_admin === true,
  };
  const updatedAt = policy?.updated_at ?? session?.updated_at;
  if (updatedAt) {
    merged.updated_at = updatedAt;
  }
  return merged;
}

export function mergeAccountPoliciesWithSessions(
  policies: unknown,
  sessions: OpenClawChatSession[],
): AccountPolicyRecord[] {
  const normalizedPolicies = AccountPolicyEngine.sanitize(policies);
  const policyBySubject = new Map(normalizedPolicies.map((policy) => [policy.subject, policy]));
  const sessionOrder = new Map(sessions.map((session, index) => [session.subject, index]));
  const merged: AccountPolicyRecord[] = [];

  for (const session of sessions) {
    merged.push(createAccountDisplayEntry(session, policyBySubject.get(session.subject)));
    policyBySubject.delete(session.subject);
  }

  for (const policy of policyBySubject.values()) {
    merged.push(createAccountDisplayEntry(undefined, policy));
  }

  return merged.sort((left, right) => {
    const leftMain = isDefaultMainSession(left) ? 0 : 1;
    const rightMain = isDefaultMainSession(right) ? 0 : 1;
    if (leftMain !== rightMain) {
      return leftMain - rightMain;
    }

    const leftOrder = sessionOrder.get(left.subject) ?? Number.MAX_SAFE_INTEGER;
    const rightOrder = sessionOrder.get(right.subject) ?? Number.MAX_SAFE_INTEGER;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }

    return left.subject.localeCompare(right.subject);
  });
}

export function ensureDefaultAdminAccount(
  policies: unknown,
  sessions: OpenClawChatSession[],
  nowIso = new Date().toISOString(),
): AccountPolicyRecord[] {
  const normalizedPolicies = AccountPolicyEngine.sanitize(policies);
  if (normalizedPolicies.some((policy) => policy.is_admin)) {
    return normalizedPolicies;
  }

  const mainSession = sessions.find((session) => isDefaultMainSession(session));
  if (!mainSession) {
    return normalizedPolicies;
  }

  const existing = normalizedPolicies.find((policy) => policy.subject === mainSession.subject);
  if (existing) {
    return normalizedPolicies.map((policy) =>
      policy.subject === mainSession.subject
        ? {
            ...policy,
            is_admin: true,
            updated_at: nowIso,
          }
        : policy,
    );
  }

  return [
    ...normalizedPolicies,
    {
      ...createAccountPolicyDraftFromSession(mainSession, mainSession.subject),
      is_admin: true,
      updated_at: nowIso,
    },
  ];
}

export function isAccountPolicyOverride(policy: AccountPolicyRecord): boolean {
  return policy.is_admin === true || policy.mode === "default_allow";
}

export function pruneAccountPolicyOverrides(input: unknown): AccountPolicyRecord[] {
  return AccountPolicyEngine.sanitize(input).filter(isAccountPolicyOverride);
}
