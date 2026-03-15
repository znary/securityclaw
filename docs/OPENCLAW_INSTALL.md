# SafeClaw OpenClaw Install

## Confirmed Local Environment
- OpenClaw is installed globally at `/Users/liuzhuangm4/.nvm/versions/node/v22.17.0/lib/node_modules/openclaw`.
- A gateway process is running as `openclaw-gateway`.
- The active config file is `~/.openclaw/openclaw.json`.
- OpenClaw loads plugins from `~/.openclaw/extensions`, `<workspace>/.openclaw/extensions`, and `plugins.load.paths`.
- Plugin config changes require a gateway restart.

## Recommended Install Path
Use the current SafeClaw workspace directly through `plugins.load.paths` so you do not need to publish a package first.

## Config Example
Add this to `~/.openclaw/openclaw.json`:

```json
{
  "plugins": {
    "enabled": true,
    "allow": ["telegram", "safeclaw"],
    "load": {
      "paths": ["/Users/liuzhuangm4/develop/safeclaw"]
    },
    "entries": {
      "telegram": {
        "enabled": true
      },
      "safeclaw": {
        "enabled": true,
        "config": {
          "configPath": "./config/policy.default.yaml",
          "dbPath": "./runtime/safeclaw.db",
          "statusPath": "./runtime/safeclaw-status.json",
          "adminAutoStart": true,
          "adminPort": 4780,
          "approvalBridge": {
            "enabled": true,
            "targets": [
              {
                "channel": "telegram",
                "to": "123456789"
              }
            ],
            "approvers": [
              {
                "channel": "telegram",
                "from": "123456789"
              }
            ]
          }
        }
      }
    }
  }
}
```

## Install Steps
1. Stop the gateway if it is managed manually.
2. Update `~/.openclaw/openclaw.json` with the `plugins.load.paths`, `plugins.allow`, and `plugins.entries.safeclaw` fields above.
3. Keep the SafeClaw repo at `/Users/liuzhuangm4/develop/safeclaw` so OpenClaw can load `index.ts` and `openclaw.plugin.json`.
4. Restart the gateway.
5. Run `openclaw plugins list` and confirm `safeclaw` shows as `loaded`.

## Operational Notes
- `config.configPath` is resolved relative to the plugin root, so `./config/policy.default.yaml` points to this repo's default policy.
- `config.dbPath` is the local SQLite database that stores dashboard strategy overrides, runtime counters, and decision history across restarts.
- `config.overridePath` is only a legacy migration input (read-once import into SQLite), not an active persistence target.
- `config.statusPath` is a JSON snapshot generated from SQLite and consumed by the admin panel.
- `config.adminAutoStart` defaults to `true`, so dashboard starts automatically when plugin load happens inside a persistent gateway service/runtime.
- `config.adminPort` controls dashboard bind port (default `4780`).
- Plugin load will also refresh the admin frontend bundle when `admin/src` is newer than `admin/public/app.js` or the bundle is missing.
- Short-lived CLI commands that happen to load plugins (for example `openclaw gateway restart`) will skip dashboard auto-start; use `npm run admin` if you want a standalone local dashboard during debugging.
- If you want webhook audit delivery, set `plugins.entries.safeclaw.config.webhookUrl`.
- `before_tool_call` uses a pure rule-first model: matched rules decide `allow/warn/challenge/block`, otherwise default allow.
- `shell.exec` is semantically normalized for filesystem behaviors. When shell command text indicates file operations, SafeClaw maps it to `filesystem.list/read/search/write/delete/archive` before rule matching, so filesystem rules can cover shell-based access paths.
- When `plugins.entries.safeclaw.config.approvalBridge.enabled=true`, `challenge` requests are written to SQLite, forwarded to configured admin chats, and can be approved with `/safeclaw-approve <approval_id>` (temporary) or `/safeclaw-approve <approval_id> long` (long-lived), or rejected with `/safeclaw-reject <approval_id>`.
- Approved requests become subject-level authorizations within the same `scope` until the authorization expires; users can retry after approval and subsequent challenged actions in that scope are also allowed while the authorization is active.
- Without `approvalBridge`, `challenge` still maps to a blocked call with an approval-required reason because OpenClaw does not expose a native pause-and-resume approval hook in this path.
- Blocked/challenged tool calls return a user-facing `blockReason` with `trace_id`, reason codes, and next action text.
- Decision observability is emitted to logger on every `before_tool_call` with `trace_id`, `tool`, `decision`, matched `rules`, and truncated tool `args`. Tune truncation with plugin config `decisionLogMaxLength`.
- Tool aliases are normalized in runtime (for example `exec` is treated as `shell.exec`) so shell execution policies can still take effect on hosts that use short tool names.
- SafeClaw can only enforce policies on actual tool execution paths. If the model answers directly without any tool call, `before_tool_call` does not run and no approval can be triggered for that turn.
- `tool_result_persist` and `before_message_write` are kept synchronous to match OpenClaw's runtime contract.
