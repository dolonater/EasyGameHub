# Bilibili 插件 UI 布局优化实施计划

> 创建日期：2026-08-11  
> 状态：Stage 2 计划草案，待批准执行  
> 设计文档：`docs/superpowers/specs/2026-08-11-bilibili-ui-redesign.md`  
> 关联主计划：`docs/superpowers/plans/2026-08-10-bilibili-plugin-plan.md`  
> 执行原则：只改官方 Bilibili 插件前端 UI 与样式；不改 Rust 后端、SDK API、播放代理、DASH/MP4 fallback 和账号能力。

## 执行原则

- 每个阶段开始前先对照设计文档和本计划做严格 review，确认没有偏离“视频客户端”方向。
- 所有代码修改限制在：
  - `scripts/official-plugins/bilibili/src/`
  - `scripts/official-plugins/bilibili/manifest.json`，仅在新增页面注册需要时修改
  - `plugins/com.easygamehub.bilibili/`
  - `resources/defaults/plugins/com.easygamehub.bilibili/`
- 不修改：
  - `src-tauri/src/core/bilibili/`
  - `src-tauri/src/commands/bilibili.rs`
  - `src/plugins/sdk.ts`
  - 播放器核心 `dashPlayer.ts` 的行为逻辑，除非 UI 拆分暴露出纯类型/回调问题。
- 保留当前已经修复的播放稳定性：
  - DASH 高清播放。
  - MP4 兼容 fallback。
  - 图片代理。
  - 进度条不因失败视频跳到末尾的修复。
- 每阶段完成后执行插件构建；涉及打包阶段执行 `npm run pack`。

## 全局验证命令

插件前端验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

主应用前端验证：

```powershell
npm run build
```

手测入口：

```powershell
npm run tauri dev
```

## P0 设计对齐与 UI 骨架拆分

### T1 Review 当前实现与目标结构

文件：

- `docs/superpowers/specs/2026-08-11-bilibili-ui-redesign.md`
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

检查：

- 首页账号库常驻侧栏是待移除对象。
- 播放页下方评论常驻是待移除对象。
- `PlayerShell` 低频控制区是待拆对象。
- 播放状态、取流、fallback、进度 reporter 不应重写。

预期：

- 明确本阶段只做组件边界和骨架，不做视觉细化。

### T2 新增插件顶层 Shell

文件：

- `scripts/official-plugins/bilibili/src/components/BiliAppShell.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/BiliTopNav.tsx`（新）
- `scripts/official-plugins/bilibili/src/routes.ts`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `BiliAppShell` 统一注入 `<style>{cssText}</style>`，提供页面外层、宽度约束和顶栏槽位。
- `BiliTopNav` 显示：
  - Bilibili 标识。
  - `首页`、`我的` 导航。
  - 当前页态。
  - 右侧登录/头像入口。
- `routes.ts` 增加：
  - `homeUrl()`
  - `mineUrl()`
  - `watchUrl(video)`
- 导航使用插件宿主内路由 URL，不新增外部依赖。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 现有首页和播放页仍可打开。
- 顶栏样式不压缩主内容。

### T3 页面接入 `BiliAppShell`

文件：

- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`

编辑：

- 移除两个页面内重复的 `bili-home-header`。
- 首页通过 `BiliAppShell current="home"` 包裹。
- 播放页通过 `BiliAppShell current="watch"` 包裹，并保留返回按钮。
- 保持数据加载逻辑不变。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 页面结构更统一。
- 不影响推荐/热门/搜索、播放详情加载。

## P1 首页重构

### T4 首页移除账号常驻侧栏

文件：

- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 移除首页 `bili-home-grid` 的右栏。
- 首页主体变为单列 feed 布局。
- 删除首页对 `LoginPanel` 和 `AccountLibraryTabs` 的直接渲染。
- 顶栏头像/登录入口负责跳转 `我的`。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 首页第一屏只剩搜索、推荐/热门、视频网格。

### T5 首页 Feed 抽组件

文件：

- `scripts/official-plugins/bilibili/src/components/HomeFeed.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/HomeFeedTabs.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`

编辑：

- 把推荐/热门/搜索结果区域从 `HomePage` 抽为 `HomeFeed`。
- 把 `推荐` / `热门` Tab 抽为 `HomeFeedTabs`。
- `HomePage` 只保留 query、mode、load 函数和数据装配。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 首页逻辑更清楚，功能不变。

### T6 优化首页视觉密度

文件：

- `scripts/official-plugins/bilibili/src/components/VideoCard.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 桌面网格目标 4-5 列，最小卡片宽度稳定。
- 封面保持 16:9。
- 标题两行截断。
- 元信息更紧凑，时长角标不遮挡主体。
- 保留图片代理和封面 fallback。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 首页呈现更像视频客户端 feed。

## P2 新增我的页

### T7 注册 `mine` 页面

文件：

- `scripts/official-plugins/bilibili/src/index.tsx`
- `scripts/official-plugins/bilibili/src/pages/MinePage.tsx`（新）
- `scripts/official-plugins/bilibili/src/routes.ts`

编辑：

- 注册页面：

```ts
sdk.ui.registerPage({
  path: "mine",
  title: "我的",
  icon: "playFilled",
  render: MinePage,
});
```

- `MinePage` 使用 `BiliAppShell current="mine"`。
- 顶栏 `我的` 导航可进入该页。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 插件出现独立 `我的` 页面。

### T8 迁移登录与账号库

文件：

- `scripts/official-plugins/bilibili/src/pages/MinePage.tsx`
- `scripts/official-plugins/bilibili/src/components/LoginPanel.tsx`
- `scripts/official-plugins/bilibili/src/components/AccountLibraryTabs.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `MinePage` 渲染 `LoginPanel`。
- 已登录时渲染账号内容 Tabs。
- 未登录时不加载历史、稍后再看、收藏夹真实数据。
- 可将 `AccountLibraryTabs` 重命名为 `MineLibraryTabs`，如重命名需同步 import。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 账号能力集中到 `我的`。
- 首页不再承担账号库展示。

### T9 我的页视觉整理

文件：

- `scripts/official-plugins/bilibili/src/pages/MinePage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 顶部账号信息区。
- 下方 `历史 / 稍后再看 / 收藏夹` Tabs。
- 收藏夹桌面左右布局，小屏上下布局。
- 空态、未登录态、加载态、错误态完整。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- `我的` 页面像账号中心，不像首页侧栏搬家。

## P3 播放页 Tabs 架构

### T10 拆出播放页布局组件

文件：

- `scripts/official-plugins/bilibili/src/components/WatchLayout.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/WatchSidebarTabs.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `WatchLayout` 管理桌面两列和小屏上下结构。
- `WatchSidebarTabs` 管理当前 active tab：
  - `pages`
  - `quality`
  - `danmaku`
  - `comments`
  - `more`
- 默认 active tab：
  - 有多个分 P 时默认 `pages`。
  - 单 P 时默认 `quality`。
- 小屏下 tabs 放到播放器下方。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 播放页只显示一个辅助面板。

### T11 `PlayerShell` 职责收缩

文件：

- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`

编辑：

- `PlayerShell` 保留：
  - video。
  - dash 初始化。
  - fallback 触发。
  - progress reporter。
  - keyboard。
  - DanmakuOverlay。
  - 高频控制条。
  - DanmakuInput。
  - 视频详情基础信息。
- 从 `PlayerShell` 移除：
  - 右侧 `bili-watch-side`。
  - 分 P panel。
  - 清晰度 panel 容器。
  - 弹幕设置 panel。
  - 外部打开、截图目录、账号操作。
- 通过回调把 `playerRef` 可用能力暴露给 `WatchSidebarTabs`，或把清晰度控制状态留在 `PlayerShell` 并提供窄接口。

风险控制：

- 不改 `createDashPlayer`。
- 不改 `requestPlaybackFallback`。
- 不改 `createProgressReporter`。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 播放核心生命周期不变。
- UI 面板从播放器组件中分离。

### T12 拆出各个右侧面板

文件：

- `scripts/official-plugins/bilibili/src/components/WatchPagesPanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/WatchQualityPanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/WatchDanmakuPanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/WatchMorePanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/CommentPanel.tsx`

编辑：

- `WatchPagesPanel` 接管分 P 列表。
- `WatchQualityPanel` 包装 `QualityMenu` 和 playback mode。
- `WatchDanmakuPanel` 接管弹幕设置和弹幕加载错误。
- `WatchMorePanel` 接管：
  - 外部打开。
  - 截图目录。
  - 稍后再看。
  - 收藏夹选择。
- `CommentPanel` 嵌入 `comments` Tab，不再由 `WatchPage` 单独堆在底部。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 播放页辅助功能分组明确。

## P4 播放页视觉与响应式

### T13 桌面播放页视觉整理

文件：

- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 播放器主区宽度优先。
- 右侧 Tabs 固定宽度约 320-360px。
- 右侧 panel 内滚动，避免页面整体被评论拉长。
- 清晰度、弹幕、更多操作按钮统一密度。
- 评论卡片样式从当前 14px 圆角收敛到 8px 风格。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 播放器成为第一视觉重心。

### T14 小屏 Tabs 响应式

文件：

- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `max-width: 760px` 下播放页变为：
  - 播放器。
  - 弹幕输入。
  - 标题信息。
  - 横向 Tabs。
  - 当前 Tab 内容。
- 控制条维持稳定尺寸，不因按钮文本导致换行挤压。
- 评论列表不遮挡播放器。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 小屏不再纵向堆全部功能。

### T15 状态样式统一

文件：

- `scripts/official-plugins/bilibili/src/styles.ts`
- 相关组件状态分支

编辑：

- 统一 loading、empty、error、disabled 状态样式。
- 错误文本允许换行，不撑破容器。
- 按钮文字较长时使用合适宽度或换行策略。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 状态表现统一，不再像临时拼接。

## P5 回归验证、打包与文档收尾

### T16 插件构建和打包

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

### T17 主应用构建

命令：

```powershell
npm run build
```

预期：

- 主前端构建通过。

### T18 手动验收

命令：

```powershell
npm run tauri dev
```

检查：

1. 首页默认展示推荐视频网格。
2. 首页 `推荐` / `热门` Tab 都可用。
3. 首页搜索和刷新可用。
4. 首页不再常驻历史、稍后再看、收藏夹侧栏。
5. 顶栏可进入 `我的`。
6. `我的` 未登录时能扫码登录。
7. `我的` 已登录时能浏览历史、稍后再看、收藏夹。
8. 从首页视频进入播放页。
9. 播放页 DASH 高清仍能播放。
10. 兼容模式仍能播放此前有黑屏风险的视频。
11. 播放中清晰度切换可用。
12. 分 P Tab 可切 P，播放进度记录不回退。
13. 弹幕 Tab 可调整弹幕设置。
14. 评论 Tab 可读取评论、发布/回复/点赞等原有能力不回退。
15. 更多 Tab 可外部打开、截图、打开截图目录、稍后再看、收藏。
16. 小屏下 Tabs 出现在播放器下方，且只展开一个面板。

### T19 更新进度文档

文件：

- `docs/superpowers/progress.md`
- `docs/superpowers/specs/2026-08-11-bilibili-ui-redesign.md`
- `docs/superpowers/plans/2026-08-11-bilibili-ui-redesign-plan.md`

编辑：

- 记录 UI 设计和计划已生成。
- 执行后记录 P0-P5 完成情况、验证命令和手测结果。
- 如果实现中发现设计偏差，先修订设计文档再继续。

验证：

- Markdown 可读。
- 路径准确。

## 回退规则

| 触发条件 | 处理 |
| --- | --- |
| 播放核心行为被迫修改 | 停止 UI 阶段，重新 review，避免把 UI 重构变成播放重写 |
| DASH 高清或兼容模式回退 | 回滚对应 UI 接线，不改播放底层 |
| 评论/弹幕/收藏功能丢失 | 检查 panel 拆分时的 props 和回调，不改 SDK |
| 小屏仍堆全部面板 | 回到 P4，重做响应式 Tabs |
| 新增页面导致宿主导航异常 | 回到 P2，只保留插件内顶栏导航并检查 registerPage |

## 完成定义

- 设计文档验收标准全部满足。
- 首页、播放页、我的页职责分离。
- 播放页辅助功能进入单任务 Tabs。
- 小屏响应式符合设计。
- `cd scripts/official-plugins/bilibili && npm run build && npm run pack` 通过。
- `npm run build` 通过。
- 内置插件开发目录和默认资源目录都写回。

