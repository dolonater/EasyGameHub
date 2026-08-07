# EasyGameHub Phase 1 — 实现计划

> 基于设计文档 [2026-07-23-easygamehub-design.md](../specs/2026-07-23-easygamehub-design.md)
>
> 实现策略：渐进式，先加功能后改品牌

---

## 任务概览

| 分组 | 任务数 | 说明 |
|------|--------|------|
| A. 数据模型 | 3 | UserGames / Config / PlaySession 扩展 |
| B. Steam 检测 | 2 | steamlocate crate 集成 |
| C. 游戏启动+追踪 | 4 | 启动命令、PID 追踪、退出检测、时长记录 |
| D. 后端命令 | 3 | 新增 + 注册 IPC 命令 |
| E. 前端启动台 | 5 | 新页面、封面卡片、状态、交互 |
| F. 改名 | 3 | 品牌名称全局替换 |
| G. 设置+集成 | 4 | 设置页、i18n、启动时调度器 |
| **合计** | **24** | |

---

## A. 数据模型扩展

### A1. 扩展 UserGames 结构体
**文件：** `src-tauri/src/core/db.rs`
**修改：** UserGames 结构体（约第 98-111 行）

```rust
// 新增字段到 UserGames:
pub launch_configs: Vec<LaunchConfig>,       // (game_id, exe_path, args, launch_method)
pub play_sessions: Vec<PlaySession>,         // (game_id, start_time, end_time, duration)
pub total_playtime: Vec<(String, u64)>,       // (game_id, seconds)
```

新增结构体：
```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchConfig {
    pub game_id: String,
    pub exe_path: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub args: Option<String>,
    #[serde(default = "default_launch_method")]
    pub launch_method: String,  // "direct" | "steam_protocol"
}
fn default_launch_method() -> String { "direct".into() }

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaySession {
    pub game_id: String,
    pub start_time: String,
    pub end_time: Option<String>,
    pub duration_seconds: Option<u64>,
}
```

所有新字段加 `#[serde(default)]` 兼容旧数据。`UserGames::empty()` 同步更新。

**验证：** `cargo check`

### A2. 扩展 Config 结构体
**文件：** `src-tauri/src/core/config.rs`
**修改：** Config 结构体（约第 6-24 行）+ Default impl（约第 28-39 行）

```rust
// 新增字段:
#[serde(default = "default_process_check_interval")]
pub process_check_interval_seconds: u64,  // 默认 5
#[serde(default)]
pub auto_backup_on_game_exit: bool,       // 默认 false
```

```rust
fn default_process_check_interval() -> u64 { 5 }
```

Default impl 同步更新。

**验证：** `cargo check`

### A3. 扩展 ConfigDto
**文件：** `src-tauri/src/commands/config.rs`
**修改：** ConfigDto（约第 6-16 行）+ get_config 映射（约第 29-38 行）+ update_config 映射（约第 43-52 行）

新增字段：
```rust
pub process_check_interval_seconds: u64,
pub auto_backup_on_game_exit: bool,
```

**验证：** `cargo check`

---

## B. Steam 可执行文件检测

### B1. 添加 steamlocate 依赖
**文件：** `src-tauri/Cargo.toml`

```toml
steamlocate = "1"
```

**验证：** `cargo check`

### B2. 在 scanner 中集成 steamlocate
**文件：** `src-tauri/src/core/scanner.rs`

新增函数：
```rust
use steamlocate::SteamDir;

/// 通过 steamlocate crate 获取已安装游戏的exe路径
/// 返回 Vec<(app_id, install_dir, executable_path)>
pub fn detect_installed_game_exes() -> Vec<(u32, PathBuf, Option<PathBuf>)> {
    // SteamDir::locate() → 遍历 library_folders → 每个 app 的 executable 字段
}
```

保留现有 `detect_steam_installation()` + `parse_app_manifests()` + `match_with_db()` 不变，新函数专注于获取 executable。

**验证：** `cargo check`

---

## C. 游戏启动 + PID 追踪

### C1. 创建 process 核心模块
**文件：** `src-tauri/src/core/process.rs`（新建）

```rust
//! Game process management: launch, PID tracking, exit detection.

use std::process::{Command, Child};
use std::sync::{Arc, Mutex};
use std::collections::HashMap;
use std::path::PathBuf;

/// Tracked running game process
struct RunningGame {
    child: Child,
    game_id: String,
    start_time: chrono::DateTime<chrono::Local>,
}

/// Manages running game processes
pub struct ProcessManager {
    running: Arc<Mutex<HashMap<String, RunningGame>>>,
    check_interval: Arc<Mutex<u64>>,
    on_exit_callback: Option<Arc<dyn Fn(&str) + Send + Sync>>,
}
```

方法：
- `new() -> Self`
- `launch(game_id, exe_path, args: Option<&str>) -> Result<()>` — `Command::new(exe_path).spawn()`，记录 PID
- `is_running(game_id) -> bool` — 检查进程是否仍活跃
- `stop(game_id) -> Result<()>` — 终止进程
- `set_on_exit_callback(cb)` — 设置退出回调
- `start_monitor()` — 启动后台线程，每 N 秒检查运行中的进程
- `stop_monitor()` — 停止监控
- `set_check_interval(secs: u64)` — 动态设置检查间隔

退出检测逻辑（监控线程）：
```
循环每 N 秒:
  for each running game:
    child.try_wait() → 如果返回 Some(exit_status) → 进程已退出
      → 记录 end_time + duration
      → 调用 on_exit_callback(game_id)
      → 如果 auto_backup_on_game_exit → 触发备份
      → 从 running map 中移除
```

**验证：** `cargo check`

### C2. 在 core/mod.rs 注册 process 模块
**文件：** `src-tauri/src/core/mod.rs`

添加 `pub mod process;`

**验证：** `cargo check`

### C3. 添加 launch_steam_game 扫描辅助
**文件：** `src-tauri/src/core/scanner.rs`

新增函数：
```rust
/// 对已安装的 Steam 游戏，用 steamlocate 找到 exe 路径
/// 如果 steamlocate 没返回 executable，返回 None
pub fn find_steam_game_exe(app_id: u32) -> Option<PathBuf>
```

**验证：** `cargo check`

---

## D. 后端命令

### D1. 新增游戏启动和管理命令
**文件：** `src-tauri/src/commands/process.rs`（新建）

| 命令 | 签名 | 说明 |
|------|------|------|
| `launch_game` | `(state, game_id) -> Result<()>` | 查找 LaunchConfig 或 steamlocate 获取 exe，启动进程，开始 PID 追踪 |
| `stop_game` | `(state, game_id) -> Result<()>` | 终止指定游戏的进程 |
| `get_running_games` | `(state) -> Result<Vec<String>>` | 返回当前运行中的游戏 ID 列表 |
| `get_playtime` | `(state, game_id) -> Result<u64>` | 返回累计游玩秒数 |
| `set_launch_config` | `(state, game_id, exe_path, args) -> Result<()>` | 手动设置游戏启动路径 |
| `get_launch_config` | `(state, game_id) -> Result<Option<LaunchConfigDto>>` | 获取启动配置 |
| `set_process_check_interval` | `(state, seconds: u64) -> Result<()>` | 设置进程检测间隔 |

**验证：** `cargo check`

### D2. 在 commands/mod.rs 注册
**文件：** `src-tauri/src/commands/mod.rs`

添加 `pub mod process;`

**验证：** `cargo check`

### D3. 在 lib.rs 注册所有新命令 + 初始化 ProcessManager
**文件：** `src-tauri/src/lib.rs`

- `AppState` 新增 `process_manager: ProcessManager`
- `invoke_handler` 注册 `commands::process::*` 所有命令
- `run()` 中初始化 ProcessManager，设置退出回调连接备份队列

**验证：** `cargo check`

---

## E. 前端 — 启动台页面

### E1. 创建 Launcher 页面
**文件：** `src/pages/Launcher.tsx`（新建）

组件结构：
```tsx
export default function Launcher() {
  // 状态: games, runningGames, playtimes
  // useEffect: 加载 get_games + get_running_games，轮询 10 秒
  // 双击处理: invoke("launch_game", { gameId })
  // 渲染: 封面网格 + 搜索 + 排序
}
```

特性：
- 显示所有监控中的游戏（封面网格）
- 默认封面视图，可选切列表视图（复用 GameList 的 view toggle）
- 搜索框 + 排序
- 双击封面 → `launch_game`
- 单击封面 → `navigate(/games/:id)`
- 运行中状态：绿色圆点 + hover 面板（运行时长）
- 右键菜单：置顶/设置启动程序/打开目录/移除

**验证：** `npx tsc --noEmit`

### E2. 添加路由
**文件：** `src/App.tsx`

```tsx
// 导入 Launcher
import Launcher from "./pages/Launcher";
// Layout 内添加:
<Route path="/launcher" element={<Launcher />} />
```

**验证：** `npx tsc --noEmit`

### E3. 侧边栏添加启动台入口
**文件：** `src/components/Layout.tsx`（约第 20-24 行）

在"总览"之后添加：
```tsx
<NavLink to="/launcher" className={linkClass}>{t("nav.launcher")}</NavLink>
```

导航顺序：`总览 | 启动台 | 游戏列表 | 添加游戏 | 设置 | 关于`

**验证：** `npx tsc --noEmit`

### E4. 运行状态上下文
**文件：** `src/hooks/useRunningGames.ts`（新建）

```tsx
// 全局 Context，管理运行中游戏列表
// 轮询 get_running_games 每 5 秒
// 提供: runningGames: Set<string>, playtimes: Map<string, number>
```

供 Launcher、GameList、GameDetail 等页面共用。

**验证：** `npx tsc --noEmit`

### E5. 扩展 GameCard 组件支持运行状态
**文件：** `src/pages/GameList.tsx`（GameCard 函数约第 497-531 行）

抽离 `GameCard` 为独立组件到 `src/components/GameCard.tsx`，增加：
- `isRunning: boolean` prop
- `playtime: number` prop（显示 "326h"）
- `onDoubleClick?: () => void` prop（启动台双击启动）
- 运行状态圆点渲染

Launcher 和 GameList 共用这个组件。

**验证：** `npx tsc --noEmit`

---

## F. 品牌改名

### F1. 前端改名
**文件：** 多个文件

| 文件 | 修改 |
|------|------|
| `index.html` 第 9 行 | `<title>GameSave Backup</title>` → `EasyGameHub` |
| `src/components/Layout.tsx` 第 18 行 | `GameSave` → `EasyGameHub` |
| `src/i18n/zh.ts` `app.title` | `Doona GameSave Backup` → `EasyGameHub` |
| `src/i18n/en.ts` `app.title` | `Doona GameSave Backup` → `EasyGameHub` |

**验证：** `npx tsc --noEmit`

### F2. 后端改名
**文件：** `src-tauri/tauri.conf.json`

```json
"identifier": "com.easygamehub.app",
"productName": "EasyGameHub"
```

窗口 title 从 `"GameSave Backup"` → `"EasyGameHub"`

**验证：** `cargo check`

### F3. Rust 代码中的名称
**文件：** `src-tauri/src/commands/config.rs`（约第 210 行）

`APP_NAME: &str = "DoonaGameSave"` → `"EasyGameHub"`（自动启动注册表项）

`src-tauri/src/lib.rs`（约第 137 行）：托盘提示文字 → `"EasyGameHub"`

**验证：** `cargo check`

---

## G. 设置 + 集成

### G1. 设置页新增字段
**文件：** `src/pages/Settings.tsx`

- 新增 `process_check_interval_seconds` 数字输入（1-30，默认5）
- 新增 `auto_backup_on_game_exit` Toggle 开关
- defaultConfig 包含新默认值
- handleSave 保存新字段

**验证：** `npx tsc --noEmit`

### G2. i18n 新增 key
**文件：** `src/i18n/zh.ts` + `src/i18n/en.ts`

新增翻译：
- `nav.launcher`: "启动台" / "Launcher"
- `settings.processCheckInterval`: "进程检测间隔（秒）"
- `settings.autoBackupOnExit`: "游戏退出时自动备份"
- `settings.autoBackupOnExitDesc`: "检测到游戏进程退出后自动创建存档快照"
- `launcher`: 新命名空间（title、running、noGames、launching 等）

**验证：** `npx tsc --noEmit`

### G3. 启动时初始化 ProcessManager
**文件：** `src-tauri/src/lib.rs`

在 `run()` 函数中：
- 创建 `ProcessManager`
- 设置退出回调：退出时检查 `auto_backup_on_game_exit` 配置，如开启则触发备份
- 将 ProcessManager 注册到 `AppState`
- 连接 PID 监控线程的 interval 到 config

**验证：** `cargo check`

### G4. 前端类型同步
**文件：** `src/lib/types.ts`

新增类型：
```ts
interface LaunchConfig {
  game_id: string;
  exe_path: string;
  args?: string;
  launch_method: string;
}

interface PlaySession {
  game_id: string;
  start_time: string;
  end_time?: string;
  duration_seconds?: number;
}
```

Config 接口新增：
```ts
process_check_interval_seconds: number;
auto_backup_on_game_exit: boolean;
```

GameInfo 新增可选字段：
```ts
is_running?: boolean;
total_playtime?: number;
```

**验证：** `npx tsc --noEmit`

---

## 执行顺序

```
A1 → A2 → A3  (数据模型，无依赖)
  ↓
B1 → B2        (Steam 检测，依赖 A1 完成)
  ↓
C1 → C2 → C3  (进程模块，依赖 A1 A2)
  ↓
D1 → D2 → D3  (IPC 命令，依赖 C1)
  ↓
G4             (前端类型，依赖 A1 A2 A3)
  ↓
E4 → E5 → E1 → E2 → E3  (前端组件，内部依赖)
  ↓
F1 → F2 → F3  (改名)
  ↓
G1 → G2 → G3  (设置+集成)
```

每步完成后验证 `cargo check` 或 `npx tsc --noEmit`。

---

## 预期产出

| 文件 | 类型 |
|------|------|
| `src-tauri/src/core/process.rs` | 新建 |
| `src-tauri/src/commands/process.rs` | 新建 |
| `src/pages/Launcher.tsx` | 新建 |
| `src/hooks/useRunningGames.ts` | 新建 |
| `src/components/GameCard.tsx` | 新建（从 GameList 抽离） |
| `src-tauri/src/core/db.rs` | 修改 |
| `src-tauri/src/core/config.rs` | 修改 |
| `src-tauri/src/core/scanner.rs` | 修改 |
| `src-tauri/src/core/mod.rs` | 修改 |
| `src-tauri/src/commands/config.rs` | 修改 |
| `src-tauri/src/commands/mod.rs` | 修改 |
| `src-tauri/src/lib.rs` | 修改 |
| `src-tauri/Cargo.toml` | 修改 |
| `src-tauri/tauri.conf.json` | 修改 |
| `src/lib/types.ts` | 修改 |
| `src/App.tsx` | 修改 |
| `src/components/Layout.tsx` | 修改 |
| `src/pages/GameList.tsx` | 修改（抽离 GameCard） |
| `src/pages/Settings.tsx` | 修改 |
| `src/i18n/zh.ts` | 修改 |
| `src/i18n/en.ts` | 修改 |
| `index.html` | 修改 |
