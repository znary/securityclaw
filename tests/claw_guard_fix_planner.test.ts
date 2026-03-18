import test from "node:test";
import assert from "node:assert/strict";

import { buildClawGuardFixPlan } from "../src/admin/claw_guard_fix_planner.ts";
import type { ClawGuardConfigSnapshot } from "../src/admin/claw_guard_types.ts";

function createSnapshot(config: Record<string, unknown>): ClawGuardConfigSnapshot {
  return {
    config,
    source: "gateway-rpc",
    gatewayOnline: true,
    writeSupported: true,
    baseHash: "hash",
  };
}

function createReadOnlySnapshot(config: Record<string, unknown>, writeReason = "Gateway RPC is unavailable"): ClawGuardConfigSnapshot {
  return {
    config,
    source: "local-file",
    gatewayOnline: false,
    writeSupported: false,
    writeReason,
  };
}

test("gateway token fix preview masks generated token", () => {
  const plan = buildClawGuardFixPlan({
    snapshot: createSnapshot({
      gateway: {
        auth: {
          mode: "password",
        },
      },
    }),
    findingId: "gateway_missing_token_auth",
    locale: "en",
    environment: {
      sandboxImageReady: true,
      browserSandboxImageReady: true,
    },
  });

  assert.equal(plan.canApply, true);
  assert.deepEqual(plan.previewPatch, {
    gateway: {
      auth: {
        mode: "token",
        token: "********",
      },
    },
  });
  assert.equal(typeof plan.patch?.gateway, "object");
});

test("group allowlist wizard falls back to disabling groups when no allowlist exists", () => {
  const snapshot = createSnapshot({
    channels: {
      telegram: {
        enabled: true,
        groupPolicy: "open",
      },
    },
  });

  const disablePlan = buildClawGuardFixPlan({
    snapshot,
    findingId: "group_missing_allowlist::telegram",
    locale: "en",
    options: {
      choice: "disable_groups",
    },
    environment: {
      sandboxImageReady: true,
      browserSandboxImageReady: true,
    },
  });
  assert.equal(disablePlan.canApply, true);
  assert.deepEqual(disablePlan.patch, {
    channels: {
      telegram: {
        groupPolicy: "disabled",
      },
    },
  });

  const allowlistPlan = buildClawGuardFixPlan({
    snapshot,
    findingId: "group_missing_allowlist::telegram",
    locale: "en",
    options: {
      choice: "use_allowlist",
    },
    environment: {
      sandboxImageReady: true,
      browserSandboxImageReady: true,
    },
  });
  assert.equal(allowlistPlan.canApply, false);
  assert.match(String(allowlistPlan.applyDisabledReason), /allowlist/i);
});

test("sandbox fix stays blocked when sandbox image is not ready", () => {
  const plan = buildClawGuardFixPlan({
    snapshot: createSnapshot({
      tools: {
        profile: "coding",
      },
      agents: {
        defaults: {
          sandbox: {
            mode: "off",
          },
        },
      },
    }),
    findingId: "sandbox_disabled_for_high_risk_profile",
    locale: "en",
    environment: {
      sandboxImageReady: false,
      browserSandboxImageReady: false,
    },
  });

  assert.equal(plan.canApply, false);
  assert.match(String(plan.applyDisabledReason), /sandbox image/i);
});

test("read-only preview keeps manual repair details", () => {
  const plan = buildClawGuardFixPlan({
    snapshot: createReadOnlySnapshot({
      gateway: {
        bind: "0.0.0.0",
      },
    }),
    findingId: "gateway_public_bind",
    locale: "en",
  });

  assert.equal(plan.title, "Limit gateway bind to loopback");
  assert.equal(plan.currentValue, "0.0.0.0");
  assert.equal(plan.recommendedValue, "loopback");
  assert.deepEqual(plan.previewPatch, {
    gateway: {
      bind: "loopback",
    },
  });
  assert.equal(plan.canApply, false);
  assert.match(String(plan.applyDisabledReason), /Gateway RPC is unavailable/i);
});
