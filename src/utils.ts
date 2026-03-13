import { randomUUID } from "node:crypto";

export function deepClone<T>(value: T): T {
  return structuredClone(value);
}

export function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object") {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      if (child && typeof child === "object" && !Object.isFrozen(child)) {
        deepFreeze(child);
      }
    }
  }
  return value;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function nowIso(now: () => number): string {
  return new Date(now()).toISOString();
}

export function generateTraceId(): string {
  return randomUUID();
}

export function ensureArray<T>(value?: T[]): T[] {
  return Array.isArray(value) ? value : [];
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  const timeout = new Promise<T>((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
  return Promise.race([promise, timeout]);
}

export function stripInlineComment(line: string): string {
  let quoted = false;
  let quoteChar = "";
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if ((char === "'" || char === "\"") && line[index - 1] !== "\\") {
      if (!quoted) {
        quoted = true;
        quoteChar = char;
      } else if (quoteChar === char) {
        quoted = false;
      }
      continue;
    }
    if (char === "#" && !quoted) {
      return line.slice(0, index).trimEnd();
    }
  }
  return line.trimEnd();
}

export function parseScalar(raw: string): unknown {
  const value = raw.trim();
  if (value === "true") {
    return true;
  }
  if (value === "false") {
    return false;
  }
  if (value === "null") {
    return null;
  }
  if (/^-?\d+(\.\d+)?$/.test(value)) {
    return Number(value);
  }
  if (
    value.startsWith("\"") && value.endsWith("\"")
  ) {
    return JSON.parse(value);
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replaceAll("''", "'");
  }
  if (value.startsWith("[") && value.endsWith("]")) {
    const inner = value.slice(1, -1).trim();
    if (inner === "") {
      return [];
    }
    return inner.split(",").map((part) => parseScalar(part));
  }
  return value;
}
