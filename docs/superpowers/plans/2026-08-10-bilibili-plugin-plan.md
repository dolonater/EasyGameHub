# Bilibili 内置视频插件实施计划

> 创建日期：2026-08-10  
> 状态：Stage 2 计划草案，待批准  
> 设计文档：`docs/superpowers/specs/2026-08-10-bilibili-plugin-design.md`  
> 工作流：`programming-workflow` Stage 2 Implementation Planning  
> 执行顺序：P0 基线与权限 → P1 账号 → P2 首页 → P3 详情与代理 → P4 DASH 播放 → P5 进度与截图 → P6 弹幕 → P7 账号内容 → P8 评论 → P9 缓存、错误、分发与验收

## 执行原则

- 只实现设计文档第一版范围：普通投稿视频，不做番剧、影视、课程、直播和下载。
- `wiliwili` 只作为功能和产品行为参考，不复制其 C++/XML 源码。
- Bilibili API 优先通过 `bpi-rs` 调用；若 `bpi-rs` 已有能力，不在 EasyGameHub 内手写重复协议。
- 插件页面不接触 Cookie、CSRF 和原始播放 URL。
- 代理只代理宿主内存播放会话登记过的 B 站 CDN URL。
- 每个阶段完成后运行该阶段指定验证命令；失败原因不明确时停止执行并修订计划。
- 账号写操作只覆盖已确认范围：进度上报、稍后再看添加/移除、收藏/取消收藏、评论读写、普通文本弹幕发送。

## 全局验证基线

在仓库根目录执行：

```powershell
cargo fmt
cargo check
npm run build
```

插件目录验证：

```powershell
cd scripts/official-plugins/bilibili
npm install
npm run build
npm run pack
```

后端重点测试：

```powershell
cargo test bilibili
cargo test plugins
```

如需直接验证 `bpi-rs`：

```powershell
cargo test --manifest-path bpi-rs/Cargo.toml --all-features
```

## P0 基线、依赖、权限与空插件

### T1 工具链和 `bpi-rs` 依赖审查

文件：

- `src-tauri/Cargo.toml`
- `Cargo.toml`
- `bpi-rs/Cargo.toml`

编辑：

- 确认本机 `rustc --version` 满足 `bpi-rs` 的 `rust-version = "1.85"`。
- 在 `src-tauri/Cargo.toml` 增加：

```toml
bpi-rs = { path = "../bpi-rs", default-features = false, features = [
    "login",
    "video",
    "video_ranking",
    "search",
    "danmaku",
    "comment",
    "historytoview",
    "fav",
    "user",
] }
```

- 若 `bpi-rs` feature 依赖导致编译缺模块，再按实际调用补充 feature；不要启用无关模块。

验证：

```powershell
rustc --version
cargo check
```

预期：

- `src-tauri` 能编译 `bpi-rs` path dependency。
- 不改根 workspace members，`bpi-rs` 仅作为 `src-tauri` 依赖。

### T2 建立 Bilibili 后端模块骨架

文件：

- `src-tauri/src/core/mod.rs`
- `src-tauri/src/core/bilibili/mod.rs`（新）
- `src-tauri/src/core/bilibili/models.rs`（新）
- `src-tauri/src/core/bilibili/errors.rs`（新）
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/commands/bilibili.rs`（新）
- `src-tauri/src/lib.rs`

编辑：

- `core/mod.rs` 增加 `pub mod bilibili;`。
- `commands/mod.rs` 增加 `pub mod bilibili;`。
- `core/bilibili/mod.rs` 暴露后续子模块占位。
- `models.rs` 定义第一批通用 DTO：`BiliOperationResult`、`BiliErrorKind`、`BiliErrorDto`。
- `errors.rs` 实现 `to_error_dto(error: &bpi_rs::BpiError) -> BiliErrorDto`，先覆盖 `requires_login()`、`requires_vip()`、`is_permission_error()`、`is_risk_control()`，其余归为 `api` 或 `network`。
- `commands/bilibili.rs` 先加入 `bilibili_ping() -> Result<BiliOperationResult, String>`，用于注册冒烟。
- `lib.rs` 注册 `commands::bilibili::bilibili_ping`。

验证：

```powershell
cargo check
```

预期：

- 新模块可编译。
- `BiliErrorDto` 可序列化给前端。

### T3 扩展插件权限白名单

文件：

- `src-tauri/src/core/plugins.rs`
- `src/plugins/types.ts`
- `src/plugins/sdk.ts`
- `scripts/plugin-template/src/types.ts`
- `scripts/plugin-template/src/sdk.d.ts`
- `docs/plugin-development.md`

编辑：

- Rust `KNOWN_PERMISSIONS` 从 5 项扩展为 6 项，增加 `"bilibili"`。
- `PluginPermission` 和 `ALL_PERMISSIONS` 增加 `"bilibili"`。
- 文档权限表增加 `bilibili`，说明仅官方内置插件使用，开放 Bilibili 登录、视频、播放、弹幕、评论和账号内容能力。
- `plugins.rs` 单测增加：`permissions:["ui","bilibili"]` 可通过；未知权限仍失败。

验证：

```powershell
cargo test plugins
npm run build
```

预期：

- manifest 可声明 `bilibili` 权限。
- 旧插件权限不受影响。

### T4 建立前端 `sdk.bilibili` 类型和空实现

文件：

- `src/plugins/sdk.ts`
- `scripts/plugin-template/src/sdk.d.ts`

编辑：

- `PluginSdk` 增加 `bilibili` 命名空间，先定义分组：

```ts
bilibili: {
  account: {};
  home: {};
  video: {};
  playback: {};
  danmaku: {};
  comment: {};
  library: {};
  cache: {};
}
```

- `createPluginSdk()` 中加入空对象，并在后续任务逐步填充方法。
- 确认 `"bilibili"` 权限调用统一走 `requirePerm("bilibili", apiName)`。

验证：

```powershell
npm run build
```

预期：

- SDK 类型扩展不破坏现有插件。

### T5 新建官方插件工程骨架

文件：

- `scripts/official-plugins/bilibili/package.json`（新）
- `scripts/official-plugins/bilibili/tsconfig.json`（新）
- `scripts/official-plugins/bilibili/manifest.json`（新）
- `scripts/official-plugins/bilibili/scripts/pack.mjs`（新）
- `scripts/official-plugins/bilibili/src/index.tsx`（新）
- `scripts/official-plugins/bilibili/src/types.ts`（新）
- `scripts/official-plugins/bilibili/src/styles.ts`（新）
- `scripts/official-plugins/bilibili/src/sdk.d.ts`（新）

编辑：

- `package.json` 使用 esbuild，增加依赖 `dashjs` 和开发依赖 `esbuild`。
- `manifest.json`：

```json
{
  "id": "com.easygamehub.bilibili",
  "name": "Bilibili",
  "version": "0.1.0",
  "api_version": 1,
  "entry": "bundle.js",
  "permissions": ["ui", "bilibili"],
  "icon": "assets/bilibili.png",
  "description": "内置 Bilibili 视频播放插件"
}
```

- `index.tsx` 注册两个页面：
  - `home`
  - `watch`
- `pack.mjs` 参考网易云插件，把 `manifest.json`、`dist/bundle.js` 和 `assets/` 同步到：
  - `plugins/com.easygamehub.bilibili`
  - `resources/defaults/plugins/com.easygamehub.bilibili`

验证：

```powershell
cd scripts/official-plugins/bilibili
npm install
npm run build
npm run pack
```

预期：

- 产出 `dist/bundle.js`。
- bundle 只 external `"sdk"`。
- 内置插件目录被同步。

### T6 P0 全量验证

命令：

```powershell
cargo test plugins
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 主应用和空 Bilibili 插件均可构建。

## P1 账号登录与 Cookie 存储

### T7 实现账号模型和加密 Cookie Store

文件：

- `src-tauri/src/core/bilibili/account.rs`（新）
- `src-tauri/src/core/bilibili/models.rs`
- `src-tauri/src/core/bilibili/mod.rs`

编辑：

- 定义 `BiliLoginInfo`、`BiliQrLoginKey`、`BiliQrLoginStatus`。
- 用 `steam_sdk::crypto::secure_store::SecureStore` 保存 `bilibili_account.enc.json`。
- Store key：
  - `cookie`
  - `updated_at`
- 实现：
  - `load_cookie(tool_dir) -> Result<Option<String>>`
  - `save_cookie(tool_dir, cookie) -> Result<()>`
  - `clear_cookie(tool_dir) -> Result<()>`
  - `cookie_to_account(cookie) -> Option<bpi_rs::Account>`
- 不把 Cookie 写入日志或返回给前端。

测试：

- 空 store 返回 `None`。
- 保存后可读回。
- 清理后不可读。
- `cookie_to_account` 能从包含 `DedeUserID`、`SESSDATA`、`bili_jct`、`buvid3` 的 cookie 构造 Account。

验证：

```powershell
cargo test bilibili
cargo check
```

预期：

- Cookie 持久化走加密 Store。

### T8 实现 BpiClient 构建和登录状态

文件：

- `src-tauri/src/core/bilibili/client.rs`（新）
- `src-tauri/src/core/bilibili/account.rs`
- `src-tauri/src/core/bilibili/errors.rs`
- `src-tauri/src/core/bilibili/mod.rs`

编辑：

- 实现：
  - `anonymous_client() -> Result<BpiClient>`
  - `account_client(tool_dir) -> Result<BpiClient>`
  - `optional_account_client(tool_dir) -> Result<BpiClient>`
  - `login_status(tool_dir) -> Result<BiliLoginInfo>`
- `login_status` 通过 `client.login().nav()` 验证登录态。
- Cookie 失效或 `requires_login()` 时返回 `logged_in=false`，不删除 Cookie；明确登录过期错误由命令层提示。

验证：

```powershell
cargo check
```

预期：

- 匿名和登录态客户端都能被后续模块复用。

### T9 实现二维码登录命令

文件：

- `src-tauri/src/core/bilibili/account.rs`
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- 使用 `bpi-rs` 的 `login().qr_generate()` 和 `login().qr_poll(...)`。
- 成功 poll 时从返回结果提取 cookies，规范化为 Cookie header 并保存。
- 命令：
  - `bilibili_login_qr_key() -> BiliQrLoginKey`
  - `bilibili_login_qr_check(key: String) -> BiliQrLoginStatus`
  - `bilibili_login_status() -> BiliLoginInfo`
  - `bilibili_logout() -> BiliOperationResult`
- 注册到 `lib.rs` invoke handler。

验证：

```powershell
cargo check
```

预期：

- 前端可通过 invoke 获取二维码 URL 并轮询登录。

### T10 扩展 `sdk.bilibili.account`

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/official-plugins/bilibili/src/types.ts`

编辑：

- 增加方法：

```ts
account: {
  loginQrKey(): Promise<BiliQrLoginKey>;
  loginQrCheck(key: string): Promise<BiliQrLoginStatus>;
  loginStatus(): Promise<BiliLoginInfo>;
  logout(): Promise<BiliOperationResult>;
}
```

- 所有方法要求 `bilibili` 权限。

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- SDK 类型和官方插件类型一致。

### T11 实现插件登录面板

文件：

- `scripts/official-plugins/bilibili/src/components/LoginPanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`（新）
- `scripts/official-plugins/bilibili/src/runtime.ts`（新）
- `scripts/official-plugins/bilibili/src/index.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- runtime 持有 `loginInfo`、`loginQr`、`loginPolling`、`loginError`。
- 登录面板显示：
  - 未登录：生成二维码、轮询状态、取消登录。
  - 已登录：头像、昵称、UID、退出登录。
- 轮询间隔 2 秒，超时 3 分钟自动停止。
- 退出登录后清理账号内容状态。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 首页可展示登录/未登录状态。

### T12 P1 验证

命令：

```powershell
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

手测：

```powershell
npm run tauri dev
```

操作：

- 打开 Bilibili 插件首页。
- 生成二维码。
- 扫码登录。
- 验证账号状态展示。
- 退出登录。

预期：

- Cookie 不暴露到前端。
- 登录失败/过期有可理解提示。

## P2 首页主链路

### T13 实现视频卡片 DTO 映射

文件：

- `src-tauri/src/core/bilibili/models.rs`
- `src-tauri/src/core/bilibili/video.rs`（新）
- `src-tauri/src/core/bilibili/mod.rs`

编辑：

- 定义 `BiliVideoCard`：
  - `bvid`
  - `aid`
  - `cid`
  - `title`
  - `cover`
  - `owner_name`
  - `owner_mid`
  - `duration`
  - `view_count`
  - `danmaku_count`
  - `published_at`
  - `progress`
- 提供映射函数：
  - search result -> card
  - popular/ranking item -> card
  - history/toview/favorite item -> card
- 对缺失字段提供稳定 fallback，避免 `unwrap`。

测试：

- 映射函数能处理缺封面、缺 cid、缺 owner 的样例。

验证：

```powershell
cargo test bilibili
cargo check
```

预期：

- 首页 DTO 不暴露 `bpi-rs` 原始响应。

### T14 实现搜索和热门命令

文件：

- `src-tauri/src/core/bilibili/video.rs`
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- 命令：
  - `bilibili_search_videos(keywords: String, page: Option<u32>) -> Vec<BiliVideoCard>`
  - `bilibili_popular_videos(page: Option<u32>) -> Vec<BiliVideoCard>`
- 搜索仅调用普通视频搜索。
- 空关键词返回错误 `invalidParameter`，前端避免调用。
- 热门/排行榜优先使用 `bpi-rs` 已有 `video_ranking` 或 `video.homepage_recommendations` 中稳定接口；若排行榜接口不可用，使用 popular list。

验证：

```powershell
cargo check
```

预期：

- 匿名状态可读取公开视频入口。

### T15 扩展 `sdk.bilibili.home`

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/official-plugins/bilibili/src/types.ts`

编辑：

```ts
home: {
  searchVideos(keywords: string, page?: number): Promise<BiliVideoCard[]>;
  popularVideos(page?: number): Promise<BiliVideoCard[]>;
}
```

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 插件可调用首页数据。

### T16 实现首页 UI

文件：

- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/components/VideoCard.tsx`
- `scripts/official-plugins/bilibili/src/components/AccountLibraryTabs.tsx`
- `scripts/official-plugins/bilibili/src/routes.ts`（新）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 顶部搜索框、登录面板、刷新按钮。
- 默认加载热门。
- 搜索后显示搜索结果。
- 视频卡片点击跳转 `/plugin/com.easygamehub.bilibili/watch?bvid=...&cid=...`。
- `routes.ts` 封装 `watchUrl(video)`，避免散落字符串。
- 历史、稍后再看、收藏夹 Tab 先显示登录占位，P7 填充。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 首页布局可构建。
- 未登录占位、加载、错误、空结果分支齐全。

### T17 P2 验证

命令：

```powershell
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

手测：

- 打开首页。
- 查看热门。
- 搜索关键词。
- 点击视频进入播放页空壳路由。

预期：

- 首页独立可用。

## P3 视频详情、取流、MPD 和专用代理

### T18 实现视频详情 DTO 和命令

文件：

- `src-tauri/src/core/bilibili/models.rs`
- `src-tauri/src/core/bilibili/video.rs`
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- 定义：
  - `BiliVideoDetail`
  - `BiliVideoPage`
  - `BiliVideoStats`
  - `BiliOwner`
- `bilibili_video_detail(bvid: Option<String>, aid: Option<u64>) -> BiliVideoDetail`
- 使用 `client.video().view(...)`、`page_list(...)`、`player_info_v2(...)`。
- 返回续播字段：
  - `last_play_cid`
  - `last_play_time`
- 如果 `player_info_v2` 未登录失败，详情仍返回，续播字段为空。

测试：

- `select_initial_page(detail, requested_cid, local_progress)` 纯函数覆盖优先级。

验证：

```powershell
cargo test bilibili
cargo check
```

预期：

- 播放页可加载视频详情和分 P。

### T19 实现播放会话和 MPD 生成纯逻辑

文件：

- `src-tauri/src/core/bilibili/playback.rs`（新）
- `src-tauri/src/core/bilibili/models.rs`
- `src-tauri/src/core/bilibili/mod.rs`

编辑：

- 定义：
  - `PlaybackSession`
  - `PlaybackTrack`
  - `BiliPlaybackSource`
  - `BiliQualityOption`
- 实现：
  - `create_session_from_stream(data, bvid, aid, cid, proxy_port) -> PlaybackSession`
  - `build_mpd(session) -> String`
  - `quality_options(session) -> Vec<BiliQualityOption>`
- MPD 内 URL 使用本地代理 `/bilibili/media/{playback_id}/{track_id}`。
- `track_id` 用稳定短 ID，不包含原始 URL。
- 支持至少一个 video representation 和一个 audio track。

测试：

- 生成的 MPD 包含 `MPD`、`AdaptationSet`、video/audio representation。
- MPD 不包含 `http://` 或 `https://` 原始 CDN URL。
- quality options 与 video tracks 一一对应。

验证：

```powershell
cargo test bilibili
cargo check
```

预期：

- MPD 生成逻辑可离线测试。

### T20 实现播放会话存储

文件：

- `src-tauri/src/core/bilibili/playback.rs`

编辑：

- 使用 `OnceLock<Mutex<HashMap<String, PlaybackSession>>>` 保存会话。
- 实现：
  - `insert_session(session) -> String`
  - `get_session(playback_id) -> Option<PlaybackSession>`
  - `get_track(playback_id, track_id) -> Option<PlaybackTrack>`
  - `cleanup_expired_sessions(now)`
  - `remove_session(playback_id)`
- 默认过期时间 2 小时。

测试：

- 插入后可取回。
- 过期会话被清理。
- 未登记 track 返回 None。

验证：

```powershell
cargo test bilibili
```

预期：

- 专用代理可安全查询会话。

### T21 实现 Bilibili 专用代理

文件：

- `src-tauri/src/core/bilibili/proxy.rs`（新）
- `src-tauri/src/core/bilibili/mod.rs`

编辑：

- 使用 axum 绑定 `127.0.0.1:0`。
- 路由：
  - `GET /bilibili/dash/:playback_id/manifest.mpd`
  - `GET /bilibili/media/:playback_id/:track_id`
  - `GET /bilibili/cover/:cache_key`
- `media` 代理：
  - 只查内存会话 track。
  - 转发 `Range`。
  - 设置 `Referer: https://www.bilibili.com/`。
  - 设置浏览器 UA。
  - 输出 CORS、CORP、Accept-Ranges、Content-Type。
  - 上游失败时尝试 backup URL。
- `dash` 返回 `application/dash+xml`。
- `cover` 先可使用登记式缓存 key，P9 再补磁盘缓存。
- 实现 `start_proxy(data_dir) -> u16`、`get_proxy_port() -> Option<u16>`。

验证：

```powershell
cargo check
```

预期：

- 代理模块可编译，尚不要求真实播放。

### T22 实现取流命令

文件：

- `src-tauri/src/core/bilibili/playback.rs`
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- 命令：
  - `bilibili_proxy_port() -> u16`
  - `bilibili_create_playback(bvid: Option<String>, aid: Option<u64>, cid: u64, quality: Option<u32>) -> BiliPlaybackSource`
- 使用 `client.video().play_url(...)`，优先 DASH。
- 若返回 durl/MP4 且无 DASH，则也登记为单 video track，MPD 生成可走 progressive fallback 或返回 `direct_url` 字段。
- `BiliPlaybackSource` 包含：
  - `playback_id`
  - `manifest_url`
  - `qualities`
  - `expires_at`
- 注册 commands。

验证：

```powershell
cargo check
```

预期：

- 播放页可创建播放会话。

### T23 扩展 `sdk.bilibili.video` 和 `playback`

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/official-plugins/bilibili/src/types.ts`

编辑：

```ts
video: {
  detail(args: { bvid?: string; aid?: number }): Promise<BiliVideoDetail>;
  related(args: { bvid?: string; aid?: number }): Promise<BiliVideoCard[]>;
}
playback: {
  proxyPort(): Promise<number>;
  createPlayback(args: {
    bvid?: string;
    aid?: number;
    cid: number;
    quality?: number;
  }): Promise<BiliPlaybackSource>;
}
```

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 前端可拿详情和播放源。

### T24 实现播放页详情空壳

文件：

- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/components/QualityMenu.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 读取 URL query。
- 加载视频详情。
- 渲染标题、UP、统计、简介、分 P。
- 选择初始分 P。
- 调 `createPlayback` 显示 manifest URL 和清晰度选项。
- 先不 attach dash.js，P4 实现。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 播放页能加载详情和播放源 DTO。

### T25 P3 验证

命令：

```powershell
cargo test bilibili
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

手测：

- 首页搜索视频。
- 进入播放页。
- 查看详情、分 P、清晰度列表。
- 浏览器 DevTools 或日志确认 manifest URL 为本地代理，不含原始 CDN URL。

预期：

- 主链路到取流会话打通。

## P4 DASH 播放器

### T26 实现 dash.js 播放封装

文件：

- `scripts/official-plugins/bilibili/src/player/dashPlayer.ts`（新）
- `scripts/official-plugins/bilibili/src/types.ts`

编辑：

- 封装 `createDashPlayer(video, manifestUrl, options)`。
- 设置：
  - `streaming.abr.autoSwitchBitrate.video = true`
  - `streaming.buffer.fastSwitchEnabled = true`
- 暴露：
  - `destroy()`
  - `setAutoQuality()`
  - `setManualQuality(representationId)`
  - `getCurrentQuality()`
  - `setPlaybackRate(rate)`
- 监听 dash.js error 事件，转换为插件错误状态。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- dash.js 被打包进官方插件。

### T27 播放页接入真实 video 播放

文件：

- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/runtime.ts`

编辑：

- `PlayerShell` 包含 `<video>`，使用 ref 初始化 dash player。
- 分 P 变化时：
  - 销毁旧 player。
  - 保存旧进度。
  - 创建新 playback source。
  - attach 新 manifest。
  - seek 到续播时间。
- 离开播放页时默认暂停并销毁 player。
- 播放失败显示重载播放器、外部打开。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 播放页具备真实播放器组件。

### T28 实现播放中清晰度切换 UI

文件：

- `scripts/official-plugins/bilibili/src/components/QualityMenu.tsx`
- `scripts/official-plugins/bilibili/src/player/dashPlayer.ts`
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`

编辑：

- QualityMenu 显示：
  - `自动`
  - 后端 `qualities`
- 自动为默认。
- 点击具体清晰度：
  - 调 `setManualQuality(representationId)`。
  - UI 显示锁定态。
- 点击自动：
  - 调 `setAutoQuality()`。
- 当前实际清晰度从 dash.js 事件更新。
- 不重建播放器。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 代码层没有通过重新取流实现清晰度切换。

### T29 实现播放器控制、倍速、快捷键和全屏

文件：

- `scripts/official-plugins/bilibili/src/player/keyboard.ts`（新）
- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 控制：
  - 播放/暂停
  - seek
  - 音量
  - 静音
  - 倍速
  - 网页内全屏
- 快捷键：
  - Space
  - 左右方向 5 秒
  - 上下方向调音量
  - M
  - F
  - D
  - Esc
- 输入框聚焦时禁用快捷键。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 播放器控制逻辑可构建。

### T30 P4 验证

命令：

```powershell
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

手测：

- 播放一个普通视频。
- 暂停、seek、音量、倍速。
- 自动清晰度。
- 播放中切换清晰度。
- 切 P。
- 网页内全屏和 Esc。

预期：

- 视频播放可用。
- 清晰度切换不重建播放器。

## P5 进度同步、外部打开和截图

### T31 实现本地进度存储

文件：

- `src-tauri/src/core/bilibili/cache.rs`（新）
- `src-tauri/src/core/bilibili/models.rs`
- `src-tauri/src/core/bilibili/mod.rs`
- `src-tauri/src/commands/bilibili.rs`

编辑：

- 用插件或 Bilibili 专用 JSON 文件保存本地进度：
  - `bvid`
  - `aid`
  - `cid`
  - `progress_seconds`
  - `updated_at`
- 命令：
  - `bilibili_save_local_progress(...)`
  - `bilibili_load_local_progress(bvid, cid?)`
- 不保存原始播放 URL。

测试：

- 保存/读取同一视频分 P。
- 不同 `cid` 进度隔离。
- 旧进度可覆盖。

验证：

```powershell
cargo test bilibili
cargo check
```

预期：

- 未登录也能本地续播。

### T32 实现 B 站进度上报命令

文件：

- `src-tauri/src/core/bilibili/video.rs`
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- 命令：
  - `bilibili_report_progress(aid: u64, cid: u64, progress: u64) -> BiliOperationResult`
- 使用 `client.video().report_watch_progress(VideoWatchProgressParams::new(aid, cid)?.progress(progress))`。
- 未登录返回 `notLoggedIn` 结构化错误。
- 风控/失败不影响本地进度保存。

验证：

```powershell
cargo check
```

预期：

- 上报命令编译通过。

### T33 前端进度 reporter

文件：

- `scripts/official-plugins/bilibili/src/player/progressReporter.ts`（新）
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/runtime.ts`

编辑：

- 每 5 秒保存本地进度。
- 每 20 秒写回 B 站进度。
- pause、ended、切 P、unmount 时补上报。
- seek 后等待 3 秒稳定播放再上报。
- 设置项 `syncProgress` 控制是否写回，默认 true。
- 上报失败轻提示，不打断播放。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 进度 reporter 生命周期跟随播放页。

### T34 实现外部打开

文件：

- `src/plugins/sdk.ts`
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`

编辑：

- 后端命令：
  - `bilibili_open_video(bvid: String) -> BiliOperationResult`
- 复用现有 `open_url` 逻辑或在 command 内打开 `https://www.bilibili.com/video/{bvid}`。
- SDK 暴露 `video.openExternal(bvid)`.
- 播放页按钮调用。

验证：

```powershell
cargo check
npm run build
```

预期：

- 播放失败时有逃生入口。

### T35 实现截图保存

文件：

- `scripts/official-plugins/bilibili/src/player/frameCapture.ts`（新）
- `scripts/official-plugins/bilibili/src/components/ScreenshotButton.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `src-tauri/src/core/bilibili/cache.rs`
- `src-tauri/src/commands/bilibili.rs`

编辑：

- 前端优先 canvas 截当前 video frame。
- 可选包含弹幕时，把弹幕 overlay 渲染到 canvas。
- 后端命令：
  - `bilibili_save_screenshot(file_name: String, data_base64: String) -> String`
  - `bilibili_open_screenshot_folder() -> BiliOperationResult`
- 保存目录：
  - `tool_dir/bilibili/screenshots`
- 文件名包含 `bvid`、`cid`、播放秒数、时间戳。
- 如果 canvas 失败，前端提示并保留外部打开。

验证：

```powershell
cargo check
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 截图保存不进入主应用游戏截图页。

### T36 P5 验证

命令：

```powershell
cargo test bilibili
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

手测：

- 播放到 30 秒后离开再进入，续播。
- 登录后播放一段，检查 B 站历史进度有写回。
- 保存截图并打开截图目录。
- 外部打开视频。

预期：

- 进度写回失败不会影响播放。

## P6 弹幕读取、渲染和发送

### T37 实现弹幕后端 DTO 和读取命令

文件：

- `src-tauri/src/core/bilibili/danmaku.rs`（新）
- `src-tauri/src/core/bilibili/models.rs`
- `src-tauri/src/core/bilibili/mod.rs`
- `src-tauri/src/commands/bilibili.rs`

编辑：

- 定义 `BiliDanmakuItem`。
- 使用 `bpi-rs` danmaku web segment 或 XML 能力读取当前分 P 弹幕。
- 把弹幕时间转为秒，文本做最小清理。
- 命令：
  - `bilibili_danmaku_list(cid: u64, aid: Option<u64>, bvid: Option<String>) -> Vec<BiliDanmakuItem>`

验证：

```powershell
cargo check
```

预期：

- 当前分 P 弹幕可返回给插件。

### T38 实现弹幕发送命令

文件：

- `src-tauri/src/core/bilibili/danmaku.rs`
- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

- 命令：
  - `bilibili_send_danmaku(aid: u64, bvid: String, cid: u64, message: String, progress: u32) -> BiliOperationResult`
- 使用 `DanmakuSendParams::new(Cid::new(cid)?, message).aid(...).bvid(...).progress(progress)`.
- 限制 message trim 后非空，长度由前端限制 100，后端也拒绝空字符串。
- 仅普通文本，默认白色滚动弹幕。

验证：

```powershell
cargo check
```

预期：

- 发送命令编译通过。

### T39 扩展 `sdk.bilibili.danmaku`

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/official-plugins/bilibili/src/types.ts`

编辑：

```ts
danmaku: {
  list(args: { cid: number; aid?: number; bvid?: string }): Promise<BiliDanmakuItem[]>;
  send(args: { aid: number; bvid: string; cid: number; message: string; progress: number }): Promise<BiliOperationResult>;
}
```

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 前端可读写弹幕。

### T40 实现弹幕 overlay

文件：

- `scripts/official-plugins/bilibili/src/danmaku/layout.ts`（新）
- `scripts/official-plugins/bilibili/src/danmaku/renderer.ts`（新）
- `scripts/official-plugins/bilibili/src/components/DanmakuOverlay.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 加载当前分 P 弹幕。
- 根据 video currentTime 推进弹幕游标。
- 轨道布局避免同屏重叠。
- 限制同屏数量。
- 支持：
  - 开关
  - 字号
  - 透明度
  - 密度
  - 速度
- seek 后重置游标到当前时间。

测试：

- `layout.ts` 纯函数测试：同一时间弹幕分配到不同轨道；超过最大同屏数丢弃。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 弹幕可在播放器上层滚动显示。

### T41 实现弹幕输入条

文件：

- `scripts/official-plugins/bilibili/src/components/DanmakuInput.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 播放器下方输入条。
- 未登录 disabled。
- 回车发送。
- 限制 100 字。
- 成功后插入当前弹幕列表，立即显示。
- 失败保留输入。
- 发送后 3-5 秒冷却。
- 弹幕隐藏时仍允许发送，提示当前已隐藏。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 普通文本弹幕发送入口可用。

### T42 P6 验证

命令：

```powershell
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

手测：

- 播放页加载弹幕。
- 开关弹幕、调字号、透明度、密度。
- seek 后弹幕同步。
- 登录后发送普通弹幕。

预期：

- 弹幕不明显拖慢播放器。

## P7 历史、稍后再看和收藏夹

### T43 实现账号内容后端

文件：

- `src-tauri/src/core/bilibili/library.rs`（新）
- `src-tauri/src/core/bilibili/models.rs`
- `src-tauri/src/core/bilibili/mod.rs`
- `src-tauri/src/commands/bilibili.rs`

编辑：

- 定义：
  - `BiliHistoryItem`
  - `BiliToViewItem`
  - `BiliFavoriteFolder`
  - `BiliFavoriteItem`
- 命令：
  - `bilibili_history_list(page: Option<u32>)`
  - `bilibili_toview_list()`
  - `bilibili_toview_add(aid: u64, bvid: Option<String>)`
  - `bilibili_toview_remove(aid: u64, viewed: Option<bool>)`
  - `bilibili_favorite_folders()`
  - `bilibili_favorite_items(media_id: u64, page: Option<u32>)`
  - `bilibili_favorite_video(rid: u64, add_media_ids: Vec<String>, del_media_ids: Vec<String>)`
- 收藏当前视频时前端必须传目标收藏夹 id；后端不猜默认收藏夹。
- 不实现清空、批量删除、移动、删除收藏夹。

验证：

```powershell
cargo check
```

预期：

- 账号内容读写命令编译通过。

### T44 扩展 `sdk.bilibili.library`

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/official-plugins/bilibili/src/types.ts`

编辑：

```ts
library: {
  historyList(page?: number): Promise<BiliHistoryItem[]>;
  toViewList(): Promise<BiliToViewItem[]>;
  addToView(args: { aid: number; bvid?: string }): Promise<BiliOperationResult>;
  removeToView(args: { aid: number }): Promise<BiliOperationResult>;
  favoriteFolders(): Promise<BiliFavoriteFolder[]>;
  favoriteItems(mediaId: number, page?: number): Promise<BiliFavoriteItem[]>;
  favoriteVideo(args: { rid: number; addMediaIds?: string[]; delMediaIds?: string[] }): Promise<BiliOperationResult>;
}
```

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 首页和播放页可调用账号内容。

### T45 实现首页账号内容 Tab

文件：

- `scripts/official-plugins/bilibili/src/components/AccountLibraryTabs.tsx`
- `scripts/official-plugins/bilibili/src/pages/HomePage.tsx`
- `scripts/official-plugins/bilibili/src/components/VideoCard.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 登录后启用：
  - 历史记录
  - 稍后再看
  - 收藏夹
- 历史和稍后再看列表复用 VideoCard。
- 收藏夹左侧 folder list，右侧 favorite items。
- 点击条目进入播放页。
- 加载、空态、错误和未登录态齐全。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 账号内容页可构建。

### T46 实现播放页收藏和稍后再看操作

文件：

- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 当前视频操作区加入：
  - 添加/移除稍后再看。
  - 收藏/取消收藏。
- 收藏时弹出轻量选择器，列出收藏夹。
- 操作成功后更新按钮状态。
- 失败时回滚乐观状态并提示。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 播放页具备小范围账号写操作。

### T47 P7 验证

命令：

```powershell
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

手测：

- 登录后打开历史、稍后再看、收藏夹。
- 从账号内容进入播放页。
- 添加/移除稍后再看。
- 收藏/取消收藏当前视频。

预期：

- 不出现清空或批量危险操作入口。

## P8 评论区

### T48 实现评论后端命令

文件：

- `src-tauri/src/core/bilibili/comment.rs`（新）
- `src-tauri/src/core/bilibili/models.rs`
- `src-tauri/src/core/bilibili/mod.rs`
- `src-tauri/src/commands/bilibili.rs`

编辑：

- 定义：
  - `BiliComment`
  - `BiliCommentMember`
  - `BiliCommentContent`
  - `BiliCommentPage`
  - `BiliReportReason`
- 命令：
  - `bilibili_comment_list(oid: u64, page: Option<u32>, sort: Option<String>)`
  - `bilibili_comment_replies(oid: u64, root: u64, page: Option<u32>)`
  - `bilibili_comment_add(oid: u64, message: String, root: Option<u64>, parent: Option<u64>)`
  - `bilibili_comment_like(oid: u64, rpid: u64, like: bool)`
  - `bilibili_comment_dislike(oid: u64, rpid: u64, dislike: bool)`
  - `bilibili_comment_delete(oid: u64, rpid: u64)`
  - `bilibili_comment_top(oid: u64, rpid: u64, top: bool)`
  - `bilibili_comment_report(oid: u64, rpid: u64, reason: String, content: Option<String>)`
- `type` 固定为视频 `1`。
- 空 message/content 后端拒绝。

验证：

```powershell
cargo check
```

预期：

- 评论读写 API 编译通过。

### T49 扩展 `sdk.bilibili.comment`

文件：

- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/official-plugins/bilibili/src/types.ts`

编辑：

```ts
comment: {
  list(args: { oid: number; page?: number; sort?: "time" | "like" | "replies" }): Promise<BiliCommentPage>;
  replies(args: { oid: number; root: number; page?: number }): Promise<BiliCommentPage>;
  add(args: { oid: number; message: string; root?: number; parent?: number }): Promise<BiliComment>;
  like(args: { oid: number; rpid: number; like: boolean }): Promise<BiliOperationResult>;
  dislike(args: { oid: number; rpid: number; dislike: boolean }): Promise<BiliOperationResult>;
  delete(args: { oid: number; rpid: number }): Promise<BiliOperationResult>;
  top(args: { oid: number; rpid: number; top: boolean }): Promise<BiliOperationResult>;
  report(args: { oid: number; rpid: number; reason: string; content?: string }): Promise<BiliOperationResult>;
}
```

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 评论 SDK 类型齐全。

### T50 实现评论面板

文件：

- `scripts/official-plugins/bilibili/src/components/CommentPanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 显示热门/最新评论切换。
- 分页加载。
- 楼中楼展开。
- 发布主评论。
- 回复评论。
- 点赞/点踩乐观更新，失败回滚。
- 删除评论二次确认。
- 举报弹窗选择原因并二次确认。
- 置顶按钮仅在评论 DTO 标记可操作时显示；接口失败提示权限不足。
- 失败时保留输入内容。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 评论区 UI 可构建。

### T51 P8 验证

命令：

```powershell
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

手测：

- 读取评论。
- 展开楼中楼。
- 发布评论和回复。
- 点赞/点踩。
- 删除自己的评论。
- 举报评论取消和确认两条路径。

预期：

- 评论写操作失败不丢输入，不阻塞播放。

## P9 缓存、错误、设置、内置分发和文档

### T52 实现轻量缓存和封面缓存

文件：

- `src-tauri/src/core/bilibili/cache.rs`
- `src-tauri/src/core/bilibili/proxy.rs`
- `src-tauri/src/commands/bilibili.rs`

编辑：

- 缓存策略：
  - 封面磁盘缓存 7 天，总量 200MB。
  - 搜索/热门 10 分钟。
  - 收藏夹 5 分钟。
  - 历史/稍后再看 1-2 分钟。
  - 视频详情 5 分钟。
  - 评论 1 分钟。
- 播放 URL 仍只进内存会话。
- 命令：
  - `bilibili_clear_cache() -> usize`
- `proxy.rs` 的 cover 路由接入封面缓存。

测试：

- 过期缓存不返回。
- 封面缓存超限清理旧文件。
- clear_cache 删除缓存文件并返回数量。

验证：

```powershell
cargo test bilibili
cargo check
```

预期：

- 缓存不保存敏感播放 URL 和 Cookie 明文。

### T53 统一结构化错误到前端

文件：

- `src-tauri/src/core/bilibili/errors.rs`
- `src-tauri/src/commands/bilibili.rs`
- `src/plugins/sdk.ts`
- `scripts/official-plugins/bilibili/src/types.ts`
- `scripts/official-plugins/bilibili/src/runtime.ts`

编辑：

- commands 内部将 `BiliErrorDto` 序列化为稳定错误字符串或返回 `Result<T, BiliErrorDto>` 兼容 Tauri；前端 SDK 统一解析。
- 插件 runtime 按错误 kind 分类显示：
  - 未登录
  - 登录过期
  - VIP
  - 风控
  - 网络
  - 代理
  - 播放
  - API
- 所有评论/弹幕/进度失败走轻提示，不打断播放。

测试：

- `errors.rs` 单测覆盖 `requires_login`、`requires_vip`、risk control fallback。

验证：

```powershell
cargo test bilibili
npm run build
```

预期：

- UI 不再只显示泛化“失败”。

### T54 实现插件设置区

文件：

- `scripts/official-plugins/bilibili/src/index.tsx`
- `scripts/official-plugins/bilibili/src/runtime.ts`
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 注册 settings section。
- 设置项：
  - 同步观看进度到 B 站：默认 true。
  - 默认弹幕开关。
  - 弹幕字号、透明度、密度、速度。
  - 默认倍速。
  - 默认清晰度模式：自动。
  - 清理 Bilibili 缓存。
  - 打开截图目录。
- 使用 `sdk.storage` 保存插件配置。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

预期：

- 设置能保存并影响播放页默认行为。

### T55 完善内置插件同步

文件：

- `scripts/official-plugins/bilibili/scripts/pack.mjs`
- `plugins/com.easygamehub.bilibili/manifest.json`
- `plugins/com.easygamehub.bilibili/bundle.js`
- `resources/defaults/plugins/com.easygamehub.bilibili/manifest.json`
- `resources/defaults/plugins/com.easygamehub.bilibili/bundle.js`

编辑：

- `npm run pack` 同步 manifest、bundle、assets。
- 确认 `core/plugins.rs` 的 built-in sync 会保留 `config.json` 和 disabled 状态。
- 如 Bilibili 需要 assets 图标，确保 zip/install 白名单允许 `assets/*`。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
npm run pack
cargo test plugins
```

预期：

- defaults 与开发期 plugins 均包含最新 Bilibili 插件。

### T56 更新文档

文件：

- `docs/plugin-development.md`
- `docs/superpowers/progress.md`
- `docs/superpowers/specs/2026-08-10-bilibili-plugin-design.md`（仅修正执行中发现的设计偏差）

编辑：

- 插件开发文档补充 `bilibili` 权限说明。
- 说明该权限为官方内置插件能力，不建议第三方插件默认使用。
- 记录各阶段完成情况和验证命令。
- 若实现中发现与设计不一致，先修订设计再继续执行。

验证：

```powershell
npm run build
```

预期：

- 文档与最终 SDK 权限一致。

### T57 P9 全量自动验证

命令：

```powershell
cargo fmt
cargo test bilibili
cargo test plugins
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

预期：

- Rust、主前端、插件构建全部通过。

### T58 Tauri 端到端手测

命令：

```powershell
npm run tauri dev
```

操作：

1. 设置 → 插件，确认 Bilibili 内置插件存在，可启用、禁用、重载。
2. 侧边栏打开 Bilibili 首页。
3. 二维码登录，退出登录，再登录。
4. 搜索普通视频。
5. 从搜索结果进入播放页。
6. 播放、暂停、seek、切 P、倍速、音量、网页内全屏。
7. 默认自动清晰度；播放中切换清晰度；切回自动。
8. 弹幕显示、关闭、调整样式、发送普通文本弹幕。
9. 评论读取、分页、回复、发布、点赞、点踩、删除、举报确认。
10. 添加/移除稍后再看。
11. 收藏/取消收藏当前视频。
12. 查看历史、稍后再看、收藏夹，并从列表进入播放页。
13. 播放一段后离开播放页，再进入续播。
14. 检查 B 站历史进度写回。
15. 保存纯视频帧截图，保存包含弹幕截图，打开截图目录。
16. 外部浏览器打开当前视频。
17. 禁用或重载插件，确认播放器、弹幕、上报 timer 全部停止。

预期：

- 设计文档 §20 验收标准全部满足。

## 回退规则

| 触发条件 | 回退处理 |
| --- | --- |
| `bpi-rs` 依赖或 feature 编译失败 | 停止 P0，修订依赖 feature 或工具链要求 |
| 二维码登录无法提取 Cookie | 回到 Stage 1 修订登录方案，不继续播放写操作 |
| MPD 生成无法被 dash.js 加载 | 先补 MPD 单测和手写最小 MPD，再继续 P4 |
| 代理不能稳定转发 Range | 停止播放阶段，先修复代理并加回归测试 |
| 播放中清晰度切换实际重建播放器 | 回到 P4，改为 dash.js representation 切换 |
| 进度上报触发风控 | 降低上报频率，设置开关默认策略需重新确认 |
| 评论/弹幕写操作频繁失败 | 保留只读能力，写操作加更强冷却和错误提示 |
| 插件禁用后仍播放或上报 | 回到 lifecycle 清理任务，修复后再继续 |
| 实现需要新增高风险账号能力 | 回到 Stage 1 重新确认范围 |

## 完成定义

- P0-P9 所有任务完成。
- `cargo fmt`、`cargo test bilibili`、`cargo test plugins`、`cargo check` 通过。
- `npm run build` 通过。
- `scripts/official-plugins/bilibili` 的 `npm run build` 和 `npm run pack` 通过。
- Tauri dev 手测清单通过。
- 插件禁用、重载、卸载后无播放器、弹幕循环、进度上报和事件监听残留。
- Cookie、CSRF、原始播放 URL 未暴露给插件页面或日志。
- 没有视频下载、离线缓存、权限绕过或番剧/直播播放实现。
