import os from "node:os";
import path from "node:path";

import type { Decision, FileRule } from "../../types.ts";

const VALID_DECISIONS = new Set<Decision>(["allow", "warn", "challenge", "block"]);

function trimmedString(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeDirectoryPath(value: string): string | undefined {
  let normalized = value.trim();
  if (!normalized) {
    return undefined;
  }
  if (normalized === "~") {
    normalized = os.homedir();
  } else if (normalized.startsWith("~/")) {
    normalized = path.join(os.homedir(), normalized.slice(2));
  }
  if (!path.isAbsolute(normalized)) {
    return undefined;
  }

  const normalizedPath = path.normalize(normalized);
  const root = path.parse(normalizedPath).root;
  if (normalizedPath === root) {
    return normalizedPath;
  }
  return normalizedPath.replace(/[\\/]+$/, "");
}

function normalizedPathForCompare(value: string): string {
  const normalized = path.normalize(value);
  if (process.platform === "win32" || process.platform === "darwin") {
    return normalized.toLowerCase();
  }
  return normalized;
}

function isPathInsideDirectory(rootDir: string, candidate: string): boolean {
  const relative = path.relative(rootDir, candidate);
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function normalizeDecision(value: unknown): Decision | undefined {
  if (typeof value !== "string") {
    return undefined;
  }
  return VALID_DECISIONS.has(value as Decision) ? (value as Decision) : undefined;
}

function normalizeReasonCodes(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => trimmedString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
}

function sortRules(rules: FileRule[]): FileRule[] {
  return [...rules].sort((left, right) => {
    const byDirectory = normalizedPathForCompare(left.directory).localeCompare(normalizedPathForCompare(right.directory));
    if (byDirectory !== 0) {
      return byDirectory;
    }
    return left.id.localeCompare(right.id);
  });
}

export function defaultFileRuleReasonCode(decision: Decision): string {
  if (decision === "allow") {
    return "USER_FILE_RULE_ALLOW";
  }
  if (decision === "warn") {
    return "USER_FILE_RULE_WARN";
  }
  if (decision === "challenge") {
    return "USER_FILE_RULE_CHALLENGE";
  }
  return "USER_FILE_RULE_BLOCK";
}

export function normalizeFileRule(value: unknown): FileRule | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const id = trimmedString(record.id);
  const directory = trimmedString(record.directory);
  const decision = normalizeDecision(record.decision);
  const reasonCodes = normalizeReasonCodes(record.reason_codes);
  const updatedAt = trimmedString(record.updated_at);
  const normalizedDirectory = directory ? normalizeDirectoryPath(directory) : undefined;
  if (!id || !normalizedDirectory || !decision) {
    return undefined;
  }

  return {
    id,
    directory: normalizedDirectory,
    decision,
    ...(reasonCodes ? { reason_codes: reasonCodes } : {}),
    ...(updatedAt ? { updated_at: updatedAt } : {}),
  };
}

export function normalizeFileRules(value: unknown): FileRule[] {
  if (!Array.isArray(value)) {
    return [];
  }
  const dedupedByDirectory = new Map<string, FileRule>();
  value.forEach((entry) => {
    const normalized = normalizeFileRule(entry);
    if (!normalized) {
      return;
    }
    dedupedByDirectory.set(normalizedPathForCompare(normalized.directory), normalized);
  });
  return sortRules(Array.from(dedupedByDirectory.values()));
}

export function matchFileRule(resourcePaths: string[], rules: FileRule[]): FileRule | undefined {
  if (!rules.length || !resourcePaths.length) {
    return undefined;
  }

  const normalizedPaths = resourcePaths
    .map((entry) => normalizeDirectoryPath(entry))
    .filter((entry): entry is string => Boolean(entry));
  if (!normalizedPaths.length) {
    return undefined;
  }

  const matches: FileRule[] = [];
  rules.forEach((rule) => {
    const normalizedDirectory = normalizeDirectoryPath(rule.directory);
    if (!normalizedDirectory) {
      return;
    }
    const matched = normalizedPaths.some((candidate) => isPathInsideDirectory(normalizedDirectory, candidate));
    if (matched) {
      matches.push({ ...rule, directory: normalizedDirectory });
    }
  });

  if (!matches.length) {
    return undefined;
  }

  matches.sort((left, right) => {
    const leftDepth = left.directory.split(path.sep).length;
    const rightDepth = right.directory.split(path.sep).length;
    if (rightDepth !== leftDepth) {
      return rightDepth - leftDepth;
    }
    const byDirectory = normalizedPathForCompare(left.directory).localeCompare(normalizedPathForCompare(right.directory));
    if (byDirectory !== 0) {
      return byDirectory;
    }
    return left.id.localeCompare(right.id);
  });
  return matches[0];
}
