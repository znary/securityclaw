# SafeClaw Agent Notes

## Completion Gate
- Treat type and syntax validation as a required completion goal.
- Before marking any code change done, run `npm test`.
- `npm test` is the canonical verification command and must include `npm run typecheck`.
- Do not claim completion while `npm test` is red.
