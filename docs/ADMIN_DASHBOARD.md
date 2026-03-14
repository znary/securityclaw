# SafeClaw Admin Dashboard

## Start
- Default behavior: once OpenClaw loads `safeclaw`, dashboard auto-starts at `http://127.0.0.1:4780`.
- Optional manual mode: run `npm run admin` when you want standalone startup or local debugging.
- You can set `plugins.entries.safeclaw.config.adminAutoStart=false` to disable auto-start.

## Current UI Behavior
- Metrics card: decision totals (`allow`, `warn/challenge`, `block`).
- Recent decisions table: time, decision, source, resource scope, hook, tool, reasons.
- Rule panel:
  - rules are grouped by `group` (for example `filesystem`, `email`, `album`).
  - each rule exposes a strategy action selector (`allow`, `warn`, `challenge`, `block`).
  - rule technical IDs are hidden behind readable names when available.
  - dashboard no longer exposes per-rule enable switches; rule editing is action-first.
- Unsaved-change protection: auto-refresh will not overwrite local edits.

## Strategy Configuration
- The panel writes overrides to `config/policy.overrides.json` via `PUT /api/strategy`.
- Editable fields from UI:
  - full `policies` array, mainly `decision` per rule.
- Save validation:
  - `policies` must be a JSON array.
  - each rule must have `rule_id`, `priority`, and a valid `decision`.

## Runtime Status
- Data source: `runtime/safeclaw-status.json` via `GET /api/status`.
- Shows totals and recent decisions with simplified labels.

## Notes
- Override updates are validated against SafeClaw config schema before saving.
- If your OpenClaw runtime does not hot-reload plugin config files, restart `openclaw-gateway` after saving strategy updates.

## Environment Variables
- `SAFECLAW_ADMIN_PORT` (default `4780`)
- `SAFECLAW_CONFIG_PATH` (default `config/policy.default.yaml`)
- `SAFECLAW_OVERRIDE_PATH` (default `config/policy.overrides.json`)
- `SAFECLAW_STATUS_PATH` (default `runtime/safeclaw-status.json`)
