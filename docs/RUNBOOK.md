# SafeClaw Runbook

## Verification Gate
- Treat `npm test` as the required completion check for code changes.
- `npm test` runs `npm run typecheck` before unit tests.
- Do not mark work complete while `npm test` is failing.

## Config Operations
- Edit the local YAML file and redeploy or call `plugin.config.reload()` from the host process.
- If reload validation fails, the plugin keeps `last_known_good`.

## Challenge Approvals
- Monitor challenge decisions from `SecurityDecisionEvent`.
- Resolve pending approvals before `expires_at`.
- Expired or rejected approvals cause replayed calls to return `block`.

## Event Delivery
- If webhook delivery fails, inspect the host's telemetry around `plugin.events.getStats()`.
- A growing `queued` count indicates an unhealthy sink or network path.
- A non-zero `dropped` count means queue or retry limits are too small for the incident window.

## Incident Response
- Switch a hook to `enabled: false` to disable it quickly.
- Change a hook to `fail_mode: open` when host availability is more important than enforcement.
- Prefer reverting the policy rule that caused an incident instead of disabling all hooks.
