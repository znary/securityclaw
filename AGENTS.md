# SecurityClaw Agent Notes

## Completion Gate
- Treat type and syntax validation as a required completion goal.
- Before marking any code change done, run `npm test`.
- `npm test` is the canonical verification command and must include `npm run typecheck`.
- Do not claim completion while `npm test` is red.

## Language Style
- Prefer plain, direct language in user-facing responses, commit messages, plans, and review comments. Explain the concrete action, result, risk, or blocker instead of dressing it up with management slang.
- Do not use buzzword-heavy phrasing as filler or tone. This includes, but is not limited to: `收紧`, `落下`, `打法`, `抓手`, `对齐`, `拉齐`, `闭环`, `链路`, `颗粒度`, `抓重点`, `卡点`, `节奏`, `推进节奏`, `发力`, `赋能`, `沉淀`, `兜底`, `透传`, `打透`, `吃透`, `拆解动作`, `动作项`, `方案面`, `心智`, `稳态`, `路径依赖`, `方法论`, `最佳实践` when used as empty framing, `组合拳`, `矩阵`, `牵引`, `承接`, `横向`, `纵向`, `颗粒`, `口径`, `抬升`, `降维`, `升维`, `覆盖到位`, `拉通`, `跑通链路`, `补位`, `协同拉齐`, `结果导向`, `形成合力`, `前置`, `后置`, `抽象一层`, `统一抓手`, `双击`, `打样`, `定调`, `定标`, `压实`, `提效`, `提质`, `降本`, `增效`, `拿结果`, `抓闭环`, `做深做透`, `建立认知`, `校准`, `锚定`, `赛道`, `场景化`, `能力建设`, `建设抓手`, `价值回收`, `复用沉淀`, `颗粒度更细`, `动作落地`, `拉满`, `兜住`, `控节奏`, `收口`, `铺排`, `排兵布阵`.
- If one of the words above is the clearest technical term in context, keep it to the minimum needed and make the sentence concrete. Otherwise, replace it with plain wording such as `限制`, `减少`, `遗漏`, `做法`, `流程`, `问题点`, `进度`, `支持`, `确认完成`, `统一认识`, `补上`, `简化`, or other direct alternatives.
- Avoid war metaphors, consultant tone, and template phrases. Prefer statements like `我会修改 X 来解决 Y` or `这里缺少 Z，所以测试失败` over abstract summaries.
- When editing documentation for this repo, keep wording specific enough that a reader can act on it without translating jargon first.

## Frontend Baseline
- For any user-facing frontend change, including the admin dashboard, treat internationalization and dark-mode support as default requirements rather than optional polish.
- New or changed UI copy must be wired through the existing locale path (`en` and `zh-CN`) instead of introducing single-language user-facing strings.
- New or changed UI surfaces must work in both light and dark themes. Prefer shared theme tokens / CSS variables and avoid hardcoded colors that only work in one theme.
- When touching charts, tables, badges, empty states, toolbars, forms, or status feedback, verify contrast, hover, focus, and active states in both themes.
- Unless the user explicitly scopes work to a single locale or single theme, do not ship frontend work that lacks both locale coverage and light/dark adaptation.

## OpenClaw Restart
- If a change requires OpenClaw gateway/plugin reload to take effect, perform the restart yourself instead of asking the user to do it manually.
- For local SecurityClaw development, run `npm run openclaw:dev:install` before any `openclaw gateway restart`, or use that command as the restart path directly. It dynamically refreshes `plugins.load.paths` to the current repo root so reloads do not keep using an older copied/npm-installed plugin snapshot.
- Do not assume an existing install under `~/.openclaw/extensions/securityclaw` is acceptable for development reloads; refresh the dev load path first.
- Use `openclaw gateway restart` as the default restart command only after the dev load-path requirement above is satisfied, unless the environment clearly requires another OpenClaw service command.
- After a required restart, verify the service with `openclaw gateway status` or an equally direct OpenClaw health check before marking the task done.
- Do not mark a restart-dependent task complete if the restart or verification step is still pending; report the concrete blocker instead.
