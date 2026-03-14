import http from "node:http";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { ConfigManager } from "../src/config/loader.ts";
import {
  applyRuntimeOverride,
  readRuntimeOverride,
  writeRuntimeOverride,
  type RuntimeOverride
} from "../src/config/runtime_override.ts";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC_DIR = path.resolve(ROOT, "admin/public");
const PORT = Number(process.env.SAFECLAW_ADMIN_PORT ?? 4780);
const CONFIG_PATH = process.env.SAFECLAW_CONFIG_PATH ?? path.resolve(ROOT, "config/policy.default.yaml");
const OVERRIDE_PATH = process.env.SAFECLAW_OVERRIDE_PATH ?? path.resolve(ROOT, "config/policy.overrides.json");
const STATUS_PATH = process.env.SAFECLAW_STATUS_PATH ?? path.resolve(ROOT, "runtime/safeclaw-status.json");

type JsonRecord = Record<string, unknown>;

function sendJson(res: http.ServerResponse, status: number, body: unknown): void {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

function sendText(res: http.ServerResponse, status: number, body: string, contentType = "text/plain; charset=utf-8"): void {
  res.writeHead(status, { "content-type": contentType });
  res.end(body);
}

async function readBody(req: http.IncomingMessage): Promise<JsonRecord> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  if (chunks.length === 0) {
    return {};
  }
  const raw = Buffer.concat(chunks).toString("utf8");
  const parsed = JSON.parse(raw) as unknown;
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("request body must be a JSON object");
  }
  return parsed as JsonRecord;
}

function safeReadStatus(): JsonRecord {
  if (!existsSync(STATUS_PATH)) {
    return {
      message: "status file not found yet",
      status_path: STATUS_PATH
    };
  }
  try {
    return JSON.parse(readFileSync(STATUS_PATH, "utf8")) as JsonRecord;
  } catch {
    return {
      message: "status file exists but cannot be parsed",
      status_path: STATUS_PATH
    };
  }
}

function readEffectivePolicy(): {
  base: ReturnType<ConfigManager["getConfig"]>;
  effective: ReturnType<ConfigManager["getConfig"]>;
  override?: RuntimeOverride;
} {
  const base = ConfigManager.fromFile(CONFIG_PATH).getConfig();
  const override = readRuntimeOverride(OVERRIDE_PATH);
  const effective = override ? applyRuntimeOverride(base, override) : base;
  return { base, effective, override };
}

function summarizeTotals(status: JsonRecord): JsonRecord {
  const hooks = (status.hooks ?? {}) as Record<string, Record<string, number>>;
  let total = 0;
  let block = 0;
  let challenge = 0;
  let warn = 0;
  let allow = 0;
  for (const value of Object.values(hooks)) {
    total += Number(value.total ?? 0);
    block += Number(value.block ?? 0);
    challenge += Number(value.challenge ?? 0);
    warn += Number(value.warn ?? 0);
    allow += Number(value.allow ?? 0);
  }
  return { total, allow, warn, challenge, block };
}

function handleApi(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  if (req.method === "GET" && url.pathname === "/api/status") {
    try {
      const status = safeReadStatus();
      const { effective, override } = readEffectivePolicy();
      sendJson(res, 200, {
        paths: {
          config_path: CONFIG_PATH,
          override_path: OVERRIDE_PATH,
          status_path: STATUS_PATH
        },
        status,
        totals: summarizeTotals(status),
        effective: {
          environment: effective.environment,
          policy_version: effective.policy_version,
          policy_count: effective.policies.length,
          event_sink_enabled: Boolean(effective.event_sink.webhook_url),
          override_loaded: Boolean(override)
        }
      });
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return;
  }

  if (req.method === "GET" && url.pathname === "/api/strategy") {
    try {
      const { effective, override } = readEffectivePolicy();
      sendJson(res, 200, {
        paths: {
          config_path: CONFIG_PATH,
          override_path: OVERRIDE_PATH
        },
        override: override ?? {},
        strategy: {
          environment: effective.environment,
          policy_version: effective.policy_version,
          risk: {
            base_score: effective.risk.base_score,
            warn_threshold: effective.risk.warn_threshold,
            challenge_threshold: effective.risk.challenge_threshold,
            block_threshold: effective.risk.block_threshold
          },
          policies: effective.policies
        }
      });
    } catch (error) {
      sendJson(res, 500, { error: String(error) });
    }
    return;
  }

  if (req.method === "PUT" && url.pathname === "/api/strategy") {
    void (async () => {
      try {
        const body = await readBody(req);
        const current = readRuntimeOverride(OVERRIDE_PATH) ?? {};

        const nextOverride: RuntimeOverride = {
          ...current,
          updated_at: new Date().toISOString(),
          environment:
            typeof body.environment === "string" ? body.environment : current.environment,
          policy_version:
            typeof body.policy_version === "string" ? body.policy_version : current.policy_version,
          risk:
            typeof body.risk === "object" && body.risk !== null
              ? (body.risk as RuntimeOverride["risk"])
              : current.risk,
          policies:
            Array.isArray(body.policies)
              ? (body.policies as RuntimeOverride["policies"])
              : current.policies
        };

        const base = ConfigManager.fromFile(CONFIG_PATH).getConfig();
        const validated = applyRuntimeOverride(base, nextOverride);
        writeRuntimeOverride(OVERRIDE_PATH, nextOverride);

        sendJson(res, 200, {
          ok: true,
          restart_required: true,
          message: "策略已保存到 override 文件。若网关未启用热加载，请重启 openclaw-gateway。",
          effective: {
            environment: validated.environment,
            policy_version: validated.policy_version,
            policy_count: validated.policies.length
          }
        });
      } catch (error) {
        sendJson(res, 400, { ok: false, error: String(error) });
      }
    })();
    return;
  }

  sendJson(res, 404, { error: "not found" });
}

function serveStatic(req: http.IncomingMessage, res: http.ServerResponse, url: URL): void {
  const relative = url.pathname === "/" ? "/index.html" : url.pathname;
  const absolute = path.resolve(PUBLIC_DIR, `.${relative}`);
  if (!absolute.startsWith(PUBLIC_DIR) || !existsSync(absolute)) {
    sendText(res, 404, "Not found");
    return;
  }
  const ext = path.extname(absolute);
  const contentType =
    ext === ".html"
      ? "text/html; charset=utf-8"
      : ext === ".js"
        ? "text/javascript; charset=utf-8"
        : ext === ".css"
          ? "text/css; charset=utf-8"
          : "application/octet-stream";
  sendText(res, 200, readFileSync(absolute, "utf8"), contentType);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    handleApi(req, res, url);
    return;
  }
  serveStatic(req, res, url);
});

server.listen(PORT, () => {
  console.log(`SafeClaw admin listening on http://127.0.0.1:${PORT}`);
  console.log(`Using config: ${CONFIG_PATH}`);
  console.log(`Using override: ${OVERRIDE_PATH}`);
  console.log(`Using status: ${STATUS_PATH}`);
});
