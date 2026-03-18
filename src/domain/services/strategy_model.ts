import type {
  ApprovalRequirements,
  ChallengeConfig,
  Decision,
  DestinationIpClass,
  DestinationType,
  FileRule,
  PolicyMatch,
  PolicyRule,
  ReasonCode,
  ResourceScope,
  SecurityClawConfig,
  SensitivePathConfig,
  SensitivePathRule,
  Severity,
  TrustLevel,
} from "../../types.ts";
import { normalizeFileRules } from "./file_rule_registry.ts";
import {
  applySensitivePathStrategyOverride,
  hydrateSensitivePathConfig,
  normalizeSensitivePathRules,
} from "./sensitive_path_registry.ts";

export type StrategyCapabilityId =
  | "runtime"
  | "filesystem"
  | "network"
  | "browser"
  | "messaging"
  | "archive"
  | "media"
  | "business"
  | "automation"
  | "memory"
  | "nodes"
  | "sessions"
  | `plugin:${string}`
  | (string & {});

export type VolumeThresholdConfig = {
  bulk_file_count: number;
  bulk_bytes: number;
  bulk_record_count: number;
};

export type StrategyPolicyRule = {
  rule_id: string;
  capability_id: StrategyCapabilityId;
  group: string;
  control_domain?: string;
  title?: string;
  description?: string;
  severity?: Severity;
  owner?: string;
  playbook_url?: string;
  enabled: boolean;
  priority: number;
  decision: Decision;
  reason_codes: ReasonCode[];
  context: PolicyMatch;
  challenge?: ChallengeConfig;
  approval_requirements?: ApprovalRequirements;
};

export type CapabilityPolicy = {
  capability_id: StrategyCapabilityId;
  default_decision: Decision;
  rules: StrategyPolicyRule[];
};

export type StrategyV2 = {
  version: "v2";
  tool_policy: {
    capabilities: CapabilityPolicy[];
  };
  classifiers: {
    disabled_builtin_ids: string[];
    custom_sensitive_paths: SensitivePathRule[];
    volume_thresholds: VolumeThresholdConfig;
  };
  exceptions: {
    directory_overrides: FileRule[];
  };
};

const BASELINE_RULE_PREFIX = "strategy-baseline:";

const CAPABILITY_ORDER: StrategyCapabilityId[] = [
  "runtime",
  "filesystem",
  "network",
  "browser",
  "messaging",
  "archive",
  "media",
  "business",
  "automation",
  "memory",
  "nodes",
  "sessions",
];

const VALID_DECISIONS = new Set<Decision>(["allow", "warn", "challenge", "block"]);

export const DEFAULT_STRATEGY_VOLUME_THRESHOLDS: VolumeThresholdConfig = {
  bulk_file_count: 20,
  bulk_bytes: 1_000_000,
  bulk_record_count: 100,
};

function normalizeString(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

function normalizeStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined;
  }
  const normalized = value
    .map((entry) => normalizeString(entry))
    .filter((entry): entry is string => Boolean(entry));
  return normalized.length > 0 ? normalized : undefined;
}

function normalizeNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function normalizeDecision(value: unknown, fallback: Decision = "allow"): Decision {
  if (typeof value === "string" && VALID_DECISIONS.has(value as Decision)) {
    return value as Decision;
  }
  return fallback;
}

function normalizePolicyContext(value: unknown): PolicyMatch {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const context: PolicyMatch = {};

  const identity = normalizeStringArray(record.identity);
  const scope = normalizeStringArray(record.scope);
  const tool = normalizeStringArray(record.tool);
  const toolGroup = normalizeStringArray(record.tool_group);
  const operation = normalizeStringArray(record.operation);
  const tags = normalizeStringArray(record.tags);
  const resourceScope = normalizeStringArray(record.resource_scope) as ResourceScope[] | undefined;
  const pathPrefix = normalizeStringArray(record.path_prefix);
  const pathGlob = normalizeStringArray(record.path_glob);
  const pathRegex = normalizeStringArray(record.path_regex);
  const fileType = normalizeStringArray(record.file_type);
  const assetLabels = normalizeStringArray(record.asset_labels);
  const dataLabels = normalizeStringArray(record.data_labels);
  const trustLevel = normalizeStringArray(record.trust_level) as TrustLevel[] | undefined;
  const destinationType = normalizeStringArray(record.destination_type) as DestinationType[] | undefined;
  const destDomain = normalizeStringArray(record.dest_domain);
  const destIpClass = normalizeStringArray(record.dest_ip_class) as DestinationIpClass[] | undefined;
  const toolArgsSummary = normalizeStringArray(record.tool_args_summary);
  const toolArgsRegex = normalizeStringArray(record.tool_args_regex);
  const minFileCount = normalizeNumber(record.min_file_count);
  const minBytes = normalizeNumber(record.min_bytes);
  const minRecordCount = normalizeNumber(record.min_record_count);

  if (identity) context.identity = identity;
  if (scope) context.scope = scope;
  if (tool) context.tool = tool;
  if (toolGroup) context.tool_group = toolGroup;
  if (operation) context.operation = operation;
  if (tags) context.tags = tags;
  if (resourceScope) context.resource_scope = resourceScope;
  if (pathPrefix) context.path_prefix = pathPrefix;
  if (pathGlob) context.path_glob = pathGlob;
  if (pathRegex) context.path_regex = pathRegex;
  if (fileType) context.file_type = fileType;
  if (assetLabels) context.asset_labels = assetLabels;
  if (dataLabels) context.data_labels = dataLabels;
  if (trustLevel) context.trust_level = trustLevel;
  if (destinationType) context.destination_type = destinationType;
  if (destDomain) context.dest_domain = destDomain;
  if (destIpClass) context.dest_ip_class = destIpClass;
  if (toolArgsSummary) context.tool_args_summary = toolArgsSummary;
  if (toolArgsRegex) context.tool_args_regex = toolArgsRegex;
  if (minFileCount !== undefined) context.min_file_count = minFileCount;
  if (minBytes !== undefined) context.min_bytes = minBytes;
  if (minRecordCount !== undefined) context.min_record_count = minRecordCount;

  return context;
}

function normalizeApprovalRequirements(value: unknown): ApprovalRequirements | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const approverRoles = normalizeStringArray(record.approver_roles);
  const ttlSeconds = normalizeNumber(record.ttl_seconds);
  const normalized: ApprovalRequirements = {
    ...(record.ticket_required === true ? { ticket_required: true } : {}),
    ...(approverRoles ? { approver_roles: approverRoles } : {}),
    ...(record.single_use === true ? { single_use: true } : {}),
    ...(record.trace_binding === "trace" || record.trace_binding === "none"
      ? { trace_binding: record.trace_binding }
      : {}),
    ...(ttlSeconds !== undefined ? { ttl_seconds: ttlSeconds } : {}),
  };
  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeChallenge(value: unknown): ChallengeConfig | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const ttlSeconds = normalizeNumber((value as { ttl_seconds?: unknown }).ttl_seconds);
  return ttlSeconds !== undefined ? { ttl_seconds: ttlSeconds } : undefined;
}

function defaultBaselineReasonCode(capabilityId: StrategyCapabilityId, decision: Decision): string {
  return `CAPABILITY_${capabilityId.replace(/[^A-Za-z0-9]+/g, "_").toUpperCase()}_${decision.toUpperCase()}`;
}

function baselineRuleId(capabilityId: StrategyCapabilityId): string {
  return `${BASELINE_RULE_PREFIX}${capabilityId}`;
}

function isBaselineRule(rule: PolicyRule): boolean {
  return rule.rule_id.startsWith(BASELINE_RULE_PREFIX);
}

function extractBaselineCapabilityId(ruleId: string): StrategyCapabilityId | undefined {
  if (!ruleId.startsWith(BASELINE_RULE_PREFIX)) {
    return undefined;
  }
  const capabilityId = ruleId.slice(BASELINE_RULE_PREFIX.length).trim();
  return capabilityId ? (capabilityId as StrategyCapabilityId) : undefined;
}

function capabilityPriority(capabilityId: StrategyCapabilityId): number {
  const index = CAPABILITY_ORDER.indexOf(capabilityId);
  return index === -1 ? CAPABILITY_ORDER.length + 1 : index;
}

function compareCapabilities(left: CapabilityPolicy, right: CapabilityPolicy): number {
  const byOrder = capabilityPriority(left.capability_id) - capabilityPriority(right.capability_id);
  if (byOrder !== 0) {
    return byOrder;
  }
  return left.capability_id.localeCompare(right.capability_id);
}

function compareStrategyRules(left: StrategyPolicyRule, right: StrategyPolicyRule): number {
  if (right.priority !== left.priority) {
    return right.priority - left.priority;
  }
  return left.rule_id.localeCompare(right.rule_id);
}

function inferCapabilityIdFromToolGroup(toolGroup: string | undefined): StrategyCapabilityId | undefined {
  if (!toolGroup) {
    return undefined;
  }
  if (toolGroup === "execution") {
    return "runtime";
  }
  if (toolGroup === "filesystem") {
    return "filesystem";
  }
  if (toolGroup === "network") {
    return "network";
  }
  if (toolGroup === "browser") {
    return "browser";
  }
  if (toolGroup === "email" || toolGroup === "sms") {
    return "messaging";
  }
  if (toolGroup === "archive") {
    return "archive";
  }
  if (toolGroup === "album" || toolGroup === "media") {
    return "media";
  }
  if (toolGroup === "business") {
    return "business";
  }
  if (
    toolGroup === "automation" ||
    toolGroup === "memory" ||
    toolGroup === "nodes" ||
    toolGroup === "sessions"
  ) {
    return toolGroup;
  }
  return toolGroup.startsWith("plugin:") ? (toolGroup as StrategyCapabilityId) : undefined;
}

function inferCapabilityIdFromToolName(toolName: string | undefined): StrategyCapabilityId | undefined {
  const normalized = toolName?.trim().toLowerCase();
  if (!normalized) {
    return undefined;
  }
  if (normalized.startsWith("shell.") || normalized === "exec") {
    return "runtime";
  }
  if (normalized.startsWith("filesystem.") || normalized.startsWith("file.")) {
    return "filesystem";
  }
  if (normalized.startsWith("network.") || normalized.startsWith("http.")) {
    return "network";
  }
  if (normalized.startsWith("browser.")) {
    return "browser";
  }
  if (
    normalized.startsWith("email.") ||
    normalized.startsWith("mail.") ||
    normalized.startsWith("sms.") ||
    normalized.startsWith("messages.")
  ) {
    return "messaging";
  }
  if (normalized.startsWith("archive.") || normalized.includes(".zip") || normalized.includes(".archive")) {
    return "archive";
  }
  if (normalized.startsWith("album.") || normalized.startsWith("photo.") || normalized.startsWith("media.")) {
    return "media";
  }
  if (
    normalized.startsWith("crm.") ||
    normalized.startsWith("erp.") ||
    normalized.startsWith("hr.") ||
    normalized.startsWith("finance.") ||
    normalized.startsWith("jira.") ||
    normalized.startsWith("servicenow.")
  ) {
    return "business";
  }
  if (
    normalized.startsWith("automation.") ||
    normalized.startsWith("memory.") ||
    normalized.startsWith("node.") ||
    normalized.startsWith("session.")
  ) {
    return normalized.split(".", 1)[0] as StrategyCapabilityId;
  }
  return undefined;
}

export function inferCapabilityIdFromRule(rule: PolicyRule): StrategyCapabilityId {
  const baselineCapabilityId = extractBaselineCapabilityId(rule.rule_id);
  if (baselineCapabilityId) {
    return baselineCapabilityId;
  }

  const toolGroups = rule.match.tool_group ?? [];
  for (const toolGroup of toolGroups) {
    const capabilityId = inferCapabilityIdFromToolGroup(toolGroup);
    if (capabilityId) {
      return capabilityId;
    }
  }

  const tools = rule.match.tool ?? [];
  for (const toolName of tools) {
    const capabilityId = inferCapabilityIdFromToolName(toolName);
    if (capabilityId) {
      return capabilityId;
    }
  }

  if (rule.match.path_glob?.length || rule.match.path_prefix?.length || rule.match.path_regex?.length) {
    return "filesystem";
  }

  return "runtime";
}

function capabilityMatch(capabilityId: StrategyCapabilityId): PolicyMatch {
  if (capabilityId === "runtime") {
    return { tool_group: ["execution"] };
  }
  if (capabilityId === "filesystem") {
    return { tool_group: ["filesystem"] };
  }
  if (capabilityId === "network") {
    return { tool_group: ["network"] };
  }
  if (capabilityId === "browser") {
    return { tool_group: ["browser"] };
  }
  if (capabilityId === "messaging") {
    return { tool_group: ["email", "sms"] };
  }
  if (capabilityId === "archive") {
    return { tool_group: ["archive"] };
  }
  if (capabilityId === "media") {
    return { tool_group: ["album", "media"] };
  }
  if (capabilityId === "business") {
    return { tool_group: ["business"] };
  }
  if (
    capabilityId === "automation" ||
    capabilityId === "memory" ||
    capabilityId === "nodes" ||
    capabilityId === "sessions"
  ) {
    return { tool_group: [capabilityId] };
  }
  if (capabilityId.startsWith("plugin:")) {
    return { tool_group: [capabilityId] };
  }
  return {};
}

function createBaselineRule(capability: CapabilityPolicy): PolicyRule | undefined {
  if (capability.default_decision === "allow") {
    return undefined;
  }
  return {
    rule_id: baselineRuleId(capability.capability_id),
    group: capability.capability_id,
    control_domain: capability.capability_id,
    title: `Default ${capability.capability_id} baseline`,
    enabled: true,
    priority: 40,
    decision: capability.default_decision,
    reason_codes: [defaultBaselineReasonCode(capability.capability_id, capability.default_decision)],
    match: capabilityMatch(capability.capability_id),
  };
}

function normalizeStrategyPolicyRule(value: unknown): StrategyPolicyRule | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const ruleId = normalizeString(record.rule_id);
  const capabilityId = normalizeString(record.capability_id) as StrategyCapabilityId | undefined;
  const group = normalizeString(record.group);
  const priority = normalizeNumber(record.priority);
  const controlDomain = normalizeString(record.control_domain);
  const title = normalizeString(record.title);
  const description = normalizeString(record.description);
  const severity = normalizeString(record.severity) as Severity | undefined;
  const owner = normalizeString(record.owner);
  const playbookUrl = normalizeString(record.playbook_url);
  const challenge = normalizeChallenge(record.challenge);
  const approvalRequirements = normalizeApprovalRequirements(record.approval_requirements);
  if (!ruleId || !capabilityId || !group || priority === undefined) {
    return undefined;
  }
  return {
    rule_id: ruleId,
    capability_id: capabilityId,
    group,
    ...(controlDomain ? { control_domain: controlDomain } : {}),
    ...(title ? { title } : {}),
    ...(description ? { description } : {}),
    ...(severity ? { severity } : {}),
    ...(owner ? { owner } : {}),
    ...(playbookUrl ? { playbook_url: playbookUrl } : {}),
    enabled: record.enabled !== false,
    priority,
    decision: normalizeDecision(record.decision, "allow"),
    reason_codes: normalizeStringArray(record.reason_codes) ?? [],
    context: normalizePolicyContext(record.context),
    ...(challenge ? { challenge } : {}),
    ...(approvalRequirements ? { approval_requirements: approvalRequirements } : {}),
  };
}

function normalizeCapabilityPolicy(value: unknown): CapabilityPolicy | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const capabilityId = normalizeString(record.capability_id) as StrategyCapabilityId | undefined;
  if (!capabilityId) {
    return undefined;
  }
  const rules = Array.isArray(record.rules)
    ? record.rules
        .map((entry) => normalizeStrategyPolicyRule(entry))
        .filter((entry): entry is StrategyPolicyRule => Boolean(entry))
        .sort(compareStrategyRules)
    : [];
  return {
    capability_id: capabilityId,
    default_decision: normalizeDecision(record.default_decision, "allow"),
    rules,
  };
}

export function normalizeStrategyV2(value: unknown): StrategyV2 | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  const record = value as Record<string, unknown>;
  const capabilities = Array.isArray((record.tool_policy as { capabilities?: unknown })?.capabilities)
    ? ((record.tool_policy as { capabilities?: unknown[] }).capabilities ?? [])
        .map((entry) => normalizeCapabilityPolicy(entry))
        .filter((entry): entry is CapabilityPolicy => Boolean(entry))
        .sort(compareCapabilities)
    : [];
  const classifiersRecord =
    record.classifiers && typeof record.classifiers === "object" && !Array.isArray(record.classifiers)
      ? (record.classifiers as Record<string, unknown>)
      : {};
  const disabledBuiltinIds = normalizeStringArray(classifiersRecord.disabled_builtin_ids) ?? [];
  const customSensitivePaths = normalizeSensitivePathRules(classifiersRecord.custom_sensitive_paths, "custom").map(
    (rule) => ({ ...rule, source: "custom" as const }),
  );
  const volumeThresholdsRecord =
    classifiersRecord.volume_thresholds &&
    typeof classifiersRecord.volume_thresholds === "object" &&
    !Array.isArray(classifiersRecord.volume_thresholds)
      ? (classifiersRecord.volume_thresholds as Record<string, unknown>)
      : {};
  const exceptionsRecord =
    record.exceptions && typeof record.exceptions === "object" && !Array.isArray(record.exceptions)
      ? (record.exceptions as Record<string, unknown>)
      : {};

  return {
    version: "v2",
    tool_policy: {
      capabilities,
    },
    classifiers: {
      disabled_builtin_ids: disabledBuiltinIds,
      custom_sensitive_paths: customSensitivePaths,
      volume_thresholds: {
        bulk_file_count:
          normalizeNumber(volumeThresholdsRecord.bulk_file_count) ??
          DEFAULT_STRATEGY_VOLUME_THRESHOLDS.bulk_file_count,
        bulk_bytes:
          normalizeNumber(volumeThresholdsRecord.bulk_bytes) ?? DEFAULT_STRATEGY_VOLUME_THRESHOLDS.bulk_bytes,
        bulk_record_count:
          normalizeNumber(volumeThresholdsRecord.bulk_record_count) ??
          DEFAULT_STRATEGY_VOLUME_THRESHOLDS.bulk_record_count,
      },
    },
    exceptions: {
      directory_overrides: normalizeFileRules(exceptionsRecord.directory_overrides),
    },
  };
}

export function buildStrategyV2FromConfig(config: SecurityClawConfig): StrategyV2 {
  const capabilities = new Map<StrategyCapabilityId, CapabilityPolicy>();
  const hydratedSensitivity = hydrateSensitivePathConfig(config.sensitivity);
  for (const rule of config.policies) {
    const capabilityId = inferCapabilityIdFromRule(rule);
    const existing =
      capabilities.get(capabilityId) ??
      {
        capability_id: capabilityId,
        default_decision: "allow" as Decision,
        rules: [],
      };

    if (isBaselineRule(rule)) {
      existing.default_decision = rule.decision ?? "allow";
    } else {
      existing.rules.push({
        rule_id: rule.rule_id,
        capability_id: capabilityId,
        group: rule.group,
        ...(rule.control_domain ? { control_domain: rule.control_domain } : {}),
        ...(rule.title ? { title: rule.title } : {}),
        ...(rule.description ? { description: rule.description } : {}),
        ...(rule.severity ? { severity: rule.severity } : {}),
        ...(rule.owner ? { owner: rule.owner } : {}),
        ...(rule.playbook_url ? { playbook_url: rule.playbook_url } : {}),
        enabled: rule.enabled !== false,
        priority: rule.priority,
        decision: rule.decision ?? "allow",
        reason_codes: [...(rule.reason_codes ?? [])],
        context: { ...(rule.match ?? {}) },
        ...(rule.challenge ? { challenge: { ...rule.challenge } } : {}),
        ...(rule.approval_requirements ? { approval_requirements: { ...rule.approval_requirements } } : {}),
      });
    }
    capabilities.set(capabilityId, existing);
  }

  const normalizedCapabilities = Array.from(capabilities.values())
    .map((capability) => ({
      ...capability,
      rules: [...capability.rules].sort(compareStrategyRules),
    }))
    .sort(compareCapabilities);

  return {
    version: "v2",
    tool_policy: {
      capabilities: normalizedCapabilities,
    },
    classifiers: {
      disabled_builtin_ids: [],
      custom_sensitive_paths: hydratedSensitivity.path_rules
        .filter((rule) => rule.source === "custom")
        .map((rule) => ({ ...rule, source: "custom" as const })),
      volume_thresholds: { ...DEFAULT_STRATEGY_VOLUME_THRESHOLDS },
    },
    exceptions: {
      directory_overrides: normalizeFileRules(config.file_rules),
    },
  };
}

export function compileStrategyV2(
  baseConfig: SecurityClawConfig,
  strategy: StrategyV2,
): Pick<SecurityClawConfig, "policies" | "sensitivity" | "file_rules"> {
  const normalized = normalizeStrategyV2(strategy) ?? buildStrategyV2FromConfig(baseConfig);
  const compiledPolicies: PolicyRule[] = [];

  normalized.tool_policy.capabilities.forEach((capability) => {
    const baseline = createBaselineRule(capability);
    if (baseline) {
      compiledPolicies.push(baseline);
    }
    capability.rules.forEach((rule) => {
      compiledPolicies.push({
        rule_id: rule.rule_id,
        group: rule.group,
        ...(rule.control_domain ? { control_domain: rule.control_domain } : {}),
        ...(rule.title ? { title: rule.title } : {}),
        ...(rule.description ? { description: rule.description } : {}),
        ...(rule.severity ? { severity: rule.severity } : {}),
        ...(rule.owner ? { owner: rule.owner } : {}),
        ...(rule.playbook_url ? { playbook_url: rule.playbook_url } : {}),
        enabled: rule.enabled !== false,
        priority: rule.priority,
        decision: rule.decision,
        reason_codes: [...rule.reason_codes],
        match: { ...rule.context },
        ...(rule.challenge ? { challenge: { ...rule.challenge } } : {}),
        ...(rule.approval_requirements ? { approval_requirements: { ...rule.approval_requirements } } : {}),
      });
    });
  });

  const sensitivityOverride = {
    disabled_builtin_ids: normalized.classifiers.disabled_builtin_ids,
    custom_path_rules: normalized.classifiers.custom_sensitive_paths.map((rule) => ({ ...rule, source: "custom" as const })),
  };
  const compiledSensitivity: SensitivePathConfig = applySensitivePathStrategyOverride(
    hydrateSensitivePathConfig(baseConfig.sensitivity),
    sensitivityOverride,
  );

  return {
    policies: compiledPolicies,
    sensitivity: compiledSensitivity,
    file_rules: normalizeFileRules(normalized.exceptions.directory_overrides),
  };
}
