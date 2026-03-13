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
          "configPath": "./config/policy.default.yaml"
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
- If you want webhook audit delivery, set `plugins.entries.safeclaw.config.webhookUrl`.
- `before_tool_call` maps `challenge` to a blocked call with an approval-required reason because OpenClaw does not expose a native pause-and-resume approval hook in this path.
- `tool_result_persist` and `before_message_write` are kept synchronous to match OpenClaw's runtime contract.
