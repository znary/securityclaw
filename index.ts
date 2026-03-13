import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  OpenClawPluginApi,
  PluginHookAgentContext,
  PluginHookBeforeMessageWriteEvent,
  PluginHookBeforePromptBuildEvent,
  PluginHookBeforePromptBuildResult,
  PluginHookBeforeToolCallEvent,
  PluginHookBeforeToolCallResult,
  PluginHookMessageSendingEvent,
  PluginHookMessageSendingResult,
  PluginHookToolContext,
  PluginHookToolResultPersistEvent,
  PluginHookToolResultPersistResult
} from "openclaw/plugin-sdk";

import { ConfigManager } from "./src/config/loader.ts";
import { DecisionEngine } from "./src/engine/decision_engine.ts";
import { DlpEngine } from "./src/engine/dlp_engine.ts";
import { RiskScorer } from "./src/engine/risk_scorer.ts";
import { RuleEngine } from "./src/engine/rule_engine.ts";
import { EventEmitter, HttpEventSink } from "./src/events/emitter.ts";
import type {
  DecisionContext,
  DlpFinding,
  PolicyRule,
  SafeClawConfig,
  SecurityDecisionEvent
} from "./src/types.ts";
import { deepClone } from "./src/utils.ts";

type SafeClawPluginConfig = {
  configPath?: string;
  webhookUrl?: string;
  policyVersion?: string;
  environment?: string;
  approvalTtlSeconds?: number;
  persistMode?: "strict" | "compat";
};

const PLUGIN_ROOT = path.dirname(fileURLToPath(import.meta.url));

function resolveScope(ctx: { workspaceDir?: string; channelId?: string }): string {
  if (ctx.workspaceDir) {
    return path.basename(ctx.workspaceDir);
  }
  return ctx.channelId ?? "default";
}

function toSecurityConfig(api: OpenClawPluginApi): SafeClawConfig {
  const pluginConfig = (api.pluginConfig ?? {}) as SafeClawPluginConfig;
  const configPath = pluginConfig.configPath
    ? path.isAbsolute(pluginConfig.configPath)
      ? pluginConfig.configPath
      : path.resolve(PLUGIN_ROOT, pluginConfig.configPath)
    : path.resolve(PLUGIN_ROOT, "./config/policy.default.yaml");
  const base = ConfigManager.fromFile(configPath).getConfig();
  return {
    ...base,
    policy_version: pluginConfig.policyVersion ?? base.policy_version,
    environment: pluginConfig.environment ?? base.environment,
    defaults: {
      ...base.defaults,
      approval_ttl_seconds: pluginConfig.approvalTtlSeconds ?? base.defaults.approval_ttl_seconds,
      persist_mode: pluginConfig.persistMode ?? base.defaults.persist_mode
    },
    event_sink: {
      ...base.event_sink,
      webhook_url: pluginConfig.webhookUrl ?? base.event_sink.webhook_url
    }
  };
}

function createEventEmitter(config: SafeClawConfig): EventEmitter {
  const sink = config.event_sink.webhook_url
    ? new HttpEventSink(config.event_sink.webhook_url, config.event_sink.timeout_ms)
    : undefined;
  return new EventEmitter(sink, config.event_sink.max_buffer, config.event_sink.retry_limit);
}

function buildDecisionContext(
  api: OpenClawPluginApi,
  ctx: PluginHookToolContext | PluginHookAgentContext,
  toolName?: string,
  tags: string[] = [],
): DecisionContext {
  const workspace = "workspaceDir" in ctx ? ctx.workspaceDir : undefined;
  return {
    actor_id: ctx.agentId ?? "unknown-agent",
    scope: resolveScope({ workspaceDir: workspace, channelId: "channelId" in ctx ? ctx.channelId : undefined }),
    tool_name: toolName,
    tags,
    security_context: {
      trace_id: ctx.runId ?? ctx.sessionId ?? ctx.sessionKey ?? `trace-${Date.now()}`,
      actor_id: ctx.agentId ?? "unknown-agent",
      workspace: workspace ?? "unknown-workspace",
      policy_version: api.id,
      untrusted: false,
      tags,
      created_at: new Date().toISOString()
    }
  };
}

function findingsToText(findings: DlpFinding[]): string {
  return findings.map((finding) => `${finding.pattern_name}@${finding.path}`).join(", ");
}

function emitEvent(
  emitter: EventEmitter,
  event: SecurityDecisionEvent,
  logger: OpenClawPluginApi["logger"],
): void {
  void emitter.emitSecurityEvent(event).catch((error) => {
    logger.warn?.(`safeclaw: failed to emit event (${String(error)})`);
  });
}

function createEvent(
  traceId: string,
  hook:
    | "before_prompt_build"
    | "before_tool_call"
    | "after_tool_call"
    | "tool_result_persist"
    | "message_sending",
  decision: "allow" | "warn" | "challenge" | "block",
  reasonCodes: string[],
  riskScore: number,
): SecurityDecisionEvent {
  return {
    schema_version: "1.0",
    event_type: "SecurityDecisionEvent",
    trace_id: traceId,
    hook,
    decision,
    reason_codes: reasonCodes,
    risk_score: riskScore,
    latency_ms: 0,
    ts: new Date().toISOString()
  };
}

function sanitizeUnknown<T>(dlpEngine: DlpEngine, value: T): { value: T; findings: DlpFinding[] } {
  const findings = dlpEngine.scan(value);
  if (findings.length === 0) {
    return { value, findings };
  }
  return {
    value: dlpEngine.sanitize(value, findings, "sanitize"),
    findings
  };
}

const plugin = {
  id: "safeclaw",
  name: "SafeClaw Security",
  description: "Runtime policy enforcement, transcript sanitization, and audit events for OpenClaw.",
  register(api: OpenClawPluginApi) {
    const config = toSecurityConfig(api);
    const emitter = createEventEmitter(config);
    const ruleEngine = new RuleEngine(config.policies);
    const riskScorer = new RiskScorer(config.risk);
    const decisionEngine = new DecisionEngine(config);
    const dlpEngine = new DlpEngine(config.dlp);

    api.on(
      "before_prompt_build",
      async (event: PluginHookBeforePromptBuildEvent, ctx: PluginHookAgentContext): Promise<PluginHookBeforePromptBuildResult> => {
        const traceId = ctx.runId ?? ctx.sessionId ?? ctx.sessionKey ?? `trace-${Date.now()}`;
        const scope = resolveScope({ workspaceDir: ctx.workspaceDir, channelId: ctx.channelId });
        const prependSystemContext = [
          "[SafeClaw Security Context]",
          `trace_id=${traceId}`,
          `agent_id=${ctx.agentId ?? "unknown-agent"}`,
          `scope=${scope}`,
          `policy_version=${config.policy_version}`
        ].join("\n");
        emitEvent(
          emitter,
          createEvent(traceId, "before_prompt_build", "allow", ["SECURITY_CONTEXT_INJECTED"], 0),
          api.logger,
        );
        return { prependSystemContext };
      },
      { priority: 100 },
    );

    api.on(
      "before_tool_call",
      async (
        event: PluginHookBeforeToolCallEvent,
        ctx: PluginHookToolContext,
      ): Promise<PluginHookBeforeToolCallResult | void> => {
        const decisionContext = buildDecisionContext(api, ctx, event.toolName);
        const matches = ruleEngine.match(decisionContext);
        const riskScore = riskScorer.score(decisionContext);
        const outcome = decisionEngine.evaluate(decisionContext, riskScore, matches);
        const traceId = decisionContext.security_context.trace_id;

        if (outcome.decision === "warn") {
          api.logger.warn?.(
            `safeclaw: warn tool=${event.toolName} reasons=${outcome.reason_codes.join(",")}`,
          );
        }

        emitEvent(
          emitter,
          createEvent(traceId, "before_tool_call", outcome.decision, outcome.reason_codes, outcome.risk_score),
          api.logger,
        );

        if (outcome.decision === "block" || outcome.decision === "challenge") {
          return {
            block: true,
            blockReason:
              outcome.decision === "challenge"
                ? `SafeClaw approval required: ${outcome.reason_codes.join(", ")}`
                : `SafeClaw blocked tool call: ${outcome.reason_codes.join(", ")}`
          };
        }

        return undefined;
      },
      { priority: 100 },
    );

    api.on("after_tool_call", async (event, ctx) => {
      const decisionContext = buildDecisionContext(api, ctx, event.toolName);
      const traceId = decisionContext.security_context.trace_id;
      const findings = dlpEngine.scan(event.result);
      const decision =
        findings.length === 0 ? "allow" : config.dlp.on_dlp_hit === "block" ? "block" : "warn";
      if (findings.length > 0) {
        api.logger.warn?.(
          `safeclaw: after_tool_call findings tool=${event.toolName} findings=${findingsToText(findings)}`,
        );
      }
      emitEvent(
        emitter,
        createEvent(
          traceId,
          "after_tool_call",
          decision,
          findings.length > 0 ? ["DLP_HIT"] : ["RESULT_OK"],
          findings.length * 20,
        ),
        api.logger,
      );
    });

    api.on(
      "tool_result_persist",
      (event: PluginHookToolResultPersistEvent): PluginHookToolResultPersistResult | void => {
        const traceId = event.toolCallId ?? event.toolName ?? `trace-${Date.now()}`;
        const sanitized = sanitizeUnknown(dlpEngine, event.message);
        if (sanitized.findings.length === 0) {
          emitEvent(
            emitter,
            createEvent(traceId, "tool_result_persist", "allow", ["PERSIST_OK"], 0),
            api.logger,
          );
          return undefined;
        }
        emitEvent(
          emitter,
          createEvent(
            traceId,
            "tool_result_persist",
            config.defaults.persist_mode === "strict" ? "block" : "warn",
            ["PERSIST_SANITIZED"],
            sanitized.findings.length * 25,
          ),
          api.logger,
        );
        return { message: sanitized.value };
      },
      { priority: 100 },
    );

    api.on(
      "before_message_write",
      (event: PluginHookBeforeMessageWriteEvent) => {
        if (config.defaults.persist_mode !== "strict") {
          return undefined;
        }
        const findings = dlpEngine.scan(event.message);
        if (findings.length === 0) {
          return undefined;
        }
        return { block: true };
      },
      { priority: 100 },
    );

    api.on(
      "message_sending",
      async (event: PluginHookMessageSendingEvent, ctx): Promise<PluginHookMessageSendingResult | void> => {
        const traceId = ctx.conversationId ?? ctx.accountId ?? `trace-${Date.now()}`;
        const sanitized = sanitizeUnknown(dlpEngine, event.content);
        if (sanitized.findings.length === 0) {
          emitEvent(
            emitter,
            createEvent(traceId, "message_sending", "allow", ["MESSAGE_OK"], 0),
            api.logger,
          );
          return undefined;
        }
        const decision = config.dlp.on_dlp_hit === "block" ? "block" : "warn";
        emitEvent(
          emitter,
          createEvent(traceId, "message_sending", decision, ["MESSAGE_SANITIZED"], sanitized.findings.length * 20),
          api.logger,
        );
        if (config.dlp.on_dlp_hit === "block") {
          return { cancel: true };
        }
        return { content: sanitized.value as string };
      },
      { priority: 100 },
    );

    api.logger.info?.(`safeclaw: loaded policy_version=${config.policy_version}`);
  }
};

export default plugin;
