# Bilibili 插件系统性扩展实施计划

> 创建日期：2026-08-11
> 状态：Stage 2 计划草案，待批准
> 工作流：`programming-workflow` Stage 2 Implementation Planning
> 设计文档：`docs/superpowers/specs/2026-08-11-bilibili-plugin-expansion-design.md`
> 执行顺序：P0 前置收编 → P1 内容浏览扩展 → P2 番剧/影视 → P3 弹幕增强 → P4 动态 → P5 私信/通知 → P6 直播 → P7 设置与打磨 → P8 专栏/笔记

## 执行原则

- 只实现设计文档确认范围；每个阶段完成后运行该阶段验证命令；失败原因不明确时停止执行并修订计划。
- Bilibili API 一律经 bpi-rs（收编后 `crates/bpi-rs`）；若 bpi-rs 已有能力，不在 EasyGameHub 内手写重复协议；缺失接口先补进 bpi-rs 及其契约测试。
- 插件页面不接触 Cookie、CSRF 和原始播放 URL；代理只代理会话登记过的 URL。
- 账号写操作（关注/追番/发布/私信/弹幕操作）全部带登录门控与错误分类提示；风控失败不阻塞播放。
- bpi-rs 收编（P0-T1）涉及 git 与目录操作，执行前先 `git status` 确认工作区干净并备份独立 `.git`（移动到 `crates/bpi-rs-git-backup/` 而非直接删除）。

## 全局验证基线

在仓库根目录执行：

```powershell
cargo fmt
cargo check
cargo test bilibili
cargo test plugins
npm run build
```

插件目录验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

bpi-rs 契约测试（新增接口后）：

```powershell
cargo test --manifest-path crates/bpi-rs/Cargo.toml <affected-module>
```

插件 bundle 检查：仅 `from "sdk"` 导入、0 处 `@tauri-apps` 直连。

## P0 前置：bpi-rs 收编、导航与 SDK 骨架

### T1 bpi-rs 收编为主仓库 crate

文件：

- `crates/bpi-rs/`（移动自 `bpi-rs/`）
- `Cargo.toml`（根 workspace）
- `src-tauri/Cargo.toml`

编辑：

- 执行前 `git status` 确认主仓库工作区干净；`bpi-rs/.git` 移动备份到**主仓库外**（`D:\apps\appss\ws\ets2\bpi-rs-git-backup\`，历史保留，不进入主仓库 git 跟踪），随后 `git add` 收编目录。
- 根 `Cargo.toml` workspace members 增加 `"crates/bpi-rs"`。
- 根 `.gitignore` **删除 `bpi-rs/` 行**（该无前缀模式会匹配任意层级的 bpi-rs 目录，导致收编后 crates/bpi-rs 不被跟踪）；全局 `target/` 已覆盖编译产物。
- `src-tauri/Cargo.toml` 依赖 `bpi-rs = { path = "../bpi-rs", ... }` 改为 `path = "../crates/bpi-rs"`，feature 列表不变。
- 保留 `crates/bpi-rs/LICENSE` 与作者署名；`crates/bpi-rs/Cargo.lock` 在 workspace 中不参与解析，可保留。

验证：

```powershell
cargo check
cargo test --manifest-path crates/bpi-rs/Cargo.toml --all-features
```

预期：

- 整个 workspace 一次 `cargo check` 通过；bpi-rs 契约测试全绿；收编后独立仓库远程不再被引用。

### T2 导航/视图模型扩展

文件：

- `scripts/official-plugins/bilibili/src/navigation.ts`
- `scripts/official-plugins/bilibili/src/pages/MainPage.tsx`
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`

编辑：

- `BiliNavView` 扩展采用**向后兼容方式**：现有 `{name:"watch",bvid?,aid?,cid?}` 调用点不改，watch 增加可选 `type:"video"|"season"`、`seasonId`、`epId` 字段；新增 `space`（mid）、`season`（seasonId）、`live`（roomId）、`settings`、`dynDetail`（dynId）、`article`（articleId）视图。
- `openWatch` 签名保持兼容；`watchKey` 适配 season 类型；`MainPage` 新增视图渲染分支（space/season/live/settings/dynDetail/article 按需挂载、home/mine 保活逻辑不变），P0 先挂占位面板（P1-P8 填充）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 新增视图骨架可挂载；既有视频播放、返回栈、滚动恢复不回退。

### T3 SDK 命名空间骨架

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/plugin-template/src/sdk.d.ts`

编辑：

- `sdk.bilibili` 增加命名空间占位：`ranking`、`search`（suggest/hotwords）、`fav`（收藏夹管理）、`user`、`season`、`live`、`dynamic`、`message`、`note`、`article`；全部 `requirePerm("bilibili")`；不设 `settings` 命名空间（设置项走 `sdk.storage` + runtime config，编码/音质参数经 `playback.createPlayback` 扩展）。
- 插件模板同步。

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 宿主 SDK 与插件声明一致，构建通过。

### T4 后端命令模块骨架

文件：

- `src-tauri/src/core/bilibili/mod.rs`
- `src-tauri/src/core/bilibili/{ranking,search,fav,user_space,season,live,dynamic,message,note,article}.rs`（新，P0 先建 `mod.rs` 声明骨架，文件内最小可编译占位）
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- `core/bilibili/mod.rs` 声明新子模块（`pub mod ranking;` 等，占位文件可先为空 mod）；commands 按 `bilibili.rs` 现有结构追加；**不注册无意义的 ping 占位命令**，真实命令随 P1-P8 各期加入并同步注册到 `lib.rs`。

验证：

```powershell
cargo check
```

### T5 首页子 tab 结构

文件：

- `scripts/official-plugins/bilibili/src/components/HomeFeedTabs.tsx`
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 首页子 tab 扩展为 `推荐 | 热门 | 搜索 | 追番 | 影视 | 直播`（搜索 Tab 维持 layout-redesign 现状不动）；追番/影视/直播 P1 渲染禁用占位（P2/P6 填充）；tab 条允许横向滚动。
- 热门子 tab 内嵌二级分类 `综合热门 | 排行榜 | 每周必看 | 入站必刷`（P1 填充排行榜/每周必看/入站必刷，综合热门复用现有 popular 数据）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T6 P0 验证

命令：

```powershell
cargo fmt
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build && npm run pack
```

预期：

- 收编后 workspace 构建通过；插件新视图/命名空间骨架可编译。

## P1 内容浏览扩展

### T7 后端排行/搜索命令

文件：

- `src-tauri/src/core/bilibili/ranking.rs`（新：ranking/series/precious）
- `src-tauri/src/core/bilibili/search.rs`（新：suggest/hotwords）
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- 命令：`bilibili_ranking_videos(rid: Option<u32>, page)`、`bilibili_weekly_series_list()`、`bilibili_weekly_series_one(series_id)`、`bilibili_precious_videos()`、`bilibili_search_suggest(keyword)`、`bilibili_search_hotwords()`。
- 全部映射 `BiliVideoCard` DTO；登录态走 optional client；空关键词 suggest 返回空数组不报错。

验证：

```powershell
cargo test bilibili
cargo check
```

### T8 SDK ranking/search 扩展

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/plugin-template/src/sdk.d.ts`

编辑：

- `sdk.bilibili.ranking.*`（videos/weeks/weekDetail/precious）、`sdk.bilibili.search.*`（suggest/hotwords）填充并强制 `bilibili` 权限（现有 `home.searchVideos` 保留不动）。

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

### T9 热门二级分类 + 排行榜 UI

文件：

- `scripts/official-plugins/bilibili/src/components/HomeFeedTabs.tsx`
- `scripts/official-plugins/bilibili/src/components/RankingPanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 热门 tab 内四个二级分类切换（综合热门复用现有 popularVideos；排行榜/每周必看/入站必刷各自独立 `usePagedFeed` 实例）。
- `RankingPanel`：rid 分区选择器（全站 0 + 常用分区列表）+ 榜单列表；每周必看默认最新一期 + 期列表切换；PGC 榜占位提示（P2 填充）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T10 搜索建议/热搜/历史

文件：

- `scripts/official-plugins/bilibili/src/components/BiliTopNav.tsx`
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/runtime.ts`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 顶栏搜索框输入联想下拉（suggest，300ms debounce）；首页空态显示热搜榜（hotwords，点击直接搜索）；搜索历史存 `sdk.storage`（最近 10 条，可清空，显示在空态热搜下方）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T11 收藏夹管理模式

文件：

- `src-tauri/src/core/bilibili/fav.rs`（新：管理命令）
- `src-tauri/src/commands/bilibili.rs`
- `src/plugins/sdk.ts`、`scripts/official-plugins/bilibili/src/sdk.d.ts`、`scripts/plugin-template/src/sdk.d.ts`
- `scripts/official-plugins/bilibili/src/components/AccountLibraryTabs.tsx`
- `scripts/official-plugins/bilibili/src/components/FavoriteManagePanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 后端命令（映射 `fav.action`，放 `core/bilibili/fav.rs`，library.rs 保留浏览命令）：`bilibili_fav_folder_create/edit/delete`、`bilibili_fav_resource_move/copy/delete/clean`。
- SDK `sdk.bilibili.fav.*`。
- UI：收藏夹 tab 加"管理"入口；文件夹级新建/重命名/删除；文件夹内多选批量删除/移动；删除文件夹、清空收藏夹二次确认弹层（自实现，复用菜单弹层样式，宿主 SDK 无 Dialog 组件）；写操作后清相关缓存。

验证：

```powershell
cargo test bilibili
cargo check
cd scripts/official-plugins/bilibili
npm run build
```

### T12 UP 详情页

文件：

- `src-tauri/src/core/bilibili/user_space.rs`（新）
- `src-tauri/src/commands/bilibili.rs`
- `src/plugins/sdk.ts`、`scripts/official-plugins/bilibili/src/sdk.d.ts`、`scripts/plugin-template/src/sdk.d.ts`
- `scripts/official-plugins/bilibili/src/pages/SpacePage.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/VideoOwnerRow.tsx`（点击进 space）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 后端：`bilibili_user_space(mid)`（space_info + card + up_stat 聚合，**逐项容错**：任一失败降级隐藏对应字段，不整卡失败）、`bilibili_user_videos(mid, page)`（uploaded_videos）、`bilibili_user_follow(mid, follow)`（modify_relation）；直播状态取自 `space_info.live_room`（容错 None）。
- SDK `sdk.bilibili.user.*`。
- UI：`space` 视图 = 信息卡（BiliImage 头像/昵称/签名/统计/直播状态）+ 关注/取关（乐观更新回滚）+ 投稿视频 tab（分页网格）；动态 tab 占位（P4）。

验证：

```powershell
cargo test bilibili
cargo check
cd scripts/official-plugins/bilibili
npm run build
```

### T13 P1 验证

命令：

```powershell
cargo fmt
cargo check
cargo test bilibili
npm run build
cd scripts/official-plugins/bilibili
npm run build && npm run pack
```

手测：热门四分类切换、排行榜分区、搜索联想/热搜/历史、收藏夹管理全流程、UP 详情页进入与关注。

## P2 番剧/影视

### T14 bpi-rs 补 pgc 接口

文件：

- `crates/bpi-rs/src/bangumi/tab.rs`（新）
- `crates/bpi-rs/src/bangumi/client.rs`
- `crates/bpi-rs/tests/contracts/bangumi/**`（新契约）

编辑：

- 新增 `bangumi_tab()`（`/pgc/page/pc/bangumi/tab`）、`cinema_tab()`（`/pgc/page/pc/cinema/tab`）、`season_rank()`（`/pgc/season/rank/web/list`），modules 结构模型（title/items/style）+ 契约与响应 fixture。

验证：

```powershell
cargo test --manifest-path crates/bpi-rs/Cargo.toml bangumi
```

### T15 后端 season 命令

文件：

- `src-tauri/src/core/bilibili/season.rs`
- `src-tauri/src/core/bilibili/playback.rs`（createPlayback 扩展）
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- 命令：`bilibili_season_detail(season_id)`、`bilibili_season_related(season_id)`、`bilibili_season_follow/unfollow(season_id)`、`bilibili_season_ep_progress`（本地进度按 ep 隔离）。
- `bilibili_create_playback` 扩展 `season_id`/`ep_id` 参数，走 `bangumi.video_stream`，复用会话/MPD/代理。
- 评论 oid 用 ep 的 aid；番剧播放源 DTO 与视频共用。

验证：

```powershell
cargo test bilibili
cargo check
```

### T16 SDK season 命名空间

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/plugin-template/src/sdk.d.ts`

编辑：

- `sdk.bilibili.season.*`（detail/related/follow/unfollow）+ `playback.createPlayback` 类型扩展 season/ep。

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

### T17 追番/影视子 tab UI

文件：

- `scripts/official-plugins/bilibili/src/components/HomeFeedTabs.tsx`
- `scripts/official-plugins/bilibili/src/components/PgcSectionFeed.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 追番/影视子 tab 激活；`PgcSectionFeed` 按 modules 分区行渲染（标题 + 横向滚动卡片），`double_feed`（猜你喜欢）分区支持加载更多；卡片点击进 season 视图。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T18 season 视图 + watch 番剧播放

文件：

- `scripts/official-plugins/bilibili/src/pages/SeasonPage.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`（season 类型分支）
- `scripts/official-plugins/bilibili/src/components/VideoInteractionBar.tsx`（追番按钮）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `season` 视图：大封面、简介、追番/取消追番、分集分区列表、相关推荐；点分集 → `openWatch({type:"season",seasonId,epId})`。
- `WatchPage` 视频/番剧分支：选集列表替换分 P、互动条显示追番态、评论挂 ep aid、进度按 ep 上报。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T19 我的页追番 tab

文件：

- `scripts/official-plugins/bilibili/src/components/AccountLibraryTabs.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 追番 tab：`user.bangumi_follow_list` 列表（封面/标题/更新集数），点击进 season 视图；空态与加载态齐全。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T20 P2 验证

命令：

```powershell
cargo fmt
cargo check
cargo test bilibili
cargo test --manifest-path crates/bpi-rs/Cargo.toml bangumi
npm run build
cd scripts/official-plugins/bilibili
npm run build && npm run pack
```

手测：追番/影视页分区行、season 详情、番剧播放/切集/进度、追番操作。

## P3 弹幕增强

### T21 后端分段弹幕命令

文件：

- `src-tauri/src/core/bilibili/danmaku.rs`
- `src-tauri/src/commands/bilibili.rs`

编辑：

- 命令：`bilibili_danmaku_segment(cid, segment_index, aid?)`（走 `web_seg_wbi_proto`，protobuf 解析失败降级 `xml_list_so` 返回同一段窗口数据）。
- `bilibili_danmaku_list` 保留（降级路径）；`bilibili_danmaku_thumbup/report/recall` 命令（映射 `danmaku.thumbup/report/recall`，带登录门控）。
- `BiliDanmakuItem` 增加 `mode`/`fontSize` 字段透传。

验证：

```powershell
cargo test bilibili
cargo check
```

### T22 前端分段加载器

文件：

- `scripts/official-plugins/bilibili/src/danmaku/segmentLoader.ts`（新）
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/components/DanmakuOverlay.tsx`

编辑：

- 每 6 分钟一段；游标所在段 ±2 段预取；段数据内存缓存复用；分段请求失败自动回退全量 XML（标记 fallback，避免重复回退）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T23 mode 2/3 固定弹幕渲染

文件：

- `scripts/official-plugins/bilibili/src/danmaku/layout.ts`
- `scripts/official-plugins/bilibili/src/danmaku/renderer.ts`
- `scripts/official-plugins/bilibili/src/components/DanmakuOverlay.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 布局增加固定弹幕轨道区（顶部/底部各独立轨道，不参与滚动轨道占用）；renderer 输出固定定位样式；`test-danmaku-layout.mjs` 补充固定弹幕用例。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run test:danmaku
npm run build
```

### T24 弹幕操作 UI

文件：

- `scripts/official-plugins/bilibili/src/components/DanmakuOverlay.tsx`
- `scripts/official-plugins/bilibili/src/components/DanmakuInput.tsx`
- `scripts/official-plugins/bilibili/src/runtime.ts`

编辑：

- 自己发送的弹幕 5 分钟窗口内特殊描边 + 点击弹出"点赞/举报/撤回"操作；发送成功 4 秒冷却逻辑保留；未登录操作走统一 notLoggedIn 提示。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T25 P3 验证

命令：

```powershell
cargo fmt
cargo check
cargo test bilibili
cd scripts/official-plugins/bilibili
npm run test:danmaku
npm run build && npm run pack
```

手测：长视频分段加载、seek 弹幕同步、顶部/底部固定弹幕、点赞/举报/撤回。

## P4 动态

### T26 后端动态命令 + SDK

文件：

- `src-tauri/src/core/bilibili/dynamic.rs`（新）
- `src-tauri/src/commands/bilibili.rs`
- `src/plugins/sdk.ts`、`scripts/official-plugins/bilibili/src/sdk.d.ts`、`scripts/plugin-template/src/sdk.d.ts`

编辑：

- 命令：`bilibili_dynamic_all(page)`（dynamic.all → `BiliDynamicCard` 统一卡片 DTO）、`bilibili_dynamic_detail(dyn_id)`、`bilibili_dynamic_like(dyn_id, like)`、`bilibili_dynamic_create_text(text)`、`bilibili_dynamic_top(dyn_id, top)`、`bilibili_dynamic_forwards(dyn_id, page)`。
- SDK `sdk.bilibili.dynamic.*`；发布限频（30s 冷却）。

验证：

```powershell
cargo test bilibili
cargo check
npm run build
```

### T27 顶层动态 Tab + 四类卡片

文件：

- `scripts/official-plugins/bilibili/src/components/BiliTopNav.tsx`
- `scripts/official-plugins/bilibili/src/pages/DynamicPage.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/DynamicCard.tsx`（新，四类：视频/图文/转发/直播）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 顶层 Tab 增加"动态"；`DynamicPage` 用 `usePagedFeed` 驱动动态流；视频卡片点击进 watch、图文卡片点击进 dynDetail、直播卡片 P6 后跳 live；点赞乐观更新回滚。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T28 动态发布

文件：

- `scripts/official-plugins/bilibili/src/pages/MinePage.tsx`
- `scripts/official-plugins/bilibili/src/components/DynamicPublishDialog.tsx`（新）

编辑：

- 我的页"发布动态"入口 → 弹窗纯文字输入（≤1000 字）→ `dynamic.createText`；成功插入动态流本地列表；限频提示。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T29 dynDetail 视图

文件：

- `scripts/official-plugins/bilibili/src/pages/DynDetailPage.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/CommentPanel.tsx`（type 参数化）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 正文全文 + 图片九宫格大图浏览 + 点赞/转发数 + 转发列表（懒加载）；评论区复用 `CommentPanel`（oid=dyn_id，type=17 参数化，后端 comment 命令 type 字段支持）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T30 空间置顶

文件：

- `scripts/official-plugins/bilibili/src/pages/SpacePage.tsx`

编辑：

- UP 详情页动态 tab（P4 激活）：自己空间（mid==当前登录 UID）的动态显示置顶/取消入口。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T31 P4 验证

命令：

```powershell
cargo fmt
cargo check
cargo test bilibili
npm run build
cd scripts/official-plugins/bilibili
npm run build && npm run pack
```

手测：动态流加载/翻页、四类卡片、点赞、发布、详情页评论、置顶。

## P5 私信/通知

### T32 bpi-rs 补私信接口

文件：

- `crates/bpi-rs/src/message/session.rs`（新）
- `crates/bpi-rs/src/message/client.rs`
- `crates/bpi-rs/tests/contracts/message/**`

编辑：

- 新增 `sessions()`（`/x/session/web/v1/session/sessions`，cursor 分页）、`messages()`（`/x/session/web/v1/session/msg`，cursor 分页）+ 契约。

验证：

```powershell
cargo test --manifest-path crates/bpi-rs/Cargo.toml message
```

### T33 后端 message 命令 + SDK

文件：

- `src-tauri/src/core/bilibili/message.rs`（新）
- `src-tauri/src/commands/bilibili.rs`
- `src/plugins/sdk.ts`、`scripts/official-plugins/bilibili/src/sdk.d.ts`、`scripts/plugin-template/src/sdk.d.ts`

编辑：

- 命令：`bilibili_message_sessions(cursor?)`、`bilibili_message_history(talker_uid, cursor?)`、`bilibili_message_send(uid, text)`、`bilibili_message_unread()`、`bilibili_message_reply_feed(page)`；未读/通知类可匿名降级。
- SDK `sdk.bilibili.message.*`。

验证：

```powershell
cargo test bilibili
cargo check
npm run build
```

### T34 私信 UI

文件：

- `scripts/official-plugins/bilibili/src/components/AccountLibraryTabs.tsx`（或独立入口）
- `scripts/official-plugins/bilibili/src/pages/MessagesPage.tsx`（新：会话列表）
- `scripts/official-plugins/bilibili/src/pages/ChatPage.tsx`（新：会话）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 我的页"私信"入口 → 会话列表（未读角标）→ 会话页：历史消息 cursor 分页、30s 轮询新消息、发送文字消息、失败保留输入。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T35 通知流 UI

文件：

- `scripts/official-plugins/bilibili/src/pages/NotificationsPage.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/BiliTopNav.tsx`（角标）
- `scripts/official-plugins/bilibili/src/runtime.ts`（30s 轮询）

编辑：

- 我的页"通知"入口 → 回复/@ 分页列表 + 类型筛选；点击跳转对应视频/动态；顶栏/我的页未读角标（30s 轮询刷新，仅登录态）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T36 P5 验证

命令：

```powershell
cargo fmt
cargo check
cargo test bilibili
cargo test --manifest-path crates/bpi-rs/Cargo.toml message
npm run build
cd scripts/official-plugins/bilibili
npm run build && npm run pack
```

手测：私信会话/历史/发送/轮询、通知列表/跳转/角标。

## P6 直播

### T37 bpi-rs `live_ws` 模块

文件：

- `crates/bpi-rs/Cargo.toml`（新增 `tokio-tungstenite`、`futures-util` 依赖）
- `crates/bpi-rs/src/live/ws/mod.rs`（新）
- `crates/bpi-rs/src/live/ws/protocol.rs`（新：16 字节包头 + zlib/brotli 解压 + JSON cmd）
- `crates/bpi-rs/src/live/ws/heartbeat.rs`（新：30s 心跳）

编辑：

- 实现 `LiveWsClient::connect(host, token, room_id)`：二进制帧协议、心跳、`DANMU_MSG`/`SEND_GIFT`/`SUPER_CHAT_MESSAGE` 等 cmd 分发、断线重连；单元测试覆盖包头/解压/心跳帧构造。

验证：

```powershell
cargo test --manifest-path crates/bpi-rs/Cargo.toml live
```

### T38 后端 live 命令 + WS 桥

文件：

- `src-tauri/src/core/bilibili/live.rs`（新）
- `src-tauri/src/core/bilibili/live_bridge.rs`（新：axum WS 中转 + 房间生命周期）
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- 命令：`bilibili_live_room(room_id)`、`bilibili_live_stream(room_id, qn?)`、`bilibili_live_recommend(page)`、`bilibili_live_areas()`、`bilibili_live_send_danmaku(room_id, text)`、`bilibili_live_heartbeat(room_id)`。
- WS 桥路由 `GET /bilibili/live/:room_id/danmaku`：创建/复用 bpi-rs `LiveWsClient`，协议消息经 axum WS 转 JSON 给插件；无插件连接时自动断开（房间引用计数）；心跳双通道（WS 协议 + HTTP `web_heart_beat`）。

验证：

```powershell
cargo check
cargo test bilibili
```

### T39 SDK live 命名空间

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/plugin-template/src/sdk.d.ts`

编辑：

- `sdk.bilibili.live.*`（room/stream/recommend/areas/sendDanmaku/heartbeat）+ `live.danmakuWsUrl(roomId)` 返回本地桥地址。

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

### T40 直播 tab UI

文件：

- `scripts/official-plugins/bilibili/src/components/HomeFeedTabs.tsx`
- `scripts/official-plugins/bilibili/src/components/LiveFeed.tsx`（新）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 直播子 tab 激活：推荐 feed（`live.recommend`）+ 分区筛选（`live.areas`）；直播卡片显示在线人数/主播头像；点击进 live 视图。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T41 live 视图

文件：

- `scripts/official-plugins/bilibili/src/pages/LivePage.tsx`（新）
- `scripts/official-plugins/bilibili/src/player/livePlayer.ts`（新：mpegts.js 封装）
- `scripts/official-plugins/bilibili/package.json`（新增 `mpegts.js` 依赖）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- `livePlayer.ts`：mpegts.js 初始化/销毁/画质切换（qn 重建流）/错误事件。
- `LivePage`：房间信息卡 + 播放器 + 弹幕层（桥接 WS 消息 → 渲染）+ 发送弹幕（30s 冷却）+ 画质菜单 + 心跳保活；礼物/SC 以特殊消息样式；离开视图清理播放器与 WS。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm install mpegts.js
npm run build
```

### T42 P6 验证

命令：

```powershell
cargo fmt
cargo check
cargo test bilibili
cargo test --manifest-path crates/bpi-rs/Cargo.toml live
npm run build
cd scripts/official-plugins/bilibili
npm run build && npm run pack
```

手测：直播 tab、进直播间、flv 播放、弹幕流、发送弹幕、切画质、退出清理无残留。

## P7 设置与打磨

### T43 settings 视图 + 入口迁移

文件：

- `scripts/official-plugins/bilibili/src/pages/SettingsPage.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/MinePage.tsx`（设置入口）
- `scripts/official-plugins/bilibili/src/index.tsx`（移除宿主 settings section 注册）

编辑：

- 我的页"设置"入口 → settings 视图（tab 结构：播放器 先行）；移除 `sdk.ui.registerSettingsSection` 注册，宿主设置区块不再出现。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T44 播放器设置 tab

文件：

- `scripts/official-plugins/bilibili/src/pages/SettingsPage.tsx`
- `scripts/official-plugins/bilibili/src/runtime.ts`（config 扩展 + 归一化钳制）
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`（读取设置）
- `scripts/official-plugins/bilibili/src/player/dashPlayer.ts`（缓冲档位）

编辑：

- 设置项：播放缓冲（自动/小/中/大 → dashjs buffer 配置）、默认视频格式（DASH/MP4 兼容 → 默认 playbackMode）、默认编码优先序（AVC/HEVC/AV1）、默认音质（标准/FLAC）、详情页自动起播开关。
- 现有配置项（进度同步/弹幕/倍速/清晰度模式）迁移到新设置页。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T45 后端编码/音质参数化

文件：

- `src-tauri/src/core/bilibili/playback.rs`
- `src-tauri/src/core/bilibili/commands` 相关
- `src-tauri/src/core/bilibili/video.rs`

编辑：

- `createPlayback` 增加 `codec_preference`（avc/hevc/av1）与 `audio_preference`（standard/flac）参数；`is_supported_dash_stream` 参数化；HEVC/AV1 track 保留 `hev1`/`av01` 白名单；FLAC 音轨保留；播放失败自动降级 AVC/AAC（会话内重建）。
- 单测：编码过滤矩阵、降级路径。

验证：

```powershell
cargo test bilibili
cargo check
```

### T46 tsc 类型检查 + sdk.d.ts 同步校验

文件：

- `scripts/official-plugins/bilibili/package.json`（build 脚本加 `tsc --noEmit`）
- `scripts/official-plugins/bilibili/scripts/check-sdk-sync.mjs`（新）
- `scripts/plugin-template/src/sdk.d.ts`

编辑：

- 构建前先 `tsc --noEmit`；`check-sdk-sync.mjs` 比对宿主 `sdk.ts` bilibili 命名空间方法签名与插件 `sdk.d.ts` 声明（方法名/参数名集合一致性），不匹配即构建失败。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T47 死代码/样式清理

文件：

- `scripts/official-plugins/bilibili/src/sdk.d.ts`（删未用 `playback.proxyPort` 等）
- `scripts/official-plugins/bilibili/src/hooks/useVideoInteraction.ts`（删 `refresh`）
- `scripts/official-plugins/bilibili/src/styles.ts`（去重重复定义）
- `src-tauri/src/commands/bilibili.rs`（评估 `bilibili_ping` 去留）

编辑：

- 按设计 §6.7 清单清理；清理后跑全量验证确认无行为回归。

验证：

```powershell
cargo check
cd scripts/official-plugins/bilibili
npm run build
```

### T48 P7 验证

命令：

```powershell
cargo fmt
cargo check
cargo test bilibili
npm run build
cd scripts/official-plugins/bilibili
npm run build && npm run pack
```

手测：设置页各选项生效（缓冲/格式/编码/音质/自动起播）、宿主设置区已移除、tsc 与同步校验通过。

## P8 专栏/笔记

### T49 后端 article/note 命令 + SDK

文件：

- `src-tauri/src/core/bilibili/article.rs`（新）
- `src-tauri/src/core/bilibili/note.rs`（新）
- `src-tauri/src/commands/bilibili.rs`
- `src/plugins/sdk.ts`、`scripts/official-plugins/bilibili/src/sdk.d.ts`、`scripts/plugin-template/src/sdk.d.ts`

编辑：

- 命令：`bilibili_article_view(article_id)`（含 content 类型标记）、`bilibili_article_like/coin(article_id)`、`bilibili_article_list(mid, page)`、`bilibili_note_list(video_aid)`、`bilibili_note_detail(note_id)`。
- SDK `sdk.bilibili.article.*` / `sdk.bilibili.note.*`。

验证：

```powershell
cargo test bilibili
cargo check
npm run build
```

### T50 article 视图（sanitize）

文件：

- `scripts/official-plugins/bilibili/src/pages/ArticlePage.tsx`（新）
- `scripts/official-plugins/bilibili/src/lib/sanitize.ts`（新）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- type=3 JSON 段落渲染优先；type=0 HTML 白名单 sanitize（允许 p/br/img/a 等，禁 script/事件/iframe），失败降级纯文本；点赞/投币按钮（乐观更新回滚）；图片懒加载。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T51 UP 专栏 tab + 搜索入口

文件：

- `scripts/official-plugins/bilibili/src/pages/SpacePage.tsx`
- `scripts/official-plugins/bilibili/src/components/VideoCard.tsx`（专栏卡片或独立 ArticleCard）

编辑：

- UP 详情页"专栏" tab（`article_list` 分页）；搜索专栏结果可点进 article 视图（后端 search article 类型映射）。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T52 笔记轻量

文件：

- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`（笔记入口）
- `scripts/official-plugins/bilibili/src/components/NotePanel.tsx`（新弹层）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 视频详情页"笔记"入口 → 弹层：笔记列表（`note_list`）+ 阅读（`note_detail`，图文渲染）；私有笔记仅登录且为本用户可见。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T53 P8 验证

命令：

```powershell
cargo fmt
cargo check
cargo test bilibili
npm run build
cd scripts/official-plugins/bilibili
npm run build && npm run pack
```

手测：专栏阅读/点赞/投币/UP 专栏 tab/搜索进入、视频笔记弹层。

## 回退规则

| 触发条件 | 回退处理 |
| --- | --- |
| bpi-rs 收编后 workspace 编译失败 | 停止 P0，恢复依赖路径为旧 `../bpi-rs` 并排查 workspace 冲突 |
| pgc 接口响应结构与 wiliwili 行为不符 | 以 bpi-rs 契约测试与真实响应为准修订模型，不硬凑解析 |
| seg.so 分段接口不稳定 | 全量降级 XML 路径保持可用，标记分段为增强项 |
| HEVC/AV1 在真实 WebView2 无法解码 | 降级链回 AVC，编码设置项标注"视系统解码器而定" |
| FLAC 音轨实测不可解 | 音质设置仅保留标准 AAC，FLAC 项移除 |
| 直播 WS 桥被风控 | 增加连接频率限制与心跳保活，弹幕降级为轮询公告接口（若有） |
| mpegts.js 无法播放某直播间流 | 保留外部打开直播链接逃生入口 |
| 私信/通知轮询触发风控 | 降低轮询间隔（60s），失败静默不打断 |
| 动态发布被风控 | 延长冷却时间并给出明确错误提示 |
| 插件禁用后 WS/轮询/播放器残留 | 回到对应期 lifecycle 清理任务，修复后再继续 |

## 完成定义

- P0-P8 所有任务完成，自动验证全绿。
- `cargo fmt`、`cargo check`、`cargo test bilibili`、`cargo test plugins`、`npm run build` 通过。
- 插件 `npm run build`（含 tsc）与 `npm run pack` 通过，两目录（`plugins/`、`resources/defaults/plugins/`）同步。
- bpi-rs 新接口契约测试通过。
- Tauri dev 手测清单通过；插件禁用/重载/卸载后无播放器、弹幕循环、进度上报、WS 连接和轮询定时器残留。
- Cookie、CSRF、原始播放 URL 未暴露给插件页面或日志。
- 文档更新：设计/计划文档、`docs/plugin-development.md`（权限与收编说明）、`docs/superpowers/progress.md`。
