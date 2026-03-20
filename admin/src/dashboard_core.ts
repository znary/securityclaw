import type { SecurityClawLocale } from "../../src/i18n/locale.ts";
import { resolveSecurityClawLocale } from "../../src/i18n/locale.ts";

export type DashboardThemePreference = "system" | "light" | "dark";
export type DashboardTheme = "light" | "dark";
export type LocalizedMessage = {
  "zh-CN"?: string;
  en?: string;
} & Record<string, string | undefined>;
export type LocalizedMap = Record<string, LocalizedMessage>;
export type RuleTextField = "title" | "description";
export type RuleTextOverrides = Record<string, Partial<Record<RuleTextField, LocalizedMessage>>>;
export type RuleChatMessage = {
  role: "user" | "system";
  text: LocalizedMessage;
};
export type RuleExplanation = {
  summary: LocalizedMessage;
  handling: LocalizedMessage;
  examples: RuleChatMessage[];
};
export type RuleExplanationMap = Record<string, RuleExplanation>;

export const REFRESH_INTERVAL_MS = 15000;
export const DECISIONS_PER_PAGE = 12;
export const ADMIN_LOCALE_STORAGE_KEY = "securityclaw.admin.locale";
export const ADMIN_THEME_STORAGE_KEY = "securityclaw.admin.theme";
export const ADMIN_DEFAULT_LOCALE = resolveSecurityClawLocale(
  typeof navigator !== "undefined" ? navigator.language : undefined,
  "en"
);
export const ADMIN_DEFAULT_THEME_PREFERENCE: DashboardThemePreference = "system";
export const DARK_COLOR_SCHEME_QUERY = "(prefers-color-scheme: dark)";
export const ADMIN_THEME_OPTIONS = new Set<DashboardThemePreference>(["system", "light", "dark"]);
export const ADMIN_BRAND_TEXT = "SecurityClaw";

let activeLocale: SecurityClawLocale = ADMIN_DEFAULT_LOCALE;

export function setActiveAdminLocale(locale: string | undefined): SecurityClawLocale {
  activeLocale = resolveSecurityClawLocale(locale, ADMIN_DEFAULT_LOCALE);
  return activeLocale;
}

export function getActiveAdminLocale(): SecurityClawLocale {
  return activeLocale;
}

export function ui(zhText: string, enText: string): string {
  return activeLocale === "zh-CN" ? zhText : enText;
}

export function readLocalized(map: LocalizedMap, key: string | null | undefined, fallback = "-"): string {
  if (!key) return fallback;
  const record = map[key];
  if (!record) return key || fallback;
  return record[activeLocale] || record.en || record["zh-CN"] || key || fallback;
}

export function normalizeAdminThemePreference(value: string | null | undefined): DashboardThemePreference {
  return typeof value === "string" && ADMIN_THEME_OPTIONS.has(value as DashboardThemePreference)
    ? (value as DashboardThemePreference)
    : ADMIN_DEFAULT_THEME_PREFERENCE;
}

export function readSystemTheme(): DashboardTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return "light";
  }
  return window.matchMedia(DARK_COLOR_SCHEME_QUERY).matches ? "dark" : "light";
}

export function resolveAdminTheme(
  preference: string | null | undefined,
  systemTheme: DashboardTheme = readSystemTheme(),
): DashboardTheme {
  const normalized = normalizeAdminThemePreference(preference);
  return normalized === "system" ? systemTheme : normalized;
}

export const TAB_ITEMS = [
  { id: "overview" },
  { id: "hardening" },
  { id: "rules" },
  { id: "skills" },
  { id: "plugins" },
  { id: "events" }
];

export function tabLabel(tabId: string): string {
  if (tabId === "overview") return ui("概览", "Overview");
  if (tabId === "hardening") return ui("系统", "System");
  if (tabId === "rules") return ui("工具", "Tools");
  if (tabId === "skills") return ui("Skills", "Skills");
  if (tabId === "plugins") return ui("插件", "Plugins");
  if (tabId === "events") return ui("记录", "Records");
  return tabId;
}

export function decisionFilterLabel(filterId: string): string {
  if (filterId === "all") return ui("全部", "All");
  if (filterId === "allow") return ui("放行", "Allow");
  if (filterId === "warn") return ui("提醒", "Warn");
  if (filterId === "challenge") return ui("需确认", "Needs Approval");
  if (filterId === "block") return ui("拦截", "Block");
  return filterId;
}

export const DECISION_TEXT = {
  allow: { "zh-CN": "放行", en: "Allow" },
  warn: { "zh-CN": "提醒", en: "Warn" },
  challenge: { "zh-CN": "需确认", en: "Needs Approval" },
  block: { "zh-CN": "拦截", en: "Block" }
};

export const DECISION_OPTIONS = ["allow", "warn", "challenge", "block"];

export const CHART_PALETTES = {
  light: ["#1e4f94", "#2d66ab", "#3f7fc2", "#5f97d1", "#7badde", "#9dc3e8", "#c2dcf2", "#dbeaf8"],
  dark: ["#38bdf8", "#60a5fa", "#34d399", "#f59e0b", "#a78bfa", "#2dd4bf", "#fb7185", "#facc15"]
};

export const CHART_THEME = {
  light: {
    grid: "#e7eef8",
    axis: "#c8d8eb",
    tick: "#5f748b",
    total: "#1e40af",
    risk: "#c03a4b"
  },
  dark: {
    grid: "rgba(148, 163, 184, 0.18)",
    axis: "rgba(148, 163, 184, 0.4)",
    tick: "#9fb2c7",
    total: "#60a5fa",
    risk: "#fb7185"
  }
};

export const DECISION_SOURCE_TEXT = {
  rule: { "zh-CN": "规则命中", en: "Rule match" },
  file_rule: { "zh-CN": "设置例外目录", en: "Exception directory" },
  default: { "zh-CN": "默认放行", en: "Default allow" },
  approval: { "zh-CN": "审批放行", en: "Approval grant" },
  account: { "zh-CN": "账号策略", en: "Account policy" }
};

export const ACCOUNT_MODE_TEXT = {
  apply_rules: { "zh-CN": "应用规则", en: "Apply rules" },
  default_allow: { "zh-CN": "默认放行", en: "Default allow" }
};

export const SCOPE_TEXT = {
  default: { "zh-CN": "默认会话", en: "Default session" },
  workspace: { "zh-CN": "工作区会话", en: "Workspace session" }
};

export const CONTROL_DOMAIN_TEXT = {
  execution_control: { "zh-CN": "执行控制", en: "Execution Control" },
  data_access: { "zh-CN": "数据访问", en: "Data Access" },
  data_egress: { "zh-CN": "数据外发", en: "Data Egress" },
  credential_protection: { "zh-CN": "凭据保护", en: "Credential Protection" },
  change_control: { "zh-CN": "变更控制", en: "Change Control" },
  approval_exception: { "zh-CN": "紧急例外", en: "Emergency Exception" }
};

export const SEVERITY_TEXT = {
  low: { "zh-CN": "低风险", en: "Low" },
  medium: { "zh-CN": "中风险", en: "Medium" },
  high: { "zh-CN": "高风险", en: "High" },
  critical: { "zh-CN": "严重", en: "Critical" }
};

export const SKILL_RISK_TIER_TEXT = {
  low: { "zh-CN": "低风险", en: "Low" },
  medium: { "zh-CN": "中风险", en: "Medium" },
  high: { "zh-CN": "高风险", en: "High" },
  critical: { "zh-CN": "严重风险", en: "Critical" }
};

export const SKILL_STATE_TEXT = {
  normal: { "zh-CN": "正常", en: "Normal" },
  quarantined: { "zh-CN": "已隔离", en: "Quarantined" },
  trusted: { "zh-CN": "受信覆盖", en: "Trust Override" }
};

export const SKILL_SCAN_STATUS_TEXT = {
  ready: { "zh-CN": "已就绪", en: "Ready" },
  stale: { "zh-CN": "已过期", en: "Stale" },
  unknown: { "zh-CN": "未扫描", en: "Unscanned" }
};

export const SKILL_SOURCE_TEXT = {
  openclaw_workspace: { "zh-CN": "OpenClaw 工作区", en: "OpenClaw Workspace" },
  openclaw_home: { "zh-CN": "OpenClaw 本地目录", en: "OpenClaw Home" },
  codex_home: { "zh-CN": "Codex 技能目录", en: "Codex Home" },
  custom: { "zh-CN": "自定义来源", en: "Custom Source" }
};

export const SKILL_SEVERITY_TEXT = {
  S0: { "zh-CN": "S0 低敏读取", en: "S0 Low-Sensitivity Read" },
  S1: { "zh-CN": "S1 普通写入 / 公网请求", en: "S1 Standard Write / Network" },
  S2: { "zh-CN": "S2 越界读写 / 敏感读取", en: "S2 Sensitive / Outside Workspace" },
  S3: { "zh-CN": "S3 执行 / 敏感外发", en: "S3 Execution / Sensitive Egress" }
};

export const SKILL_REASON_TEXT = {
  SKILL_CONTENT_UNREADABLE: { "zh-CN": "内容不可读", en: "Content Unreadable" },
  SKILL_MISSING_AUTHOR: { "zh-CN": "缺少作者信息", en: "Missing Author" },
  SKILL_MISSING_VERSION: { "zh-CN": "缺少版本信息", en: "Missing Version" },
  SKILL_CHANGELOG_MISSING: { "zh-CN": "缺少变更说明", en: "Missing Changelog" },
  SKILL_DOWNLOAD_EXECUTE_PATTERN: { "zh-CN": "检测到下载后执行模式", en: "Download-and-Execute Pattern" },
  SKILL_CAPABILITY_SHELL_EXEC: { "zh-CN": "包含执行能力", en: "Shell Execution Capability" },
  SKILL_POLICY_BYPASS_LANGUAGE: { "zh-CN": "存在绕过策略语义", en: "Policy Bypass Language" },
  SKILL_CREDENTIAL_TARGETING: { "zh-CN": "命中凭据 / 令牌目标", en: "Credential Targeting" },
  SKILL_PUBLIC_EGRESS_PATTERN: { "zh-CN": "存在公网外发语义", en: "Public Egress Pattern" },
  SKILL_OUTSIDE_WORKSPACE_WRITE: { "zh-CN": "涉及工作区外变更", en: "Outside-Workspace Change" },
  SKILL_CAPABILITY_COMBINATION: { "zh-CN": "高危能力组合", en: "High-Risk Capability Combination" },
  SKILL_TYPOSQUAT_SUSPECTED: { "zh-CN": "疑似相似名伪装", en: "Possible Typosquat" },
  SKILL_DRIFT_DETECTED: { "zh-CN": "内容变了但版本没变", en: "Changed Without Version Update" },
  SKILL_TRUST_OVERRIDE_APPLIED: { "zh-CN": "受信覆盖已应用", en: "Trust Override Applied" },
  SKILL_QUARANTINE_OVERRIDE: { "zh-CN": "隔离状态变更", en: "Quarantine Changed" }
};

export const SKILL_ACTIVITY_TEXT = {
  finding: { "zh-CN": "扫描信号", en: "Scan Signal" },
  rescan: { "zh-CN": "人工重扫", en: "Manual Rescan" },
  drift_detected: { "zh-CN": "发现未声明变更", en: "Undeclared Change Detected" },
  quarantine_on: { "zh-CN": "已隔离", en: "Quarantined" },
  quarantine_off: { "zh-CN": "解除隔离", en: "Quarantine Removed" },
  trust_override_on: { "zh-CN": "设为受信", en: "Trust Override On" },
  trust_override_off: { "zh-CN": "撤销受信", en: "Trust Override Removed" }
};

export const SKILL_RISK_FILTER_OPTIONS = ["all", "low", "medium", "high", "critical"];
export const SKILL_STATE_FILTER_OPTIONS = ["all", "normal", "quarantined", "trusted"];
export const SKILL_DRIFT_FILTER_OPTIONS = ["all", "drifted", "steady"];
export const SKILL_INTERCEPT_FILTER_OPTIONS = ["all", "recent"];
export const SKILL_POLICY_TIERS = ["low", "medium", "high", "critical", "unknown"];
export const SKILL_SEVERITY_LEVELS = ["S0", "S1", "S2", "S3"];

export const PLUGIN_RISK_TIER_TEXT = {
  low: { "zh-CN": "低风险", en: "Low" },
  medium: { "zh-CN": "中风险", en: "Medium" },
  high: { "zh-CN": "高风险", en: "High" },
  critical: { "zh-CN": "严重风险", en: "Critical" }
};

export const PLUGIN_STATE_TEXT = {
  enabled: { "zh-CN": "已启用", en: "Enabled" },
  disabled: { "zh-CN": "已停用", en: "Disabled" }
};

export const PLUGIN_SOURCE_TEXT = {
  npm: { "zh-CN": "NPM 安装", en: "NPM Package" },
  path: { "zh-CN": "本地路径", en: "Local Path" },
  git: { "zh-CN": "Git 来源", en: "Git Source" },
  unknown: { "zh-CN": "未知来源", en: "Unknown Source" }
};

export const PLUGIN_SCOPE_TEXT = {
  openclaw_home: { "zh-CN": "OpenClaw 目录内", en: "Inside OpenClaw Home" },
  external: { "zh-CN": "OpenClaw 目录外", en: "Outside OpenClaw Home" },
  unknown: { "zh-CN": "未知位置", en: "Unknown Location" }
};

export const PLUGIN_REASON_TEXT = {
  PLUGIN_INSTALL_PATH_MISSING: {
    "zh-CN": "安装路径缺失或不存在",
    en: "Install Path Missing or Unreadable"
  },
  PLUGIN_MANIFEST_MISSING: {
    "zh-CN": "缺少插件清单",
    en: "Plugin Manifest Missing"
  },
  PLUGIN_PACKAGE_METADATA_MISSING: {
    "zh-CN": "缺少包元数据",
    en: "Package Metadata Missing"
  },
  PLUGIN_PATH_SOURCE: {
    "zh-CN": "来自可变本地路径",
    en: "Loaded From Mutable Local Path"
  },
  PLUGIN_INTEGRITY_MISSING: {
    "zh-CN": "缺少安装完整性记录",
    en: "Integrity Record Missing"
  },
  PLUGIN_EXTERNAL_INSTALL_PATH: {
    "zh-CN": "安装位置在 OpenClaw 目录外",
    en: "Installed Outside OpenClaw Home"
  },
  PLUGIN_CONFIG_SCHEMA_MISSING: {
    "zh-CN": "未声明配置 Schema",
    en: "Config Schema Missing"
  },
  PLUGIN_DYNAMIC_EVAL: {
    "zh-CN": "检测到动态执行代码",
    en: "Dynamic Code Evaluation Detected"
  },
  PLUGIN_EXECUTION_SIGNAL: {
    "zh-CN": "检测到进程执行能力",
    en: "Process Execution Signal"
  },
  PLUGIN_NETWORK_SIGNAL: {
    "zh-CN": "检测到网络访问能力",
    en: "Network Access Signal"
  },
  PLUGIN_ENV_ACCESS: {
    "zh-CN": "检测到环境变量访问",
    en: "Environment Variable Access"
  },
  PLUGIN_FILESYSTEM_WRITE: {
    "zh-CN": "检测到文件写入能力",
    en: "Filesystem Write Signal"
  },
  PLUGIN_HEAVY_DEPENDENCIES: {
    "zh-CN": "依赖面较大",
    en: "Broad Dependency Surface"
  }
};

export const PLUGIN_RISK_FILTER_OPTIONS = ["all", "low", "medium", "high", "critical"];
export const PLUGIN_STATE_FILTER_OPTIONS = ["all", "enabled", "disabled"];

export const CONTROL_DOMAIN_SECURITY_GAIN_TEXT = {
  execution_control: "降低误执行高危命令、系统损坏和被植入后门的风险。",
  data_access: "减少越权读取、批量拉取和误触敏感信息的风险。",
  data_egress: "避免机密信息直接流向公网或不受控的外部渠道。",
  credential_protection: "保护账号、密钥、令牌等核心凭据，减少账号被盗用风险。",
  change_control: "降低关键发布和基础设施配置被误改后引发生产事故的风险。",
  approval_exception: "确保紧急例外仍有审批责任人和完整审计链路。"
};

export const DECISION_IMPACT_TEXT = {
  allow: "命中后会继续执行，用户几乎无感知，但会保留审计记录。",
  warn: "命中后会继续执行，同时给出风险提醒，便于用户及时纠正。",
  challenge: "命中后会先暂停，需审批通过后才继续，流程会比平时慢一些。",
  block: "命中后会立即拦截，操作不会执行，需要改用更安全方案。"
};

export const OPERATION_TEXT = {
  read: { "zh-CN": "读取", en: "Read" },
  search: { "zh-CN": "搜索", en: "Search" },
  list: { "zh-CN": "枚举", en: "List" },
  write: { "zh-CN": "写入", en: "Write" },
  delete: { "zh-CN": "删除", en: "Delete" },
  archive: { "zh-CN": "归档", en: "Archive" },
  execute: { "zh-CN": "执行", en: "Execute" },
  modify: { "zh-CN": "修改", en: "Modify" },
  export: { "zh-CN": "导出", en: "Export" }
};

export const FILE_RULE_OPERATION_OPTIONS = ["read", "list", "search", "write", "delete", "archive", "execute"];

export const TOOL_GROUP_TEXT = {
  execution: { "zh-CN": "执行命令", en: "Command Execution" },
  filesystem: { "zh-CN": "文件访问", en: "Filesystem Access" },
  network: { "zh-CN": "网络访问", en: "Network Access" },
  archive: { "zh-CN": "归档导出", en: "Archive / Export" },
  email: { "zh-CN": "邮箱访问", en: "Email Access" },
  sms: { "zh-CN": "短信访问", en: "SMS Access" },
  album: { "zh-CN": "相册访问", en: "Album Access" },
  browser: { "zh-CN": "浏览器数据访问", en: "Browser Data Access" },
  business: { "zh-CN": "业务系统访问", en: "Business System Access" }
};

export const CAPABILITY_TEXT = {
  runtime: { "zh-CN": "命令执行与环境", en: "Execution & Runtime" },
  filesystem: { "zh-CN": "文件系统", en: "Filesystem" },
  network: { "zh-CN": "网络与外发", en: "Network & Egress" },
  browser: { "zh-CN": "浏览器数据", en: "Browser Data" },
  messaging: { "zh-CN": "消息与通信", en: "Messaging" },
  archive: { "zh-CN": "归档与导出", en: "Archive & Export" },
  media: { "zh-CN": "媒体与相册", en: "Media & Photos" },
  business: { "zh-CN": "业务系统", en: "Business Systems" },
  automation: { "zh-CN": "自动化任务", en: "Automation" },
  memory: { "zh-CN": "记忆与知识库", en: "Memory & Knowledge" },
  nodes: { "zh-CN": "节点与代理协作", en: "Nodes & Agent Coordination" },
  sessions: { "zh-CN": "会话控制", en: "Session Control" }
};

export const CAPABILITY_DESCRIPTION_TEXT = {
  runtime: {
    "zh-CN": "控制 shell / exec 一类命令执行，以及对宿主环境的直接影响。",
    en: "Controls shell-style execution and other actions that directly affect the host runtime environment."
  },
  filesystem: {
    "zh-CN": "控制读取、搜索、写入、删除、归档和执行文件等文件系统操作。",
    en: "Controls file reads, searches, writes, deletes, archive actions, and file execution behavior."
  },
  network: {
    "zh-CN": "控制访问外部网络、调用 API，以及把数据发送到外部地址。",
    en: "Controls outbound network access, API calls, and sending data to external destinations."
  },
  browser: {
    "zh-CN": "控制读取浏览器 Cookie、凭据、历史记录和站点数据。",
    en: "Controls access to browser cookies, credentials, history, and site data."
  },
  messaging: {
    "zh-CN": "控制读取或导出邮件、短信等通信内容。",
    en: "Controls reading or exporting email, SMS, and other communication content."
  },
  archive: {
    "zh-CN": "控制压缩、打包、归档和导出行为。",
    en: "Controls compression, packaging, archiving, and export actions."
  },
  media: {
    "zh-CN": "控制访问相册、图片、音视频和 OCR 类媒体资料。",
    en: "Controls access to photos, screenshots, audio, video, and OCR-oriented media."
  },
  business: {
    "zh-CN": "控制 CRM、ERP、工单、财务等业务系统访问。",
    en: "Controls access to CRM, ERP, ticketing, finance, and other business systems."
  },
  automation: {
    "zh-CN": "控制计划任务、自动触发和无人值守执行。",
    en: "Controls scheduled jobs, automated triggers, and unattended execution."
  },
  memory: {
    "zh-CN": "控制持久记忆、知识库写入和历史检索。",
    en: "Controls persistent memory, knowledge-base writes, and historical retrieval."
  },
  nodes: {
    "zh-CN": "控制多节点、多代理之间的调用与协作边界。",
    en: "Controls cross-node and multi-agent invocation boundaries."
  },
  sessions: {
    "zh-CN": "控制跨会话读取、接管和上下文复用等会话级操作。",
    en: "Controls cross-session reads, takeovers, and context reuse."
  }
};

export const DESTINATION_TYPE_TEXT = {
  public: { "zh-CN": "公网", en: "Public Internet" },
  personal_storage: { "zh-CN": "个人网盘", en: "Personal Storage" },
  paste_service: { "zh-CN": "粘贴站点", en: "Paste Service" },
  internal: { "zh-CN": "内部网络", en: "Internal Network" },
  unknown: { "zh-CN": "未知地址", en: "Unknown Destination" }
};

export const TRUST_LEVEL_TEXT = {
  trusted: { "zh-CN": "受信输入", en: "Trusted Input" },
  untrusted: { "zh-CN": "未受信输入", en: "Untrusted Input" }
};

export const DATA_LABEL_TEXT = {
  secret: { "zh-CN": "机密信息", en: "Secrets" },
  pii: { "zh-CN": "个人隐私", en: "PII" },
  customer_data: { "zh-CN": "客户数据", en: "Customer Data" },
  financial: { "zh-CN": "财务数据", en: "Financial Data" },
  communications: { "zh-CN": "通信内容", en: "Communications" },
  otp: { "zh-CN": "验证码", en: "OTP" },
  browser_secret: { "zh-CN": "浏览器凭据", en: "Browser Secrets" },
  media: { "zh-CN": "媒体资料", en: "Media" }
};

export const RULE_IMPACT_EXAMPLES = {
  "high-risk-command-block": {
    scene: "执行 `rm -rf` 或 `curl ... | sh` 这类高危命令。",
    result: "系统会直接拦截，命令不会落地执行。",
    tip: "先缩小操作范围到具体文件，再改成可审查的分步执行。"
  },
  "workspace-outside-write-block": {
    scene: "删除工作区外目录，或者改写系统目录文件。",
    result: "系统会立即拦截，防止误删系统文件或污染宿主环境。",
    tip: "把操作限定在工作区内，或由管理员走受控变更流程。"
  },
  "sensitive-directory-enumeration-challenge": {
    scene: "批量列出 `.ssh`、`.kube` 或 `Downloads` 目录内容。",
    result: "系统会进入审批，确认后才允许继续枚举。",
    tip: "仅查询必要目录和必要文件，减少不必要的高敏暴露。"
  },
  "credential-path-access-challenge": {
    scene: "读取 `.env`、`id_rsa`、`aws/credentials` 这类凭据文件。",
    result: "系统会先要求审批，再决定是否允许读取。",
    tip: "优先使用脱敏配置或只读必要字段，避免整文件暴露。"
  },
  "public-network-egress-challenge": {
    scene: "把数据请求发到公网 API 或个人网盘。",
    result: "系统会先要求审批，防止数据未经确认外发。",
    tip: "先确认目的地可信且业务必要，再由审批放行。"
  },
  "sensitive-public-egress-block": {
    scene: "把含客户信息或财务信息的数据发送到公网。",
    result: "系统会直接拦截，避免高敏数据泄露。",
    tip: "先做脱敏处理，确认不含敏感标签后再发往外部。"
  },
  "sensitive-archive-challenge": {
    scene: "打包压缩客户数据并导出。",
    result: "系统会进入审批，审批通过才允许归档导出。",
    tip: "尽量按最小范围导出，避免一次性打包过多敏感数据。"
  },
  "critical-control-plane-change-challenge": {
    scene: "修改 `Dockerfile`、`*.tf` 或 `k8s` 部署文件。",
    result: "系统会先要求审批，防止关键配置误改上线。",
    tip: "先在变更单说明影响范围与回滚方案，再申请放行。"
  },
  "email-content-access-challenge": {
    scene: "读取邮箱正文、附件，或者导出邮件。",
    result: "系统会进入审批，确认后才允许读取或导出。",
    tip: "优先按关键词和时间范围缩小查询，减少无关数据暴露。"
  },
  "sms-content-access-challenge": {
    scene: "读取短信内容、历史会话，或者导出短信。",
    result: "系统会先要求审批，审批通过后才能继续。",
    tip: "只读取与任务相关的短信范围，避免批量拉取全部记录。"
  },
  "sms-otp-block": {
    scene: "读取包含验证码或登录提醒的短信。",
    result: "系统会直接拦截，避免账号验证信息被滥用。",
    tip: "验证码应由账号持有人手动输入，不应由代理读取。"
  },
  "album-sensitive-read-challenge": {
    scene: "读取相册里的截图、证件照或 OCR 扫描件。",
    result: "系统会进入审批，审批通过后才允许访问。",
    tip: "先缩小到单个文件，再确认是否真的需要读取图片内容。"
  },
  "browser-credential-block": {
    scene: "读取浏览器 Cookie、密码或自动填充内容。",
    result: "系统会直接拦截，防止凭据被提取后冒用。",
    tip: "改用正规登录或令牌授权流程，不要直接抓取浏览器凭据。"
  },
  "business-system-bulk-read-block": {
    scene: "从 CRM/ERP 等系统批量读取或导出大量记录。",
    result: "系统会直接拦截，防止业务数据被一次性带出。",
    tip: "先拆分为小批次、最小字段范围，并走审批或脱敏流程。"
  }
};

export const RULE_EXPLANATIONS: RuleExplanationMap = {
  "high-risk-command-block": {
    summary: {
      "zh-CN": "命中删除、提权、下载后执行等高危命令时直接拦截。",
      en: "Directly blocks destructive deletion, privilege escalation, and download-and-execute commands."
    },
    handling: {
      "zh-CN": "当前处理方式是拦截。",
      en: "The current handling is block."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "磁盘快满了，我想把那整个临时目录直接清掉。",
          en: "Disk is almost full. I want to wipe that whole temp directory now."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "这个请求包含高危删除动作，我会直接拦截。",
          en: "This request contains a high-risk destructive action, so I will block it."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "把这个脚本下载下来后直接执行。",
          en: "Download this script and execute it."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中下载后执行模式，系统直接拦截。",
          en: "This matches a download-and-execute pattern, so the system blocks it."
        }
      }
    ]
  },
  "workspace-outside-write-block": {
    summary: {
      "zh-CN": "写入或删除工作区外和系统目录时直接拦截。",
      en: "Blocks writes and deletes outside the workspace or in system paths."
    },
    handling: {
      "zh-CN": "当前处理方式是拦截。",
      en: "The current handling is block."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "我想把生成结果直接写到桌面目录，省得再挪文件。",
          en: "I want to save the output straight to Desktop so I can skip moving files."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "目标路径在工作区外，这类写入会被直接拦截。",
          en: "The target path is outside the workspace, so this write is blocked."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "帮我改 `/etc/hosts`。",
          en: "Edit `/etc/hosts`."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中系统目录写入模式，系统直接拦截。",
          en: "This matches a system-path write, so the system blocks it."
        }
      }
    ]
  },
  "sensitive-directory-enumeration-challenge": {
    summary: {
      "zh-CN": "枚举凭据、下载区、浏览器资料等敏感目录时先审批。",
      en: "Requires approval before enumerating sensitive directories such as credentials, downloads, or browser data."
    },
    handling: {
      "zh-CN": "当前处理方式是需确认。",
      en: "The current handling is approval."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "我在排查登录问题，先把 .ssh 目录内容都列出来看看。",
          en: "I'm troubleshooting login issues and want to list everything in `.ssh` first."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "这是敏感目录枚举请求，需要先审批。",
          en: "This is sensitive directory enumeration, so approval is required."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "搜索一下 `Downloads` 目录里的文件。",
          en: "Search the files under `Downloads`."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "目录命中高风险范围，系统先要求审批。",
          en: "The directory is in a high-risk scope, so the system asks for approval first."
        }
      }
    ]
  },
  "credential-path-access-challenge": {
    summary: {
      "zh-CN": "读取密钥、令牌和云凭据文件时先审批。",
      en: "Requires approval before reading key, token, or cloud credential files."
    },
    handling: {
      "zh-CN": "当前处理方式是需确认。",
      en: "The current handling is approval."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "连接一直失败，我想直接看一下本机私钥文件内容。",
          en: "The connection keeps failing. I want to inspect the local private key file directly."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "这属于凭据文件读取场景，必须先审批。",
          en: "This falls under credential-file access, so approval is required."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "读一下 `.env` 里的密钥。",
          en: "Read the secret values from `.env`."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中敏感凭据文件，系统先暂停。",
          en: "This hits a sensitive credential file, so the system pauses for approval."
        }
      }
    ]
  },
  "communication-store-access-challenge": {
    summary: {
      "zh-CN": "访问本地邮件、消息库和聊天记录时先审批。",
      en: "Requires approval before accessing local mail, message stores, or chat history."
    },
    handling: {
      "zh-CN": "当前处理方式是需确认。",
      en: "The current handling is approval."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "我在做故障复盘，想把这台机器上的消息历史都拉出来。",
          en: "I'm doing an incident review and want to pull message history from this machine."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "请求涉及本地通信存储访问，需要先审批。",
          en: "This request accesses local communication storage, so approval is required."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "导出聊天记录给我。",
          en: "Export the chat history."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中本地通信存储，系统先要求审批。",
          en: "This hits a local communication store, so the system asks for approval first."
        }
      }
    ]
  },
  "public-network-egress-challenge": {
    summary: {
      "zh-CN": "访问公网、未知域、网盘或粘贴站点时先审批。",
      en: "Requires approval before requests to public, unknown, storage, or paste destinations."
    },
    handling: {
      "zh-CN": "当前处理方式是需确认。",
      en: "The current handling is approval."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "我想把这份分析结果直接回传到一个公网接口。",
          en: "I want to send this analysis result directly to a public API endpoint."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "目标是公网地址，外发前需要审批确认。",
          en: "The destination is public, so outbound delivery needs approval first."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "上传到这个个人网盘链接。",
          en: "Upload to this personal storage link."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中公网外发规则，先走审批。",
          en: "This matches public egress, so approval is required."
        }
      }
    ]
  },
  "sensitive-public-egress-block": {
    summary: {
      "zh-CN": "含机密、PII 或客户数据时，禁止直接外发到公网。",
      en: "Blocks direct public egress when data is labeled as secret, PII, or customer data."
    },
    handling: {
      "zh-CN": "当前处理方式是拦截。",
      en: "The current handling is block."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "为了给外包同学排查，我打算把客户名单放到公开仓库。",
          en: "To help an external teammate troubleshoot, I plan to upload the customer list to a public repo."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "内容带有客户敏感标签，这类公网外发会被直接拦截。",
          en: "This content is labeled as customer-sensitive, so public egress is blocked."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "把这份含密钥的日志贴到外部站点。",
          en: "Paste this log with secrets to an external site."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中敏感外发规则，系统直接拦截。",
          en: "This hits a sensitive egress rule, so the system blocks it."
        }
      }
    ]
  },
  "sensitive-archive-challenge": {
    summary: {
      "zh-CN": "归档、压缩或导出敏感内容时先审批。",
      en: "Requires approval before archiving, compressing, or exporting sensitive content."
    },
    handling: {
      "zh-CN": "当前处理方式是需确认。",
      en: "The current handling is approval."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "业务方催得急，我想先把客户资料整包导出来。",
          en: "The business team is pushing hard, so I want to export all customer files in one package."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "归档内容包含敏感数据，导出前需要审批。",
          en: "The archive includes sensitive data, so approval is required before export."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "压缩这批财务资料发给我。",
          en: "Compress and send me this financial data."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "归档内容带有敏感标签，系统先暂停。",
          en: "The archive contains sensitive labels, so the system pauses for approval."
        }
      }
    ]
  },
  "critical-control-plane-change-challenge": {
    summary: {
      "zh-CN": "修改发布、部署、Terraform 或 K8s 文件时先审批。",
      en: "Requires approval before changing release, deployment, Terraform, or Kubernetes files."
    },
    handling: {
      "zh-CN": "当前处理方式是需确认。",
      en: "The current handling is approval."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "线上要紧急修复，我准备直接改部署文件发版。",
          en: "We need an urgent production fix, and I plan to edit deployment config and release immediately."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "这是关键发布配置变更，请先走审批。",
          en: "This is a critical release-config change, so approval is required first."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "更新 `Dockerfile` 后直接上线。",
          en: "Update the `Dockerfile` and ship it."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中关键发布文件，系统先要求审批。",
          en: "This hits a critical release file, so the system asks for approval first."
        }
      }
    ]
  },
  "email-content-access-challenge": {
    summary: {
      "zh-CN": "读取邮箱正文、附件或导出邮件时先审批。",
      en: "Requires approval before reading email content, attachments, or exports."
    },
    handling: {
      "zh-CN": "当前处理方式是需确认。",
      en: "The current handling is approval."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "我先帮你把这封邮件正文和附件都看一遍。",
          en: "I'll go through the full email body and attachments for you first."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "邮件正文/附件读取属于通信内容访问，需要审批。",
          en: "Reading email body/attachments is communication-content access, so approval is required."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "把收件箱里的附件导出来。",
          en: "Export the attachments from the inbox."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中邮件导出，系统先暂停。",
          en: "This hits email export, so the system pauses for approval."
        }
      }
    ]
  },
  "sms-content-access-challenge": {
    summary: {
      "zh-CN": "读取短信正文、会话历史或导出短信时先审批。",
      en: "Requires approval before reading SMS content, conversation history, or exports."
    },
    handling: {
      "zh-CN": "当前处理方式是需确认。",
      en: "The current handling is approval."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "我想把最近一周的短信内容都抓出来做分析。",
          en: "I want to pull SMS content from the past week for analysis."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "短信正文读取会触发通信访问规则，需要审批。",
          en: "Reading SMS bodies triggers communication-access controls, so approval is required."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "把这段短信历史导出。",
          en: "Export this SMS history."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中短信导出，系统先要求审批。",
          en: "This hits SMS export, so the system asks for approval first."
        }
      }
    ]
  },
  "sms-otp-block": {
    summary: {
      "zh-CN": "包含验证码、登录提醒或 OTP 的短信直接拦截。",
      en: "Directly blocks SMS that contains OTP, verification codes, or login alerts."
    },
    handling: {
      "zh-CN": "当前处理方式是拦截。",
      en: "The current handling is block."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "登录卡住了，帮我把验证码短信内容念出来。",
          en: "Login is stuck. Please read out the verification-code SMS."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "验证码和登录提醒属于高敏短信内容，会被直接拦截。",
          en: "Verification codes and login alerts are high-sensitivity SMS content and are blocked."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "帮我找登录提醒短信。",
          en: "Find the login-alert SMS."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中验证码类短信，系统直接拦截。",
          en: "This hits verification-code SMS, so the system blocks it."
        }
      }
    ]
  },
  "album-sensitive-read-challenge": {
    summary: {
      "zh-CN": "读取截图、证件照、扫描件或 OCR 图片时先审批。",
      en: "Requires approval before reading screenshots, ID photos, scans, or OCR-oriented images."
    },
    handling: {
      "zh-CN": "当前处理方式是需确认。",
      en: "The current handling is approval."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "我想从相册里那张截图提取文字发给你。",
          en: "I want to extract text from that screenshot in the album and send it to you."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "截图或 OCR 类相册内容读取会先进入审批。",
          en: "Reading screenshot or OCR-oriented album content requires approval first."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "读取这张证件照里的信息。",
          en: "Read the information in this ID photo."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中相册敏感内容，系统先暂停。",
          en: "This hits sensitive album content, so the system pauses for approval."
        }
      }
    ]
  },
  "browser-credential-block": {
    summary: {
      "zh-CN": "读取浏览器 Cookie、密码、自动填充信息时直接拦截。",
      en: "Directly blocks access to browser cookies, passwords, and autofill data."
    },
    handling: {
      "zh-CN": "当前处理方式是拦截。",
      en: "The current handling is block."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "我想复用现成登录态，直接把浏览器 Cookie 导出来。",
          en: "I want to reuse the current login session and export browser cookies directly."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "浏览器凭据数据受保护，这类读取会被直接拦截。",
          en: "Browser credential data is protected, so this access is blocked."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "导出自动填充密码。",
          en: "Export the autofill passwords."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中浏览器秘密数据，系统直接拦截。",
          en: "This hits browser secret data, so the system blocks it."
        }
      }
    ]
  },
  "business-system-bulk-read-block": {
    summary: {
      "zh-CN": "从 CRM、ERP、财务或客服系统批量读取时直接拦截。",
      en: "Directly blocks bulk reads from CRM, ERP, finance, or support systems."
    },
    handling: {
      "zh-CN": "当前处理方式是拦截。",
      en: "The current handling is block."
    },
    examples: [
      {
        role: "user",
        text: {
          "zh-CN": "开会前我想把 CRM 全量客户数据先导出来。",
          en: "Before the meeting, I want to export the full customer dataset from CRM."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "这是业务系统批量读取场景，会被直接拦截。",
          en: "This is a bulk read scenario in a business system, so it is blocked."
        }
      },
      {
        role: "user",
        text: {
          "zh-CN": "读取财务系统里的 100 条订单。",
          en: "Read 100 orders from the finance system."
        }
      },
      {
        role: "system",
        text: {
          "zh-CN": "命中批量导出模式，系统直接拦截。",
          en: "This hits a bulk export pattern, so the system blocks it."
        }
      }
    ]
  }
};

const RULE_EXPLANATION_FALLBACK: RuleExplanation = {
  summary: {
    "zh-CN": "这条规则用于说明什么请求会命中它。",
    en: "This rule explains which requests will match it."
  },
  handling: {
    "zh-CN": "当前处理方式按规则里的默认动作执行。",
    en: "The current handling follows the rule's default action."
  },
  examples: [
    {
      role: "user",
      text: {
        "zh-CN": "这个请求会不会命中这条规则？",
        en: "Will this request match the rule?"
      }
    },
    {
      role: "system",
      text: {
        "zh-CN": "如果请求条件和匹配项一致，就会命中。",
        en: "If the request matches the rule conditions, it will trigger."
      }
    },
    {
      role: "user",
      text: {
        "zh-CN": "那没命中的话会怎样？",
        en: "What happens if it does not match?"
      }
    },
    {
      role: "system",
      text: {
        "zh-CN": "不会走这条规则，会继续匹配其他策略。",
        en: "This rule is skipped and other policies continue to evaluate."
      }
    }
  ]
};

export const RULE_TEXT_OVERRIDES: RuleTextOverrides = {
  "high-risk-command-block": {
    title: { "zh-CN": "高危命令模式默认拦截", en: "Block High-Risk Command Patterns" },
    description: {
      "zh-CN": "阻断删除、权限递归修改、下载后执行、提权和停用系统审计等高危命令模式。",
      en: "Blocks high-risk command patterns such as destructive deletion, recursive permission changes, download-and-execute behavior, privilege escalation, and audit shutdown commands."
    }
  },
  "workspace-outside-write-block": {
    title: {
      "zh-CN": "工作区外或系统目录写入删除默认拦截",
      en: "Block Writes/Deletes Outside Workspace or in System Paths"
    },
    description: {
      "zh-CN": "阻断对工作区外和系统目录的写入、删除或覆盖类操作。",
      en: "Blocks write, delete, or overwrite operations targeting paths outside the workspace or system directories."
    }
  },
  "sensitive-directory-enumeration-challenge": {
    title: { "zh-CN": "枚举敏感目录需审批", en: "Approval Required for Sensitive Directory Enumeration" },
    description: {
      "zh-CN": "对凭据目录、配置目录和下载区等高风险目录的枚举与搜索默认进入审批。",
      en: "Routes enumeration and search actions on high-risk directories (credentials/config/downloads) to approval."
    }
  },
  "credential-path-access-challenge": {
    title: { "zh-CN": "敏感凭据路径访问需审批", en: "Approval Required for Credential Path Access" },
    description: {
      "zh-CN": "读取 .env、SSH、Kube、包管理凭据和云访问凭据时默认要求审批。",
      en: "Requires approval before reading sensitive credential paths such as .env, SSH keys, kube config, package credentials, and cloud credentials."
    }
  },
  "public-network-egress-challenge": {
    title: { "zh-CN": "访问公网接口需审批", en: "Approval Required for Public Network Egress" },
    description: {
      "zh-CN": "访问公网、未知域、个人网盘或 paste 类站点时，至少要求显式审批。",
      en: "Requires explicit approval for requests to public or unknown destinations, personal cloud storage, or paste services."
    }
  },
  "sensitive-public-egress-block": {
    title: { "zh-CN": "敏感数据向公网外发默认拦截", en: "Block Sensitive Data Egress to Public Destinations" },
    description: {
      "zh-CN": "当请求命中客户、财务、PII、通信或密钥类数据标签时，禁止直接向公网外发。",
      en: "Blocks direct public egress when data is labeled as customer, financial, PII, communications, or secrets."
    }
  },
  "sensitive-archive-challenge": {
    title: { "zh-CN": "敏感内容归档导出需审批", en: "Approval Required for Sensitive Archive/Export" },
    description: {
      "zh-CN": "对客户数据、财务资料、密钥或媒体资料进行归档、压缩或导出时要求审批。",
      en: "Requires approval for archive/compress/export actions on customer data, financial data, secrets, or media."
    }
  },
  "critical-control-plane-change-challenge": {
    title: { "zh-CN": "关键控制面文件变更需审批", en: "Approval Required for Critical Control-Plane Changes" },
    description: {
      "zh-CN": "修改 CI/CD、部署、容器、Terraform、Kubernetes 或 IAM 相关文件时默认进入审批。",
      en: "Requires approval for changes to CI/CD, deployment, container, Terraform, Kubernetes, or IAM-related files."
    }
  },
  "email-content-access-challenge": {
    title: { "zh-CN": "读取邮箱正文或附件需审批", en: "Approval Required for Email Content Access" },
    description: {
      "zh-CN": "邮箱正文、附件、搜索结果和批量导出默认纳入审批流。",
      en: "Routes email body, attachments, search results, and bulk export actions into approval flow."
    }
  },
  "sms-content-access-challenge": {
    title: { "zh-CN": "读取短信内容需审批", en: "Approval Required for SMS Content Access" },
    description: {
      "zh-CN": "短信正文、会话历史、搜索结果和导出默认纳入审批流。",
      en: "Routes SMS body, conversation history, search results, and export actions into approval flow."
    }
  },
  "sms-otp-block": {
    title: { "zh-CN": "读取短信验证码或登录通知默认拦截", en: "Block OTP/Login SMS Access" },
    description: {
      "zh-CN": "命中 OTP、验证码或登录提醒等短信内容时直接拦截。",
      en: "Directly blocks SMS access when OTP, verification code, or login-alert content is detected."
    }
  },
  "album-sensitive-read-challenge": {
    title: { "zh-CN": "读取截图、扫描件或证件照片需审批", en: "Approval Required for Sensitive Album Reads" },
    description: {
      "zh-CN": "相册中的截图、录屏、扫描件、证件和 OCR 文本读取默认进入审批。",
      en: "Routes access to screenshots, screen recordings, scans, IDs, and OCR-related album content to approval."
    }
  },
  "browser-credential-block": {
    title: { "zh-CN": "读取浏览器 Cookie、密码或自动填充默认拦截", en: "Block Browser Credential Access" },
    description: {
      "zh-CN": "浏览器凭据、Cookie、自动填充和下载历史等高敏内容读取默认阻断。",
      en: "Blocks access to browser credentials, cookies, autofill, and other high-sensitivity browser secrets."
    }
  },
  "business-system-bulk-read-block": {
    title: { "zh-CN": "业务系统批量读取默认拦截", en: "Block Bulk Reads from Business Systems" },
    description: {
      "zh-CN": "CRM、ERP、HR、财务、工单与客服系统的批量读取或导出默认拦截。",
      en: "Blocks bulk read/export actions from CRM, ERP, HR, finance, ticketing, and customer-support systems."
    }
  }
};

export function decisionLabel(decision: string | null | undefined): string {
  return readLocalized(DECISION_TEXT, decision, String(decision || "-"));
}

export function decisionSourceLabel(source: string | null | undefined): string {
  return readLocalized(DECISION_SOURCE_TEXT, source, "-");
}

export function accountModeLabel(mode: string | null | undefined): string {
  return readLocalized(ACCOUNT_MODE_TEXT, mode, mode || "-");
}

export function scopeLabel(scope: string | null | undefined): string {
  if (!scope) return ui("未知作用域", "Unknown scope");
  return readLocalized(SCOPE_TEXT, scope, scope);
}

export function controlDomainLabel(domain: string | null | undefined): string {
  if (!domain) return ui("未分类", "Uncategorized");
  return readLocalized(CONTROL_DOMAIN_TEXT, domain, domain);
}

export function capabilityLabel(capabilityId: string | null | undefined): string {
  if (!capabilityId) return ui("未分类能力", "Uncategorized Capability");
  return readLocalized(CAPABILITY_TEXT, capabilityId, capabilityId);
}

export function capabilityDescription(capabilityId: string | null | undefined): string {
  if (!capabilityId) {
    return ui(
      "用于承载一组相近能力的默认策略和附加限制。",
      "Holds the default posture and additional restrictions for a related set of capabilities."
    );
  }
  return readLocalized(
    CAPABILITY_DESCRIPTION_TEXT,
    capabilityId,
    ui("用于承载这组能力的默认策略和附加限制。", "Holds the default posture and additional restrictions for this capability group.")
  );
}

export function severityLabel(severity: string | null | undefined): string {
  return readLocalized(SEVERITY_TEXT, severity, severity || ui("未分级", "Unrated"));
}

export function skillRiskLabel(value: string | null | undefined): string {
  return readLocalized(SKILL_RISK_TIER_TEXT, value, value || "-");
}

export function skillStateLabel(value: string | null | undefined): string {
  return readLocalized(SKILL_STATE_TEXT, value, value || "-");
}

export function skillScanStatusLabel(value: string | null | undefined): string {
  return readLocalized(SKILL_SCAN_STATUS_TEXT, value, value || "-");
}

export function skillSourceLabel(value: string | null | undefined, detail?: string): string {
  const source = readLocalized(SKILL_SOURCE_TEXT, value, value || ui("未知来源", "Unknown Source"));
  return detail ? `${source} · ${detail}` : source;
}

export function skillSeverityLabel(value: string | null | undefined): string {
  return readLocalized(SKILL_SEVERITY_TEXT, value, value || "-");
}

export function skillReasonLabel(value: string | null | undefined): string {
  return readLocalized(SKILL_REASON_TEXT, value, value || "-");
}

export function skillActivityLabel(value: string | null | undefined): string {
  return readLocalized(SKILL_ACTIVITY_TEXT, value, value || "-");
}

export function skillRiskFilterLabel(value: string): string {
  if (value === "all") return ui("全部风险", "All Risk Tiers");
  return skillRiskLabel(value);
}

export function skillStateFilterLabel(value: string): string {
  if (value === "all") return ui("全部状态", "All States");
  return skillStateLabel(value);
}

export function skillDriftFilterLabel(value: string): string {
  if (value === "all") return ui("全部变更状态", "All Change States");
  if (value === "drifted") return ui("仅看未声明变更", "Changed Without Version Update");
  return ui("无未声明变更", "No Undeclared Change");
}

export function skillInterceptFilterLabel(value: string): string {
  if (value === "all") return ui("全部拦截状态", "All Interception States");
  return ui("24 小时内有需确认 / 拦截", "Challenge / Block in Last 24h");
}

export function withLabel(value: string | null | undefined, labels: LocalizedMap): string {
  return readLocalized(labels, value, value ?? "");
}

export function localizedRuleField(ruleId: string | null | undefined, field: RuleTextField): string | undefined {
  if (!ruleId) return undefined;
  const item = RULE_TEXT_OVERRIDES[ruleId];
  const fieldValue = item?.[field];
  if (!fieldValue) return undefined;
  return fieldValue[activeLocale] || fieldValue.en || fieldValue["zh-CN"];
}

export function ruleExplanation(ruleId: string | null | undefined): RuleExplanation {
  if (!ruleId) return RULE_EXPLANATION_FALLBACK;
  return RULE_EXPLANATIONS[ruleId] || RULE_EXPLANATION_FALLBACK;
}
