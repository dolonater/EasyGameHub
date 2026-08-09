# AGENTS.md

本文件面向在本仓库中工作的 AI 编程代理。修改代码前先读本文件，并优先遵守更深层目录中可能存在的 `AGENTS.md`。

## 项目概览

`EasyGameHub` 是一个 Windows 优先的桌面应用。主体是 React + Vite 前端和 Tauri 2 / Rust 后端，用于游戏存档备份、恢复、运行状态监控、Steam 本地数据集成、截图/游玩时长管理、主题/外观配置和插件扩展。

主要技术栈：

- 前端：React 18、TypeScript、Vite、Tailwind CSS、styled-components、react-router-dom、i18next。
- 桌面后端：Tauri 2、Rust 2021、serde/serde_json、zip、notify、sysinfo、reqwest/ureq、axum、steamlocate、windows-sys。
- 工作区：根 `Cargo.toml` 包含 `src-tauri` 和 `steam-sdk` 两个 Rust member。
- 插件：宿主内 Webview JS 模块，zip 安装，入口为 `manifest.json` + `bundle.js`，SDK 通过 `"sdk"` 外部依赖暴露。

## 目录边界

- `src/`：主前端源码。
  - `src/App.tsx`：路由和 Provider 组合入口。
  - `src/pages/`：页面级视图，包含 Dashboard、游戏列表/详情、设置、截图、Steam 相关页面等。
  - `src/components/`：业务组件和基础 UI 组件。
  - `src/components/ui/`：可复用 UI 原语，新增通用控件优先放这里。
  - `src/hooks/`：跨页面状态、主题、外观、路由缓存、动画、Steam 数据懒加载等 hooks。
  - `src/lib/`：类型、格式化、图标、主题、Steam 路径和纯工具函数。
  - `src/plugins/`：插件类型、SDK、加载器、注册表、Provider、事件和错误边界。
- `src-tauri/`：Tauri/Rust 后端。
  - `src-tauri/src/lib.rs`：应用初始化、共享 `AppState`、托盘、事件桥接、命令注册。
  - `src-tauri/src/commands/`：Tauri command 层。负责参数/返回值边界、状态读取和错误字符串转换。
  - `src-tauri/src/core/`：业务核心逻辑，如备份、恢复、扫描、数据库、主题、插件、Steam 云、音乐代理、调度器、文件监听。
  - `src-tauri/src/traits/`：平台和存储抽象。
  - `src-tauri/capabilities/`：Tauri 权限配置。
- `steam-sdk/`：本地 Steam 能力封装。改 Steam 深层逻辑时先确认这里是否已有实现。
- `scripts/`：插件模板、官方插件、示例插件和转换脚本。
- `resources/defaults/`：打包时随应用分发的默认数据和内置插件资源。
- `docs/`：设计文档和历史方案，插件或主题相关改动要先参考这里。
- `public/`、`assets/`、`icons/`、`ico/`：静态资源。
- `plugins/`：开发期/运行期插件样例和注册数据。
- `data/`、根目录 `*.json`：开发期默认/运行时数据文件，修改前确认是否应同步到 `resources/defaults/`。

不要把以下目录当作源码修改目标：`node_modules/`、`dist/`、`target/`、`.vite/`、`cache/`、`backups/`、`bak/`、压缩包产物、安装器产物。`SJMCL/`、`SteamTools/`、`WinNative/`、`animotion/` 是旁支/外部项目目录，除非任务明确指向它们，否则不要改。

## 常用命令

在仓库根目录执行：

```powershell
npm install
npm run dev
npm run build
npm run preview
npm run tauri dev
npm run tauri build
cargo check
cargo test
cargo fmt
```

说明：

- Vite dev server 固定使用 `1420` 端口，见 `vite.config.ts` 和 `src-tauri/tauri.conf.json`。
- `npm run build` 会执行 `tsc && vite build && vite build --config vite.sdk.config.ts`，同时构建主前端和插件 SDK 产物。
- 根目录没有独立 lint 脚本；TypeScript 检查以 `npm run build` 中的 `tsc` 为准。
- 插件模板构建在对应目录执行，例如 `scripts/plugin-template` 或 `scripts/official-plugins/netease-music` 下的 `npm run build`。

## UTF-8 与中文文件处理最高优先级规则

本节优先级极高，适用于所有涉及中文文件、脚本和文档的读写操作，并与上方事故复盘规则同级执行。

- 所有文件读写默认使用 UTF-8 编码，修改文件时不得改变原有编码、换行风格和无关内容。
- 在 PowerShell 中读取含中文文件前，先执行 `chcp 65001`，并设置：
  - `[Console]::OutputEncoding = [System.Text.Encoding]::UTF8`
  - `$OutputEncoding = [System.Text.Encoding]::UTF8`
- 读取含中文文件时优先使用 `Get-Content -Raw -Encoding UTF8`。
- 禁止用 PowerShell 的 here-string 管道、重定向、`Set-Content`、`Out-File` 写入含中文源码、JSON 或文档。
- 不要用 `sed`、`awk` 处理含中文文件，改用 Python 或 Node.js。
- 使用 Python 或 Node.js 脚本处理中文文件时，必须显式以 UTF-8 读写。
- 代码注释使用中文。
- 不要为了修编码而整文件重写、全文件格式化或全文件字符串替换。

## 编码与文本

- 新增/修改源码和文档默认使用 UTF-8。
- 仓库中已有部分中文文件或注释在某些终端显示为乱码；改动时不要扩大乱码范围。遇到乱码文本，先判断原文件编码和实际含义，再做最小修复。
- 用户可见文案优先通过 `src/i18n/` 管理；临时 `defaultValue` 可以使用，但不要把大段 UI 文案散落在组件里。
- 代码注释要短，只解释不明显的业务约束或边界条件。

## 前端规范

- 遵循现有 React 函数组件、hooks 和 TypeScript 类型风格。
- 页面级数据优先通过 `useAppData()`、主题/外观 hooks、插件 Provider 等既有上下文获取；不要在每个页面重复全局状态加载。
- Tauri 调用使用 `@tauri-apps/api/core` 的 `invoke`，命令名必须和 `src-tauri/src/lib.rs` 中注册的 command 保持一致。
- 新增可复用控件优先使用或扩展 `src/components/ui/` 中的 Button、Dialog、Toggle、TextField、Select、GlassCard、Icon 等。
- UI 风格应延续当前“游戏工具 + 玻璃/主题系统”的视觉语言：使用 CSS 变量、Tailwind token、`app-surface` / `app-glass-button` / `Glass*` 组件等已有约定。
- 图标优先走 `src/lib/icons.ts` 和 `Icon` 组件；不要随意内联 SVG。
- 交互状态要覆盖 loading、empty、error/permission denied、disabled 等常见分支。
- Steam 本地库扫描可能较重，应保持懒加载模式，不要塞进全局 30 秒刷新里。
- 动画、外观、圆角、背景模糊等效果应尊重 `Config.appearance` 和动画开关。

## Rust/Tauri 规范

- `commands/` 负责 Tauri 边界，`core/` 负责业务逻辑。新增功能时优先保持这个分层。
- command 返回类型通常为 `Result<T, String>`，内部错误在边界处用 `map_err(|e| e.to_string())?` 转换。
- 共享路径、队列、watcher、scheduler、process manager 放在 `AppState`，不要散落全局 mutable state。
- 文件读写使用 serde 结构体和 pretty JSON，避免手写 JSON 字符串。
- 修改游戏库、用户游戏、主题、视图设置、插件注册表等数据时，确认对应 load/save helper 是否已经存在。
- 备份、恢复、监听、调度、进程监控和 Steam 同步可能涉及文件系统或后台线程，改动后要注意并发、锁范围和 UI 事件通知。
- 新增 Tauri command 后必须同时：
  - 放到合适的 `src-tauri/src/commands/*.rs`。
  - 在 `src-tauri/src/commands/mod.rs` 暴露模块。
  - 在 `src-tauri/src/lib.rs` 的 `tauri::generate_handler!` 注册。
  - 在前端用匹配的 camelCase 参数名调用。
- Rust 代码提交前运行 `cargo fmt`；涉及后端逻辑时至少运行 `cargo check`，有测试时运行相关 `cargo test`。

## 数据与资源

- 开发模式下，`src-tauri/src/lib.rs` 会把项目根目录作为数据目录，把 `resources/defaults` 作为默认资源目录。
- Release 模式下，运行时数据位于应用数据目录，默认资源来自 Tauri resource dir。
- 若修改默认配置、内置主题、默认游戏库、内置插件，通常需要同步 `resources/defaults/...`，并确认根目录开发期文件是否也要同步。
- `games.db.json` 是完整库，`games_index.json` 是快速查找索引；数据库更新后应显式重建索引，不要在普通读取路径反复解析大文件。
- 用户数据文件包括 `config.json`、`custom_games.json`、`user_games.json`、`themes.json`、`view-settings.json`、`hidden_games.json` 等。不要在不必要时重排或清空用户数据。
- 备份目录和缓存目录可能包含真实用户文件或较大二进制，默认不要读取、重写或删除。

## 插件系统规范

插件相关实现优先参考：

- `docs/plugin-development.md`
- `docs/superpowers/specs/2026-08-04-plugin-system-design.md`
- `src/plugins/`
- `src-tauri/src/core/plugins.rs`
- `scripts/plugin-template/`
- `scripts/examples/`
- `scripts/official-plugins/netease-music/`

插件包规则：

- zip 根目录直接包含 `manifest.json` 和 `bundle.js`，可选 `assets/`。
- `manifest.id` 使用反向域名风格；同 id 安装视为覆盖更新。
- `api_version` 大于宿主 SDK 当前版本时应拒绝加载。
- 插件 JS 构建为 ESM 单文件，`sdk` 必须 external，不要直接 bundle React。
- 权限控制必须经过 SDK 白名单，不要给插件直接文件系统或破坏性宿主 API。
- 卸载、禁用、重载插件时要执行生命周期清理，移除页面、设置区块和事件监听。

## 主题与外观规范

主题/外观相关实现优先参考：

- `docs/theme-system-design.md`
- `docs/liquid-glass-components-design.md`
- `src/hooks/useThemeData.tsx`
- `src/hooks/useAppearance.tsx`
- `src/components/ThemeEditor.tsx`
- `src/lib/types.ts`

注意：

- 主题变量使用 HSL 字符串并映射到 CSS custom properties。
- 明暗模式由 `theme_mode` 和 `<html>.dark` 协作，避免另起一套主题状态。
- 圆角、背景图、模糊、透明度属于 appearance，不要混入主题对象。
- 页面绑定、全局默认和系统默认 fallback 逻辑要保持稳定。

## 验证清单

根据改动范围选择验证：

- 仅文档：检查 Markdown 可读性和路径/命令准确性。
- 前端组件/页面：运行 `npm run build`；有界面改动时启动 `npm run dev` 或 `npm run tauri dev` 并人工/浏览器验证关键页面。
- Rust/Tauri：运行 `cargo fmt`、`cargo check`，必要时运行 `cargo test`。
- 插件：在插件目录运行 `npm run build`，必要时打包 zip 并通过设置页安装验证。
- 默认资源/数据：确认开发期文件和 `resources/defaults` 是否都需要更新，并测试首次启动或重置路径。

## 工作习惯

- 开始前先用 `rg --files`、`rg "<symbol>"` 查找现有实现，避免重复造轮子。
- 保持小范围修改；不要顺手重构旁支目录、构建产物或用户数据。
- 不要执行破坏性命令或批量删除用户文件。
- 这个目录当前可能不是 git 仓库；不要假设可以用 git 回滚。
- 修改涉及真实存档、Steam 账户、鉴权、更新器、下载器、插件安装或文件删除时，要优先保护用户数据和可恢复性。
- 结果说明里写清楚改了哪些文件、跑了哪些验证、哪些验证未跑。
