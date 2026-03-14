import type { DecisionContext, DecisionOutcome, RuleMatch, SafeClawConfig } from "../types.ts";

export class DecisionEngine {
  readonly config: SafeClawConfig;

  constructor(config: SafeClawConfig) {
    this.config = config;
  }

  evaluate(_context: DecisionContext, matches: RuleMatch[]): DecisionOutcome {
    const decisiveRule = matches.find((match) => Boolean(match.rule.decision));

    if (decisiveRule?.rule.decision) {
      return {
        decision: decisiveRule.rule.decision,
        decision_source: "rule",
        reason_codes: decisiveRule.rule.reason_codes,
        matched_rules: matches.map((match) => match.rule),
        challenge_ttl_seconds:
          decisiveRule.rule.decision === "challenge"
            ? decisiveRule.rule.challenge?.ttl_seconds ?? this.config.defaults.approval_ttl_seconds
            : undefined
      };
    }

    return {
      decision: "allow",
      decision_source: "default",
      reason_codes: ["NO_MATCH_DEFAULT_ALLOW"],
      matched_rules: matches.map((match) => match.rule)
    };
  }
}
