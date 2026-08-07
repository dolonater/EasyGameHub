# 插件系统实施计划

> 创建日期：2026-08-04  
> 前置：`docs/superpowers/specs/2026-08-04-plugin-system-design.md`（Stage 1 已批准）  
> 验证命令基线：`cargo test`（src-tauri 目录）、`cargo check`（src-tauri 目录）、`npm run build`（根目录）、`npm run tauri dev`（根目录）

---

## P1 骨架：Rust 插件基座 + SDK 装载器 + 管理页

### T1 新建 `src-tauri/src/core/plugins.rs`（纯逻辑层）

内容：

- `PluginManifest { id, name, version, api_version, entry, permissions }`（serde derive，字段齐全即 fail）
- `parse_manifest(bytes: &[u8]) -> Result<PluginManifest, PluginError>`：JSON 解析 + 字段校验（id 正则 `^[a-z0-9.][a-z0-9.-]*$`、name 1-40 字符、version 非空、api_version ≥ 1、entry 必须以 `bundle.js` 结尾）
- `PluginRegistry { plugins: Vec<PluginRecord> }`，`PluginRecord { id, name, version, api_version, enabled, installed_at, last_error, error_count }`；`load_registry(path) / save_registry(path)`（参照 `core/db.rs:120-134` 的 load/save JSON 模式，文件不存在返回空 registry）
- `is_supported(api_version, max_api_version) -> bool`（≤ max）
- `#[cfg(test)]` 单测：合法 manifest 通过；缺字段/非法 id/非法 entry/低 api_version 拒绝；registry load/save 往返一致

> verify: `cargo test plugins`（src-tauri 下）

### T2 `core/plugins.rs` 追加 `extract_plugin_zip`

- `extract_plugin_zip(zip_path, plugins_dir) -> Result<PluginManifest, PluginError>`
- 防护：每个条目路径规范化后必须落在 `plugins_dir/<id>/` 内（拒绝 `..`、绝对路径、盘符）；单条目 ≤ 50MB、总条目 ≤ 30 个；只解压 `manifest.json`、`bundle.js`、`assets/*`
- 解压后读取 manifest 校验，`plugins_dir/<id>` 已存在 → 报 id 冲突错误
- 单测：构造 zip-slip 样本（`../evil.js`、`C:/evil.js`）断言拒绝；正常 zip 解压成功且 manifest 一致

> verify: `cargo test plugins`

### T3 注册模块

- `src-tauri/src/core/mod.rs`：追加 `pub mod plugins;`
- `src-tauri/src/commands/mod.rs`：追加 `pub mod plugins;`

> verify: `cargo check`

### T4 新建 `src-tauri/src/commands/plugins.rs`（薄层）

命令（全部薄封装，业务在 core）：

- `install_plugin(path: String)`：调 `extract_plugin_zip`，成功后向 registry 追加 `PluginRecord`（enabled: true）并 save
- `uninstall_plugin(id: String)`：从 registry 移除 + 删除 `plugins/<id>/` 目录
- `get_plugin_registry() -> PluginRegistry`
- `save_plugin_registry(registry: PluginRegistry)`（供前端错误上报/启停状态持久化）
- `read_plugin_config(id: String) -> Option<serde_json::Value>`：读 `plugins/<id>/config.json`，不存在返回 None
- `write_plugin_config(id: String, data: serde_json::Value)`：写 `plugins/<id>/config.json`；id 必须存在于 registry

> verify: `cargo check`

### T5 AppState 与命令注册（`src-tauri/src/lib.rs`）

- `AppState` 增加 `plugins_dir: PathBuf`、`plugins_registry_path: PathBuf`（见 lib.rs:18-34 现有字段模式）
- `run()` 初始化两路径（`tool_dir/plugins`、`tool_dir/plugins/plugins_registry.json`），`create_dir_all(plugins_dir)`
- `invoke_handler`（lib.rs:338 起）追加 6 个 plugins 命令

> verify: `cargo check` && `cargo test`

### T6 前端类型与命令封装

- 新建 `src/plugins/types.ts`：`PluginManifest`、`PluginRecord`、`PluginRegistry` 类型（与 Rust 结构镜像）
- 新建 `src/plugins/registry.ts`：`invoke` 封装 —— `installPlugin(path)` / `uninstallPlugin(id)` / `getRegistry()` / `saveRegistry(reg)` / `readConfig(id)` / `writeConfig(id, data)`

> verify: `npm run build`（tsc 通过）

### T7 SDK 产物与 import map

- `vite.config.ts`：`build.rollupOptions.input = { main: "index.html", sdk: "src/plugins/sdk.ts" }`；`entryFileNames` 对 sdk 固定为 `plugin-sdk.js`（chunk.name === "sdk" 分支），其余保持默认
- `index.html`：内联 `<script>` 按 `location.protocol === "http:"` 注入 import map —— dev 指向 `/src/plugins/sdk.ts`，prod 指向 `/plugin-sdk.js`（map 键 `"sdk"`）

> verify: `npm run build` 后 `dist/plugin-sdk.js` 存在且为 ESM；dev 下 `http://localhost:1420/src/plugins/sdk.ts` 可访问

### T8 新建 `src/plugins/sdk.ts`（模块骨架）

- `export const apiVersion = 1`；`export const sdk = { apiVersion, core, events, ui, storage, log }`（core/events/storage 先置占位实现，P2 填充）
- React 重导出：`export { createElement, Fragment, useState, useEffect, useRef, useCallback, useContext } from "react"`
- UI 收集器：模块级 `registeredPages[]`、`registeredSettingsSections[]`（registerPage/registerSettingsSection 写入；loader 卸载时清空）
- 封装组件重导出：`Button`、`TextField`、`Icon`、`Dialog`（从 `../components/ui` 引入）
- `log(...args)`：console + 可选错误上报钩子

> verify: `npm run build`

### T9 新建 `src/plugins/loader.ts`

- `loadPlugin(record, manifest)`：`convertFileSrc(plugins_dir/<id>/<entry>)` → `await import(url)`；**验证点：asset 协议模块内 `import "sdk"` 是否经文档 import map 解析**；失败即记录错误并按 T12 上报；成功调用模块导出 `setup(ctx)`（传受限 sdk）
- 受限 SDK 构造：按 manifest.permissions 白名单生成 `sdk` 代理（缺失权限 → 抛 `PermissionDenied`）
- 防御包装：模块加载、setup、以及注册的回调全部 try/catch
- `unloadPlugin(id)`：清空 UI 收集器对应条目 + 移除事件监听
- 若 import map 对 asset URL 模块不生效（验证失败）：回退方案 —— 新增 Rust 命令 `read_plugin_bundle(id) -> String`，前端 `import(URL.createObjectURL(new Blob([code])))`

> verify: `npm run build`；集成验证见 T11

### T10 插件管理页（设置页新 Tab）

- 新建 `src/components/settings/PluginManagerSection.tsx`：插件列表（名称/版本/api_version/启停开关/重载/卸载/`last_error` 红字展示）、安装按钮（`openDialog` 选 zip → `installPlugin` → 重读 registry → 加载）
- `src/pages/Settings.tsx`：`settingsTab` 状态（settings.tsx:76）追加 `"plugins"`，TabButtons options 追加「插件」，渲染 PluginManagerSection
- `src/i18n/zh.ts`、`src/i18n/en.ts` 补插件相关文案 key

> verify: `npm run build`；dev 下手工装一个最小 zip 插件（含合法 manifest + bundle.js）出现在列表并可启停

### T11 启动加载（`src/App.tsx` + 新建 `src/plugins/PluginProvider.tsx`）

- `PluginProvider`：挂载时 `getRegistry()` → 对 enabled 插件依次 `loadPlugin`；错误经 `reportPluginError`（走 `savePluginRegistry` 更新 `last_error`/`error_count`，≥3 自动置 disabled）；暴露 `usePlugins()`（pages、settingsSections、reload、setEnabled）
- `App.tsx` 用 Provider 包裹（参照 useAppData 位置，App.tsx:56）

> verify: `npm run build`；dev 启动无未捕获错误，插件管理页显示已加载插件

## P2 桥接：SDK 全量 API + UI 注入

### T12 Rust 追加 `backup:started` 事件

- `src-tauri/src/core/backup.rs`：备份队列任务开始处（参照 297 行 `cb("backup:completed", ...)` 模式）新增 `cb("backup:started", &task.game_id, &task.game_name, None, None)`
- `backup:failed` 事件：若任务报错路径已 emit，则保持现状；否则在失败分支追加

> verify: `cargo check` && `cargo test`

### T13 sdk.core / sdk.storage / sdk.ui.notify 实现（`src/plugins/sdk.ts`）

- `core.listGames()` → `invoke("get_games")`；`core.getGame(id)` → `invoke("get_game_by_id")`；`core.listSnapshots(gameId)` → `invoke("get_snapshots", { gameId })`（命令签名以 `commands/backup.rs` 为准）；`core.triggerBackup(gameId)` → `invoke("backup_now", { gameId })`；均带权限门控
- `storage.get() / storage.set(data)` → `read_plugin_config` / `write_plugin_config`，作用域按插件 id
- `ui.notify(message)` → 现有 Notification/toast 机制（`src/lib/toast.ts` 为准）

> verify: `npm run build`

### T14 sdk.events 事件总线（`src/plugins/sdk.ts` + `src/plugins/events.ts`）

- 新建 `src/plugins/events.ts`：本地 Emitter（on/off/emit）+ Tauri 事件适配（`listen("backup:started" | "backup:completed" | "backup:failed")` 转发到同一总线）
- `game:added` / `game:removed`：`AddGameDialog.tsx` 的 `addSingleGame`/`handleBatchAdd`/`handleCustomAdd` 成功后与 `remove_game` 调用点 emit 本地事件
- sdk.events.on/off 挂到总线上（绑定插件 id，unload 时统一移除）

> verify: `npm run build`；dev 下示例插件打印事件日志

### T15 动态路由与侧边栏合并

- `src/App.tsx`：`<Routes>` 改为 `useRoutes(baseRoutes.concat(pluginPages))`（App.tsx:27-42 现有路由迁入数组；插件路由 `/plugin/:id/:page`，render 取 `usePlugins().pages` 匹配）
- `src/components/Layout.tsx`：SidebarMenu 之后追加插件导航区块（`/plugin/...` 链接，样式沿用 navBtnClass/sectionClass，Layout.tsx:138-145 模式）

> verify: `npm run build`；dev 下插件页面可达、侧边栏可见

### T16 设置区块注入

- `PluginManagerSection.tsx` 内：按 `usePlugins().settingsSections` 渲染各插件配置区（启停开关旁）

> verify: `npm run build`；dev 下示例插件设置区块渲染

## P3 验证：模板工程 + 示例插件 + 文档

### T17 插件模板工程 `scripts/plugin-template/`

- `package.json`（build 脚本：esbuild `--bundle --format=esm --external:sdk --jsx=transform --outfile=dist/bundle.js`，jsxFactory 默认 React.createElement）
- `src/index.tsx`：模板插件（registerSettingsSection + registerPage + events.on + storage 读写示例）
- `tsconfig.json`、`README.md`（构建 → 打包 zip → 安装三步说明）

> verify: `npm install && npm run build` 产出 `dist/bundle.js` 且仅 `import ... from "sdk"`

### T18 WebDAV 自动上传示例 `scripts/examples/webdav-backup/`

- 基于模板；`events.on("backup:completed")` → `sdk.core.listSnapshots` 取最新快照 → `fetch` PUT 到配置 URL；设置区块含 URL/用户名/密码（storage 持久化）

> verify: 打包 zip 安装到应用 → 触发一次备份 → 目标 WebDAV 出现快照文件（本地 mock dav 服务或真实服务）

### T19 备份统计页示例 `scripts/examples/stats-page/`

- 基于模板；registerPage 侧边栏页面，`core.listGames()` + `core.listSnapshots(id)` 汇总展示（React 组件）

> verify: 安装后侧边栏出现「备份统计」页，数据与真实快照一致

### T20 文档与进度收尾

- 新建 `docs/plugin-development.md`：SDK API 参考、manifest 规范、打包步骤、权限表、限制（无阻塞钩子/无破坏性 API/防隔离说明）
- 更新 `docs/superpowers/progress.md`

> verify: 文档与 T17-T19 实际产物一致（按文档流程可复现）

---

## 回退与风险触发点

| 触发 | 处理 |
|------|------|
| T9 验证失败（asset import map 不解析 sdk） | 立即切回退方案：新增 `read_plugin_bundle` 命令 + Blob URL import，调整 T9/T11 |
| cargo test 红（zip-slip 测试） | 检查解压实现，先补测试红线再修实现（TDD） |
| dev/prod import map 路径异常 | T7 内联脚本按 `location.protocol` 分支已覆盖，验证时确认 tauri dev 的 origin 值 |
