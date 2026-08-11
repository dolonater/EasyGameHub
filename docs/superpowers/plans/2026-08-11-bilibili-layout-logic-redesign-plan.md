# Bilibili 插件页面布局与逻辑重设计实施计划

> 创建日期：2026-08-11
> 状态：Stage 2 计划草案，待批准执行
> 设计文档：`docs/superpowers/specs/2026-08-11-bilibili-layout-logic-redesign.md`
> 关联设计：`2026-08-10-bilibili-plugin-design.md`、`2026-08-11-bilibili-ui-redesign.md`、`2026-08-11-bilibili-interactions-design.md`
> 执行顺序：P0 逻辑 Hook → P1 首页 → P2 播放页布局 → P3 控制栏与弹层 → P4 我的页 → P5 响应式、打包与文档收尾

## 执行原则

- 只改官方 Bilibili 插件前端（`scripts/official-plugins/bilibili/src/`）与打包产物。
- 不改 `src-tauri/src/core/bilibili/`、`src-tauri/src/commands/bilibili.rs`、`src/plugins/sdk.ts`、`runtime.ts` 的全局 store 结构。
- 保留播放核心：DASH 高清、MP4 兼容 fallback、图片代理、进度 reporter、弹幕读取/发送、评论 API、收藏/稍后再看 API 一律不动。
- 弹层统一只改视觉不改行为：投币/收藏确认流程、互动乐观更新与回滚逻辑保持。
- 先抽 Hook 保留原行为，再改布局；每阶段完成跑插件构建，涉及打包阶段跑 `npm run pack`。
- 相关推荐属于内容区功能，独立加载失败只显示空态，不阻塞播放页。

## 全局验证命令

插件前端：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

主应用前端（验证 SDK 未破坏）：

```powershell
npm run build
```

手测入口：

```powershell
npm run tauri dev
```

## P0 逻辑层 Hook

### T1 实现 `usePagedFeed`

文件：

- `scripts/official-plugins/bilibili/src/hooks/usePagedFeed.ts`（新）

编辑：

- 实现 `usePagedFeed<T>(fetcher, options)`，封装 `items/page/loading/error`，`fetcher` 签名 `(page, refresh) => Promise<T[]>`。
- 接口：`reload()`（**换一批**：page+1 并透传 refresh 绕过缓存，对齐现有"刷新"语义，不是刷新当前页）、`reset()`（重载第一页，同词重提交场景）。
- 不实现 `loadMore()`（首页无"加载更多"UI，`reload()` 已覆盖翻批）。
- `options.key` 变化时自动 reset 到第一页并加载；`options.enabled` 为 false 时不加载并清空数据。
- 用请求序号丢弃过期响应，并沿用 `active` 守卫避免卸载后 setState。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- Hook 可编译，独立于页面组件。

### T2 实现 `useVideoInteraction`

文件：

- `scripts/official-plugins/bilibili/src/hooks/useVideoInteraction.ts`（新）

编辑：

- 从 `WatchPage` 移入：互动状态加载、乐观更新（点赞/稍后再看/关注）与回滚、投币（非乐观）、收藏、分享、举报、busy 串行锁、登录态门控。
- 接收 deps：`{ aid, bvid, ownerMid, loggedIn }`；`aid/bvid/ownerMid` 与 `loggedIn` 变化时重新加载互动状态（对齐现有 effect 的 `loginInfo.loggedIn` 依赖）。
- 保持现有交互行为不变：乐观回滚、投币成功刷新、互动失败不阻塞播放、写操作未登录提示登录。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- Hook 封装完整互动逻辑，`WatchPage` 可改为消费它。

### T3 首页接入 `usePagedFeed`（行为不变重构）

文件：

- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`

编辑：

- 用三个 `usePagedFeed` 实例替换三套 page 计数器与三个 load 函数。
- 保留 `mode` 状态选择当前活动实例，把活动实例的 `items/loading/error` 传给 `HomeFeed`，`HomeFeed` props 不变。
- 推荐实例 mount 即加载；热门实例 `enabled` 懒加载（首次切到热门 Tab 才请求，对齐现有行为）；搜索实例 `key` 用**已提交关键词**状态（非实时输入框），提交触发、同词重提交调 `reset()`、空词回到推荐。
- 保持现有页面结构（单列 feed、无搜索 Tab）不变，仅验证逻辑等价。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 首页行为与重构前一致，三套计数器消失。

### T4 播放页接入 `useVideoInteraction`（行为不变重构）

文件：

- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`

编辑：

- 用 `useVideoInteraction` 替换 `WatchPage` 内的互动状态与回调，props 由 Hook 结果驱动。
- `PlayerShell` 的 props 接口保持不变（`interactionState/loading/error/busy` + `onLike/onCoin/...`），P0 不改 `PlayerShell`。
- 保持现有播放页布局不变，仅验证逻辑等价。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 互动行为与重构前一致，`WatchPage` 回调收敛。

### T5 P0 验证

命令：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

预期：

- 两个 Hook 落地，首页与播放页行为与重构前一致。

## P1 首页布局

### T6 首页三 Tab（推荐/热门/搜索）

文件：

- `scripts/official-plugins/bilibili/src/components/HomeFeedTabs.tsx`
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `HomeFeedTabs` 增加"搜索"Tab；当前 mode 为 search 时高亮"搜索"。
- 搜索提交自动切到搜索 Tab；空关键词不进入搜索空态。
- "搜索"Tab 未输入关键词时显示"输入关键词开始搜索"引导空态。
- 三个 Tab 各自持有独立 feed 数据，切 Tab 不丢、刷新只刷当前。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 搜索成为第三 Tab，语义清晰，无覆盖态高亮错乱。

### T7 热门精选横向行

文件：

- `scripts/official-plugins/bilibili/src/components/HotRow.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 顶部 `HotRow` 独立取 `popularVideos` 前 N 个（横向滚动）。
- 下方主网格为当前 mode 数据。
- 热门行独立加载失败只隐藏该行，不阻塞主网格。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 首页有"热门精选行 + 主网格"节奏。

### T8 首页组件纯展示化

文件：

- `scripts/official-plugins/bilibili/src/components/HomeFeed.tsx`

编辑：

- `HomeFeed` 收敛为纯展示（接收三实例数据 + 当前 mode + 回调），不持有数据装配逻辑。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 首页逻辑集中在 `HomePage` 的 Hook 消费，展示组件纯粹。

### T9 P1 验证

命令：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

预期：

- 首页三 Tab、热门精选行可用，网格视觉有节奏。

## P2 播放页布局

### T10 评论区回主区全宽

文件：

- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/components/CommentPanel.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `PlayerShell` 在 `watch-main` 底部渲染 `commentsPanel` prop（全宽），不再把 `commentsPanel` 传给侧栏 Tab。
- 移除侧栏 `comments` Tab。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 评论区在主区全宽，评论列表/楼中楼/发布/分页不变。

### T11 右侧内容栏（分P + 相关推荐）

文件：

- `scripts/official-plugins/bilibili/src/components/WatchSidebarTabs.tsx`
- `scripts/official-plugins/bilibili/src/components/RelatedPanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `WatchSidebarTabs` 改为右侧内容栏，**两个堆叠区块**：`分P 列表` + `相关推荐`，不做 Tab 切换。
- 移除 Tab 切换机制、`defaultTab`（依赖 `pagesCount>1` 的逻辑）与 `focusMoreNonce`（"更多"不再驱动侧栏）。
- `RelatedPanel` 接线 `sdk.bilibili.video.related`（bvid/aid），复用 `VideoCard`。
- 侧栏只放内容，不放任何播放器设置。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 相关推荐死代码被接线，侧栏有真实内容。

### T12 播放页职责边界

文件：

- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`

编辑：

- `PlayerShell` 只负责播放内核：video、dash 生命周期、fallback、progress reporter、keyboard、DanmakuOverlay、两行控制栏、弹幕输入、详情信息、互动条与 UP 行渲染（数据经 props 传入）。
- 分P/相关推荐/设置面板全部移出到布局层。
- 不改 `createDashPlayer`、`requestPlaybackFallback`、`createProgressReporter`。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 组件职责清晰，播放核心生命周期不变。

### T13 P2 验证

命令：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

预期：

- 播放页主区全宽 + 右侧内容栏，评论全宽，相关推荐有数据。

## P3 控制栏与弹层

### T14 两行控制栏 + 图标化

文件：

- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 控制栏改两行：第一行进度条 + 时间；第二行播放/暂停 | 音量 | 倍速 | 清晰度▾ | 弹幕▾ | 截图 | 全屏。
- 控件图标化，倍速/清晰度/弹幕状态用"图标 + 小标签"。
- 截图按钮从互动条语境移入控制栏（ScreenshotButton 复用）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 控制栏两行图标化，不换行。

### T15 清晰度/弹幕进控制栏 popover

文件：

- `scripts/official-plugins/bilibili/src/components/QualityMenu.tsx`（复用为 popover 内容）
- `scripts/official-plugins/bilibili/src/components/DanmakuSettingsPopover.tsx`（新，自 PlayerShell 迁出弹幕设置）
- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 清晰度按钮点开 popover，内容为 `QualityMenu`（自动/手动/具体清晰度），从播放器实际状态取。
- 弹幕按钮点开 popover，内容为弹幕设置（开关/字号/透明度/密度/速度）。
- 侧栏不再承载清晰度/弹幕面板。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 清晰度/弹幕是控制栏 popover，不再在侧栏。

### T16 弹层统一为菜单样式

文件：

- `scripts/official-plugins/bilibili/src/components/WatchMoreMenu.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/CoinPanel.tsx`
- `scripts/official-plugins/bilibili/src/components/FavoritePanel.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `VideoInteractionBar` 的"更多"按钮本地弹 `WatchMoreMenu`（外部打开 / 复制链接 / 打开截图目录），不再通过 `onMore`/`focusMoreNonce` 驱动侧栏。
- 移除 `focusMoreNonce` 机制与侧栏 `more` Tab。
- 投币面板、收藏面板统一为同一种菜单样式弹层。
- 弹层只改视觉不改行为；投币/收藏确认流程不变。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 四个弹层统一风格，行为不变。

### T17 P3 验证

命令：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

预期：

- 控制栏两行、清晰度/弹幕 popover、统一弹层全部可用。

## P4 我的页

### T18 账号信息卡

文件：

- `scripts/official-plugins/bilibili/src/components/AccountCard.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/MinePage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 顶部账号卡：头像/昵称/UID + 可拼统计。
- 实施前调查 `bpi-rs`/`wiliwili` 现有能力确定统计字段（如历史条数/稍后再看条数/收藏夹数）；能拼出什么放什么，不做空卡。
- 未登录显示登录卡片（LoginPanel 复用）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 我的页有个人中心感，统计来自真实数据。

### T19 我的页视觉整理

文件：

- `scripts/official-plugins/bilibili/src/pages/MinePage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 账号卡 + 下方三个 Tab 布局；loading/empty/error/未登录态齐全。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 我的页完整可用。

### T20 P4 验证

命令：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

预期：

- 账号卡数据真实，账号内容 Tab 功能不回退。

## P5 响应式、打包与文档

### T21 最小窗口响应式

文件：

- `scripts/official-plugins/bilibili/src/styles.ts`
- 相关组件状态分支

编辑：

- 最小窗口（~720px，可用 ~650px）下：右侧内容栏收成可展开面板，不常驻占宽；主链路（播放器+信息+评论）全宽；首页网格降 2-3 列；控制栏两行不换行。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 缩到最小窗口不破版，主链路可用。

### T22 插件构建、打包与写回

命令：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

预期：

- `plugins/com.easygamehub.bilibili/bundle.js` 更新。
- `resources/defaults/plugins/com.easygamehub.bilibili/bundle.js` 更新。
- bundle 仍只通过 `"sdk"` 使用宿主能力。

### T23 主应用构建

命令：

```powershell
npm run build
```

预期：

- 主前端构建通过（SDK 未破坏）。

### T24 手动验收

命令：

```powershell
npm run tauri dev
```

检查：

1. 首页默认推荐，推荐/热门/搜索三 Tab 各自数据独立，切换不互相覆盖。
2. 刷新只刷新当前模式。
3. 搜索提交进搜索 Tab，空关键词不进入搜索空态。
4. 首页有热门精选行 + 主网格。
5. 播放页评论区全宽，不再在侧栏。
6. 右侧内容栏只有分P + 相关推荐，相关推荐有数据。
7. 清晰度/弹幕在控制栏 popover。
8. 控制栏两行图标化。
9. 投币/收藏/更多/弹幕设置弹层统一菜单样式。
10. 我的页账号卡显示真实统计。
11. 缩到最小窗口侧栏折叠，主链路可用。
12. DASH 高清、兼容播放、清晰度切换、弹幕、评论、互动、进度、截图、收藏、稍后再看不回退。

### T25 更新进度文档

文件：

- `docs/superpowers/progress.md`
- `docs/superpowers/specs/2026-08-11-bilibili-layout-logic-redesign.md`
- `docs/superpowers/plans/2026-08-11-bilibili-layout-logic-redesign-plan.md`

编辑：

- 记录设计已确认（经 grill-me）、各阶段完成情况、验证命令与手测结果。
- 若实现中发现设计偏差，先修订设计文档再继续。

## 回退规则

| 触发条件 | 处理 |
| --- | --- |
| 播放核心行为被迫修改 | 停止 P2，重新 review，避免把布局重构变成播放重写 |
| 弹层统一样破坏投币/收藏流程 | 回滚对应样式，不改交互行为 |
| 相关推荐接口不稳定 | 面板独立加载失败只显示空态，不阻塞播放页 |
| 我的页统计拿不到数据 | 移除对应统计字段，保留账号卡基础信息 |
| 首页三 Tab 数据串扰 | 回到 P0 检查 `usePagedFeed` 实例隔离 |
| 最小窗口侧栏仍挤 | 回到 P5，调整折叠面板断点 |

## 完成定义

- 设计文档验收标准全部满足。
- 首页/播放页/我的页职责与布局符合设计。
- `usePagedFeed`/`useVideoInteraction` 收敛页面逻辑，`runtime.ts` 保留。
- `cd scripts/official-plugins/bilibili && npm run build && npm run pack` 通过。
- `npm run build` 通过。
- 内置插件开发目录与默认资源目录都写回。
- 播放能力无回退。
