# Doona Music 独立网易云播放器实施计划

> 创建日期：2026-08-06
> 状态：Stage 2 实施计划，待批准
> 依据设计：`docs/superpowers/specs/2026-08-06-doona-music-design.md`
> 新工程目录：`D:\apps\appss\ws\ets2\doona-music\`（独立 git 仓库）

## 0. 约定

- 源工程（本仓库）简称 **HOST**；新工程简称 **DOONA**。
- 所有任务验证在 DOONA 目录执行；HOST 只读不改。
- 中文文件处理遵守仓库 UTF-8 规则；PowerShell 读写中文前 `chcp 65001`。
- 每阶段完成后更新 `docs/superpowers/progress.md`。

## P1：工程骨架与 Rust 音乐核心跟搬（T1-T6）

- **T1. 脚手架**
  - 执行：`npm create tauri-app@latest doona-music -- --template react-ts --manager npm --yes`（在 `D:\apps\appss\ws\ets2` 下）；`cd doona-music && git init`。
  - verify: `npm run build` 通过；`cargo check`（src-tauri）通过；目录 `src/`、`src-tauri/` 存在。

- **T2. 基座依赖**
  - 执行：npm 侧补 `tailwindcss@3` + `postcss` + `autoprefixer`（或按模板现状核对）；cargo 侧在 `src-tauri/Cargo.toml` 补：`cbc = "0.1"`、`num-bigint = "0.4"`、`image = { version = "0.25", features = ["png"] }`、`qrcode = "0.14"`、`base64 = "0.22"`、`rand = "0.8"`、`tauri-plugin-store = "2"`、`axum = "0.7"`、`url = "2"`、`reqwest = { version = "0.12", features = ["json","stream"] }`、`log = "0.4"`、`urlencoding = "2"`、`anyhow = "1"`、`tokio = { version = "1", features = ["net","time"] }`（后两者为 review 补充：cookie.rs/login.rs 直接用 anyhow，login.rs/proxy.rs 直接用 tokio）。
  - verify: `npm run build` + `cargo check` 通过。

- **T3. 拷贝 `core/music/`**
  - 执行：HOST `src-tauri/src/core/music/{mod.rs,netease.rs,weapi.rs,login.rs,cookie.rs,proxy.rs,models.rs}` → DOONA `src-tauri/src/core/music/`。
  - 执行：`mod.rs` 内容改为模块声明（netease/weapi/login/cookie/proxy/models）；无业务逻辑文件需要改写。
  - verify: `cargo check` 通过。

- **T4. 命令层**
  - 执行：HOST `src-tauri/src/commands/music.rs` → DOONA `src-tauri/src/commands/music.rs`，保留全部 25 个命令函数（music_open_login_window、music_login_qr_key、music_login_qr_check、music_login_send_captcha、music_login_cellphone、music_login_status、music_logout、music_search、music_user_playlists、music_likelist、music_like、music_playlist_subscribe、music_recommend_songs、music_toplists、music_personalized_playlists、music_playlist_search、music_album_search、music_artist_search、music_album_songs、music_artist_songs、music_playlist_tracks、music_playlist_tracks_range、music_song_url、music_lyric、music_proxy_port）。
  - 执行：`commands/mod.rs` 暴露 `pub mod music;`；`lib.rs` `generate_handler!` 注册全部 `music_*`。
  - verify: `cargo check` 通过；`cargo test` 中 `music::cookie`、`music::weapi` 测试通过。

- **T5. 启动接线（setup 层）**
  - 执行：代理**懒加载**（照搬 HOST：`music_proxy_port` 命令内 `get_proxy_port()` 为 None 时 `start_proxy()`，setup 不主动拉代理）；`lib.rs` 注册 store 插件 `tauri_plugin_store::Builder::default().build()`；应用目录初始化（`app_data_dir` 下 `music-cookies.json` 懒建）。
  - 执行：`src-tauri/capabilities/default.json` 放行 store 插件权限（`"store:default"`），否则前端 `invoke("plugin:store|get")` 会因权限拒绝失败。
  - verify: `cargo check` + `cargo test` 通过。

- **T6. 基础 UI 冒烟**
  - 执行：确认 `npm run tauri dev` 能起窗口（模板界面即可）。
  - verify: 窗口打开无错误日志。

## P2：UI 库、图标与主题基座

- **T7. 拷贝 UI 组件**
  - 执行：HOST `src/components/ui/` → DOONA `src/components/ui/`，**剔除**游戏/宿主专用件：GameCard、GameBannerCard、SidebarMenu、StatCard、ThemeLibraryTile、ThemeToggle、ColorSwatch、AccountCard、BackgroundTile、BigPictureCard、BookmarkToggle、Card1、FormCard、GlassListCard（如被引用则保留并在计划中注明）。
  - 执行：同步 `glassClasses.ts`、`GlassSurface.tsx`、`GlassCard.tsx`、`Toast.tsx`、`index.ts` 等被依赖项。
  - verify: 列出 DOONA `src/components/ui/` 文件清单与 HOST 对照，缺失依赖逐个补。

- **T8. 拷贝 lib/hooks 依赖**
  - 执行：HOST `src/lib/icons.ts`、`src/lib/toast.ts`（或对应实现）、`src/hooks/useAnimation.ts`、`useCountUp.ts`、`src/lib/themeName.ts`（如被 Toast/UI 引用）→ DOONA 对应目录。
  - 执行：`src/components/ui/` 内 `../../lib/...`、`../../hooks/...` 相对路径保持原样（目录结构对齐 HOST：`src/lib/`、`src/hooks/`、`src/components/ui/`）。
  - verify: `npm run build` 通过（组件库编译零错误）。

- **T9. Tailwind 与静态主题基座**
  - 执行：HOST `tailwind.config.ts`（或 .js）、`postcss.config.js` → DOONA 根；HOST `src/index.css` 中 HSL 变量与 Tailwind tokens 部分复制为 DOONA `src/styles/tokens.css`，其中主题色取宿主默认主题值写死；`src/index.css` 或 `main.tsx` 引入 tokens.css。
  - verify: `npm run build` 通过；`npm run dev` 打开页面可见 UI 库组件正常渲染（写一个临时展示页验证 Button/TextField/Dialog 样式）。

## P3：播放器前端迁移（B1 轻重构）

- **T10. 播放器样式**
  - 执行：HOST `scripts/official-plugins/netease-music/src/styles.ts` → DOONA `src/netease/styles.ts`（原样，CSS 变量自带 fallback，无需改动）。
  - verify: `npm run build` 通过。

- **T11. 类型与 SDK 适配层**
  - 执行：DOONA 新建 `src/netease/sdk-bridge.ts`：封装 `invoke("music_*")` 全部 25 个命令为与原 `PluginSdk.music` 同签名的函数（`audioProxyUrl`/`coverProxyUrl` 是前端 URL 组装 helper，不算命令）；`storage` 用 `tauri-plugin-store` 实现 `get/set`；`ui.notify` 映射到本地 `showToast`。
  - 执行：HOST 插件 `src/types.ts` → DOONA `src/netease/types.ts`，`import from "sdk"` 改为本地类型。
  - verify: `npm run build` 通过。

- **T12. runtime 迁移**
  - 执行：HOST 插件 `src/runtime.ts` → DOONA `src/netease/runtime.ts`：`requireSdk()` 改为 `sdk-bridge`；`this.sdk?.ui.notify` → `showToast`；`sdk.storage` → bridge 的 store；`sdk.music.*` → bridge；`sdk.lifecycle.onDispose` 保留为 `dispose()` 由 App 卸载时调用；移除 `sdk.ui.registerPage/registerSettingsSection` 相关（无宿主页面注册）。
  - verify: `npm run build` 通过。

- **T13. UI 组件替换**
  - 执行：HOST 插件 `src/index.tsx` 拆分迁移到 DOONA `src/netease/`：
    - `AppShell.tsx`（MusicPage 主壳，view 状态机保留）
    - `views/HomePage.tsx`、`DiscoverPage.tsx`、`PlaylistSourcePage.tsx`、`PlaylistDetailPage.tsx`、`AlbumDetailPage.tsx`、`ArtistDetailPage.tsx`、`SearchPage.tsx`、`SongCollectionPage.tsx`
    - `components/PlayerBar.tsx`、`ExpandedPlayer.tsx`、`MiniPlayer.tsx`、`LoginDialog.tsx`、`ContextMenu.tsx`、`CoverImage.tsx`、`SongList.tsx`、`PlaylistList.tsx`、`AlbumList.tsx`、`ArtistList.tsx`、`EmptyState.tsx`、`SearchSuggestPopover.tsx`
    - `helpers/format.ts`（formatDuration、playlistCreatorText 等纯函数）
  - 执行：`import { Button, Dialog, Icon, ... } from "sdk"` → `import { Button, ... } from "../components/ui"`（对齐 UI 库真实导出名）；`runtime.subscribe(setState)` 等模式不动。
  - verify: `npm run build` 通过（类型检查零错误）。

- **T14. App 壳接线**
  - 执行：`src/App.tsx` 挂载 `netease/AppShell`，`useEffect` 初始化 runtime 并在卸载时 `runtime.dispose()`；`src/main.tsx` 引入 tokens.css 与 netease styles。
  - verify: `npm run tauri dev` 启动，播放器页面显示（未登录态）。

## P4：产品形态（托盘 + 打包）

- **T15. 托盘与关窗拦截**
  - 执行：DOONA `src-tauri/src/tray.rs`：`TrayIconBuilder` 菜单（显示窗口/播放暂停/上一首/下一首/退出）；`lib.rs` 处理 `WindowEvent::CloseRequested` → `api.prevent_close()` + 隐藏窗口；前端 `listen` 托盘事件调用 runtime 对应方法；退出菜单项走 `app.exit(0)`。
  - 执行：`tauri.conf.json` `app.withGlobalTauri` 或 capabilities 放行事件与托盘权限。
  - verify: `cargo check` + `cargo test` 通过；`npm run tauri dev` 手测：关窗隐藏、托盘菜单播放/暂停生效、显示窗口恢复。

- **T16. CSP 与标识**
  - 执行：`tauri.conf.json`：`productName: "Doona Music"`、`identifier: "com.doona.music"`、`bundle.targets: ["nsis"]`、CSP 放行 `connect-src http://127.0.0.1:* media-src http://127.0.0.1:* img-src http://127.0.0.1:*`（按 Tauri 2 CSP 字段实际结构配置）。
  - 执行：替换应用图标（`src-tauri/icons/`，从 HOST `icons/` 或自绘）。
  - verify: `npm run tauri build` 产出 NSIS 安装包。

## P5：冒烟与验收（属于 Stage 4/5 范畴，计划内定义清单）

- **T17. 冒烟清单执行**
  - 执行：按设计文档第 6 节 10 项清单，在 `npm run tauri dev` 下用真实网易云账号逐项验证。
  - verify: 每项结论记录到 progress.md；失败项回滚至对应阶段修复后重测。

## 验证命令速查

```bash
# DOONA 目录内
npm run build            # 前端 tsc + vite 构建
npm run tauri dev        # 开发窗口
cargo check              # src-tauri
cargo test               # 含 core/music 单测
npm run tauri build      # 产出 NSIS 安装包
```

## 回滚规则

- P2/P3 阶段发现设计缺口 → 回 Stage 1 修订设计文档。
- 任务无法执行（依赖缺失、命令冲突）→ 停在当前任务，记录阻塞原因。
- P5 冒烟失败 → 按失败点回对应阶段（P3 逻辑/ P4 形态）修复重测。
