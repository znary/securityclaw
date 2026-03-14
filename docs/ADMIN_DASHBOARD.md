# SafeClaw Admin Dashboard

## Start
- Run `npm run admin`.
- Open `http://127.0.0.1:4780`.

## What It Shows
- Current runtime status from `runtime/safeclaw-status.json`.
- Decision counters (`allow/warn/challenge/block`).
- Recent decision records with trace id, hook, tool, scope, and reasons.

## Strategy Configuration
- The panel writes overrides to `config/policy.overrides.json` via `PUT /api/strategy`.
- Editable fields:
  - `environment`
  - risk thresholds (`base_score`, `warn/challenge/block_threshold`)
  - full `policies` array (JSON)

## Notes
- Override updates are validated against SafeClaw config schema before saving.
- If your OpenClaw runtime does not hot-reload plugin config files, restart `openclaw-gateway` after saving strategy updates.

## Environment Variables
- `SAFECLAW_ADMIN_PORT` (default `4780`)
- `SAFECLAW_CONFIG_PATH` (default `config/policy.default.yaml`)
- `SAFECLAW_OVERRIDE_PATH` (default `config/policy.overrides.json`)
- `SAFECLAW_STATUS_PATH` (default `runtime/safeclaw-status.json`)
