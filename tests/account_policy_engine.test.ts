import test from "node:test";
import assert from "node:assert/strict";

import { canonicalizeAccountPolicies } from "../src/domain/services/account_policy_engine.ts";

test("canonicalize account policies produces stable order and field layout", () => {
  const first = canonicalizeAccountPolicies([
    {
      label: "Chat 42",
      subject: "telegram:chat-42",
      admin_allow_all: false,
      is_admin: false,
      mode: "default_allow",
      updated_at: "2026-03-15T00:00:00.000Z",
      channel: "telegram"
    }
  ]);

  const second = canonicalizeAccountPolicies([
    {
      subject: "telegram:chat-42",
      mode: "default_allow",
      is_admin: false,
      admin_allow_all: false,
      channel: "telegram",
      label: "Chat 42",
      updated_at: "2026-03-15T00:00:00.000Z"
    }
  ]);

  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
});
