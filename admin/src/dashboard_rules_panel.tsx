import { useEffect, useMemo, useState } from "react";
import type { CapabilityPolicy, StrategyPolicyRule } from "../../src/domain/services/strategy_model.ts";
import type { Decision, PolicyMatch } from "../../src/types.ts";
import { DECISION_OPTIONS, getActiveAdminLocale, ruleExplanation, ui } from "./dashboard_core.ts";
import { DecisionTag } from "./dashboard_primitives.tsx";
import { AdminAccessPanel } from "./dashboard_panels.tsx";
import { FilesystemOverridesSection } from "./filesystem_overrides_section.tsx";
import type { FilesystemOverridesSectionProps } from "./filesystem_overrides_section.tsx";
import type { AccountPolicyMode, AccountPolicyRecord } from "../../src/types.ts";

type RuleDisplay = StrategyPolicyRule & {
  match: PolicyMatch;
};

type RuleDetailState = {
  index: number;
  rule: StrategyPolicyRule;
};

type InterventionCopy = {
  title: string;
  detail: string;
};

function isCardInteractiveTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("button, select, input, textarea, a, label"));
}

function securityClawIntervention(decision: Decision, locale: string): InterventionCopy {
  if (locale === "zh-CN") {
    if (decision === "block") {
      return {
        title: "SecurityClaw 介入",
        detail: "检测到高风险行为，已直接拦截并保护当前会话。",
      };
    }
    if (decision === "challenge") {
      return {
        title: "SecurityClaw 介入",
        detail: "检测到风险行为，已暂停请求并要求审批后继续。",
      };
    }
    if (decision === "warn") {
      return {
        title: "SecurityClaw 介入",
        detail: "检测到潜在风险，已附加安全提醒后继续执行。",
      };
    }
    return {
      title: "SecurityClaw 介入",
      detail: "已记录安全审计并保护会话上下文。",
    };
  }
  if (decision === "block") {
    return {
      title: "SecurityClaw Intervened",
      detail: "A high-risk action was detected and blocked to protect the session.",
    };
  }
  if (decision === "challenge") {
    return {
      title: "SecurityClaw Intervened",
      detail: "A risky action was detected, so the request was paused for approval.",
    };
  }
  if (decision === "warn") {
    return {
      title: "SecurityClaw Intervened",
      detail: "A potential risk was detected and a safety warning was applied.",
    };
  }
  return {
    title: "SecurityClaw Intervened",
    detail: "Security auditing was applied to protect the session context.",
  };
}

type RulesPanelProps = {
  capabilityPolicies: CapabilityPolicy[];
  additionalRestrictionCount: number;
  directoryOverrideCount: number;
  accountCount: number;
  displayAccounts: AccountPolicyRecord[];
  selectedAdminSubject: string;
  adminConfigured: boolean;
  managementEffective: boolean;
  managementInactiveReason: string;
  hasFilesystemCapability: boolean;
  filesystemOverridesProps: FilesystemOverridesSectionProps;
  capabilityLabel: (capabilityId: string | null | undefined) => string;
  capabilityDescription: (capabilityId: string | null | undefined) => string;
  decisionLabel: (decision: string | null | undefined) => string;
  accountPrimaryLabel: (account: Partial<AccountPolicyRecord> | null | undefined) => string;
  accountModeLabel: (mode: AccountPolicyMode | string | null | undefined) => string;
  accountMetaLabel: (account: Partial<AccountPolicyRecord> | null | undefined) => string;
  controlDomainLabel: (domain: string | null | undefined) => string;
  severityLabel: (severity: string | null | undefined) => string;
  policyTitle: (policy: RuleDisplay, index: number) => string;
  ruleDescription: (policy: RuleDisplay) => string;
  userImpactSummary: (policy: { decision?: Decision | string | null } | unknown) => string;
  capabilityBaselineSummary: (capability: CapabilityPolicy | unknown) => string;
  onSetCapabilityDefaultDecision: (capabilityId: CapabilityPolicy["capability_id"], decision: Decision) => void;
  onSetRuleDecision: (ruleId: string, decision: Decision) => void;
  onUpdateAccountPolicy: (subject: string, patch: Partial<AccountPolicyRecord>) => void;
  onSetAdminAccount: (subject: string) => void;
};

export function RulesPanel({
  capabilityPolicies,
  additionalRestrictionCount,
  directoryOverrideCount,
  accountCount,
  displayAccounts,
  selectedAdminSubject,
  adminConfigured,
  managementEffective,
  managementInactiveReason,
  hasFilesystemCapability,
  filesystemOverridesProps,
  capabilityLabel,
  capabilityDescription,
  decisionLabel,
  accountPrimaryLabel,
  accountModeLabel,
  accountMetaLabel,
  controlDomainLabel,
  severityLabel,
  policyTitle,
  ruleDescription,
  userImpactSummary,
  capabilityBaselineSummary,
  onSetCapabilityDefaultDecision,
  onSetRuleDecision,
  onUpdateAccountPolicy,
  onSetAdminAccount,
}: RulesPanelProps) {
  const toolControlsDisabled = !managementEffective;
  const capabilityGroups = useMemo(
    () => {
      const groups = capabilityPolicies.map((capability, index) => ({
        capability,
        order: index,
        id: `${String(capability?.capability_id || "capability").replace(/[^a-zA-Z0-9_-]/g, "-")}-${index}`,
      }));
      groups.sort((left, right) => {
        const leftFirst = left.capability.capability_id === "filesystem";
        const rightFirst = right.capability.capability_id === "filesystem";
        if (leftFirst !== rightFirst) {
          return leftFirst ? -1 : 1;
        }
        return left.order - right.order;
      });
      return groups;
    },
    [capabilityPolicies],
  );
  const [activeCapabilityGroupId, setActiveCapabilityGroupId] = useState("");

  useEffect(() => {
    if (capabilityGroups.length === 0) {
      setActiveCapabilityGroupId("");
      return;
    }
    if (!capabilityGroups.some((group) => group.id === activeCapabilityGroupId)) {
      setActiveCapabilityGroupId(capabilityGroups[0].id);
    }
  }, [activeCapabilityGroupId, capabilityGroups]);

  const activeCapabilityGroup = useMemo(
    () => capabilityGroups.find((group) => group.id === activeCapabilityGroupId) || capabilityGroups[0] || null,
    [activeCapabilityGroupId, capabilityGroups]
  );
  const activeCapability = activeCapabilityGroup?.capability || null;
  const [activeRuleDetail, setActiveRuleDetail] = useState<RuleDetailState | null>(null);

  useEffect(() => {
    if (!activeRuleDetail) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setActiveRuleDetail(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeRuleDetail]);

  const activeRuleDisplay = activeRuleDetail
    ? ({ ...activeRuleDetail.rule, match: activeRuleDetail.rule.context } as RuleDisplay)
    : null;
  const activeRuleInfo = activeRuleDetail ? ruleExplanation(activeRuleDetail.rule.rule_id) : null;
  const locale = getActiveAdminLocale();
  const intervention = activeRuleDetail ? securityClawIntervention(activeRuleDetail.rule.decision, locale) : null;
  return (
    <section id="panel-rules" className="tab-panel" role="tabpanel" aria-labelledby="tab-rules">
      <div className="panel-card strategy-panel dashboard-panel">
        <div className="card-head">
          <h2>{ui("工具", "Tools")}</h2>
          <div className="rule-meta">
            <span className="meta-pill">{ui("能力", "Capabilities")} {capabilityPolicies.length}</span>
            <span className="meta-pill">{ui("附加限制", "Additional Restrictions")} {additionalRestrictionCount}</span>
            <span className="meta-pill">{ui("设置例外目录", "Exception Directories")} {directoryOverrideCount}</span>
          </div>
        </div>

        <AdminAccessPanel
          accountCount={accountCount}
          displayAccounts={displayAccounts}
          selectedAdminSubject={selectedAdminSubject}
          adminConfigured={adminConfigured}
          managementEffective={managementEffective}
          inactiveReason={managementInactiveReason}
          accountPrimaryLabel={accountPrimaryLabel}
          accountModeLabel={accountModeLabel}
          accountMetaLabel={accountMetaLabel}
          onUpdateAccountPolicy={onUpdateAccountPolicy}
          onSetAdminAccount={onSetAdminAccount}
        />

        <section
          className={`rule-group rule-group-shell tool-policy-panel ${toolControlsDisabled ? "is-disabled" : ""}`}
          aria-label={ui("访问基线", "Access baseline")}
        >
          <div className="rule-head">
            <div>
              <div className="rule-title">{ui("工具规则", "Tool rules")}</div>
              <div className="rule-desc">
                {ui(
                  "这里设置每类工具的默认处理方式和附加规则。",
                  "Set the default handling and extra rules for each tool category."
                )}
              </div>
            </div>
          </div>

          {capabilityPolicies.length === 0 ? (
            <div className="chart-empty">{ui("暂无能力配置。", "No capability policies configured.")}</div>
          ) : (
            <div className="rule-capability-list">
              <div className="tablist tool-capability-tablist" role="tablist" aria-label={ui("工具能力分组", "Tool capability groups")}>
                {capabilityGroups.map((group) => (
                  <button
                    key={group.id}
                    id={`tool-group-tab-${group.id}`}
                    className={`tab-button ${activeCapabilityGroup?.id === group.id ? "active" : ""}`}
                    type="button"
                    role="tab"
                    aria-selected={activeCapabilityGroup?.id === group.id}
                    aria-controls={`tool-group-panel-${group.id}`}
                    onClick={() => setActiveCapabilityGroupId(group.id)}
                  >
                    <span className="tab-label">{capabilityLabel(group.capability.capability_id)}</span>
                    <span className="tab-count">{group.capability.rules.length}</span>
                  </button>
                ))}
              </div>

              {activeCapabilityGroup && activeCapability ? (
                <section
                  key={activeCapabilityGroup.id}
                  id={`tool-group-panel-${activeCapabilityGroup.id}`}
                  className="rule-group rule-capability-group"
                  role="tabpanel"
                  aria-labelledby={`tool-group-tab-${activeCapabilityGroup.id}`}
                >
                  <div className="rule-head rule-capability-head">
                    <div>
                      <div className="rule-title">{capabilityLabel(activeCapability.capability_id)}</div>
                      <div className="rule-desc">{capabilityDescription(activeCapability.capability_id)}</div>
                    </div>
                    <div className="rule-head-side">
                      <DecisionTag decision={activeCapability.default_decision} />
                      <span className="tag meta-tag">{ui("Baseline", "Baseline")}</span>
                    </div>
                  </div>

                  <div className="rule-select-row">
                    <label className="rule-select-field">
                      <span>{ui("默认策略", "Baseline policy")}</span>
                      <select
                        className="rule-select-control"
                        value={activeCapability.default_decision}
                        disabled={toolControlsDisabled}
                        aria-label={ui(`${capabilityLabel(activeCapability.capability_id)} 默认策略`, `${capabilityLabel(activeCapability.capability_id)} baseline policy`)}
                        onChange={(event) =>
                          onSetCapabilityDefaultDecision(activeCapability.capability_id, event.target.value as Decision)
                        }
                      >
                        {DECISION_OPTIONS.map((decision) => (
                          <option key={`${activeCapability.capability_id}-${decision}`} value={decision}>
                            {decisionLabel(decision)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className={`rule-inline-info ${activeCapability.default_decision}`}>
                      <span className="rule-inline-info-label">
                        {ui("默认策略说明", "Baseline effect")} · {decisionLabel(activeCapability.default_decision)}
                      </span>
                      <span>{capabilityBaselineSummary(activeCapability)}</span>
                    </div>
                  </div>

                  {activeCapability.rules.length === 0 ? (
                    <div className="chart-empty">{ui("当前能力下没有额外附加限制。", "No additional restrictions for this capability.")}</div>
                  ) : (
                    <div className="rules">
                      {activeCapability.rules.map((rule, index) => {
                        const policy = { ...rule, match: rule.context };
                        const openRuleDetail = () => setActiveRuleDetail({ index, rule });
                        const isActiveRule = activeRuleDetail?.rule.rule_id === rule.rule_id;
                        return (
                          <article
                            key={`${activeCapability.capability_id}:${rule.rule_id || index}`}
                            className={`rule ${isActiveRule ? "active" : ""}`}
                            role="button"
                            tabIndex={0}
                            aria-haspopup="dialog"
                            aria-label={ui(
                              `查看规则 ${policyTitle(policy, index)} 的触发对话示例`,
                              `Open trigger conversation examples for ${policyTitle(policy, index)}`
                            )}
                            onClick={(event) => {
                              if (isCardInteractiveTarget(event.target)) {
                                return;
                              }
                              openRuleDetail();
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ") {
                                return;
                              }
                              event.preventDefault();
                              openRuleDetail();
                            }}
                          >
                            <div className="rule-head">
                              <div className="rule-title">{policyTitle(policy, index)}</div>
                              <div className="rule-head-side">
                                <DecisionTag decision={rule.decision} />
                                <div className="rule-tags" aria-label={ui("规则标签", "Rule tags")}>
                                  <span className="tag meta-tag">{controlDomainLabel(rule.control_domain || rule.group)}</span>
                                  {rule.severity ? <span className={`tag meta-tag severity-${rule.severity}`}>{severityLabel(rule.severity)}</span> : null}
                                  {rule.owner ? <span className="tag meta-tag">{rule.owner}</span> : null}
                                </div>
                              </div>
                            </div>
                            <div className="rule-select-row">
                              <label className="rule-select-field">
                                <span>{ui("处理方式", "Handling")}</span>
                                <select
                                  className="rule-select-control"
                                  value={rule.decision}
                                  disabled={toolControlsDisabled}
                                  aria-label={ui(`规则 ${rule.rule_id || index + 1} 的策略动作`, `Policy actions for rule ${rule.rule_id || index + 1}`)}
                                  onClick={(event) => event.stopPropagation()}
                                  onKeyDown={(event) => event.stopPropagation()}
                                  onChange={(event) => onSetRuleDecision(rule.rule_id, event.target.value as Decision)}
                                >
                                  {DECISION_OPTIONS.map((decision) => (
                                    <option key={`${rule.rule_id}-${decision}`} value={decision}>
                                      {decisionLabel(decision)}
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div className={`rule-inline-info ${rule.decision}`}>
                                <span className="rule-inline-info-label">
                                  {ui("当前处理方式", "Current handling")} · {decisionLabel(rule.decision)}
                                </span>
                                <span>{userImpactSummary(rule)}</span>
                              </div>
                            </div>
                            <div className="rule-desc">{ruleDescription(policy)}</div>
                          </article>
                        );
                      })}
                    </div>
                  )}

                  {activeCapability.capability_id === "filesystem" ? (
                    <FilesystemOverridesSection
                      inline
                      disabled={toolControlsDisabled}
                      disabledReason={managementInactiveReason}
                      {...filesystemOverridesProps}
                    />
                  ) : null}
                </section>
              ) : null}
            </div>
          )}
        </section>

        {activeRuleDetail && activeRuleInfo ? (
          <div
            className="hardening-drawer-backdrop rule-detail-backdrop"
            role="dialog"
            aria-modal="true"
            aria-labelledby="rule-detail-title"
            aria-describedby="rule-detail-chat-title"
            onClick={() => setActiveRuleDetail(null)}
          >
            <div className="hardening-drawer rule-detail-modal" onClick={(event) => event.stopPropagation()}>
              <div className="hardening-modal-sticky">
                <div className="hardening-drawer-head">
                  <div className="hardening-modal-header-copy">
                    <span className="eyebrow">{ui("对话示例", "Conversation examples")}</span>
                    <h3 id="rule-detail-title">{activeRuleDisplay ? policyTitle(activeRuleDisplay, activeRuleDetail.index) : ""}</h3>
                  </div>
                  <div className="hardening-modal-head-actions">
                    <button className="ghost small" type="button" onClick={() => setActiveRuleDetail(null)}>
                      {ui("关闭", "Close")}
                    </button>
                  </div>
                </div>
              </div>

              <div className="hardening-drawer-content">
                <div className="rule-chat-panel rule-detail-chat-panel">
                  <h5 id="rule-detail-chat-title">{ui("下面是可能触发这条规则的对话", "Examples of conversations that can trigger this rule")}</h5>
                    <div className="rule-chat">
                    <div className="rule-detail-chat-turn">
                      {activeRuleInfo.examples[0] ? (
                        <div className="rule-message user">
                          <span className="rule-message-role">{ui("用户", "User")}</span>
                          <p>{activeRuleInfo.examples[0].text[locale] || activeRuleInfo.examples[0].text.en || activeRuleInfo.examples[0].text["zh-CN"]}</p>
                        </div>
                      ) : null}
                      <div className="rule-intervention">
                        <strong>{intervention?.title}</strong>
                        <p>{intervention?.detail}</p>
                      </div>
                      {activeRuleInfo.examples[1] ? (
                        <div className="rule-message system">
                          <span className="rule-message-role">{ui("系统", "System")}</span>
                          <p>{activeRuleInfo.examples[1].text[locale] || activeRuleInfo.examples[1].text.en || activeRuleInfo.examples[1].text["zh-CN"]}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}

        {!hasFilesystemCapability ? (
          <FilesystemOverridesSection
            disabled={toolControlsDisabled}
            disabledReason={managementInactiveReason}
            {...filesystemOverridesProps}
          />
        ) : null}
      </div>
    </section>
  );
}
