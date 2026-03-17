import assert from "node:assert/strict";
import test from "node:test";

import { normalizeSensitivePathStrategyOverride } from "../src/domain/services/sensitive_path_registry.ts";

test("normalizeSensitivePathStrategyOverride keeps only valid builtin ids and custom rules", () => {
  const override = normalizeSensitivePathStrategyOverride({
    disabled_builtin_ids: [
      "download-staging-downloads-directory",
      "unknown-id",
    ],
    custom_path_rules: [
      {
        id: "download-staging-downloads-directory",
        asset_label: "credential",
        match_type: "prefix",
        pattern: "/tmp/override",
        source: "custom"
      },
      {
        id: "custom-invalid-regex",
        asset_label: "credential",
        match_type: "regex",
        pattern: "(",
        source: "custom"
      },
      {
        id: "custom-valid-regex",
        asset_label: "credential",
        match_type: "regex",
        pattern: "^/srv/secrets(?:/|$)",
        source: "builtin"
      }
    ]
  });

  assert.deepEqual(override?.disabled_builtin_ids, ["download-staging-downloads-directory"]);
  assert.deepEqual(override?.custom_path_rules?.map((rule) => rule.id), ["custom-valid-regex"]);
  assert.equal(override?.custom_path_rules?.[0]?.source, "custom");
});
