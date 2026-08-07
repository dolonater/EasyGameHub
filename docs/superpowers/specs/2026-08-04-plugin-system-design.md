# 插件系统设计文档

> 创建日期：2026-08-04  
> 状态：Stage 1 已批准  
> 前置调研：上一轮设计访谈（grill-me）逐项确认，本文件为共识落地

---

## 1. 背景与目标

EasyGameHub 需要一套插件系统，支持**通用自动化 + 前端 UI**，让第三方能够在不改动主应用的前提下扩展能力：订阅备份事件并自动处理、读取游戏/快照数据、触发备份、提供自定义页面与设置界面、通过 HTTP 与外部服务集成（WebDAV 上传、消息推送等）。

设计目标：

- 插件以 **Webview 内 JS 模块**形式运行，复用主应用 React，UI 原生化
- 插件打包为 zip（manifest + 单文件 bundle），用户手动安装到 `plugins/` 目录
- 插件通过 **SDK allowlist** 声明权限，加载器强制拦截
- 事件模型为**纯异步**，不阻塞 Rust 备份管线
- 插件故障**防御性隔离**：错误记录、连续异常自动禁用，不拖垮主界面

---

## 2. 范围定义

### 2.1 第一版纳入范围

| 能力 | 说明 |
|------|------|
| 插件安装/卸载 | zip 包（manifest.json + bundle.js + 资源），Rust 侧校验与解压（zip-slip 防护） |
| 插件启停 | 热启停（卸载监听 + 卸载 UI），无需重启应用；支持手动重载 |
| 插件管理 UI | 设置页新增「插件」Tab：列表、启停开关、重载、卸载、安装、上次错误展示 |
| SDK 核心读写 | 游戏列表、快照列表、单游戏详情读取 |
| SDK 触发备份 | `triggerBackup(gameId)` 单个触发 |
| SDK 事件订阅 | `backup:started`、`backup:completed`、`backup:failed`、`game:added`、`game:removed` |
| SDK 私有存储 | 每个插件独立 JSON 配置（`plugins/<id>/config.json`），Rust 命令代理 |
| SDK 网络 | 直接使用浏览器 `fetch()`，无需封装 |
| SDK UI | 注册设置页区块、注册侧边栏页面；暴露 React（`createElement` 等）与少量封装组件 |
| 权限模型 | manifest 声明 permission，加载器在 SDK 层 allowlist 拦截 |
| API 版本 | manifest `api_version`，加载器向前兼容（`≤ max` 即加载） |
| 示例验证 | WebDAV 自动上传插件、备份统计页插件、插件模板工程 |

### 2.2 第一版明确不纳入范围

- 破坏性操作 API：恢复快照、删除快照、删除/修改游戏、修改主配置
- 同步阻塞钩子（before_backup 屏障等待）——v2 再议
- 在线插件市场 / 自动更新 / 插件签名
- 仪表盘小部件（v2）
- 插件逻辑隔离（Web Worker / 独立窗口）——以防御性包装替代
- 插件内嵌 Rust 原生模块

---

## 3. 技术方案

### 3.1 运行时与加载模型

- 插件 = 单文件 ES Module（作者用 esbuild/rollup 打成 bundle，`--external:sdk`）
- 主应用构建时产出独立、固定文件名的 SDK 模块 `plugin-sdk.js`（Vite 多入口 + `entryFileNames` 固定）
- `index.html` 内联 **import map**：`"sdk": "/plugin-sdk.js"`（dev 下指向 `/src/plugins/sdk.ts`，由内联脚本按 `location.protocol` 切换）
- 插件 bundle 存放于 `plugins/<id>/bundle.js`，前端通过 Tauri asset protocol（`convertFileSrc`，已启用、scope `**`）动态 `import()` 加载
- 插件 bundle 内部 `import ... from 'sdk'` 经 import map 解析到主应用 SDK 模块，与主应用共享 React 实例（同一 chunk）

关键约束：插件作者**不得**直接 import `react`，统一从 `sdk` 导入（SDK 重导出 React 常用 API 与封装组件）。这绕开了 react chunk 哈希变化导致的 import map 失配问题。

插件 bundle 的 JSX 采用经典转换（`--jsx=transform`），`React` 从 `sdk` 导入（`import React from "sdk"`），不依赖 `react/jsx-runtime`。

### 3.2 目录与文件布局

```
<tool_dir>/plugins/
  <plugin-id>/                 # 插件目录（id 即目录名）
    manifest.json
    bundle.js
    config.json                # 私有存储，由插件读写（可缺失）
    assets/...                 # 可选静态资源
  plugins_registry.json        # 全局插件元数据（启停状态/错误记录）
```

`tool_dir` 与主应用 JSON 文件同目录（与 config.json 等一致）。

### 3.3 manifest.json

```json
{
  "id": "com.example.webdav",
  "name": "WebDAV 备份",
  "version": "1.0.0",
  "api_version": 1,
  "entry": "bundle.js",
  "permissions": ["core.read", "core.backup", "events", "ui"]
}
```

| 字段 | 规则 |
|------|------|
| `id` | 反向域名格式，`^[a-z0-9.][a-z0-9.-]*$`，目录名与 id 一致 |
| `name` | 显示名，1-40 字符 |
| `version` | semver |
| `api_version` | 正整数；`> max_api_version` 拒绝加载 |
| `entry` | 相对路径的 JS 入口 |
| `permissions` | 可空；SDK 命名空间授权列表 |

权限词汇表（v1）：

| 权限 | 开放 API |
|------|---------|
| `core.read` | `listGames` `listSnapshots` `getGame` |
| `core.backup` | `triggerBackup` |
| `events` | `on` `off` |
| `ui` | `registerPage` `registerSettingsSection` `notify` |
| （始终开放） | `storage` `log` |

### 3.4 SDK 模块（`src/plugins/sdk.ts`）

SDK 是固定文件名产物，插件唯一依赖：

```ts
sdk.apiVersion            // number，当前 max
sdk.react 或命名导出       // createElement / Fragment / useState / useEffect / useRef / useCallback
sdk.ui.registerPage({ path, title, icon, render })
sdk.ui.registerSettingsSection({ id, title, render })
sdk.ui.notify(message)
sdk.core.listGames()
sdk.core.listSnapshots(gameId)
sdk.core.getGame(gameId)
sdk.core.triggerBackup(gameId)
sdk.events.on(eventName, handler)   // 支持 tauri 事件与本地事件
sdk.events.off(eventName, handler)
sdk.storage.get()                   // 读 plugins/<id>/config.json
sdk.storage.set(data)               // 写
sdk.log(...)
```

UI 组件（最小集）：`Button` `Dialog` `TextField` `Icon` —— 由 SDK 从主应用组件库重导出。

### 3.5 事件模型

纯异步事件。两类来源：

- **Tauri 事件**（Rust → 前端）：`backup:completed`（已有）、新增 `backup:started`、`backup:failed`。SDK `events.on` 对 Tauri 事件走 `@tauri-apps/api/event.listen`
- **本地事件**（前端自产）：`game:added`、`game:removed`（add_game/remove_game 成功后由前端 emit 到本地事件总线）

事件载荷沿用现有结构（`backup:completed` 含 game_id / game_name / snapshot 信息），不新建数据结构。

### 3.6 权限强制

权限检查在**前端 SDK 加载器**执行（Tauri capabilities 无法区分同 webview 内的插件代码，只能在 SDK 层拦截）：

- 加载器为每个插件构造受限 SDK 实例：manifest 未声明 `core.backup` 时，`sdk.core.triggerBackup` 调用即抛出 `PermissionDenied`
- `storage` 天然按插件 id 作用域隔离（路径绑定），始终开放

### 3.7 故障隔离与错误上报

- 插件模块加载包裹 try/catch，失败 → 记录 `last_error`，不阻断其他插件
- SDK 调用包裹 try/catch，插件回调内异常 → 通过 `reportPluginError` 命令（或复用 registry 命令）记录
- `error_count` 连续 ≥ 3 → 自动禁用（`enabled: false`）
- 插件管理页展示每插件 `last_error` 与错误次数

### 3.8 生命周期

- **安装**：设置页「插件」Tab → 选择 zip → `install_plugin`（Rust：校验 manifest → zip-slip/大小防护解压 → 冲突 id 拒绝）→ 刷新注册表 → 加载插件
- **启用/禁用**：热切换 —— 启用=动态 import + 注册路由/设置区块；禁用=卸载监听 + 注销 UI。无需重启
- **重载**：按插件重新走「卸载 → 加载」
- **卸载**：禁用后删除 `plugins/<id>/` 目录与注册表项
- **更新**：同 id 覆盖安装（版本号变化写入注册表）
- 状态持久化：`plugins_registry.json`（结构见 3.2），沿用主应用现有 Rust 命令读 JSON 模式

### 3.9 路由与 UI 注入

- **侧边栏页面**：`App.tsx` 从 `<Routes>` JSX 改为 `useRoutes()` 动态合并——基础路由数组 + 插件注册的路由（`/plugin/<id>/<page>`）。`Layout.tsx` 侧边栏导航项数组与插件页面合并渲染
- **设置页区块**：设置页新增「插件」Tab，列出已加载插件；每插件一个配置区（`registerSettingsSection` 渲染）
- 路由重算时机：插件加载/卸载/启停后

### 3.10 Rust 后端

新增模块（沿用 commands 薄层 / core 纯逻辑分层）：

| 模块 | 内容 |
|------|------|
| `core/plugins.rs` | `PluginManifest` 解析校验、`extract_plugin_zip`（zip-slip 防护、条目大小/数量上限、bundle 入口白名单）、`PluginRegistry` load/save、api_version 判定；单元测试 |
| `commands/plugins.rs` | `install_plugin` `uninstall_plugin` `get_plugin_registry` `save_plugin_registry` `read_plugin_config` `write_plugin_config`，参数传递 + 错误映射，零业务逻辑 |
| `lib.rs` | AppState 增加 `plugins_dir` `plugins_registry_path`；注册命令；备份队列任务开始时追加 emit `backup:started` |

---

## 4. 验证方式

- **Rust**：`cargo test`（core/plugins.rs 单测：manifest 解析、zip-slip 攻击样本、id 冲突、api_version、registry 往返）、`cargo check`
- **前端**：`npm run build`（tsc + vite 双入口产物，确认 `plugin-sdk.js` 固定文件名 + import map）
- **集成**：`npm run tauri dev` 手动安装示例插件，验证加载、页面路由、设置区块、事件触发、错误上报与自动禁用

---

## 5. 实施阶段

| 阶段 | 内容 | 验收 |
|------|------|------|
| P1 骨架 | core/plugins.rs + commands/plugins.rs + 命令注册 + 插件管理页 + SDK 模块与加载器（import map、allowlist、防御包装） | cargo test / cargo check / npm run build 通过；dev 下可安装并加载一个最小插件 |
| P2 桥接 | SDK 全量 API（core 读写、triggerBackup、事件、storage、notify）、UI 注入（动态路由 + 侧边栏合并 + 设置区块）、`backup:started` 事件、SDK 组件导出 | 示例插件可读数据、触发备份、收到事件、渲染页面与设置区 |
| P3 验证 | 插件模板工程、WebDAV 上传示例、备份统计页示例、插件开发文档 | 两个示例插件按文档流程可安装运行；progress.md 更新 |

---

## 6. 风险与回退

| 风险 | 应对 |
|------|------|
| asset protocol 动态 import 的 bare specifier 经 import map 解析失败 | 回退方案：Rust 读取 bundle 文本 → Blob URL 动态 import；P1 集成验证时优先确认 |
| dev/prod 下 import map 指向不同 | index.html 内联脚本按协议切换（`http:` → dev 源码路径，`tauri:`/`asset:` → `plugin-sdk.js`） |
| 插件死循环冻结 UI | 接受（防御性包装覆盖不住），文档明示限制；v2 评估 Worker 隔离 |
| 插件与主应用 React 版本失配 | api_version 机制 + SDK 是唯一依赖面，避免插件直接引 react |
