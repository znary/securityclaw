import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";

const REFRESH_INTERVAL_MS = 15000;
const DECISIONS_PER_PAGE = 12;
const TAB_ITEMS = [
  {
    id: "overview",
    label: "概览"
  },
  {
    id: "events",
    label: "决策记录"
  },
  {
    id: "rules",
    label: "规则策略"
  }
];

const DECISION_TEXT = {
  allow: "放行",
  warn: "提醒",
  challenge: "需确认",
  block: "拦截"
};
const DECISION_OPTIONS = ["allow", "warn", "challenge", "block"];

const DECISION_SOURCE_TEXT = {
  rule: "规则命中",
  default: "默认放行",
  approval: "审批放行"
};

const CONTROL_DOMAIN_TEXT = {
  execution_control: "执行控制",
  data_access: "数据访问",
  data_egress: "数据外发",
  credential_protection: "凭据保护",
  change_control: "变更控制",
  approval_exception: "审批例外"
};

const SEVERITY_TEXT = {
  low: "低风险",
  medium: "中风险",
  high: "高风险",
  critical: "严重"
};

const CONTROL_DOMAIN_SECURITY_GAIN_TEXT = {
  execution_control: "降低误执行高危命令、系统损坏和被植入后门的风险。",
  data_access: "减少越权读取、批量拉取和误触敏感信息的风险。",
  data_egress: "避免机密信息直接流向公网或不受控的外部渠道。",
  credential_protection: "保护账号、密钥、令牌等核心凭据，减少账号被盗用风险。",
  change_control: "降低关键发布和基础设施配置被误改后引发生产事故的风险。",
  approval_exception: "确保紧急例外仍有审批责任人和完整审计链路。"
};

const DECISION_IMPACT_TEXT = {
  allow: "命中后会继续执行，用户几乎无感知，但会保留审计记录。",
  warn: "命中后会继续执行，同时给出风险提醒，便于用户及时纠正。",
  challenge: "命中后会先暂停，需审批通过后才继续，流程会比平时慢一些。",
  block: "命中后会立即拦截，操作不会执行，需要改用更安全方案。"
};

const OPERATION_TEXT = {
  read: "读取",
  search: "搜索",
  list: "枚举",
  write: "写入",
  delete: "删除",
  modify: "修改",
  export: "导出"
};

const TOOL_GROUP_TEXT = {
  execution: "执行命令",
  filesystem: "文件访问",
  network: "网络访问",
  archive: "归档导出",
  email: "邮箱访问",
  sms: "短信访问",
  album: "相册访问",
  browser: "浏览器数据访问",
  business: "业务系统访问"
};

const DESTINATION_TYPE_TEXT = {
  public: "公网",
  personal_storage: "个人网盘",
  paste_service: "粘贴站点",
  internal: "内部网络",
  unknown: "未知地址"
};

const TRUST_LEVEL_TEXT = {
  trusted: "受信输入",
  untrusted: "未受信输入"
};

const DATA_LABEL_TEXT = {
  secret: "机密信息",
  pii: "个人隐私",
  customer_data: "客户数据",
  financial: "财务数据",
  communications: "通信内容",
  otp: "验证码",
  browser_secret: "浏览器凭据",
  media: "媒体资料"
};

const RULE_IMPACT_EXAMPLES = {
  "high-risk-command-block": {
    scene: "执行 `rm -rf` 或 `curl ... | sh` 这类高危命令。",
    result: "系统会直接拦截，命令不会落地执行。",
    tip: "先缩小操作范围到具体文件，再改成可审查的分步执行。"
  },
  "untrusted-execution-challenge": {
    scene: "执行聊天里收到的陌生命令。",
    result: "系统会先要求审批，审批通过后才能执行。",
    tip: "先确认命令来源和用途，再提交审批，避免执行恶意指令。"
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
  },
  "break-glass-exception-challenge": {
    scene: "发起 break-glass 例外请求，绕过常规规则。",
    result: "系统会要求单次审批并绑定当前 trace 后才放行。",
    tip: "仅在紧急故障处置时使用，并在工单里补齐风险说明。"
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function toArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatTime(iso) {
  if (!iso) return "-";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return String(iso);
  return date.toLocaleString("zh-CN", { hour12: false });
}

function decisionLabel(decision) {
  return DECISION_TEXT[decision] || String(decision || "-");
}

function decisionSourceLabel(source) {
  return DECISION_SOURCE_TEXT[source] || "-";
}

function resourceScopeLabel(scope) {
  if (!scope) return "-";
  if (scope === "workspace_inside") return "工作区内";
  if (scope === "workspace_outside") return "工作区外";
  if (scope === "system") return "系统目录";
  if (scope === "none") return "无路径";
  return scope;
}

function getJsonError(payload, fallback) {
  if (payload && typeof payload === "object" && payload.error) {
    return String(payload.error);
  }
  return fallback;
}

async function getJson(url) {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  const payload = await response.json();
  if (!response.ok) {
    throw new Error(getJsonError(payload, `请求失败: ${response.status}`));
  }
  return payload;
}

function extractPolicies(strategyPayload) {
  const list = strategyPayload?.strategy?.policies;
  return Array.isArray(list)
    ? clone(list).map((policy) => ({ ...policy, enabled: true }))
    : [];
}

function formatList(values) {
  return values.join(" | ");
}

function summarizeMatch(match) {
  const scopes = toArray(match?.scope);
  const tools = toArray(match?.tool);
  const toolGroups = toArray(match?.tool_group);
  const operations = toArray(match?.operation);
  const identities = toArray(match?.identity);
  const resourceScopes = toArray(match?.resource_scope);
  const fileTypes = toArray(match?.file_type);
  const assetLabels = toArray(match?.asset_labels);
  const dataLabels = toArray(match?.data_labels);
  const trustLevels = toArray(match?.trust_level);
  const destinationTypes = toArray(match?.destination_type);
  const destinationDomains = toArray(match?.dest_domain);
  const destinationIpClasses = toArray(match?.dest_ip_class);
  const pathMatchers = [
    ...toArray(match?.path_prefix),
    ...toArray(match?.path_glob),
    ...toArray(match?.path_regex)
  ];
  const argMatchers = [...toArray(match?.tool_args_summary), ...toArray(match?.tool_args_regex)];

  const parts = [];
  if (scopes.length) parts.push(`范围: ${formatList(scopes)}`);
  if (tools.length) parts.push(`工具: ${formatList(tools)}`);
  if (toolGroups.length) parts.push(`工具组: ${formatList(toolGroups)}`);
  if (operations.length) parts.push(`动作: ${formatList(operations)}`);
  if (identities.length) parts.push(`身份: ${formatList(identities)}`);
  if (resourceScopes.length) parts.push(`资源范围: ${formatList(resourceScopes.map(resourceScopeLabel))}`);
  if (fileTypes.length) parts.push(`文件类型: ${formatList(fileTypes)}`);
  if (assetLabels.length) parts.push(`资产标签: ${formatList(assetLabels)}`);
  if (dataLabels.length) parts.push(`数据标签: ${formatList(dataLabels)}`);
  if (trustLevels.length) parts.push(`信任级别: ${formatList(trustLevels)}`);
  if (destinationTypes.length) parts.push(`目的地类型: ${formatList(destinationTypes)}`);
  if (destinationDomains.length) parts.push(`目的地域名: ${formatList(destinationDomains)}`);
  if (destinationIpClasses.length) parts.push(`目标 IP: ${formatList(destinationIpClasses)}`);
  if (pathMatchers.length) parts.push(`路径条件: ${pathMatchers.length} 条`);
  if (argMatchers.length) parts.push(`参数特征: ${argMatchers.length} 条`);
  if (typeof match?.min_file_count === "number") parts.push(`文件数 >= ${match.min_file_count}`);
  if (typeof match?.min_bytes === "number") parts.push(`字节数 >= ${match.min_bytes}`);
  if (typeof match?.min_record_count === "number") parts.push(`记录数 >= ${match.min_record_count}`);
  return parts.join(" · ") || "无附加匹配条件";
}

function ruleDescription(policy) {
  if (policy?.description) {
    return policy.description;
  }
  const action = decisionLabel(policy?.decision);
  const match = summarizeMatch(policy?.match);
  return `命中条件时执行“${action}”。${match}。`;
}

function controlDomainLabel(domain) {
  if (!domain) return "未分类";
  return CONTROL_DOMAIN_TEXT[domain] || domain;
}

function severityLabel(severity) {
  return SEVERITY_TEXT[severity] || severity || "未分级";
}

function policyTitle(policy, index) {
  return policy?.title || policy?.rule_id || `规则 ${index + 1}`;
}

function approvalSummary(requirements) {
  if (!requirements) return "";
  const parts = [];
  if (requirements.ticket_required) parts.push("工单必填");
  if (toArray(requirements.approver_roles).length) parts.push(`审批角色: ${formatList(requirements.approver_roles)}`);
  if (requirements.single_use) parts.push("单次放行");
  if (requirements.trace_binding === "trace") parts.push("绑定当前 trace");
  if (typeof requirements.ttl_seconds === "number") parts.push(`有效期 ${requirements.ttl_seconds} 秒`);
  return parts.join(" · ");
}

function formatSimpleList(values) {
  return toArray(values).filter(Boolean).join("、");
}

function withLabel(value, labels) {
  return labels[value] || value;
}

function approvalImpactSummary(requirements) {
  if (!requirements) return "";
  const parts = [];
  if (requirements.ticket_required) {
    parts.push("需要填写工单号");
  }
  const roles = formatSimpleList(requirements.approver_roles);
  if (roles) {
    parts.push(`需要 ${roles} 审批`);
  }
  if (requirements.single_use) {
    parts.push("每次审批仅可放行一次");
  }
  if (typeof requirements.ttl_seconds === "number") {
    const minutes = Math.max(1, Math.round(requirements.ttl_seconds / 60));
    parts.push(`审批通过后约 ${minutes} 分钟内有效`);
  }
  return parts.length ? `此外，${parts.join("，")}。` : "";
}

function impactTriggerSummary(policy) {
  if (policy?.description) {
    return policy.description;
  }
  const match = policy?.match || {};
  const parts = [];
  const toolGroups = toArray(match.tool_group).map((value) => withLabel(value, TOOL_GROUP_TEXT));
  const operations = toArray(match.operation).map((value) => withLabel(value, OPERATION_TEXT));
  const trustLevels = toArray(match.trust_level).map((value) => withLabel(value, TRUST_LEVEL_TEXT));
  const destinationTypes = toArray(match.destination_type).map((value) => withLabel(value, DESTINATION_TYPE_TEXT));
  const dataLabels = toArray(match.data_labels).map((value) => withLabel(value, DATA_LABEL_TEXT));
  const pathExample = toArray(match.path_glob)[0] || toArray(match.path_prefix)[0];

  if (toolGroups.length) {
    parts.push(`涉及${formatSimpleList(toolGroups)}相关操作`);
  }
  if (operations.length) {
    parts.push(`动作属于${formatSimpleList(operations)}`);
  }
  if (trustLevels.length) {
    parts.push(`输入来源是${formatSimpleList(trustLevels)}`);
  }
  if (destinationTypes.length) {
    parts.push(`目标是${formatSimpleList(destinationTypes)}`);
  }
  if (dataLabels.length) {
    parts.push(`内容被识别为${formatSimpleList(dataLabels)}`);
  }
  if (pathExample) {
    parts.push(`路径命中类似 ${pathExample}`);
  }
  return parts.join("，") || "当操作命中这条规则定义的风险条件时会触发。";
}

function securityGainSummary(policy) {
  const domain = policy?.control_domain || policy?.group;
  const base = CONTROL_DOMAIN_SECURITY_GAIN_TEXT[domain] || "减少误操作和敏感数据泄露风险。";
  if (policy?.decision === "block") {
    return `${base} 这条规则会在关键风险点直接刹车。`;
  }
  if (policy?.decision === "challenge") {
    return `${base} 这条规则会在高风险场景加一道人工确认。`;
  }
  if (policy?.decision === "warn") {
    return `${base} 这条规则会在不中断流程的前提下提醒风险。`;
  }
  return `${base} 同时保留审计记录，便于回溯。`;
}

function userImpactSummary(policy) {
  const base = DECISION_IMPACT_TEXT[policy?.decision] || DECISION_IMPACT_TEXT.allow;
  const approval = approvalImpactSummary(policy?.approval_requirements);
  return `${base}${approval ? ` ${approval}` : ""}`;
}

function fallbackImpactExample(policy, index) {
  return {
    scene: `执行「${policyTitle(policy, index)}」覆盖范围内的操作。`,
    result: `系统会按当前策略“${decisionLabel(policy?.decision)}”处理这次请求。`,
    tip: policy?.decision === "block"
      ? "如果业务必须执行，请先缩小操作范围，再联系管理员评估例外放行。"
      : "先确认操作必要性，再继续或提交审批。"
  };
}

function ruleImpactGuide(policy, index) {
  return {
    trigger: impactTriggerSummary(policy),
    securityGain: securityGainSummary(policy),
    userImpact: userImpactSummary(policy),
    example: RULE_IMPACT_EXAMPLES[policy?.rule_id] || fallbackImpactExample(policy, index)
  };
}

function assistantDecisionLine(policy) {
  if (policy?.decision === "block") {
    return "这个请求风险太高，我不能直接执行。";
  }
  if (policy?.decision === "challenge") {
    return "这个请求需要你确认审批后，我才能继续执行。";
  }
  if (policy?.decision === "warn") {
    return "这个请求可以继续，但我会先提醒你潜在风险。";
  }
  return "这个请求可以继续，我会按规则保留审计记录。";
}

function buildRuleConversation(policy, index) {
  const guide = ruleImpactGuide(policy, index);
  return [
    {
      role: "user",
      label: "你",
      text: guide.example.scene
    },
    {
      role: "assistant",
      label: "助手",
      text: assistantDecisionLine(policy)
    },
    {
      role: "system",
      label: "SafeClaw",
      text: guide.example.result
    },
    {
      role: "assistant",
      label: "助手",
      text: `更安全的做法：${guide.example.tip}`
    }
  ];
}

function formatPercent(value, total) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function buildPageItems(currentPage, totalPages) {
  if (totalPages <= 5) {
    return Array.from({ length: totalPages }, (_, index) => index + 1);
  }
  const start = Math.max(1, currentPage - 2);
  const end = Math.min(totalPages, start + 4);
  const adjustedStart = Math.max(1, end - 4);
  return Array.from({ length: end - adjustedStart + 1 }, (_, index) => adjustedStart + index);
}

function DecisionTag({ decision }) {
  return <span className={`tag ${decision || "allow"}`}>{decisionLabel(decision)}</span>;
}

function App() {
  const [statusPayload, setStatusPayload] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [publishedPolicies, setPublishedPolicies] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const [decisionPage, setDecisionPage] = useState(1);
  const [activeRuleKey, setActiveRuleKey] = useState("");
  const [sidePanelOffset, setSidePanelOffset] = useState(0);
  const rulesColumnRef = useRef(null);
  const firstRuleRef = useRef(null);

  const hasPendingChanges = useMemo(
    () => JSON.stringify(policies) !== JSON.stringify(publishedPolicies),
    [policies, publishedPolicies]
  );
  const groupedPolicies = useMemo(() => {
    const groups = new Map();
    policies.forEach((policy, index) => {
      const key = policy?.control_domain || policy?.group || "general";
      const list = groups.get(key) || [];
      list.push({ policy, index });
      groups.set(key, list);
    });
    return Array.from(groups.entries());
  }, [policies]);
  const policyEntries = useMemo(
    () => policies.map((policy, index) => ({ key: policy?.rule_id || String(index), policy, index })),
    [policies]
  );
  const firstRuleKey = policyEntries[0]?.key || "";

  const loadData = useCallback(async (syncRules = true, silent = false) => {
    if (!silent) {
      setLoading(true);
    }
    setError("");
    try {
      const [status, strategy] = await Promise.all([
        getJson("/api/status"),
        getJson("/api/strategy")
      ]);
      setStatusPayload(status);
      const nextPolicies = extractPolicies(strategy);
      setPublishedPolicies(nextPolicies);
      if (syncRules) {
        setPolicies(clone(nextPolicies));
      }
    } catch (loadError) {
      setError(String(loadError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData(true, false);
  }, [loadData]);

  useEffect(() => {
    if (hasPendingChanges || saving) {
      return undefined;
    }
    const timer = setInterval(() => {
      void loadData(true, true);
    }, REFRESH_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [hasPendingChanges, loadData, saving]);

  const totals = statusPayload?.totals || {};
  const decisions = toArray(statusPayload?.status?.recent_decisions);
  const latestDecision = decisions[0] || null;
  const totalDecisionPages = Math.max(1, Math.ceil(decisions.length / DECISIONS_PER_PAGE));
  const pagedDecisions = decisions.slice(
    (decisionPage - 1) * DECISIONS_PER_PAGE,
    decisionPage * DECISIONS_PER_PAGE
  );
  const pageItems = buildPageItems(decisionPage, totalDecisionPages);
  const firstDecisionIndex = decisions.length === 0 ? 0 : (decisionPage - 1) * DECISIONS_PER_PAGE + 1;
  const lastDecisionIndex = Math.min(decisionPage * DECISIONS_PER_PAGE, decisions.length);

  const stats = {
    total: Number(totals.total || 0),
    allow: Number(totals.allow || 0),
    watch: Number(totals.warn || 0) + Number(totals.challenge || 0),
    block: Number(totals.block || 0)
  };

  const savePolicies = useCallback(async (nextPolicies) => {
    const normalizedPolicies = nextPolicies.map((policy) => ({ ...policy, enabled: true }));
    setSaving(true);
    setError("");
    setMessage("规则自动保存中...");
    try {
      const response = await fetch("/api/strategy", {
        method: "PUT",
        headers: {
          "content-type": "application/json",
          accept: "application/json"
        },
        body: JSON.stringify({
          policies: normalizedPolicies
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(getJsonError(payload, "保存失败"));
      }
      const suffix = payload.restart_required ? " 需要重启 gateway 后完整生效。" : "";
      setMessage(`规则已自动保存。${payload.message || ""}${suffix}`.trim());
      setPublishedPolicies(clone(normalizedPolicies));
      await loadData(false, true);
    } catch (saveError) {
      setError(String(saveError));
      setMessage("");
    } finally {
      setSaving(false);
    }
  }, [loadData]);

  useEffect(() => {
    if (loading || saving || !hasPendingChanges) {
      return undefined;
    }
    setMessage("检测到规则变更，正在自动保存...");
    const timer = setTimeout(() => {
      void savePolicies(policies);
    }, 500);
    return () => clearTimeout(timer);
  }, [hasPendingChanges, loading, policies, savePolicies, saving]);

  useEffect(() => {
    setDecisionPage((current) => Math.min(current, totalDecisionPages));
  }, [totalDecisionPages]);

  useEffect(() => {
    if (!activeRuleKey) {
      return;
    }
    const exists = policyEntries.some((entry) => entry.key === activeRuleKey);
    if (!exists) {
      setActiveRuleKey("");
    }
  }, [activeRuleKey, policyEntries]);

  useEffect(() => {
    function updateOffset() {
      const column = rulesColumnRef.current;
      const firstRule = firstRuleRef.current;
      if (!column || !firstRule) {
        setSidePanelOffset(0);
        return;
      }
      const columnTop = column.getBoundingClientRect().top;
      const firstRuleTop = firstRule.getBoundingClientRect().top;
      setSidePanelOffset(Math.max(0, Math.round(firstRuleTop - columnTop)));
    }

    updateOffset();
    window.addEventListener("resize", updateOffset);
    let observer = null;
    if (typeof ResizeObserver === "function") {
      observer = new ResizeObserver(updateOffset);
      if (rulesColumnRef.current) {
        observer.observe(rulesColumnRef.current);
      }
      if (firstRuleRef.current) {
        observer.observe(firstRuleRef.current);
      }
    }

    return () => {
      window.removeEventListener("resize", updateOffset);
      if (observer) {
        observer.disconnect();
      }
    };
  }, [activeTab, firstRuleKey, policyEntries.length]);

  function onDecisionChange(index, decision) {
    setPolicies((current) => {
      const next = clone(current);
      next[index].decision = decision;
      next[index].enabled = true;
      return next;
    });
  }

  function onRuleCardKeyDown(event, entryKey) {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setActiveRuleKey(entryKey);
    }
  }

  function stopRuleCardEvent(event) {
    event.stopPropagation();
  }

  const tabCounts = {
    overview: stats.total,
    events: decisions.length,
    rules: policies.length
  };
  const postureTitle = stats.block > 0
    ? "防护规则正在主动拦截风险操作"
    : stats.watch > 0
      ? "当前以提醒和确认为主的审慎策略"
      : "当前以放行为主，运行相对平稳";
  const postureDescription = latestDecision
    ? `${decisionLabel(latestDecision.decision)} · ${latestDecision.tool || "未知操作"} · ${resourceScopeLabel(latestDecision.resource_scope)}`
    : "等待新的运行数据进入控制台。";
  const statusTone = error ? "error" : hasPendingChanges || saving ? "warn" : "good";
  const statusMessage = error || message || (hasPendingChanges ? "检测到规则变更，正在自动保存..." : "");
  const shouldShowStatus = Boolean(statusMessage);
  const activeRuleEntry = policyEntries.find((entry) => entry.key === activeRuleKey) || null;
  const activeRuleGuide = activeRuleEntry ? ruleImpactGuide(activeRuleEntry.policy, activeRuleEntry.index) : null;
  const activeRuleConversation = activeRuleEntry
    ? buildRuleConversation(activeRuleEntry.policy, activeRuleEntry.index)
    : [];
  const isRuleSideVisible = Boolean(activeRuleEntry && activeRuleGuide);

  return (
    <div className="app">
      <section className="workspace card">
        <div className="workspace-top">
          <div className="workspace-title">
            <div className="workspace-kicker">SafeClaw Admin</div>
            <div className="workspace-heading">
              <h1>管理后台</h1>
              <div className="tablist" role="tablist" aria-label="后台模块页签">
                {TAB_ITEMS.map((tab) => (
                  <button
                    key={tab.id}
                    id={`tab-${tab.id}`}
                    className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeTab === tab.id}
                    aria-controls={`panel-${tab.id}`}
                    onClick={() => setActiveTab(tab.id)}
                  >
                    <span className="tab-label">{tab.label}</span>
                    <span className="tab-count">{tabCounts[tab.id]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {shouldShowStatus ? (
          <div className={`status-inline status-banner ${statusTone}`}>
            <span className="status-dot" />
            <span>{statusMessage}</span>
          </div>
        ) : null}

        {activeTab === "overview" ? (
          <section
            id="panel-overview"
            className="tab-panel overview-panel"
            role="tabpanel"
            aria-labelledby="tab-overview"
          >
            <div className="card-head">
              <h2>概览</h2>
            </div>
            <div className="overview-grid">
              <div className="panel-card">
                <div className="stats">
                  <div className="stat">
                    <b>总请求</b>
                    <span>{stats.total}</span>
                  </div>
                  <div className="stat good">
                    <b>放行</b>
                    <span>{stats.allow}</span>
                  </div>
                  <div className="stat warn">
                    <b>提醒 / 确认</b>
                    <span>{stats.watch}</span>
                  </div>
                  <div className="stat bad">
                    <b>拦截</b>
                    <span>{stats.block}</span>
                  </div>
                </div>
              </div>

              <aside className="panel-card insight-card">
                <div className="insight-head">
                  <span className="eyebrow">当前态势</span>
                  <h3>{postureTitle}</h3>
                  <p>{postureDescription}</p>
                </div>
                <div className="insight-list">
                  <div className="insight-item">
                    <span>提醒 / 确认占比</span>
                    <strong>{formatPercent(stats.watch, stats.total)}</strong>
                  </div>
                  <div className="insight-item">
                    <span>拦截占比</span>
                    <strong>{formatPercent(stats.block, stats.total)}</strong>
                  </div>
                  <div className="insight-item">
                    <span>规则分组</span>
                    <strong>{groupedPolicies.length}</strong>
                  </div>
                  <div className="insight-item">
                    <span>生效规则</span>
                    <strong>{policies.length}</strong>
                  </div>
                </div>
                <div className="latest-event">
                  <div className="latest-event-head">
                    <span>最新决策</span>
                    {latestDecision ? <DecisionTag decision={latestDecision.decision} /> : null}
                  </div>
                  <p>{latestDecision ? toArray(latestDecision.reasons).join("，") || "无附加原因" : "暂无决策记录"}</p>
                </div>
              </aside>
            </div>
          </section>
        ) : null}

        {activeTab === "events" ? (
          <section
            id="panel-events"
            className="tab-panel"
            role="tabpanel"
            aria-labelledby="tab-events"
          >
            <div className="panel-card">
              <div className="card-head card-head-compact">
                <h2>决策记录</h2>
                <div className="header-actions">
                  <button
                    className="ghost small"
                    type="button"
                    onClick={() => void loadData(!hasPendingChanges && !saving, false)}
                  >
                    刷新
                  </button>
                </div>
              </div>
                <div className="table-wrap">
                  <table>
                  <thead>
                    <tr>
                      <th>时间</th>
                      <th>决策</th>
                      <th>来源</th>
                      <th>资源范围</th>
                      <th>环节</th>
                      <th>操作</th>
                      <th>原因</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.length === 0 ? (
                      <tr>
                        <td colSpan={7}>{loading ? "加载中..." : "暂无决策记录"}</td>
                      </tr>
                    ) : (
                      pagedDecisions.map((item, index) => (
                        <tr key={`${item.trace_id || "trace"}-${firstDecisionIndex + index}`}>
                          <td>{formatTime(item.ts)}</td>
                          <td>
                            <DecisionTag decision={item.decision} />
                          </td>
                          <td>{decisionSourceLabel(item.decision_source)}</td>
                          <td>{resourceScopeLabel(item.resource_scope)}</td>
                          <td>{item.hook || "-"}</td>
                          <td>{item.tool || "-"}</td>
                          <td>{toArray(item.reasons).join("，") || "-"}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              {decisions.length > 0 ? (
                <div className="pagination">
                  <div className="pagination-summary">
                    显示 {firstDecisionIndex}-{lastDecisionIndex} / {decisions.length} · 第 {decisionPage} / {totalDecisionPages} 页
                  </div>
                  <div className="pagination-controls">
                    <button
                      className="ghost small"
                      type="button"
                      disabled={decisionPage === 1}
                      onClick={() => setDecisionPage((current) => Math.max(1, current - 1))}
                    >
                      上一页
                    </button>
                    {pageItems.map((page) => (
                      <button
                        key={page}
                        className={`page-button ${page === decisionPage ? "active" : ""}`}
                        type="button"
                        aria-current={page === decisionPage ? "page" : undefined}
                        onClick={() => setDecisionPage(page)}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      className="ghost small"
                      type="button"
                      disabled={decisionPage === totalDecisionPages}
                      onClick={() => setDecisionPage((current) => Math.min(totalDecisionPages, current + 1))}
                    >
                      下一页
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
          </section>
        ) : null}

        {activeTab === "rules" ? (
          <section
            id="panel-rules"
            className="tab-panel"
            role="tabpanel"
            aria-labelledby="tab-rules"
          >
            <div className="panel-card">
              <div className="card-head">
                <h2>规则策略</h2>
                <div className="rule-meta">
                  <span className="meta-pill">分组 {groupedPolicies.length}</span>
                  <span className="meta-pill">规则 {policies.length}</span>
                </div>
              </div>

              <div className={`rules-layout ${isRuleSideVisible ? "with-side" : ""}`}>
                <div className="rules" ref={rulesColumnRef}>
                  {policies.length === 0 ? (
                    <div className="rule">暂无规则</div>
                  ) : (
                    groupedPolicies.map(([group, entries]) => (
                      <section key={group} className="rule-group">
                        <h4 className="rule-group-title">{controlDomainLabel(group)}</h4>
                        {entries.map(({ policy, index }) => {
                          const entryKey = policy.rule_id || String(index);
                          const isActive = entryKey === activeRuleKey;
                          return (
                            <article
                              key={entryKey}
                              className={`rule ${isActive ? "active" : ""}`}
                              ref={entryKey === firstRuleKey ? firstRuleRef : null}
                              role="button"
                              tabIndex={0}
                              aria-pressed={isActive}
                              aria-controls="active-rule-example-panel"
                              onClick={() => setActiveRuleKey(entryKey)}
                              onKeyDown={(event) => onRuleCardKeyDown(event, entryKey)}
                            >
                              <div className="rule-head">
                                <div className="rule-title">{policyTitle(policy, index)}</div>
                                <div className="rule-head-side">
                                  <DecisionTag decision={policy.decision} />
                                  <div className="rule-tags" aria-label="规则标签">
                                    <span className="tag meta-tag">{controlDomainLabel(policy.control_domain || policy.group)}</span>
                                    {policy.severity ? <span className={`tag meta-tag severity-${policy.severity}`}>{severityLabel(policy.severity)}</span> : null}
                                    {policy.owner ? <span className="tag meta-tag">{policy.owner}</span> : null}
                                  </div>
                                </div>
                              </div>
                              <div className="rule-actions" role="group" aria-label={`规则 ${policy.rule_id || index + 1} 的策略动作`}>
                                {DECISION_OPTIONS.map((decision) => (
                                  <button
                                    key={decision}
                                    className={`rule-action-button ${decision} ${policy.decision === decision ? "active" : ""}`}
                                    type="button"
                                    aria-pressed={policy.decision === decision}
                                    onClick={(event) => {
                                      stopRuleCardEvent(event);
                                      onDecisionChange(index, decision);
                                    }}
                                    onKeyDown={stopRuleCardEvent}
                                  >
                                    {decisionLabel(decision)}
                                  </button>
                                ))}
                              </div>
                              <div className="rule-desc">{ruleDescription(policy)}</div>
                            </article>
                          );
                        })}
                      </section>
                    ))
                  )}
                </div>

                {isRuleSideVisible ? (
                  <aside
                    id="active-rule-example-panel"
                    className="rule-side-panel"
                    aria-live="polite"
                    style={{ marginTop: `${sidePanelOffset}px` }}
                  >
                    <div className="rule-side-card">
                      <div className="rule-side-head">
                        <div className="rule-side-head-top">
                          <span className="eyebrow">规则对话示例</span>
                          <button
                            className="ghost small rule-side-close"
                            type="button"
                            onClick={() => setActiveRuleKey("")}
                          >
                            关闭
                          </button>
                        </div>
                        <h3>{policyTitle(activeRuleEntry.policy, activeRuleEntry.index)}</h3>
                        <div className="rule-row">
                          <DecisionTag decision={activeRuleEntry.policy.decision} />
                          <span className="tag meta-tag">{controlDomainLabel(activeRuleEntry.policy.control_domain || activeRuleEntry.policy.group)}</span>
                        </div>
                      </div>

                      <div className="rule-side-notes">
                        <section className="rule-side-note">
                          <h5>什么时候会触发</h5>
                          <p>{activeRuleGuide.trigger}</p>
                        </section>
                        <section className="rule-side-note">
                          <h5>为什么更安全</h5>
                          <p>{activeRuleGuide.securityGain}</p>
                        </section>
                        <section className="rule-side-note">
                          <h5>会发生什么</h5>
                          <p>{activeRuleGuide.userImpact}</p>
                        </section>
                      </div>

                      <section className="rule-chat-panel" aria-label="典型对话场景">
                        <h5>典型对话场景</h5>
                        <div className="rule-chat">
                          {activeRuleConversation.map((line, lineIndex) => (
                            <article key={`${line.role}-${lineIndex}`} className={`rule-message ${line.role}`}>
                              <span className="rule-message-role">{line.label}</span>
                              <p>{line.text}</p>
                            </article>
                          ))}
                        </div>
                      </section>
                    </div>
                  </aside>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}

createRoot(document.getElementById("root")).render(<App />);
