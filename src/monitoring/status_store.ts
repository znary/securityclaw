import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

type Decision = "allow" | "warn" | "challenge" | "block";

type HookCounter = {
  total: number;
  allow: number;
  warn: number;
  challenge: number;
  block: number;
  last_ts?: string;
  last_tool?: string;
  last_scope?: string;
};

export type StatusRecord = {
  ts: string;
  hook: string;
  trace_id: string;
  actor?: string;
  scope?: string;
  tool?: string;
  decision: Decision;
  risk?: number;
  reasons: string[];
  rules?: string;
};

type RuntimeStatus = {
  updated_at: string;
  started_at: string;
  config: {
    environment: string;
    policy_version: string;
    policy_count: number;
    config_path: string;
    override_path: string;
    override_loaded: boolean;
  };
  hooks: Record<string, HookCounter>;
  recent_decisions: StatusRecord[];
};

const DEFAULT_HOOKS = [
  "before_prompt_build",
  "before_tool_call",
  "after_tool_call",
  "tool_result_persist",
  "before_message_write",
  "message_sending"
];

function createHookCounter(): HookCounter {
  return {
    total: 0,
    allow: 0,
    warn: 0,
    challenge: 0,
    block: 0
  };
}

function createEmptyStatus(): RuntimeStatus {
  const hooks: Record<string, HookCounter> = {};
  for (const hook of DEFAULT_HOOKS) {
    hooks[hook] = createHookCounter();
  }
  return {
    updated_at: new Date().toISOString(),
    started_at: new Date().toISOString(),
    config: {
      environment: "unknown",
      policy_version: "unknown",
      policy_count: 0,
      config_path: "",
      override_path: "",
      override_loaded: false
    },
    hooks,
    recent_decisions: []
  };
}

function safeReadStatus(filePath: string): RuntimeStatus {
  if (!existsSync(filePath)) {
    return createEmptyStatus();
  }
  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8")) as RuntimeStatus;
    if (!parsed || typeof parsed !== "object") {
      return createEmptyStatus();
    }
    return parsed;
  } catch {
    return createEmptyStatus();
  }
}

export class RuntimeStatusStore {
  #path: string;
  #maxRecent: number;
  #status: RuntimeStatus;

  constructor(statusPath: string, maxRecent = 80) {
    this.#path = statusPath;
    this.#maxRecent = maxRecent;
    mkdirSync(path.dirname(statusPath), { recursive: true });
    this.#status = safeReadStatus(statusPath);
  }

  markBoot(config: RuntimeStatus["config"]): void {
    try {
      this.#status = {
        ...this.#status,
        updated_at: new Date().toISOString(),
        started_at: new Date().toISOString(),
        config,
        hooks: Object.fromEntries(DEFAULT_HOOKS.map((hook) => [hook, createHookCounter()])),
        recent_decisions: []
      };
      this.#flush();
    } catch {
      // Swallow status persistence errors to avoid impacting guard execution.
    }
  }

  recordDecision(record: StatusRecord): void {
    try {
      const hooks = { ...this.#status.hooks };
      const next = hooks[record.hook] ?? createHookCounter();
      next.total += 1;
      next[record.decision] += 1;
      next.last_ts = record.ts;
      next.last_tool = record.tool;
      next.last_scope = record.scope;
      hooks[record.hook] = next;

      const recent = [record, ...this.#status.recent_decisions].slice(0, this.#maxRecent);
      this.#status = {
        ...this.#status,
        updated_at: new Date().toISOString(),
        hooks,
        recent_decisions: recent
      };
      this.#flush();
    } catch {
      // Swallow status persistence errors to avoid impacting guard execution.
    }
  }

  #flush(): void {
    writeFileSync(this.#path, `${JSON.stringify(this.#status, null, 2)}\n`, "utf8");
  }
}
