# 网易云播放器官方插件实施计划

> 创建日期：2026-08-04  
> 状态：Stage 2 计划草案，待批准  
> 设计文档：`docs/superpowers/specs/2026-08-04-netease-music-plugin-design.md`  
> 验证命令基线：根目录 `npm run build`；`src-tauri` 目录 `cargo test music`、`cargo check`

## 执行原则

- 只实现设计文档第一版范围。
- 不复制 NexBox 源码，按本项目结构重写。
- 不实现破解、替代源、账号写操作。
- 每个任务完成后运行指定验证命令。
- 若验证失败且原因不明确，停止执行并回到计划修订。

## P1 插件系统扩展：权限与生命周期

### T1 扩展 Rust 插件权限白名单

文件：

- `src-tauri/src/core/plugins.rs`

编辑：

- 将 `KNOWN_PERMISSIONS` 扩展为包含 `"music"`。
- 补充 manifest 校验单元测试：`permissions:["music"]` 可通过；未知权限仍失败。

验证：

```powershell
cd src-tauri
cargo test plugins
```

预期：插件 manifest 可声明 `music` 权限，原有插件权限测试继续通过。

### T2 扩展前端 SDK 权限类型

文件：

- `src/plugins/sdk.ts`
- `src/plugins/types.ts`
- `scripts/plugin-template/src/types.ts`
- `scripts/plugin-template/src/sdk.d.ts`
- `docs/plugin-development.md`

编辑：

- `ALL_PERMISSIONS` 增加 `"music"`。
- `Permission` 类型同步。
- 文档权限表增加 `music`。
- 模板类型先声明 `music` 命名空间接口，具体方法在 T13 补齐。

验证：

```powershell
npm run build
```

预期：主应用和 SDK 构建通过。

### T3 增加插件生命周期 dispose 注册

文件：

- `src/plugins/sdk.ts`
- `src/plugins/loader.ts`

编辑：

- 在 `PluginSdk` 增加：

```ts
lifecycle: {
  onDispose(callback: () => void | Promise<void>): void;
}
```

- SDK 内部为每个插件维护 dispose callbacks。
- 新增 `runPluginDispose(pluginId)` 和 `clearPluginDispose(pluginId)`。
- `unloadPlugin(id)` 调用 dispose callbacks。
- `loadPlugin()` 若模块导出 `teardown()`，在 unload 时调用。
- dispose 和 teardown 异常通过 `reportError(id, e)` 记录，但不阻塞后续清理。

验证：

```powershell
npm run build
```

预期：插件可注册清理函数，禁用/重载插件时清理函数会执行。

## P2 Rust 音乐后端

### T4 增加后端依赖

文件：

- `src-tauri/Cargo.toml`

编辑：

- 增加：

```toml
reqwest = { version = "0.12", features = ["json", "stream"] }
axum = "0.7"
futures-util = "0.3"
tauri-plugin-store = "2"
url = "2"
urlencoding = "2"
```

- 如 `reqwest 0.12` 与当前依赖冲突，则改用当前 lockfile 可解析版本，并在执行记录中说明。

验证：

```powershell
cd src-tauri
cargo check
```

预期：依赖解析成功。

### T5 注册 store 插件

文件：

- `src-tauri/src/lib.rs`

编辑：

- 在 Tauri Builder 中增加：

```rust
.plugin(tauri_plugin_store::Builder::default().build())
```

验证：

```powershell
cd src-tauri
cargo check
```

预期：Tauri store 插件可用。

### T6 新建音乐数据模型

文件：

- `src-tauri/src/core/music/mod.rs`
- `src-tauri/src/core/music/models.rs`
- `src-tauri/src/core/mod.rs`

编辑：

- 新增 `pub mod music;`。
- 定义 `Song`、`Artist`、`Playlist`、`SongUrlResult`、`LoginInfo`、`Lyrics`、`PlaybackQuality`。
- 为模型添加 `Serialize`、`Deserialize`、`Default` 和必要的 `Clone`。

验证：

```powershell
cd src-tauri
cargo check
```

预期：模型可被 commands 和 tests 引用。

### T7 实现 cookie 存储与解析

文件：

- `src-tauri/src/core/music/cookie.rs`
- `src-tauri/src/core/music/mod.rs`

编辑：

- 实现 `parse_cookie_string(cookie: &str) -> HashMap<String, String>`。
- 实现 `normalize_cookie_header(raw: &str) -> String`。
- 实现 `netease_cookie_has_login(cookie: &str) -> bool`。
- 实现 `save_cookie(app, "netease", cookie)`、`load_cookie(app, "netease")`、`clear_cookie(app, "netease")`，store 文件名使用 `music-cookies.json`。
- 增加单元测试覆盖空 cookie、包含 `MUSIC_U`、重复 key 和空值。

验证：

```powershell
cd src-tauri
cargo test music
```

预期：cookie 解析和登录态判断稳定。

### T8 实现网易云只读 API 客户端

文件：

- `src-tauri/src/core/music/netease.rs`
- `src-tauri/src/core/music/models.rs`

编辑：

- 建立 `reqwest::Client` 构造函数，设置 15 秒 API 请求超时。
- 实现普通 GET/POST helper，带 `User-Agent`、`Referer: https://music.163.com/`、`Cookie`。
- 实现：

```rust
search(keywords, limit, cookie) -> Vec<Song>
login_status(cookie) -> LoginInfo
user_playlists(uid, cookie) -> Vec<Playlist>
playlist_tracks(id, cookie) -> (Playlist, Vec<Song>)
playlist_tracks_range(id, start, count, cookie) -> Vec<Song>
song_url(id, preferred_quality, cookie) -> SongUrlResult
lyric(id, cookie) -> Lyrics
```

- `song_url` 支持音质候选降级：`hires -> lossless -> exhigh -> standard`。
- 返回试听 URL 时 `trial=true`。
- 无 URL 时 `playable=false`，填充 `reason` 和 `message`。
- 不实现喜欢、收藏、评论等写操作。

验证：

```powershell
cd src-tauri
cargo check
```

预期：API 客户端编译通过。

### T9 实现登录窗口

文件：

- `src-tauri/src/core/music/login.rs`
- `src-tauri/src/core/music/mod.rs`
- `src-tauri/src/lib.rs`

编辑：

- 创建或刷新 `netease-login` WebView。
- 导航到 `https://music.163.com/#/login`。
- 轮询 `window.cookies()`，过滤网易云域名 cookie。
- 按优先顺序拼接 `MUSIC_U`、`__csrf`、`NMTID` 等 cookie。
- 发现 `MUSIC_U` 后保存 cookie，调用 `login_status` 验证。
- 成功时 emit `music:login-success`，失败时 emit `music:login-failed`。
- 超时 5 分钟后停止轮询，不关闭用户窗口。

验证：

```powershell
cd src-tauri
cargo check
```

预期：登录窗口命令可编译。

### T10 实现本地音频和封面代理

文件：

- `src-tauri/src/core/music/proxy.rs`
- `src-tauri/src/core/music/mod.rs`

编辑：

- 使用 axum 绑定 `127.0.0.1:0`。
- 实现 `GET /audio?url=...`，转发 Range，流式返回 bytes。
- 实现 `GET /cover?url=...`，返回图片 bytes 和 CORS/CORP 头。
- 只允许 `http` 和 `https`。
- 提供 `start_proxy() -> u16` 和 `get_proxy_port() -> u16`。

验证：

```powershell
cd src-tauri
cargo check
```

预期：代理模块编译通过。

### T11 新建 Tauri music commands

文件：

- `src-tauri/src/commands/music.rs`
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`

编辑：

- `commands/mod.rs` 增加 `pub mod music;`。
- `lib.rs` invoke handler 注册：

```rust
music_open_login_window
music_login_status
music_logout
music_search
music_user_playlists
music_playlist_tracks
music_playlist_tracks_range
music_song_url
music_lyric
music_proxy_port
```

- `setup()` 阶段可启动代理，也可 lazy start；MVP 推荐 lazy start。

验证：

```powershell
cd src-tauri
cargo check
cargo test music
```

预期：所有音乐命令可被前端 invoke。

## P3 SDK 音乐 API

### T12 增加前端音乐类型

文件：

- `src/plugins/music-types.ts`
- `scripts/plugin-template/src/types.ts`
- `scripts/plugin-template/src/sdk.d.ts`

编辑：

- 定义 `Song`、`Artist`、`Playlist`、`SongUrlResult`、`LoginInfo`、`Lyrics`、`PlayMode`、`PlaybackQuality`。
- SDK 模板类型同步。

验证：

```powershell
npm run build
```

预期：类型可被 SDK 和官方插件引用。

### T13 实现 `sdk.music`

文件：

- `src/plugins/sdk.ts`

编辑：

- `PluginSdk` 增加 `music` 命名空间。
- 所有方法调用前 `requirePerm("music", "...")`。
- 方法映射到 Tauri commands。
- `audioProxyUrl(rawUrl)` 和 `coverProxyUrl(rawUrl)` 调 `music_proxy_port` 后组合本地代理 URL。
- `coverProxyUrl("")` 返回空字符串。

验证：

```powershell
npm run build
```

预期：插件可通过 `sdk.music` 调用宿主音乐能力。

### T14 更新插件开发文档

文件：

- `docs/plugin-development.md`

编辑：

- 增加 `music` 权限说明。
- 增加 `sdk.lifecycle.onDispose()` 说明。
- 增加音乐 API 简要说明。
- 明确 `music` 权限只开放只读和播放，不开放账号写操作。

验证：

```powershell
npm run build
```

预期：文档与 SDK 类型一致。

## P4 官方网易云插件

### T15 新建官方插件工程

文件：

- `scripts/official-plugins/netease-music/package.json`
- `scripts/official-plugins/netease-music/tsconfig.json`
- `scripts/official-plugins/netease-music/manifest.json`
- `scripts/official-plugins/netease-music/src/types.ts`
- `scripts/official-plugins/netease-music/src/index.tsx`

编辑：

- 使用 esbuild 构建单文件 ESM bundle。
- manifest：

```json
{
  "id": "com.easygamehub.netease-music",
  "name": "网易云播放器",
  "version": "0.1.0",
  "api_version": 1,
  "entry": "bundle.js",
  "permissions": ["ui", "music"]
}
```

- `setup(sdk)` 注册播放器页面，路径 `netease-music`，标题 `网易云播放器`。
- 注册 `sdk.lifecycle.onDispose(runtime.dispose)`。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm install
npm run build
```

预期：产出 `dist/bundle.js`，且仅从 `"sdk"` 导入。

### T16 实现插件 runtime

文件：

- `scripts/official-plugins/netease-music/src/runtime.ts`
- `scripts/official-plugins/netease-music/src/types.ts`

编辑：

- 模块级创建 `Audio` 单例。
- 实现 `subscribe(listener)`、`getState()`、`setState(patch)`。
- 实现状态字段：当前歌曲、队列、索引、播放状态、时间、时长、音量、模式、登录信息、歌单、歌曲列表、搜索结果、歌词、试听标记、错误。
- 绑定 audio 事件：`timeupdate`、`loadedmetadata`、`ended`、`error`。
- `dispose()` pause、清空 src、移除事件、清空 timer 和订阅者。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：runtime 独立于页面组件，构建通过。

### T17 实现登录和基础数据动作

文件：

- `scripts/official-plugins/netease-music/src/runtime.ts`
- `scripts/official-plugins/netease-music/src/index.tsx`

编辑：

- `init()` 调用 `sdk.music.loginStatus()`。
- 登录后加载 `sdk.music.userPlaylists()`。
- `openLoginWindow()` 调用 SDK，并监听或轮询登录状态。
- `logout()` 清理登录信息、歌单和当前账号相关状态。
- 页面显示登录按钮、登出按钮、头像、昵称、VIP/SVIP。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：插件页面可显示登录状态。

### T18 实现搜索和歌单加载

文件：

- `scripts/official-plugins/netease-music/src/runtime.ts`
- `scripts/official-plugins/netease-music/src/index.tsx`

编辑：

- 搜索框触发 `sdk.music.search(keywords, 30)`。
- 左栏歌单点击调用 `sdk.music.playlistTracks(id)`。
- 歌单分页加载调用 `sdk.music.playlistTracksRange(id, start, 50)`。
- 中栏支持搜索结果和当前歌单歌曲列表切换。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：搜索结果和歌单歌曲可以渲染。

### T19 实现播放队列和音频播放

文件：

- `scripts/official-plugins/netease-music/src/runtime.ts`
- `scripts/official-plugins/netease-music/src/index.tsx`

编辑：

- 实现 `playSong(song, queue?)`。
- 调用 `sdk.music.songUrl(song.id, quality)`。
- 有 URL 时使用 `sdk.music.audioProxyUrl(url)` 设置 `audio.src` 并播放。
- `trial=true` 时设置试听状态。
- 无 URL 手动播放只提示，不改变当前歌曲。
- 队列自动下一首遇无 URL 时跳过，连续 5 首失败后停止。
- 实现 `togglePlay`、`nextTrack`、`prevTrack`、`seek`、`setVolume`、`setPlayMode`。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：构建通过，播放状态机无类型错误。

### T20 实现 LRC 歌词解析和滚动

文件：

- `scripts/official-plugins/netease-music/src/lyrics.ts`
- `scripts/official-plugins/netease-music/src/runtime.ts`
- `scripts/official-plugins/netease-music/src/index.tsx`

编辑：

- 实现 `parseLrc(lyric, translation)`。
- 同时间戳翻译合并到原文行。
- 播放新歌后异步调用 `sdk.music.lyric(song.id)`。
- 当前播放时间变化时计算 active line。
- UI 当前行高亮，容器滚动到当前行。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：歌词解析和渲染构建通过。

### T21 完成三栏 UI

文件：

- `scripts/official-plugins/netease-music/src/index.tsx`
- `scripts/official-plugins/netease-music/src/styles.ts`

编辑：

- 左栏：账号、登录/登出、我的歌单。
- 中栏：搜索框、搜索结果、歌单歌曲。
- 右栏：封面、试听标记、歌名、歌手、进度、播放控制、音量、播放模式、歌词、队列。
- 使用内联样式或样式对象，跟随主题 CSS 变量。
- 不实现宿主迷你播放器。
- 响应式折叠为纵向布局。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：插件 UI 构建通过。

### T22 打包官方插件

文件：

- `scripts/official-plugins/netease-music/package.json`
- `plugins/com.easygamehub.netease-music/manifest.json`
- `plugins/com.easygamehub.netease-music/bundle.js`

编辑：

- 增加 `pack` 脚本，将 `manifest.json` 和 `dist/bundle.js` 复制到 `plugins/com.easygamehub.netease-music/`。
- 若需要 zip，也输出 `netease-music.zip`，zip 根目录只包含 `manifest.json` 和 `bundle.js`。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
npm run pack
```

预期：官方插件进入项目 `plugins/` 目录。

### T23 内置插件同步

文件：

- `src-tauri/src/core/plugins.rs`
- `src-tauri/src/commands/plugins.rs`
- `src-tauri/src/lib.rs`
- `resources/defaults/plugins/com.easygamehub.netease-music/manifest.json`
- `resources/defaults/plugins/com.easygamehub.netease-music/bundle.js`

编辑：

- 新增 `sync_builtin_plugins(defaults_plugins_dir, plugins_dir, registry_path)`。
- 启动时若官方插件不存在，则复制 defaults 并写入 registry。
- 若 registry 中用户已禁用该插件，不重新启用。
- 若 defaults 版本高于已安装版本，覆盖 manifest/bundle，保留 `config.json`。

验证：

```powershell
cd src-tauri
cargo test plugins
cargo check
```

预期：默认插件可自动安装到运行目录。

## P5 端到端验证

### T24 全量构建验证

命令：

```powershell
npm run build
cd src-tauri
cargo test music
cargo test plugins
cargo check
```

预期：前端、SDK、官方插件、Rust 后端全部通过。

### T25 Tauri 手动验证

命令：

```powershell
npm run tauri dev
```

操作：

1. 打开设置到插件页，确认“网易云播放器”存在。
2. 启用插件，侧边栏进入“网易云播放器”。
3. 点击登录，完成网易云官方登录。
4. 确认账号头像、昵称、VIP 状态显示。
5. 搜索一首普通可播歌曲并播放。
6. 打开我的歌单并播放歌单歌曲。
7. 播放过程中切换到 Dashboard，确认音乐继续。
8. 回到插件页面，确认进度和状态仍同步。
9. 播放一首只返回试听片段的歌曲，确认标记“试听片段”。
10. 禁用或重载插件，确认音乐停止。

预期：所有操作符合设计文档验收标准。

### T26 失败路径验证

操作：

- 未登录时打开我的歌单。
- 搜索无结果关键字。
- 播放无 URL 歌曲。
- 连续多首无 URL。
- 登录窗口关闭但未登录。
- 后端网络断开。

预期：

- 插件显示明确错误或空态。
- 队列不会进入无限跳过。
- 插件错误不会拖垮主应用。

### T27 更新文档与进度

文件：

- `docs/plugin-development.md`
- `docs/superpowers/progress.md`

编辑：

- 写入音乐插件 SDK 说明。
- 记录完成阶段、验证命令和人工验证结果。

验证：

```powershell
npm run build
```

预期：文档与实现一致。

## 回退规则

| 触发条件 | 回退处理 |
| --- | --- |
| `reqwest`/`axum` 依赖冲突 | 固定到 lockfile 可解析版本，更新计划记录 |
| WebView cookie 读取不可用 | 暂停登录实现，回到设计补二维码或手动 cookie 方案 |
| 音频代理无法处理 Range | 暂停播放功能，先补代理集成测试 |
| 插件 unload 后音频仍播放 | 回到 P1，修复 lifecycle 清理后再继续 |
| 网易云接口返回结构变化 | 修改 `netease.rs` 映射层，不修改插件 UI 契约 |
| 官方插件打包无法被 loader 加载 | 回到插件构建配置，确认 `bundle.js` 只 external `"sdk"` |

## 完成定义

- 设计文档验收标准全部满足。
- `npm run build` 通过。
- `cargo test music`、`cargo test plugins`、`cargo check` 通过。
- Tauri dev 手动验证通过。
- 插件禁用、重载、卸载时无后台音频残留。
- 实现中没有账号写操作和破解逻辑。
