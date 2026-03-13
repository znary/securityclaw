import type { HookControls, HookName, SafeClawConfig } from "../types.ts";

const DEFAULT_HOOKS: Record<HookName, HookControls> = {
  before_prompt_build: { enabled: true, timeout_ms: 50, fail_mode: "open" },
  before_tool_call: { enabled: true, timeout_ms: 50, fail_mode: "close" },
  after_tool_call: { enabled: true, timeout_ms: 50, fail_mode: "open" },
  tool_result_persist: { enabled: true, timeout_ms: 50, fail_mode: "close" },
  message_sending: { enabled: true, timeout_ms: 50, fail_mode: "open" }
};

export function validateConfig(raw: Record<string, unknown>): SafeClawConfig {
  if (!raw || typeof raw !== "object") {
    throw new Error("Config must be an object.");
  }

  const config = raw as Partial<SafeClawConfig>;
  if (!config.version || !config.policy_version || !config.environment) {
    throw new Error("Config must define version, policy_version, and environment.");
  }

  const hooks = { ...DEFAULT_HOOKS, ...(config.hooks ?? {}) };
  const risk = config.risk;
  if (!risk) {
    throw new Error("Config must define risk thresholds.");
  }
  if (
    typeof risk.base_score !== "number" ||
    typeof risk.warn_threshold !== "number" ||
    typeof risk.challenge_threshold !== "number" ||
    typeof risk.block_threshold !== "number"
  ) {
    throw new Error("Risk thresholds must be numbers.");
  }

  const policies = Array.isArray(config.policies) ? config.policies : [];
  for (const rule of policies) {
    if (!rule.rule_id || typeof rule.priority !== "number") {
      throw new Error("Every policy must define rule_id and priority.");
    }
  }

  const dlp = config.dlp;
  if (!dlp || !Array.isArray(dlp.patterns) || !dlp.on_dlp_hit) {
    throw new Error("DLP config must define patterns and on_dlp_hit.");
  }

  return {
    version: config.version,
    policy_version: config.policy_version,
    environment: config.environment,
    defaults: {
      approval_ttl_seconds: config.defaults?.approval_ttl_seconds ?? 900,
      persist_mode: config.defaults?.persist_mode ?? "compat"
    },
    hooks,
    risk: {
      base_score: risk.base_score,
      warn_threshold: risk.warn_threshold,
      challenge_threshold: risk.challenge_threshold,
      block_threshold: risk.block_threshold,
      tags: risk.tags ?? {},
      tools: risk.tools ?? {},
      scopes: risk.scopes ?? {},
      identities: risk.identities ?? {}
    },
    policies,
    dlp: {
      on_dlp_hit: dlp.on_dlp_hit,
      patterns: dlp.patterns
    },
    event_sink: {
      webhook_url: config.event_sink?.webhook_url,
      timeout_ms: config.event_sink?.timeout_ms ?? 3000,
      max_buffer: config.event_sink?.max_buffer ?? 100,
      retry_limit: config.event_sink?.retry_limit ?? 3
    }
  };
}
