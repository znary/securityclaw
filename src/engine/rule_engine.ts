import type { DecisionContext, PolicyRule, RuleMatch } from "../types.ts";
import { ensureArray } from "../utils.ts";

function intersects(targets: string[] | undefined, value: string): boolean {
  return !targets || targets.length === 0 || targets.includes(value);
}

function includesAll(targets: string[] | undefined, values: string[]): boolean {
  return !targets || targets.length === 0 || targets.some((target) => values.includes(target));
}

function matchesPathPrefixes(prefixes: string[] | undefined, paths: string[]): boolean {
  if (!prefixes || prefixes.length === 0) {
    return true;
  }
  if (paths.length === 0) {
    return false;
  }
  return prefixes.some((prefix) => paths.some((candidate) => candidate.startsWith(prefix)));
}

function precedence(rule: PolicyRule): number {
  let score = 1;
  if (ensureArray(rule.match.identity).length > 0) {
    score += 4;
  }
  if (ensureArray(rule.match.scope).length > 0) {
    score += 2;
  }
  if (ensureArray(rule.match.resource_scope).length > 0 || ensureArray(rule.match.path_prefix).length > 0) {
    score += 1;
  }
  return score;
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
          includesAll(rule.match.tags, context.tags) &&
          intersects(rule.match.resource_scope, context.resource_scope) &&
          matchesPathPrefixes(rule.match.path_prefix, context.resource_paths)
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
