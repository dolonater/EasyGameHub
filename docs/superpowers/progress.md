# Development Progress

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 1 Requirement Exploration: Completed at 2026-08-06（设计经 grill-me 访谈 13 轮逐项确认）
- Design doc: docs/superpowers/specs/2026-08-06-doona-music-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-06
- Plan doc: docs/superpowers/plans/2026-08-06-doona-music-plan.md
- Stage 3 Plan Execution: P0 completed at 2026-08-06
- P0 scope completed (T1-T2 + 文档审查修订):
  - 审查修订：计划 T4 命令名改全称、T11 命令数 22→25、T5 补 capabilities `store:default`；设计 3.2 `runtime-box.ts`→`runtime.ts`、3.5 目录树统一为 `src/netease/`。
  - T1: `npm create tauri-app@latest doona-music -- --template react-ts --manager npm --yes` 于 `D:\apps\appss\ws\ets2`，git init 完成。
  - T2a: 前端依赖按设计 2.1 降至 React 18（react@18.3.1、@types/react@18），补 tailwindcss@3.4.19 + postcss + autoprefixer。
  - T2b: Cargo.toml 补音乐核心依赖（reqwest json+stream、axum 0.7、url/urlencoding、base64/cbc/aes/qrcode/rand/num-bigint/image/log、tauri-plugin-store 2），并按审查结论追加 `tauri` `tray-icon` feature（P4 托盘必需，提前编译）。
- P0 Verification:
  - `npm run build` passed（tsc + vite build）。
  - `cargo check` passed（1m08s 全量依赖解析成功）。
- Active stage: Stage 3 P2 未开始（待用户批准继续）

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- 阶段编号修正（用户指示）：P1=T1-T6、P2=T7-T9、P3=T10-T14、P4=T15-T16、P5=T17；计划文档已同步。
- Stage 3 Plan Execution: P2 completed at 2026-08-06
- P2 scope completed (T7-T9):
  - T7: HOST `src/components/ui/` 剪裁拷贝 16 个通用组件（Button/Checkbox/ContextMenu/Dialog/GlassCard/GlassSurface/Icon/OtpInput/SearchInput/Select/Slider/TabButtons/TextField/Toast/Toggle/glassClasses）；重写 barrel `index.ts`（剔除 14 个游戏/宿主专用件）；**Toast.tsx 裁剪**：去 react-i18next（DOONA 无 i18n）与宿主 backup 事件监听，保留 onToast 通道。
  - T8: `lib/icons.ts` + `lib/toast.ts` 拷贝；icons.ts 引用的 87 个 SVG（28 fill + 59 regular）按引用清单精确拷贝至根 `assets/`；hooks（useAnimation/useCountUp）与 `themeName.ts` 确认无 UI 组件引用，按计划"如被引用"条款跳过。
  - T9: HOST `tailwind.config.ts`/`postcss.config.js` 拷贝；新写 `src/styles/tokens.css`（@tailwind 指令 + :root/.dark HSL 变量写死宿主默认主题 + UI 组件引用的动画 keyframes/glass/scrollbar 类，剔除 app-liquid-glass/game-cover-card 等宿主专属段）；main.tsx 引入；App.tsx 换成临时 UI 冒烟页（替换掉引用已删除 greet 命令的模板页）。
- P2 执行中发现并修正的偏差：
  - DOONA 模板 tsconfig 开了 `noUnusedLocals/noUnusedParameters` 而 HOST 显式关闭 → 对齐 HOST 设为 false（保持 vendored 组件原样，不改组件代码）。
  - icons.ts 依赖 `../../assets/fill|regular/*.svg?raw`（HOST 根目录 1500+ 图标集），按引用清单只拷 87 个。
  - Select 组件 `name` 为必填 prop（HOST 原样）。
- P2 Verification:
  - `npm run build` passed（tsc + vite，CSS 33.7kB，组件编译零错误）。
  - 临时展示页（Button/Dialog/Toast/TextField/Slider/Toggle/Checkbox/Select/SearchInput）`npm run tauri dev` 渲染待用户手动确认。
- Active stage: Stage 3 P5 完成（用户手测全项通过），项目交付完成

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 3 Plan Execution: P5 completed at 2026-08-06
- P5 scope completed (T17):
  - 用户手测（真实网易云账号）10 项冒烟清单全部通过：
    1. QR 登录、手机验证码登录 ✓
    2. 搜索四 tab（单曲/歌单/专辑/歌手）✓
    3. 歌单分页（滚动加载 + 加载更多）✓
    4. 播放/暂停/下一首/上一首/播放模式/音量 ✓
    5. 歌词 + 翻译、封面主题色切换 ✓
    6. 喜欢/取消喜欢 ✓
    7. 展开播放器、迷你播放器 ✓
    8. 缓存恢复（重启后播放位置/队列/最近/搜索历史）✓
    9. 托盘（关窗继续播、托盘菜单控制、重新显示窗口）✓
    10. 音质设置、无版权试听片段标记 ✓
  - 冒烟前处理：kill 遗留 vite dev server（PID 34576，占 1422 与 tauri dev 冲突）。
- P5 Verification: `npm run tauri dev` 手测全项通过；无失败项需回滚。

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 3 Plan Execution: P4 completed at 2026-08-06
- P4 scope completed (T15-T16):
  - T15: 新建 `src-tauri/src/tray.rs`：`TrayIconBuilder` 菜单 5 项（显示窗口/播放暂停/上一首/下一首/退出），左键单击托盘显示主窗口，播放控制命令 `app.emit("tray:play-pause|prev|next")` 走前端 runtime（`togglePlay/prevTrack/nextTrack`）；`lib.rs` `on_window_event` 拦截 `CloseRequested` → `prevent_close()` + `hide()`（宿主模式照搬）；`App.tsx` `listen` 三个托盘事件映射到 runtime，卸载时清监听。
  - T16: `tauri.conf.json`：`productName: "Doona Music"`、`identifier: "com.doona.music"`、`bundle.targets: ["nsis"]`、窗口 1100x720（min 800x560）；CSP 严格化：`default-src 'self'` + `connect-src ipc: http://ipc.localhost http://127.0.0.1:*`（Tauri IPC + 本地音乐/封面代理）+ `media-src/img-src http://127.0.0.1:* data: blob:` + `style-src 'unsafe-inline'` + `script-src 'self'`（无 unsafe-eval）。
  - 应用图标：Python+PIL 脚本 `scripts/gen_icons.py` 自绘音符渐变图标，生成 16-512 PNG + icon.ico/icon.png（替换 Tauri 模板图标）。
- P4 执行中发现并修正的偏差：
  - `cargo check` 报 `emit` 需 `tauri::Emitter` trait 显式引入，补 `use tauri::Emitter`。
  - 计划原案 CSP `connect-src http://127.0.0.1:*` 需补 Tauri 2 IPC 域名（`ipc:` / `http://ipc.localhost`），否则 `invoke` 会被 CSP 拦截。
- P4 Verification:
  - `cargo check` + `cargo test` passed（0 测试）；`cargo fmt` 执行。
  - `npm run tauri build` passed：产出 `Doona Music_0.1.0_x64-setup.exe`（3.0M, NSIS）+ release exe（14M, 2m40s 编译）。
  - 托盘/关窗隐藏手测项待用户 `tauri dev` 确认（计划 T15 verify）。

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 3 Plan Execution: P3 completed at 2026-08-06
- P3 scope completed (T10-T14):
  - T10: HOST 插件 `src/styles.ts` 原样拷贝至 DOONA `src/netease/styles.ts`（CSS 变量自带 fallback 无需改动）；`lyrics.ts` 一并拷贝（ExpandedPlayer 依赖 `activeLyricIndex`）。
  - T11: 新建 `src/netease/sdk-bridge.ts` 封装 25 个 `music_*` invoke 命令（参数名与 commands/music.rs 对齐）+ `storage`（tauri-plugin-store）+ `ui.notify`→showToast；HOST `src/types.ts` 拷贝至 `src/netease/types.ts`（`import from "sdk"` 改本地类型）。
  - T12: HOST `src/runtime.ts` 拷贝至 `src/netease/runtime.ts`：`runtime.init(sdk)` 由 App 传 bridge，`dispose()` 保留供卸载调用；订阅/状态机模式原样。
  - T13: HOST 插件 `src/index.tsx`（2827 行）按 Python 行号区间脚本机械拆分为 42 文件：`AppShell.tsx`（MusicPage→AppShell，view 状态机保留）、8 个 `views/*`、32 个 `components/*`、`helpers/constants.ts`（手写类型/常量）与 `helpers/format.ts`（纯函数）、2 个 hooks；sdk import 改 `../../components/ui`；漏切组件 `LibraryTabs`/`DiscoveryTabs`（原插件未调用）补建 `components/PanelTabs.tsx` 保持 1:1。
  - T14: `src/App.tsx` 挂载 `<AppShell/>` + `useEffect` runtime.init/dispose；main.tsx 已引 tokens.css。
- P3 执行中发现并修正的偏差：
  - HOST 插件从 `sdk` 导入 Button/Icon/TextField/Dialog/Slider，DOONA 对应 `src/components/ui`（P2 剪裁版）；拆分脚本最初指向不存在的 `../ui`，改为 `../../components/ui`。
  - `Icon` 组件 `name` 原为严格 `IconName` 联合类型，拆分组件传入 `string`（meta/icon 字面量表）→ 放宽为 `IconName | string` 且 `ICONS[name] ?? ""` 兜底。
  - PlayerBar `onSongContextMenu` 原必需，但宿主 ExpandedPlayer 内 `<PlayerBar state onExpand={()=>undefined}/>` 未传（宿主构建宽松）→ DOONA strict 下改可选 + QueuePopover 内 `?? (() => undefined)` 兜底。
  - sdk-bridge 初版误用 `Store.load()` 实例方法（v2 plugin-store 为静态 `Store.load`，实例自动加载）→ 删除冗余 `await s.load()`。
  - 拆分后 `../../lib/icons` 依赖 87 个 SVG：先误拷至 `src/assets/`，按相对路径（`../../assets` = 根）修正拷至根 `assets/`（174 个文件含 dup 无 MISSING）。
- P3 Verification:
  - `npx tsc --noEmit` passed（零错误）。
  - `npm run build` passed（185 modules，JS 342.93kB，CSS 34.66kB）。
  - dev server 冒烟：1422 被遗留 node（PID 34576）占用，临时 `--port 1424 --strictPort` 启动正常；`tauri dev` 播放器页面（未登录态）待用户手动确认。

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 3 Plan Execution: P1 completed at 2026-08-06
- P1 scope completed (T3-T6):
  - T3: HOST `core/music/` 六文件（cookie/login/models/netease/proxy/weapi/mod.rs）拷贝至 DOONA `src-tauri/src/core/music/`；mod.rs 本就是纯模块声明，无需改写；新建 `core/mod.rs` 声明 `pub mod music`。
  - T4: `commands/music.rs` 照搬（264 行，25 个 `music_*` 命令 + 私有 `logged_in_cookie`）；新建 `commands/mod.rs`；lib.rs 注册全部 25 命令。
  - T5: lib.rs 注册 store 插件；代理为**懒加载**（照搬 HOST：`music_proxy_port` 命令内 `get_proxy_port()` 为 None 时 `start_proxy()`，setup 不主动拉代理——review 修正，与设计 3.4"或懒加载"一致）；capabilities/default.json 放行 `store:default`。
  - T6: 冒烟——首次 `tauri dev` 因 1420 端口被宿主 dev server（node PID 15948）占用而失败，DOONA 独立端口改为 1422（vite.config.ts + tauri.conf.json devUrl）；用户手动确认 dev 窗口正常。
- P1 执行中发现并修正的偏差：
  - T2 依赖漏项（P1 编译时暴露）：`anyhow = "1"`（cookie.rs/login.rs 直接使用）、`tokio = { version = "1", features = ["net","time"] }`（login.rs `tokio::time::sleep`、proxy.rs `tokio::net::TcpListener`）、`cipher = "0.4"`（weapi.rs `use cipher::{...}`）；三者 HOST Cargo.toml 均有，已补入 DOONA 并同步修订计划 T2。
  - 计划 T5 原案"setup 启动 start_proxy()"与 HOST 实际懒加载行为不符，已改为懒加载并同步修订计划。
- P1 Verification:
  - `cargo check` passed（初次 2.76s，依赖已缓存）。
  - `cargo test music` passed: 10 passed, 0 failed（cookie/weapi/login 单测）。
  - `npm run tauri dev`：窗口正常（用户手动确认）。
- Active stage: Stage 3 P2 未开始（待用户批准继续）
- 关键结论：
  - 新工程 `D:\apps\appss\ws\ets2\doona-music\`，独立 git 仓库，Tauri 2 + React 18 + Vite + Tailwind + Rust。
  - 产品名 Doona Music，identifier `com.doona.music`，仅 NSIS 打包，无自动更新。
  - 单主窗口 + 托盘常驻（关窗继续播）；B1 轻重构（runtime 订阅模式 + view 状态机沿用，不上 router/状态库）。
  - Rust core/music 六模块 + UI 库通用组件 + icons/hooks + Tailwind/静态主题基座全部 vendored。
  - 功能 1:1 全量保留；文案硬编码中文，i18n 后置。

## Current Workflow Request
- Topic: 网易云音乐插件内手机号/二维码登录
- Stage 1 Requirement Exploration: Completed at 2026-08-05
- Design doc: docs/superpowers/specs/2026-08-05-netease-in-page-login-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-05
- Plan doc: docs/superpowers/plans/2026-08-05-netease-in-page-login-plan.md
- Stage 3 Plan Execution: P1 completed at 2026-08-05
- P1 scope completed:
  - T1: 新增 `LoginQrKeyResult`、`LoginQrCheckResult`、`CaptchaSentResult` 后端模型。
  - T2: 新增 AES-CBC、PKCS7、随机数、大整数和二维码生成依赖。
  - T3: 新增 `core::music::weapi` 纯函数，覆盖 weapi 参数加密、chainId 和二维码 data URL 单元测试。
  - T4: 新增 `post_weapi` 网络 helper，包含请求头、表单加密、响应 JSON 和 Set-Cookie 归一化。
  - T5: 新增二维码 key 创建后端函数。
  - T6: 新增二维码状态检查、803 登录成功 Cookie 保存和 `music:login-success` / `music:login-failed` 事件。
  - T7: 新增手机号短信验证码发送后端函数。
  - T8: 新增手机号短信验证码登录后端函数，成功后复用 Cookie 保存和登录态验证。
  - T9: 新增并注册 `music_login_qr_key`、`music_login_qr_check`、`music_login_send_captcha`、`music_login_cellphone` Tauri commands。
- Verification:
  - `cd src-tauri && cargo check` passed after T1/T2/T4/T5/T6/T7/T8.
  - `cd src-tauri && cargo test music::weapi` passed after T3.
  - `cd src-tauri && cargo test music && cargo check` passed after T9 and final cleanup.
  - `cargo fmt --check` was not used as a gate because the repository currently has broad pre-existing rustfmt diffs outside this P1 scope; no unrelated Rust files were reformatted.
- Stage 3 Plan Execution: P2 completed at 2026-08-05
- P2 scope completed:
  - T10: `src/plugins/music-types.ts` 新增 `LoginQrKeyResult`、`LoginQrCheckResult`、`CaptchaSentResult`。
  - T11: `src/plugins/sdk.ts` 新增 `music.loginQrKey`、`music.loginQrCheck`、`music.sendLoginCaptcha`、`music.loginCellphone`，并保持 `music` 权限检查。
  - T12: `scripts/official-plugins/netease-music/src/sdk.d.ts` 和 `types.ts` 同步登录结果类型与 SDK 方法声明。
- P2 Verification:
  - `npm run build` passed after T10.
  - `npm run build` passed after T11.
  - `cd scripts/official-plugins/netease-music && npm run build` passed after T12.
  - Final `npm run build` passed after progress update.
- Stage 3 Plan Execution: P3 completed at 2026-08-05
- P3 scope completed:
  - T13: `scripts/official-plugins/netease-music/src/runtime.ts` 保留 `openLoginWindow()` 兼容方法，并新增 `createQrLogin`、`checkQrLogin`、`sendLoginCaptcha`、`loginWithCellphone`。
  - T14: `scripts/official-plugins/netease-music/src/index.tsx` 新增插件内 `LoginDialog`，支持二维码生成、2 秒轮询、过期刷新、手机号验证码发送和倒计时。
  - T15: 顶部账号登录按钮和未登录空态登录按钮改为打开插件内 Dialog，不再默认调用外部登录窗口。
  - T16: `scripts/official-plugins/netease-music/src/styles.ts` 新增登录 Dialog、二维码面板、手机号表单和小屏适配样式。
  - T17: 登录相关错误提示增加二维码、验证码和请求频繁场景映射；扫码等待、已扫码、过期等可恢复状态显示在 Dialog 内。
- P3 Verification:
  - `cd scripts/official-plugins/netease-music && npm run build` passed after T13.
  - `cd scripts/official-plugins/netease-music && npm run build` passed after T14/T15.
  - `cd scripts/official-plugins/netease-music && npm run build` passed after T16/T17.
  - Final `cd scripts/official-plugins/netease-music && npm run build` passed after progress update.
- Stage 3 Plan Execution: P4 completed at 2026-08-05
- P4 scope completed:
  - T18: Rust 音乐相关测试和后端编译验证完成。`cargo fmt --check` 显示大量无关历史格式差异，因此按 `AGENTS.md` 最小改动规则未执行会批量改写仓库的 `cargo fmt`。
  - T19: 官方网易云插件完成 `npm run build` 和 `npm run pack`，已同步 `plugins/com.easygamehub.netease-music` 与 `resources/defaults/plugins/com.easygamehub.netease-music`。
  - T20: 主应用 `npm run build` 通过，包含 TypeScript、Vite 主应用和插件 SDK 构建。
  - T21: 手动交互验证因当前工具环境无法可靠控制 Tauri 桌面窗口和真实扫码/短信验证码流程，未执行；需要人工在应用内验收登录 Dialog。
  - T22: 进度文档已更新。
- P4 Verification:
  - `cd src-tauri && cargo fmt --check` failed with broad pre-existing rustfmt diffs outside this feature scope; no Rust files were reformatted.
  - `cd src-tauri && cargo test music` passed: 8 passed, 0 failed.
  - `cd src-tauri && cargo check` passed.
  - `cd scripts/official-plugins/netease-music && npm run build` passed.
  - `cd scripts/official-plugins/netease-music && npm run pack` passed.
  - Bundle import check confirmed generated plugin bundles import from `"sdk"`.
  - `npm run build` passed.
  - Final `npm run build` passed after progress update.
- Active stage: Stage 4 Test-Driven Validation not started
- Notes:
  - 当前设计结论为可实现。
  - 后端参考 go-musicfox 的 `LoginQRService`、`CaptchaSentService`、`LoginCellphoneService` 接口语义。
  - 需要新增 Rust 最小 `weapi` 请求能力；不保存明文密码，不做破解或会员绕过。

## Current Workflow Request
- Topic: NetEase music official plugin
- Stage 1 Requirement Exploration: Completed at 2026-08-04
- Design doc: docs/superpowers/specs/2026-08-04-netease-music-plugin-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-04
- Plan doc: docs/superpowers/plans/2026-08-04-netease-music-plugin-plan.md
- Stage 3 Plan Execution: P1 completed at 2026-08-04
- P1 scope completed:
  - T1: Rust plugin permission whitelist accepts `music`; unknown permissions still fail.
  - T2: Frontend SDK permission type, plugin template type declarations, and plugin documentation reserve `music`.
  - T3: Plugin unload now runs `sdk.lifecycle.onDispose()` callbacks, then optional module `teardown()`, then clears registrations/listeners/loaded state.
- Verification:
  - `cd src-tauri && cargo test plugins` passed.
  - `npm run build` passed.
  - `cd scripts/plugin-template && npm run build` passed.
- Stage 3 Plan Execution: P2 completed at 2026-08-04
- P2 scope completed:
  - T4: Rust music backend dependencies added. `reqwest 0.12` resolved successfully alongside transitive dependencies; a direct minimal `tokio` dependency was added for axum proxy TCP listening and login polling.
  - T5: `tauri-plugin-store` registered in the Tauri builder.
  - T6: `core::music` module and shared music data models added.
  - T7: NetEase cookie parsing, normalization, login-cookie detection, local `music-cookies.json` storage helpers, and unit tests added.
  - T8: Read-only NetEase client added for search, login status, user playlists, playlist tracks/range, song URL fallback, and lyrics.
  - T9: Official login WebView command added; it polls WebView cookies, stores `MUSIC_U` cookies, validates login status, and emits `music:login-success` / `music:login-failed`.
  - T10: Local `127.0.0.1` audio/cover proxy added with http/https validation, Range forwarding, CORS/CORP headers, and streaming response bodies.
  - T11: Tauri music commands registered for login, search, playlists, song URL, lyrics, and proxy port.
- Verification:
  - `cd src-tauri && cargo check` passed.
  - `cd src-tauri && cargo test music` passed.
  - `npm run build` passed.
- Stage 3 Plan Execution: P3 completed at 2026-08-04
- P3 scope completed:
  - T12: Frontend music types added in `src/plugins/music-types.ts` and synchronized to plugin template declarations.
  - T13: `sdk.music` added to `PluginSdk`; all methods enforce `music` permission and map to Tauri music commands or local proxy URL helpers.
  - T14: Plugin development documentation now describes the `music` permission, lifecycle cleanup, music SDK calls, trial snippets, and no account-write/no bypass restrictions.
- Verification:
  - `npm run build` passed.
  - `cd scripts/plugin-template && npm run build` passed.
- Stage 3 Plan Execution: P4 completed at 2026-08-04
- P4 scope completed:
  - T15: Official NetEase music plugin project added under `scripts/official-plugins/netease-music`.
  - T16: Module-level `Audio` runtime added with subscriptions, state updates, queue, playback mode, volume, quality, and disposal.
  - T17: Login/status/logout and user playlist loading wired through `sdk.music`.
  - T18: Search, playlist loading, and paged playlist track loading implemented.
  - T19: Queue playback implemented through `sdk.music.songUrl()` and local audio proxy helpers; trial snippets are marked, unavailable tracks are prompted/skipped without bypass logic.
  - T20: LRC and translated lyric parsing plus active-line calculation added.
  - T21: Three-column player UI added for account/playlists, search/tracks, player/lyrics/queue.
  - T22: `npm run pack` copies `manifest.json` and `bundle.js` to `plugins/com.easygamehub.netease-music` and `resources/defaults/plugins/com.easygamehub.netease-music`.
  - T23: Built-in plugin startup sync added in Rust; default plugins install/update from resources, keep disabled records disabled, and preserve `config.json`.
- Verification:
  - `cd scripts/official-plugins/netease-music && npm install` passed with one moderate esbuild audit warning.
  - `cd scripts/official-plugins/netease-music && npm run build` passed.
  - `cd scripts/official-plugins/netease-music && npm run pack` passed.
  - Official bundle imports only from `"sdk"`.
  - `cd src-tauri && cargo test plugins` passed.
  - `cd src-tauri && cargo check` passed.
  - `npm run build` passed.
- Active stage: Stage 3 P5 not started.

## Current Workflow Request
- Topic: 插件系统（plugin system）
- Stage 1 Requirement Exploration: Completed at 2026-08-04（设计经 grill-me 访谈逐项确认）
- Design doc: docs/superpowers/specs/2026-08-04-plugin-system-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-04
- Plan doc: docs/superpowers/plans/2026-08-04-plugin-system-plan.md
- Stage 3 Plan Execution: P1 已完成（T1-T11，2026-08-04）
  - 验证：cargo test 35 passed、cargo check、npm run build（含 sdk lib 构建）、dev 服务器 SDK 模块 200
  - 待人工验收：npm run tauri dev → 设置→插件 → 安装 C:\Users\JT\AppData\Local\Temp\opencode\hello-plugin.zip → 检查加载/启停/错误展示
- Active stage: Stage 3 P2（等待 P1 人工验收；P2 已实现并自动化验证）

### P3 完成情况（T17-T20，2026-08-04）
- T17 `scripts/plugin-template/`：package.json（esbuild `--bundle --format=esm --external:sdk --jsx=transform`）、src/index.tsx（registerSettingsSection + registerPage + events.on + storage 读写示例）、tsconfig.json、README.md（构建 → 打包 → 安装三步）、manifest.json、sdk.d.ts/types.ts（类型镜像）
  - 前置：sdk.ts 增加 **default export**（React 表面）——设计 3.1 要求 `import React from "sdk"` 经典转换写法，原 SDK 无默认导出
  - verify：`npm install && npm run build` → dist/bundle.js 2.7kb，仅 `from "sdk"` ✓
- T18 `scripts/examples/webdav-backup/`：`backup:completed` → `core.listSnapshots` 最新快照（已按时间降序，[0] 即最新）→ `fetch` PUT 快照元数据 JSON 到配置 URL；设置区块 URL/用户名/密码（storage 持久化，Basic Auth）；附带 `mock-dav.mjs` 本地 mock 服务（PUT/GET/OPTIONS + CORS，`node mock-dav.mjs [port]`）
  - verify：build 3.3kb 仅 `from "sdk"` ✓；mock 冒烟 PUT/GET/CORS 正常；**端到端验收跳过**（用户指示）
- T19 `scripts/examples/stats-page/`：registerPage 侧边栏页面「备份统计」（icon chart），`core.listGames()` + `core.listSnapshots(id)` 汇总（游戏数/快照总数/总占用/最近备份 + 逐游戏明细表）
  - verify：build 3.1kb 仅 `from "sdk"` ✓
- T20 `docs/plugin-development.md`（SDK API 参考/manifest 规范/权限表/打包步骤/限制）+ progress.md 更新
- 三个 zip 均已打包并验证（zipfile 校验 valid，条目 = manifest.json + bundle.js 在 zip 根）：
  - `scripts/plugin-template/plugin-template.zip`
  - `scripts/examples/webdav-backup/webdav-backup.zip`
  - `scripts/examples/stats-page/stats-page.zip`

### P3 执行中发现的偏差（相对计划文档，已修正）
11. **sdk.ts 无 default export**：设计 3.1 的模板写法 `import React from "sdk"` 需要默认导出 → sdk.ts 补 React 表面 default export（不影响命名导出/既有加载器）
12. **打包工具坑**：GNU tar `-a` 不支持 zip 格式（产出伪 zip 头）；Compress-Archive 保留 `dist/` 层级破坏入口白名单 → 实际打包用 Python zipfile（arcname 打平到 zip 根），README 统一用 Windows 自带 bsdtar `tar -a -cf` 并在 dist 目录内执行（示例已按此打包验证）
13. T18 mock dav 冒烟通过后端到端实测按用户指示跳过（验收待补）

### P2 完成情况（T12-T16，2026-08-04）
- T12 `backup:started`：core/backup.rs `run_single_task` 开头 emit；`backup:failed` 两条失败路径已有，保持现状
- T13 sdk.core/storage/notify：P1 已实现（命令名/参数核对无误：get_games、get_game_by_id(gameId)、get_snapshots(gameId)、backup_now(gameId, note?)）
- T14 `src/plugins/events.ts`：本地 Emitter + Tauri 适配（listen backup:started/completed/failed 转发同总线）；sdk.events 接入（onForPlugin 按插件绑定，unload 时 removePluginListeners）；game:added/game:removed 发射点 = AddGameDialog 三处 add + GameList handleRemoveConfirm
- T15 App.tsx `useRoutes` 动态合并插件路由 `/plugin/:id/:page`（PluginPage + ErrorBoundary），Layout 侧边栏 SidebarMenu 后追加插件导航区块
- T16 PluginManagerSection 每插件渲染 settingsSections（ErrorBoundary 包裹）
- 新增 `src/plugins/ErrorBoundary.tsx`（设计 3.7 防御隔离的必要实现）

### P2 执行中发现的偏差（相对计划文档，已修正）
7. **lib.rs 事件名统一问题（设计 3.5 的正确实现所需）**：event_cb 原先把 backup:started/failed/queue_changed 全部 emit 为 `backup:completed`（payload.event 区分）。按设计 3.5 改为 `emit(event, payload)` 独立事件名；连带 Toast.tsx 补 `listen("backup:failed")`（原失败 toast 逻辑在 backup:completed 内检查 payload.event，拆分后失效）
8. **SDK 产物打包了 @tauri-apps/api**（invoke/listen 内联进 plugin-sdk.js）：vite.sdk.config.ts 仅 external react/react-dom。若把 tauri api 也 external，import map 需指向哈希化 chunk（react 覆辙），故维持打包 —— 走全局 `__TAURI_INTERNALS__` 契约，webview 内功能正确，仅少量重复体积
9. 测试插件 bundle.js 的 sdk 须为模块级变量（setup 参数非闭包可见），已修正
10. **回归修复**：T15 重写 App.tsx 时误删 `ActiveThemeProvider`/`GlobalThemeStyle`/`GlobalAppearanceStyle` 包裹层 → 外观/主题设置失效；已恢复为 `useRoutes` 外层包裹（构建通过，待用户确认恢复生效）

### Review/执行中发现并修正的偏差（相对计划文档）
1. 计划 T2「id 冲突拒绝」与设计 3.8「同 id 覆盖=更新」矛盾 → 按设计执行：install_plugin 同 id 原子覆盖
2. 前端需 plugins_dir 绝对路径（convertFileSrc）→ get_plugin_registry 返回 DTO 附加 plugins_dir 字段
3. loader 需 entry/permissions → PluginRecord 持久化这两个字段（安装时写入）
4. 构建方案修正（计划 T7 原案产物导出名被压缩器改写 + react 双实例问题）：
   - 应用构建单入口 + manualChunks 固定 react chunk 为 react.js
   - SDK 改为独立 lib 构建（vite.sdk.config.ts）→ dist/plugin-sdk.js 保留导出名
   - import map prod 分支增加 react / react-dom 指向 /react.js
   - package.json build 追加 `vite build --config vite.sdk.config.ts`
5. 全量测试暴露 tempdir 并行竞争（共享目录）→ 每测试唯一目录（线程名）
6. P2 补充：插件页面渲染需 ErrorBoundary（设计防御隔离意图的必要实现）

---

## 历史记录（2026-07）

## Stage 1 Requirement Exploration
- Completed at: 2026-07-23
- Design doc: docs/superpowers/specs/2026-07-23-easygamehub-design.md

## Stage 2 Implementation Planning
- Phase 1 plan: docs/superpowers/plans/2026-07-23-easygamehub-plan.md
- Phase 2 plan: docs/superpowers/plans/2026-07-23-easygamehub-phase2-plan.md

## Stage 3 Plan Execution
- Phase 1: Completed 2026-07-23 (24 tasks A-G)
- Phase 2: Completed 2026-07-23 (18 tasks H-L)

## Stage 4 Test-Driven Validation
- Not started (user declined)

## Stage 5 Browser Verification
- Not started (user declined)

## Current Workflow Request
- Topic: launcher / game list / steam inventory view settings system
- Stage 1 Requirement Exploration: Completed at 2026-07-26
- Design doc: docs/superpowers/specs/2026-07-26-view-settings-design.md
- Stage 2 Implementation Planning: Completed at 2026-07-26
- Plan doc: docs/superpowers/plans/2026-07-26-view-settings-plan.md
- Active stage: Stage 3 Plan Execution
- Current progress: Group A completed and verified (`cargo check`, `cargo test view_settings -- --nocapture`); Group B completed and verified (`npx tsc --noEmit`); Group C completed and verified (`npx tsc --noEmit`)
- Group D status: partially started, then stopped at user request after the user reverted their version
- Additional fix applied during Group A verification: updated existing `src-tauri/src/core/scanner.rs` test fixtures to include the required `popular` field so the planned Rust test command could run
- Current state: development paused by user request; do not continue unless explicitly resumed
