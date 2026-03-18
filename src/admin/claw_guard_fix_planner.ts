import crypto from "node:crypto";

import type { SecurityClawLocale } from "../i18n/locale.ts";
import { runProcessSync } from "../runtime/process_runner.ts";
import type {
  ClawGuardConfigSnapshot,
  ClawGuardFixPlan,
  ClawGuardRepairChoice,
} from "./claw_guard_types.ts";

const DEFAULT_SANDBOX_IMAGE = "openclaw-sandbox:bookworm-slim";
const DEFAULT_BROWSER_SANDBOX_IMAGE = "openclaw-sandbox-browser:bookworm-slim";
const GUIDED_DISABLE_GROUPS = "disable_groups";
const GUIDED_USE_ALLOWLIST = "use_allowlist";

type ClawGuardEnvironment = {
  sandboxImageReady: boolean;
  browserSandboxImageReady: boolean;
};

type DecodeFindingIdResult = {
  ruleId: string;
  scopeId?: string;
};

function text(locale: SecurityClawLocale, zhText: string, enText: string): string {
  return locale === "zh-CN" ? zhText : enText;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function readString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function readBoolean(value: unknown): boolean | undefined {
  return typeof value === "boolean" ? value : undefined;
}

function decodeFindingId(findingId: string): DecodeFindingIdResult {
  const [ruleId, scopeId] = String(findingId || "").split("::");
  return {
    ruleId,
    ...(scopeId ? { scopeId } : {}),
  };
}

function buildPatchForChannel(channelId: string, value: Record<string, unknown>): Record<string, unknown> {
  return {
    channels: {
      [channelId]: value,
    },
  };
}

function ensureChoice(
  locale: SecurityClawLocale,
  id: string,
  recommended = false,
  disabled = false,
  disabledReason?: string,
): ClawGuardRepairChoice {
  return {
    id,
    label: id === GUIDED_DISABLE_GROUPS
      ? text(locale, "禁用群聊", "Disable Groups")
      : text(locale, "切到 allowlist", "Switch to Allowlist"),
    description: id === GUIDED_DISABLE_GROUPS
      ? text(locale, "直接关闭群聊入口。", "Turn group access off completely.")
      : text(locale, "保留群聊，只允许白名单里的群或成员触发。", "Keep groups enabled, but allow only allowlisted groups or senders."),
    ...(recommended ? { recommended } : {}),
    ...(disabled ? { disabled } : {}),
    ...(disabledReason ? { disabledReason } : {}),
  };
}

function readGuidedChoice(options: Record<string, unknown> | undefined): string {
  const choice = typeof options?.choice === "string" ? options.choice.trim() : "";
  return choice || GUIDED_DISABLE_GROUPS;
}

function hasEffectiveAllowlist(channel: Record<string, unknown>): boolean {
  if (asArray(channel.groupAllowFrom).length > 0) {
    return true;
  }
  const groups = asRecord(channel.groups);
  return Object.entries(groups)
    .filter(([groupId]) => groupId !== "*")
    .some(([, value]) => {
      const entry = asRecord(value);
      return readBoolean(entry.allow) === true || asArray(entry.allowFrom).length > 0;
    });
}

function resolveClawGuardEnvironment(config: Record<string, unknown>): ClawGuardEnvironment {
  const sandbox = asRecord(asRecord(asRecord(config.agents).defaults).sandbox);
  const sandboxImage = readString(asRecord(sandbox.docker).image) || DEFAULT_SANDBOX_IMAGE;
  const browserSandboxImage = readString(asRecord(sandbox.browser).image) || DEFAULT_BROWSER_SANDBOX_IMAGE;

  const hasImage = (image: string): boolean => {
    const result = runProcessSync("docker", ["image", "inspect", image], {
      encoding: "utf8",
      stdio: "pipe",
      timeout: 8000,
      windowsHide: true,
    });
    return !result.error && result.status === 0;
  };

  return {
    sandboxImageReady: hasImage(sandboxImage),
    browserSandboxImageReady: hasImage(browserSandboxImage),
  };
}

function formatPatchPreview(patch: Record<string, unknown> | null): string {
  return patch ? JSON.stringify(patch, null, 2) : "";
}

function finalizePlan(
  plan: ClawGuardFixPlan,
  snapshot: ClawGuardConfigSnapshot,
  locale: SecurityClawLocale,
): ClawGuardFixPlan {
  if (snapshot.writeSupported) {
    return plan;
  }

  return {
    ...plan,
    canApply: false,
    applyDisabledReason:
      snapshot.writeReason
      || text(
        locale,
        "当前是只读模式。请按下方建议手动修改 OpenClaw 配置。",
        "This page is read-only. Apply the change manually using the guidance below.",
      ),
  };
}

export function buildClawGuardFixPlan(input: {
  snapshot: ClawGuardConfigSnapshot;
  findingId: string;
  options?: Record<string, unknown>;
  locale: SecurityClawLocale;
  environment?: ClawGuardEnvironment;
}): ClawGuardFixPlan {
  const { snapshot, findingId, options, locale } = input;
  const config = asRecord(snapshot.config);
  const { ruleId, scopeId } = decodeFindingId(findingId);
  const finish = (plan: ClawGuardFixPlan): ClawGuardFixPlan => finalizePlan(plan, snapshot, locale);
  const gateway = asRecord(config.gateway);
  const gatewayAuth = asRecord(gateway.auth);
  const channels = asRecord(config.channels);
  const channel = scopeId ? asRecord(channels[scopeId]) : {};
  const currentSandbox = asRecord(asRecord(asRecord(config.agents).defaults).sandbox);
  const sandboxMode = readString(currentSandbox.mode) || "off";

  const environment = input.environment
    || (snapshot.writeSupported
      ? resolveClawGuardEnvironment(config)
      : {
          sandboxImageReady: true,
          browserSandboxImageReady: true,
        });

  if (ruleId === "gateway_public_bind") {
    const currentValue = readString(gateway.bind) || text(locale, "未设置", "unset");
    const patch = { gateway: { bind: "loopback" } };
    return finish({
      findingId,
      title: text(locale, "把 gateway 收回 loopback", "Limit gateway bind to loopback"),
      summary: text(locale, "只保留本机访问入口。", "Keep gateway access on the local host only."),
      currentValue,
      recommendedValue: "loopback",
      impact: text(
        locale,
        "应用后，远端主机不能再直接连这个 gateway；需要重新走可信代理或安全远程访问方案。",
        "After this change, remote hosts can no longer connect to the gateway directly; use a trusted proxy or a secure remote-access path instead.",
      ),
      configPaths: ["gateway.bind"],
      repairChoices: [],
      patch,
      previewPatch: patch,
      restartRequired: true,
      canApply: true,
    });
  }

  if (ruleId === "gateway_missing_token_auth") {
    const currentMode = readString(gatewayAuth.mode) || text(locale, "未设置", "unset");
    const hasToken =
      readString(gatewayAuth.token).length > 0 ||
      Boolean(gatewayAuth.token && typeof gatewayAuth.token === "object");
    const generatedToken = crypto.randomBytes(24).toString("base64url");
    const patch = {
      gateway: {
        auth: hasToken
          ? { mode: "token" }
          : { mode: "token", token: generatedToken },
      },
    };
    const previewPatch = hasToken
      ? patch
      : {
          gateway: {
            auth: {
              mode: "token",
              token: "********",
            },
          },
        };
    return finish({
      findingId,
      title: text(locale, "启用 gateway token 鉴权", "Enable gateway token authentication"),
      summary: text(locale, "把 gateway 固定在 token 鉴权模式。", "Force gateway access through token authentication."),
      currentValue: text(
        locale,
        `${currentMode}${hasToken ? "" : "，token 缺失"}`,
        `${currentMode}${hasToken ? "" : ", token missing"}`,
      ),
      recommendedValue: hasToken
        ? text(locale, "mode=token", "mode=token")
        : text(locale, "mode=token，并生成新的随机 token", "mode=token with a newly generated random token"),
      impact: text(
        locale,
        "应用后，所有调用方都需要带 token。若原来没有 token，系统会生成一个新的随机 token 并写入配置。",
        "After this change, every caller must present a token. When no token exists yet, a new random token is generated and written into config.",
      ),
      configPaths: ["gateway.auth.mode", "gateway.auth.token"],
      repairChoices: [],
      patch,
      previewPatch,
      restartRequired: true,
      canApply: true,
    });
  }

  if (ruleId === "dm_policy_too_open" && scopeId) {
    const patch = buildPatchForChannel(scopeId, { dmPolicy: "pairing" });
    return finish({
      findingId,
      title: text(locale, "把私信入口改成 pairing", "Change DM access to pairing"),
      summary: text(locale, "未知私信用户需要先配对。", "Unknown DM senders must pair before they can chat."),
      currentValue: readString(channel.dmPolicy) || "open",
      recommendedValue: "pairing",
      impact: text(
        locale,
        "应用后，陌生私信不会再直接触发机器人，需要先经过配对或 allowlist。",
        "After this change, unknown DM senders can no longer trigger the bot directly and must pair or be allowlisted first.",
      ),
      configPaths: [`channels.${scopeId}.dmPolicy`],
      repairChoices: [],
      patch,
      previewPatch: patch,
      restartRequired: true,
      canApply: true,
    });
  }

  if (ruleId === "group_policy_too_open" && scopeId) {
    const choice = readGuidedChoice(options);
    const allowlistAvailable = hasEffectiveAllowlist(channel);
    const patch = choice === GUIDED_USE_ALLOWLIST
      ? buildPatchForChannel(scopeId, { groupPolicy: "allowlist" })
      : buildPatchForChannel(scopeId, { groupPolicy: "disabled" });
    const repairChoices = [
      ensureChoice(locale, GUIDED_DISABLE_GROUPS, true),
      ensureChoice(locale, GUIDED_USE_ALLOWLIST, false, !allowlistAvailable, !allowlistAvailable
        ? text(locale, "当前没有可直接复用的群白名单或成员 allowlist。", "No reusable group allowlist or sender allowlist is configured yet.")
        : undefined),
    ];

    return finish({
      findingId,
      title: choice === GUIDED_USE_ALLOWLIST
        ? text(locale, "把群聊切到 allowlist", "Switch group access to allowlist")
        : text(locale, "禁用群聊入口", "Disable group access"),
      summary: choice === GUIDED_USE_ALLOWLIST
        ? text(locale, "只允许白名单里的群或成员触发。", "Allow only allowlisted groups or senders to trigger the bot.")
        : text(locale, "直接关闭当前渠道的群聊入口。", "Turn off group access for this channel."),
      currentValue: readString(channel.groupPolicy) || "open",
      recommendedValue: choice === GUIDED_USE_ALLOWLIST ? "allowlist" : "disabled",
      impact: choice === GUIDED_USE_ALLOWLIST
        ? text(
            locale,
            "应用后，群聊只接受白名单里的群或成员；未在 allowlist 里的流量会被挡掉。",
            "After this change, only allowlisted groups or senders can trigger the bot in groups.",
          )
        : text(
            locale,
            "应用后，这个渠道的群聊不会再触发机器人。",
            "After this change, groups on this channel can no longer trigger the bot.",
          ),
      configPaths: [`channels.${scopeId}.groupPolicy`],
      repairChoices,
      selectedChoiceId: choice,
      patch,
      previewPatch: patch,
      restartRequired: true,
      canApply: choice !== GUIDED_USE_ALLOWLIST || allowlistAvailable,
      ...(choice === GUIDED_USE_ALLOWLIST && !allowlistAvailable
        ? {
            applyDisabledReason: text(
              locale,
              "当前没有可直接复用的群白名单或成员 allowlist。",
              "No reusable group allowlist or sender allowlist is configured yet.",
            ),
          }
        : {}),
    });
  }

  if (ruleId === "group_missing_require_mention" && scopeId) {
    const groups = asRecord(channel.groups);
    const patch = Object.keys(groups).length > 0
      ? buildPatchForChannel(scopeId, { groups: { "*": { requireMention: true } } })
      : buildPatchForChannel(scopeId, { requireMention: true });
    return finish({
      findingId,
      title: text(locale, "要求先 @ 机器人", "Require mentioning the bot"),
      summary: text(locale, "把群聊触发改成显式 mention。", "Require an explicit mention before the bot replies in groups."),
      currentValue: text(locale, "requireMention 未开启", "requireMention is not enabled"),
      recommendedValue: "requireMention=true",
      impact: text(
        locale,
        "应用后，普通群聊噪声不会再直接触发机器人，误回复会明显减少。",
        "After this change, ordinary group chatter no longer triggers the bot directly, which reduces accidental replies.",
      ),
      configPaths: [`channels.${scopeId}.groups.*.requireMention`],
      repairChoices: [],
      patch,
      previewPatch: patch,
      restartRequired: true,
      canApply: true,
    });
  }

  if (ruleId === "group_missing_allowlist" && scopeId) {
    const allowlistAvailable = hasEffectiveAllowlist(channel);
    const choice = readGuidedChoice(options);
    const canApply = choice !== GUIDED_USE_ALLOWLIST || allowlistAvailable;
    const patch = choice === GUIDED_USE_ALLOWLIST
      ? buildPatchForChannel(scopeId, { groupPolicy: "allowlist" })
      : buildPatchForChannel(scopeId, { groupPolicy: "disabled" });
    return finish({
      findingId,
      title: choice === GUIDED_USE_ALLOWLIST
        ? text(locale, "切到 allowlist", "Switch to allowlist")
        : text(locale, "先禁用群聊", "Disable groups for now"),
      summary: choice === GUIDED_USE_ALLOWLIST
        ? text(locale, "沿用现有白名单，把群聊收紧到明确范围。", "Reuse existing allowlists and narrow group access to an explicit scope.")
        : text(locale, "在没有白名单前，先关掉群聊入口。", "Turn group access off until you have a proper allowlist."),
      currentValue: text(locale, "没有有效群白名单或成员 allowlist", "No effective group or sender allowlist"),
      recommendedValue: choice === GUIDED_USE_ALLOWLIST ? "allowlist" : "disabled",
      impact: choice === GUIDED_USE_ALLOWLIST
        ? text(locale, "应用后，只有白名单里的群或成员可以触发机器人。", "After this change, only allowlisted groups or senders can trigger the bot.")
        : text(locale, "应用后，这个渠道的群聊入口会被关闭。", "After this change, group access on this channel is disabled."),
      configPaths: [`channels.${scopeId}.groupPolicy`, `channels.${scopeId}.groupAllowFrom`],
      repairChoices: [
        ensureChoice(locale, GUIDED_DISABLE_GROUPS, true),
        ensureChoice(
          locale,
          GUIDED_USE_ALLOWLIST,
          false,
          !allowlistAvailable,
          !allowlistAvailable
            ? text(locale, "当前没有可直接复用的群白名单或成员 allowlist。", "No reusable group allowlist or sender allowlist is configured yet.")
            : undefined,
        ),
      ],
      selectedChoiceId: choice,
      patch,
      previewPatch: patch,
      restartRequired: true,
      canApply,
      ...(canApply
        ? {}
        : {
            applyDisabledReason: text(
              locale,
              "当前没有可直接复用的群白名单或成员 allowlist。",
              "No reusable group allowlist or sender allowlist is configured yet.",
            ),
          }),
    });
  }

  if (ruleId === "sandbox_disabled_for_high_risk_profile") {
    const patch = {
      agents: {
        defaults: {
          sandbox: {
            mode: "non-main",
          },
        },
      },
    };
    return finish({
      findingId,
      title: text(locale, "启用 non-main 普通沙箱", "Enable the standard non-main sandbox"),
      summary: text(locale, "把非主会话放进 Docker 沙箱。", "Run non-main sessions inside the Docker sandbox."),
      currentValue: sandboxMode,
      recommendedValue: "non-main",
      impact: text(
        locale,
        "应用后，群聊和其他非主会话会进入普通沙箱，执行、文件写入和网络访问都会收紧到容器里。",
        "After this change, group chats and other non-main sessions run inside the standard sandbox, which narrows execution, file writes, and network access to the container.",
      ),
      configPaths: ["tools.profile", "agents.defaults.sandbox.mode"],
      repairChoices: [],
      patch,
      previewPatch: patch,
      restartRequired: true,
      canApply: environment.sandboxImageReady,
      ...(environment.sandboxImageReady
        ? {}
        : {
            applyDisabledReason: text(
              locale,
              "没有检测到普通沙箱镜像，请先准备 `openclaw-sandbox` 镜像环境。",
              "The standard sandbox image is not available yet. Prepare the `openclaw-sandbox` image first.",
            ),
          }),
    });
  }

  if (ruleId === "browser_sandbox_missing") {
    const patch = {
      agents: {
        defaults: {
          sandbox: {
            mode: sandboxMode === "off" ? "non-main" : sandboxMode,
            browser: {
              enabled: true,
            },
          },
        },
      },
    };
    const canApply = environment.sandboxImageReady && environment.browserSandboxImageReady;
    return finish({
      findingId,
      title: text(locale, "启用浏览器沙箱", "Enable the browser sandbox"),
      summary: text(
        locale,
        "把浏览器能力切到独立浏览器沙箱容器；若普通沙箱还没开，会一起补上 non-main。",
        "Route browser access through the dedicated browser sandbox container and add `non-main` mode when standard sandboxing is still off.",
      ),
      currentValue: text(locale, "sandbox.browser.enabled 未开启", "sandbox.browser.enabled is not enabled"),
      recommendedValue: text(locale, "sandbox.browser.enabled=true", "sandbox.browser.enabled=true"),
      impact: text(
        locale,
        "应用后，浏览器能力会优先走独立浏览器沙箱容器，而不是继续直接依赖宿主环境。",
        "After this change, browser access is routed through the dedicated browser sandbox container instead of relying on the host browser path.",
      ),
      configPaths: ["browser", "agents.defaults.sandbox.browser.enabled", "agents.defaults.sandbox.mode"],
      repairChoices: [],
      patch,
      previewPatch: patch,
      restartRequired: true,
      canApply,
      ...(canApply
        ? {}
        : {
            applyDisabledReason: text(
              locale,
              "没有检测到普通沙箱或浏览器沙箱镜像，请先准备对应镜像环境。",
              "The standard sandbox image or browser sandbox image is missing. Prepare both images first.",
            ),
          }),
    });
  }

  throw new Error(`unsupported hardening finding: ${findingId}`);
}

export function toClawGuardPreviewPayload(plan: ClawGuardFixPlan) {
  return {
    finding_id: plan.findingId,
    title: plan.title,
    summary: plan.summary,
    current_value: plan.currentValue,
    recommended_value: plan.recommendedValue,
    impact: plan.impact,
    patch_preview: formatPatchPreview(plan.previewPatch),
    restart_required: plan.restartRequired,
    can_apply: plan.canApply,
    ...(plan.applyDisabledReason ? { apply_disabled_reason: plan.applyDisabledReason } : {}),
    config_paths: plan.configPaths,
    repair_choices: plan.repairChoices,
    ...(plan.selectedChoiceId ? { selected_choice_id: plan.selectedChoiceId } : {}),
  };
}
