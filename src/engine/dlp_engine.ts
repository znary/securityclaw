import type { DlpConfig, DlpFinding } from "../types.ts";
import { deepClone } from "../utils.ts";

function visit(value: unknown, path: string, onString: (text: string, path: string) => void): void {
  if (typeof value === "string") {
    onString(value, path);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(entry, `${path}[${index}]`, onString));
    return;
  }
  if (value && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) {
      visit(child, `${path}.${key}`, onString);
    }
  }
}

export class DlpEngine {
  readonly config: DlpConfig;

  constructor(config: DlpConfig) {
    this.config = config;
  }

  scan(content: unknown): DlpFinding[] {
    const findings: DlpFinding[] = [];
    visit(content, "root", (text, path) => {
      for (const pattern of this.config.patterns) {
        const flags = pattern.flags?.includes("g") ? pattern.flags : `${pattern.flags ?? ""}g`;
        const regex = new RegExp(pattern.regex, flags);
        const matches = text.matchAll(regex);
        for (const match of matches) {
          findings.push({
            pattern_name: pattern.name,
            type: pattern.type,
            action: pattern.action,
            path,
            match: match[0]
          });
        }
      }
    });
    return findings;
  }

  sanitize<T>(content: T, findings: DlpFinding[], mode = this.config.on_dlp_hit): T {
    if (mode === "warn") {
      return deepClone(content);
    }
    const cloned = deepClone(content) as unknown;
    return this.#sanitizeNode(cloned, "root", findings) as T;
  }

  #sanitizeNode(node: unknown, path: string, findings: DlpFinding[]): unknown {
    const nodeFindings = findings.filter((finding) => finding.path === path);
    if (typeof node === "string") {
      if (nodeFindings.length === 0) {
        return node;
      }
      let next = node;
      for (const finding of nodeFindings) {
        if (finding.action === "remove") {
          return undefined;
        }
        next = next.split(finding.match).join("[REDACTED]");
      }
      return next;
    }

    if (Array.isArray(node)) {
      return node
        .map((entry, index) => this.#sanitizeNode(entry, `${path}[${index}]`, findings))
        .filter((entry) => entry !== undefined);
    }

    if (node && typeof node === "object") {
      const copy: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(node)) {
        const next = this.#sanitizeNode(value, `${path}.${key}`, findings);
        if (next !== undefined) {
          copy[key] = next;
        }
      }
      return copy;
    }

    return node;
  }
}
