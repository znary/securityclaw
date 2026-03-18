import { existsSync, readFileSync } from "node:fs";

import {
  hydrateSensitivePathConfig,
} from "../domain/services/sensitive_path_registry.ts";
import { normalizeFileRules } from "../domain/services/file_rule_registry.ts";
import { compileStrategyV2, type StrategyV2 } from "../domain/services/strategy_model.ts";
import type {
  AccountPolicyRecord,
  DlpConfig,
  SecurityClawConfig,
} from "../types.ts";
import { validateConfig } from "./validator.ts";

export type RuntimeOverride = {
  updated_at?: string | undefined;
  environment?: string | undefined;
  policy_version?: string | undefined;
  defaults?: Partial<SecurityClawConfig["defaults"]> | undefined;
  strategy?: StrategyV2 | undefined;
  account_policies?: AccountPolicyRecord[] | undefined;
  dlp?: (Partial<Omit<DlpConfig, "patterns">> & { patterns?: DlpConfig["patterns"]; }) | undefined;
};

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function readRuntimeOverride(overridePath: string): RuntimeOverride | undefined {
  if (!existsSync(overridePath)) {
    return undefined;
  }
  const raw = JSON.parse(readFileSync(overridePath, "utf8")) as unknown;
  if (!isObject(raw)) {
    throw new Error("runtime override must be an object");
  }
  return raw as RuntimeOverride;
}

export function applyRuntimeOverride(base: SecurityClawConfig, override: RuntimeOverride): SecurityClawConfig {
  const compiledStrategy = override.strategy ? compileStrategyV2(base, override.strategy) : undefined;
  const baseSensitivity = hydrateSensitivePathConfig(base.sensitivity);
  const merged: SecurityClawConfig = {
    ...base,
    environment: override.environment ?? base.environment,
    policy_version: override.policy_version ?? base.policy_version,
    defaults: {
      ...base.defaults,
      ...(override.defaults ?? {})
    },
    dlp: {
      ...base.dlp,
      ...(override.dlp ?? {}),
      patterns: override.dlp?.patterns ?? base.dlp.patterns
    },
    policies: compiledStrategy?.policies ?? base.policies,
    sensitivity: compiledStrategy?.sensitivity ?? baseSensitivity,
    file_rules: compiledStrategy?.file_rules ?? normalizeFileRules(base.file_rules),
  };
  return validateConfig(merged as unknown as Record<string, unknown>);
}
