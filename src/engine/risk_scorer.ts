import type { DecisionContext, RiskWeights } from "../types.ts";
import { clamp } from "../utils.ts";

export class RiskScorer {
  readonly weights: RiskWeights;

  constructor(weights: RiskWeights) {
    this.weights = weights;
  }

  score(context: DecisionContext): number {
    let total = this.weights.base_score;
    total += this.weights.identities[context.actor_id] ?? 0;
    total += this.weights.scopes[context.scope] ?? 0;
    if (context.tool_name) {
      total += this.weights.tools[context.tool_name] ?? 0;
    }
    for (const tag of context.tags) {
      total += this.weights.tags[tag] ?? 0;
    }
    if (context.security_context.untrusted) {
      total += this.weights.tags.untrusted ?? 0;
    }
    return clamp(total, 0, 100);
  }
}
