import type { DecisionContext, PolicyRule, RuleMatch } from "../types.ts";
import { ensureArray } from "../utils.ts";

function intersects(targets: string[] | undefined, value: string): boolean {
  return !targets || targets.length === 0 || targets.includes(value);
}

function includesAll(targets: string[] | undefined, values: string[]): boolean {
  return !targets || targets.length === 0 || targets.some((target) => values.includes(target));
}

function precedence(rule: PolicyRule): number {
  if (ensureArray(rule.match.identity).length > 0) {
    return 3;
  }
  if (ensureArray(rule.match.scope).length > 0) {
    return 2;
  }
  return 1;
}

export class RuleEngine {
  readonly rules: PolicyRule[];

  constructor(rules: PolicyRule[]) {
    this.rules = [...rules];
  }

  match(context: DecisionContext): RuleMatch[] {
    const matches = this.rules
      .filter((rule) => {
        if (!rule.enabled) {
          return false;
        }
        return (
          intersects(rule.match.identity, context.actor_id) &&
          intersects(rule.match.scope, context.scope) &&
          intersects(rule.match.tool, context.tool_name ?? "") &&
          includesAll(rule.match.tags, context.tags)
        );
      })
      .map((rule) => ({ rule, precedence: precedence(rule) }));

    matches.sort((left, right) => {
      if (right.precedence !== left.precedence) {
        return right.precedence - left.precedence;
      }
      return right.rule.priority - left.rule.priority;
    });
    return matches;
  }
}
