import type { Decision, DecisionContext, DecisionOutcome, RuleMatch, SafeClawConfig } from "../types.ts";

const RISK_REASON: Record<Decision, string> = {
  allow: "RISK_ALLOW",
  warn: "RISK_WARN_THRESHOLD",
  challenge: "RISK_CHALLENGE_THRESHOLD",
  block: "RISK_BLOCK_THRESHOLD"
};

export class DecisionEngine {
  readonly config: SafeClawConfig;

  constructor(config: SafeClawConfig) {
    this.config = config;
  }

  evaluate(context: DecisionContext, riskScore: number, matches: RuleMatch[]): DecisionOutcome {
    const decisiveRule = matches.find((match) => {
      if (match.rule.risk_threshold === undefined) {
        return Boolean(match.rule.decision);
      }
      return riskScore >= match.rule.risk_threshold && Boolean(match.rule.decision);
    });

    if (decisiveRule?.rule.decision) {
      return {
        decision: decisiveRule.rule.decision,
        reason_codes: decisiveRule.rule.reason_codes,
        risk_score: riskScore,
        matched_rules: matches.map((match) => match.rule),
        challenge_ttl_seconds:
          decisiveRule.rule.decision === "challenge"
            ? decisiveRule.rule.challenge?.ttl_seconds ?? this.config.defaults.approval_ttl_seconds
            : undefined
      };
    }

    const decision = this.fromRisk(riskScore);
    return {
      decision,
      reason_codes: [RISK_REASON[decision]],
      risk_score: riskScore,
      matched_rules: matches.map((match) => match.rule),
      challenge_ttl_seconds:
        decision === "challenge" ? this.config.defaults.approval_ttl_seconds : undefined
    };
  }

  fromRisk(score: number): Decision {
    if (score >= this.config.risk.block_threshold) {
      return "block";
    }
    if (score >= this.config.risk.challenge_threshold) {
      return "challenge";
    }
    if (score >= this.config.risk.warn_threshold) {
      return "warn";
    }
    return "allow";
  }
}
