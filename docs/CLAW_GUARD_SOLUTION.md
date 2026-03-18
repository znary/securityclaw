# Claw Guard 系统加固页方案 v0.1

## 1. 方案目标
在 SecurityClaw 管理后台新增一个独立页签：`系统加固 / Claw Guard`。

这个页签不负责展示所有运行时安全能力，而是专门解决一个更具体的问题：
- 读取当前 OpenClaw 配置。
- 找出已经存在的高价值安全隐患。
- 对能安全自动处理的问题提供一键修复。
- 对需要用户补充信息的问题提供轻量修复向导。

这页的定位是“配置体检 + 修复入口”，不是新的总览页，也不是替代现有 `策略`、`Skill`、`账号` 面板。

## 2. 为什么要做这一页
结合《火山引擎 OpenClaw 安全最佳实践》和 OpenClaw 官方文档，真正对用户有即时价值的不是再看一遍大而全的安全原则，而是直接回答下面三个问题：

1. 我现在的 OpenClaw 配置有没有明显风险？
2. 这些风险具体在哪个配置项上？
3. 我能不能在后台直接修掉，而不是回去手改 `~/.openclaw/openclaw.json`？

后台现在已经能看 SecurityClaw 的策略与 Skill 风险，但缺少一层“OpenClaw 基础配置加固”。这会导致用户知道有风险，却不知道入口面、网关暴露面、沙箱面是否已经收住。

## 3. 第一版范围

### 3.1 In Scope
- 基于当前 OpenClaw 配置做静态体检。
- 展示风险项、原因、当前值、推荐值。
- 提供一键修复或轻量修复向导。
- 标记修复后是否需要重启 gateway。
- 支持 `zh-CN` / `en`。
- 支持浅色 / 深色主题。

### 3.2 Out of Scope
- 不把所有 SecurityClaw 规则命中结果搬进这一页。
- 不做复杂图表，不做新的趋势分析。
- 不在第一版做批量“全部修复”。
- 不在第一版承诺覆盖所有旁路能力，例如第三方插件自定义服务端口。
- 不直接编辑原始 JSON 文本并保留注释格式；优先走 OpenClaw 配置接口。

## 4. 产品原则

### 4.1 页面要简
- 不做大屏化设计。
- 不放多余图表。
- 核心就是“有哪些问题、影响是什么、怎么修”。

### 4.2 风险要实
- 只展示能根据当前配置明确判断的问题。
- 不做纯理论告警。
- 每条问题都要能指向具体配置键。

### 4.3 修复要稳
- 优先提供“保守且安全”的默认修复值。
- 自动修复前必须给出变更预览。
- 涉及 secret 生成、allowlist 选择等项，走向导，不盲改。

### 4.4 交互要轻
- 风险列表主操作统一叫 `修复`。
- 能直接修的，点一下进入预览并确认。
- 需要补充输入的，进入同一个侧滑抽屉，不跳页。

## 5. 页面信息架构

```text
系统加固 / Claw Guard
├─ 顶部摘要
│  ├─ 风险总数
│  ├─ 可直接修复数
│  ├─ 需要重启数
│  └─ 已通过项数
├─ 当前状态提示
│  ├─ 最近一次扫描时间
│  ├─ 配置来源
│  └─ gateway 是否在线
├─ 风险列表
│  ├─ 严重风险
│  ├─ 高风险
│  ├─ 中风险
│  └─ 低风险
└─ 已通过项
   └─ 折叠展示
```

### 5.1 页签位置
建议把 `hardening` 插到 `overview` 后面，理由很直接：
- 它比 `策略` 更接近“先看环境是否安全”。
- 它是运维入口，不应该埋在细节配置页后面。

推荐顺序：

```text
Overview -> Claw Guard -> Accounts -> Strategy -> Skill -> Interceptions
```

## 6. UI 设计

### 6.1 页面布局
- 顶部 4 张紧凑摘要卡片。
- 下方一条状态横幅，显示扫描时间、配置来源、gateway 在线状态。
- 主体是一列风险卡片。
- 每张卡片高度尽量一致，不做复杂展开层级。

### 6.2 风险卡片内容
每条风险卡片固定展示：
- 风险等级 badge。
- 标题。
- 一句话风险说明。
- 当前状态摘要。
- 推荐做法摘要。
- 配置路径标签，例如 `gateway.bind`、`channels.telegram.groupPolicy`。
- 操作按钮：`查看详情`、`修复`。

### 6.3 详情抽屉
点击 `查看详情` 或 `修复` 打开右侧抽屉，抽屉内容固定为：
- 风险说明。
- 当前值。
- 推荐值。
- 预估影响。
- 变更预览。
- 是否需要重启。
- 确认按钮。

### 6.4 视觉风格
- 延续当前后台卡片、边框、badge 风格。
- 不引入新的重色背景区块。
- 严重风险用清晰但克制的红色，高风险用橙色，中风险用黄色，已通过用绿色。
- 重点靠层级和留白，不靠大面积装饰。

## 7. 交互设计

### 7.1 首次进入
页面加载时自动执行一次扫描：
- 若能读取配置，直接展示风险结果。
- 若 gateway 不在线但本地配置可读，则页面进入只读模式。
- 若两者都不可用，则展示明确错误，不做空白页。

### 7.2 修复流程
统一采用两段式流程：

1. `修复`
2. `预览变更 -> 确认应用`

这样可以避免误改，也和现有后台自动保存逻辑区分开。

### 7.3 修复成功后的反馈
- 当前卡片状态立刻刷新。
- 顶部状态横幅显示成功信息。
- 若需要重启，显示明确提示，不和普通成功提示混在一起。

### 7.4 需要用户输入的修复
有些项无法盲目一键修，例如：
- 需要补充 allowlist。
- 需要决定“禁用群聊”还是“改为 allowlist”。

这类项不做复杂表单页，只在抽屉里给 2 到 3 个推荐选项，默认选中最保守方案。

## 8. 风险规则设计

第一版建议先做 8 条，覆盖文章里最有价值、也最容易落地的加固项。

### 8.1 `gateway_public_bind`
- 含义：gateway 不是 `loopback` 绑定。
- 严重级别：`critical`
- 判断：
  - `gateway.bind` 为 `0.0.0.0`
  - 或其他非 `loopback` 的对外绑定模式
- 风险：
  - OpenClaw gateway 暴露到不可信网络。
- 默认修复：
  - 把 `gateway.bind` 改为 `loopback`

### 8.2 `gateway_missing_token_auth`
- 含义：gateway 没有启用 token 鉴权，或 token 未配置。
- 严重级别：`critical`
- 判断：
  - `gateway.auth.mode !== "token"`
  - 或 `gateway.auth.token` 缺失 / 为空
- 风险：
  - 未授权调用 gateway。
- 默认修复：
  - `gateway.auth.mode = "token"`
  - 若 token 缺失，后端自动生成随机 token 并写入配置
- 交互说明：
  - 预览时只显示掩码后的 token 结果，不回显完整 secret。

### 8.3 `dm_policy_too_open`
- 含义：私信入口过宽。
- 严重级别：`high`
- 判断：
  - 渠道启用，且 `dmPolicy = "open"`
- 风险：
  - 任意用户可直接触发机器人。
- 默认修复：
  - 改为 `pairing`
- 可选修复：
  - 若已有 allowlist 数据，则允许用户切为 `allowlist`

### 8.4 `group_policy_too_open`
- 含义：群聊入口过宽。
- 严重级别：`high`
- 判断：
  - 渠道启用，且 `groupPolicy = "open"`
- 风险：
  - 群内任何成员都可能触发机器人。
- 默认修复：
  - 改为 `disabled`
- 可选修复：
  - 在抽屉中选择改为 `allowlist`

### 8.5 `group_missing_require_mention`
- 含义：群聊允许触发，但未要求 `@` 机器人。
- 严重级别：`medium`
- 判断：
  - 群聊未禁用
  - 且 `requireMention !== true`
- 风险：
  - 机器人被普通对话噪声误触发。
- 默认修复：
  - 将对应群配置的 `requireMention` 设为 `true`

### 8.6 `group_missing_allowlist`
- 含义：群聊开放，但群或群内触发人未收口。
- 严重级别：`high`
- 判断：
  - `groupPolicy = "open"` 或 `allowlist`
  - 但没有有效群级白名单或成员 allowlist
- 风险：
  - 群面扩大，误触发和滥用成本低。
- 默认修复：
  - 提供向导，推荐两种方案：
    - 方案 A：禁用群聊
    - 方案 B：切到 allowlist，并选择已有群配置

### 8.7 `sandbox_disabled_for_high_risk_profile`
- 含义：高风险工具画像下未启用普通沙箱。
- 严重级别：`high`
- 判断：
  - `tools.profile` 为高风险画像，例如 `coding`
  - 且 `agents.defaults.sandbox.mode` 未开启
- 风险：
  - 执行、文件写入、网络访问与宿主机隔离不足。
- 默认修复：
  - 启用默认普通沙箱配置
- 说明：
  - 若当前环境缺少沙箱镜像，只展示“需要准备环境”的友好说明。

### 8.8 `browser_sandbox_missing`
- 含义：启用浏览器能力，但未做浏览器沙箱隔离。
- 严重级别：`medium`
- 判断：
  - 配置中存在浏览器能力
  - 但没有浏览器沙箱配置
- 风险：
  - 浏览器上下文与宿主机共享过多。
- 默认修复：
  - 若检测到已有浏览器沙箱镜像配置，直接切换。
  - 若没有环境依赖，展示只读提示，不允许盲修。

## 9. 一键修复边界

### 9.1 可直接一键修的项
- `gateway.bind`
- `gateway.auth.mode`
- 自动生成 token
- `dmPolicy=open -> pairing`
- `groupPolicy=open -> disabled`
- `requireMention=false -> true`

### 9.2 需要修复向导的项
- allowlist 相关项
- 沙箱镜像未就绪但需要启用沙箱

### 9.3 暂不支持自动修复的项
- 依赖用户企业网络架构的远程访问方案
- 需要与外部 secret 管理平台联动的 token 存储
- 无法确定安全默认值的第三方插件端口暴露问题

## 10. 技术架构

```text
Admin UI
  └─ Claw Guard Panel
      ├─ loadHardeningStatus()
      ├─ previewHardeningFix()
      └─ applyHardeningFix()

Admin Server
  ├─ OpenClawConfigClient
  │   ├─ readConfigSnapshot()
  │   ├─ previewPatch()
  │   └─ applyPatch()
  ├─ ClawGuardDetector
  │   └─ buildFindings(config)
  └─ ClawGuardFixPlanner
      └─ buildPatch(findingId, options)
```

### 10.1 后端模块划分
建议新增 4 个模块：

#### `src/admin/claw_guard_types.ts`
- 定义状态、风险项、修复预览、修复结果类型。

#### `src/admin/openclaw_config_client.ts`
- 负责与 OpenClaw 配置层交互。
- 优先走 `config.get` / `config.patch`。
- fallback 为只读文件解析。

#### `src/admin/claw_guard_detector.ts`
- 纯函数模块。
- 输入配置快照，输出风险列表和通过项。
- 不做 I/O，方便测试。

#### `src/admin/claw_guard_fix_planner.ts`
- 根据风险 ID 和用户选择生成 patch。
- 统一判断是否需要重启、是否可自动修复。

### 10.2 路由设计
在 `src/admin/server_router.ts` 中新增：

#### `GET /api/hardening/status`
返回：
- 配置来源
- gateway 是否在线
- 风险列表
- 已通过项
- 摘要统计

#### `POST /api/hardening/fixes/:id/preview`
输入：
- `options`

返回：
- 当前值
- 推荐值
- patch 预览
- 是否需要重启
- 是否可直接应用

#### `POST /api/hardening/fixes/:id/apply`
输入：
- `options`

返回：
- `ok`
- `message`
- `restart_required`
- 修复后的该项状态

## 11. 配置读取与写入策略

### 11.1 读取策略
第一选择：
- 调 OpenClaw 配置接口读取当前生效配置。

第二选择：
- 读取 `~/.openclaw/openclaw.json` 做只读分析。

### 11.2 写入策略
不建议直接改文本文件，理由：
- OpenClaw 配置可能有 JSON5、include、注释等特性。
- 直接改文本容易破坏格式。
- 很难保证与运行时生效配置一致。

因此第一版建议：
- 用 OpenClaw 官方配置 patch 能力做写入。
- 如果 patch 能力不可用，则页面进入只读模式，禁用修复按钮。

## 12. 前端实现建议

### 12.1 新增 tab
需要修改：
- `src/admin/dashboard_url_state.ts`
- `admin/src/dashboard_core.ts`
- `admin/src/app.tsx`

新增 tab id：

```ts
"hardening"
```

文案：
- `zh-CN`: `系统加固`
- `en`: `Claw Guard`

### 12.2 新增面板文件
建议新增：

```text
admin/src/dashboard_hardening_panel.tsx
```

这个文件只负责：
- 摘要卡片
- 风险卡片列表
- 详情抽屉
- 修复确认弹层

数据拉取和状态管理继续放在 `admin/src/app.tsx`，保持和当前后台结构一致。

## 13. 友好交互细节

### 13.1 文案风格
- 直接说问题，不堆术语。
- 不写“存在潜在风险面”这类空话。
- 直接写：
  - `gateway 当前不是 loopback 绑定`
  - `群聊当前对所有成员开放`
  - `当前未要求 @ 机器人`

### 13.2 空状态
当没有风险项时：
- 不显示大面积成功插图。
- 只显示一句明确文案：
  - `当前配置没有发现可识别的高价值风险项。`

### 13.3 错误状态
若无法读取配置：
- 说明是“配置不可读”还是“gateway 不在线”。
- 如果只是无法写入，仍展示只读分析结果。

### 13.4 重启提示
需要重启时不要只写在 toast 里。
应该在风险卡片和抽屉里都给出明确标签：
- `需要重启 gateway`

## 14. 当前配置的预期命中效果
按当前本机配置的脱敏检查，第一版落地后应该至少具备下面这种效果：
- `gateway.bind=loopback` 和 `auth.mode=token` 这类项会显示为已通过。
- 已开启群聊且未完全收口的渠道，会直接在风险列表里出现。

这说明该页不是概念页，而是落地后马上能给出真实结果。

## 15. 测试方案

### 15.1 单元测试
- `claw_guard_detector.test.ts`
  - 各风险规则的命中与不命中。
- `claw_guard_fix_planner.test.ts`
  - patch 生成正确。
- `openclaw_config_client.test.ts`
  - 读取、预览、应用、失败回退。

### 15.2 前端测试
- 新 tab 的 URL 状态同步。
- 风险卡片渲染。
- 预览和确认交互。
- 中英文文案切换。
- 浅色 / 深色主题可读性。

### 15.3 集成测试
- 管理后台 API 返回 hardening 状态。
- 应用修复后重新读取状态能更新。
- 需要重启的项返回正确标记。

## 16. 实现顺序

### Phase 1
- 新 tab
- 状态 API
- 6 到 8 条基础规则
- 预览与单项修复

### Phase 2
- allowlist 修复向导
- 沙箱环境检查增强
- 已通过项折叠区

### Phase 3
- 可选的“推荐基线”批量修复
- 修复历史与审计记录

## 17. 落地后的文档同步
如果这个方案确认进入实现，建议同步更新：
- `docs/ADMIN_DASHBOARD.md`
- `docs/OPENCLAW_INSTALL.md`

前者补新页签说明，后者补“系统加固”与 OpenClaw 配置修复路径说明。
