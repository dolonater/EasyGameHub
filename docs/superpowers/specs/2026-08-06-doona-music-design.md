# Doona Music 独立网易云播放器设计文档

> 创建日期：2026-08-06
> 状态：Stage 1 设计文档，待批准
> 前置调研：grill-me 访谈 13 轮结论；现有 `scripts/official-plugins/netease-music/` 插件；宿主 `src-tauri/src/core/music/` 与 `src/components/ui/`
> 对应既存设计：`2026-08-04-netease-music-plugin-design.md`、`2026-08-05-netease-in-page-login-design.md`

## 1. 背景与目标

EasyGameHub 内置的网易云音乐插件已具备完整播放器能力：六视图浏览、三态播放器、QR/手机号登录、歌词、缓存管理、喜欢列表。当前插件强依赖宿主运行时（`sdk` 外部依赖、宿主 Rust 音乐命令、宿主 UI 组件与图标库、宿主主题系统）。

本设计将网易云播放器从插件形态改造成**独立桌面软件 Doona Music**：脱离 EasyGameHub，单独构建、单独发布，仍可保持能力 1:1。

目标：

- 独立运行、独立安装（NSIS）、独立数据目录，不受宿主升级影响。
- 播放器功能 1:1 迁移，不砍功能、不加失控新功能。
- 视觉语言继承宿主 UI 库与图标库，主题由固定静态 CSS 变量提供，不接宿主动态主题系统。
- Rust 音乐核心（weapi 加密、登录、代理、cookie）零逻辑重写，整体 vendored。
- 支持托盘常驻：关窗最小化到托盘，音乐继续播放。

## 2. 范围定义

### 2.1 纳入范围

| 能力 | 说明 |
| --- | --- |
| 独立工程 | 新目录 `D:\apps\appss\ws\ets2\doona-music\`，独立 git 仓库，`create-tauri-app`（Vite + React-TS）起步 |
| 产品标识 | 产品名 Doona Music，identifier `com.doona.music`，打包目标仅 NSIS，无自动更新 |
| 后端 | vendored `core/music/` 六模块（netease/weapi/login/cookie/proxy/models）+ 新增 setup 层拉起代理与注册命令 |
| 前端 | B1 轻重构：真实 React 18 + TS，view 状态机与 runtime 订阅模式沿用，不引入 react-router/状态库 |
| UI | vendored 宿主 `src/components/ui/` 通用组件 + `lib/icons.ts` + 相关 hooks + Tailwind 配置 + 静态主题变量基座 |
| 浏览 | 首页、发现、我的歌单/榜单/发现歌单、歌单分页、搜索四 tab、专辑/歌手详情、每日推荐、最近播放 |
| 播放 | 播放栏、展开播放器、迷你播放器、音质/播放模式/音量、封面主题色提取 |
| 登录 | QR + 手机验证码 + 登录轮询 + 喜欢列表 |
| 歌词 | LRC + 翻译、字号、纯音乐识别 |
| 缓存 | 歌单/封面/媒体详情 持久化缓存、统计与清理、上次播放位置恢复 |
| 窗口形态 | 单主窗口 + 系统托盘常驻，关窗最小化；托盘菜单（播放/暂停、上一首/下一首、显示窗口） |
| 发布 | NSIS 安装包，手动覆盖升级 |

### 2.2 不纳入范围

- 自动更新（updater）。
- 多窗口形态（迷你播放器独立小窗）、系统媒体键/SMTC。
- react-router、全局状态库（zustand/Redux）。
- 动态主题编辑器、明暗切换之外的宿主主题系统对接。
- i18n 框架（文案保持硬编码中文，i18n 后置）。
- 破解、灰歌解锁、VIP 绕过、替代音源搜索。

## 3. 关键设计决策

### 3.1 代码复用方式：vendored，不引用

`core/backend` 六个模块与 UI 组件、图标库全部以**复制**方式进入新工程，不使用 workspace member、git submodule 或路径引用。理由：独立构建、低耦合、手动频率高的同步点低。同步策略为"改动后手动反向同步"。

### 3.2 前端改造级别：B1 轻重构

复用插件的：

- `src/runtime.ts`（插件原文件）：单一运行时类 + `Set<Listener>` 订阅模式、`getState/setState`、播放器音频绑定逻辑。
- `src/views/…`：view 状态机（`mainView` / `libraryView` / `searchTab` 等）。

改动范围：

- `sdk` 外部依赖 → 真实 React 18 + 本地 UI 组件库。
- `sdk.music.*` → `invoke('music_*', …)` 命令层封装。
- `sdk.storage` → tauri-plugin-store（本地 JSON）。
- `sdk.ui.notify` → 复用本地 `toast`（`lib/toast` 的 `showToast` + `Toast` 组件）。
- `sdk.lifecycle.onDispose` → 组件卸载/窗口退出清理。
- 不引入 react-router：单页播放器的"视图切换"本质是状态机，路由是负资产。

### 3.3 UI 继承：全量 vendored 通用组件

把宿主 `src/components/ui/` 通用控件整体拷贝（Button、Dialog、TextField、Select、Slider、Toggle、Icon、Toast、GlassSurface、GlassCard、TabButtons、SearchInput、Checkbox、ContextMenu、FormCard、CoverImage、FloatingGlass… 剔除游戏业务专用件：GameCard/GameBannerCard/SidebarMenu/StatCard/ThemeLibraryTile/ThemeToggle/ColorSwatch/AccountCard 等），配套 `lib/icons.ts`、`hooks/useAnimation`、`useCountUp`、Tailwind 配置与 `index.css` 变量基座。**宿主主题由一组写死的静态 CSS 变量接管**，不接宿主主题加载逻辑。

### 3.4 后端适配点

| 宿主绑定 | 独立后的处理 |
| --- | --- |
| `app.path().app_data_dir()` | 搬入后自动指向新应用数据目录，无需改动 |
| `login.rs` WebviewWindow 登录窗 | 标准 Tauri API，直接可用 |
| `proxy.rs` OnceLock + 随机端口 | 完全独立，零改动复用 |
| cookie 持久化 | 自动落到新应用数据目录 `music-cookies.json` |
| 命令注册 | 新增 `commands/` 层照搬 `commands/music.rs`，在 `lib.rs` `generate_handler!` 注册 |
| 代理拉起 | 新增 setup 层在启动时 `start_proxy()`（或懒加载 `music_proxy_port`） |
| CSP | 放行 `media-src http://127.0.0.1:*`、`img-src http://127.0.0.1:*` |
| 托盘 | 注册托盘 + 关窗事件（`on_window_event` 拦截 `CloseRequested`，托盘菜单事件转发给前端） |

### 3.5 目录结构

```
doona-music/
├─ src/                        # 前端
│  ├─ main.tsx, App.tsx        # 入口与壳
│  ├─ components/ui/           # vendored 宿主通用组件（剪裁后）
│  ├─ lib/                     # icons.ts、toast、types 等 vendored + 新代码
│  ├─ hooks/                   # useAnimation 等 vendored hooks
│  ├─ netease/                 # 播放器模块（runtime.ts 改造 + index.tsx 拆分，含 views/components/helpers）
│  ├─ styles/                  # 静态主题变量基座 + 播放器 CSS
│  └─ vite-env.d.ts
├─ src-tauri/
│  ├─ src/
│  │  ├─ lib.rs                # 初始化、命令注册、托盘、代理拉起
│  │  ├─ commands.rs (music)   # 命令边界（照搬）
│  │  └─ core/                 # vendored 音乐核心六模块 + setup
│  └─ tauri.conf.json          # productName Doona Music, nsis, CSP
└─ package.json, tsconfig.json, tailwind.config.ts, ...
```

## 4. 关键技术细节与备忘

- `ICONS[name]` 为 SVG 字符串，`Icon` 组件 `dangerouslySetInnerHTML`；UUID host-specific 图标（`steamLogo`, `gameController`…）不在音乐页面使用，但为保持 `IconName` 类型完整，保留 `icons.ts` 全套。
- 宿主 UI 组件大量使用 Tailwind token（`hsl(var(--primary))` 等），静态变量基座在 `index.css` 中声明 `--primary`、`--background`、`--card` 等全部色板，Tailwind 配置照搬 `tailwind.config.*`。
- 播放器自身样式 `styles.ts` 中所有 `var(--xxx, fallback)` 均带 fallback，不依赖宿主变量即可自洽，搬入后无需改动。
- runtime 的 `storage` 对象体积可能较大（持久化缓存），使用 store 需评估 JSON 大小；数据量大时可拆分文件，MVP 直接全量 store。
- 登录轮询依赖 `setInterval` + 事件 `music:login-success`，`tauri-plugin-store` 无事件，前端用 `listen` 订阅命令自己 emit 的事件。

## 5. 里程碑与验证

| 阶段 | 内容 | 验证点 |
| --- | --- | --- |
| P0 | create-tauri-app 骨架 + git init | `npm run dev` / `cargo check` |
| P1 | Rust 核心跟搬 + commands + setup + 托盘 | `cargo test music && cargo check` |
| P2 | UI 库 + 图标 + hooks + Tailwind + 静态主题；改 import 路径 | `npm run build` |
| P3 | runtime 改造（invoke/store/toast）+ index.tsx 拆分（B1） | `npm run build`；`npm run tauri dev` 冒烟 |
| P4 | 托盘常驻 + 关窗拦截 + CSP + productName/identifier/nsis | `npm run tauri build`；动态冒烟清单 |
| P5 | 手工冒烟清单（真实网易云账号） | 见第 6 节 |

## 6. 手工冒烟清单（P5）

1. QR 登录、手机验证码登录。
2. 搜索四 tab（单曲/歌单/专辑/歌手）。
3. 歌单分页（滚动加载 50 条 + 加载更多）。
4. 播放/暂停/下一首/上一首/播放模式/音量。
5. 歌词 + 翻译、封面主题色切换。
6. 喜欢/取消喜欢。
7. 展开播放器、迷你播放器。
8. 缓存恢复：重启后上次播放位置与队列恢复。
9. 托盘：关窗继续播、托盘菜单控制、重新显示窗口。
10. 音质设置、无版权试听片段标记。

## 7. 风险与对策

| 风险 | 对策 |
| --- | --- |
| 迁移后播放器功能回归 | 每阶段独立验证 + P5 冒烟清单 |
| SDK 行为不匹配（notify/storage 等语义） | 在 setup 层写死行为对齐表并测 |
| CSP 拦截代理 | 提前在 tauri.conf.json 配好 `http://127.0.0.1:*` |
| 大 JSON store 性能 | 评估后决定是否拆分，MVP 先不拆 |
| 宿主 UI 依赖缺失（类型/hooks） | 按依赖图逐项 vendored，缺失时人工补全 |