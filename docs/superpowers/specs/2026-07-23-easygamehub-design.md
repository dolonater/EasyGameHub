# EasyGameHub — 设计文档

> 产品定位：全能游戏管家 — 启动台 + 存档保护 + 时长统计 + 截图管理
>
> 基于 GameSave Backup v0.1.0 改造

---

## 1. 产品概览

| 属性 | 值 |
|------|-----|
| 产品名称 | **EasyGameHub** |
| 原名称 | GameSave Backup / Doona GameSave Backup |
| 定位 | 全员游戏管家：启动台、存档保护、时长统计、截图管理 |
| 平台 | Windows 10+ |
| 技术栈 | Tauri v2 (Rust + React 18 + TypeScript + Tailwind CSS) |
| 实现策略 | 渐进式改造：先加功能，后改品牌 |

---

## 2. 核心功能路线图

### Phase 1 — 启动台核心

| 功能 | 说明 |
|------|------|
| **改名 EasyGameHub** | 窗口标题、侧边栏、identifier 全改（图标保留） |
| **启动台页面** | 新页面，封面网格默认视图，单击进详情/双击启动/右键菜单 |
| **Steam exe 自动检测** | `steamlocate` crate 获取已安装 Steam 游戏的 executable 路径 |
| **游戏启动 + PID 追踪** | `CreateProcess` 启动，记录 PID，每 N 秒检测进程退出（默认 5 秒，设置可调） |
| **退出自动备份** | 游戏进程退出后自动创建存档快照（设置中开启，默认关闭） |
| **游戏时长累积** | 每次游玩会话记录启动/退出时间，累加 total_playtime |

### Phase 2 — 数据深化

| 功能 | 说明 |
|------|------|
| **Steam 时长同步** | 解析 `localconfig.vdf` 获取 Steam 记录的游玩时长（总时长 + 近两周） |
| **时长详情页** | 可排序的时间明细列表 / 柱状图（按天/周/月聚合） / 游戏维度统计 |
| **封面升级** | 使用 Steam 600×900 竖版封面 (`library_600x900.jpg`)，自动回退 231×87 |
| **截图管理** | Steam 自动扫描截图目录 + 自定义目录，缩略图网格 + 大图预览 |
| **游戏库美化** | 标签分类（RPG/FPS/独立等）、收藏星标、排序增强（按游戏时长/最近游玩） |

#### 2.1 Steam 时长同步

**数据来源：**
- 本地 VDF：`Steam/userdata/<steam_id>/config/localconfig.vdf`
- 解析路径：`UserLocalConfigStore\Software\Valve\Steam\apps\<appid>\PlayedSeconds`
- 优先本地 VDF，备选 Steam Web API（需要 API Key）

**同步策略：**
- 应用启动时全量同步一次
- 每次游戏退出后增量更新对应游戏
- Steam 时长覆盖本地时长（Steam 更权威）
- 学习版游戏保持本地累积

#### 2.2 时长详情页

**路由：** `/playtime`（新页面，或作为 Dashboard 子页）

**组件：**
- `PlaytimeOverview` — 顶部统计卡片（总时长/本周/本月/日均）
- `PlaytimeChart` — 柱状图：近 7 天/30 天每日时长。纯 CSS 实现（不引入图表库）
- `PlaytimeList` — 排序表格：游戏名、总时长、最近游玩、会话次数。可排序

**数据：**
- 复用 `UserGames.play_sessions` 聚合
- 按天/周/月 GROUP BY

#### 2.3 封面升级

**Steam 图片 API：**

| 类型 | URL 模板 | 尺寸 |
|------|----------|------|
| 竖版封面（新） | `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/<appid>/library_600x900.jpg` | 600×900 |
| 横版头图 | `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/<appid>/header.jpg` | 460×215 |
| 横条胶囊（旧） | `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/<appid>/capsule_231x87.jpg` | 231×87 |

**策略：**
- GameCard `aspect-[2/3]`（竖版比例）
- `<img>` 先加载 `library_600x900`，`onError` 回退 `capsule_231x87`
- 非 Steam 游戏保持首字母占位

#### 2.4 截图管理

**自动扫描：**
- 解析 `localconfig.vdf` 获取 Steam ID
- 扫描 `Steam/userdata/<steam_id>/760/remote/<appid>/screenshots/`
- 每个截图含 `thumbnails/` 子目录

**自定义目录：**
- 每游戏可手动指定截图目录（新增 `screenshot_dirs` 到 `UserGames`）

**UI：**
- 路由：`/screenshots`（新页面）
- 按游戏分组，每组显示缩略图网格
- 点击缩略图 → 大图预览（全屏浮层，支持左右切换）
- 右键菜单：打开文件位置、复制图片、删除

**数据模型：**
```rust
struct ScreenshotSource {
    game_id: String,
    source_type: String,   // "steam" | "custom"
    directory: String,
}
// 存储到 UserGames.screenshot_sources
```

#### 2.5 游戏库美化

**标签分类：**
- 预置标签：RPG、FPS、动作、冒险、策略、模拟、独立、休闲、体育、竞速
- 自定义标签（用户自由输入）
- 存储：`UserGames.game_tags: Vec<(String, Vec<String>)>` — (game_id, tags)
- UI：启动台页面顶部标签筛选栏，可多选，封面卡片上显示标签

**收藏：**
- 存储：`UserGames.favorites: Vec<String>` — game_ids
- UI：星标 ⭐ 图标在封面卡片右上角（与运行状态圆点一起）
- 右键菜单"收藏/取消收藏"
- 排序优先级：收藏 > 置顶 > 运行中 > 其他

**排序增强：**
- 新增排序选项：按游戏时长（高到低）、按最近游玩（最近优先）

---

### Phase 3 — 生态扩展

| 功能 | 说明 |
|------|------|
| **云端存档同步** | 对接 WebDAV / OneDrive（复用 `StorageBackend` trait） |
| **性能监控** | FPS / CPU / GPU overlay（需要 RTSS 或自定义 overlay） |
| **更多平台** | Epic / GOG 游戏检测（复用 `PlatformDetector` trait） |

---

## 3. 交互设计

### 3.1 导航结构

```
总览 | 启动台 | 游戏列表 | 添加游戏 | 设置 | 关于
```

- **总览** — Dashboard 统计卡片 + 最近活动 + 存储/监控状态
- **启动台** — 封面网格，双击启动游戏（新建页面）
- **游戏列表** — 原 GameList（监控中 / 不可用 Tab），专注备份管理
- 启动台与游戏列表互为独立页面，不合并

### 3.2 启动台封面卡片

每个游戏卡片包含：
- Steam 竖版封面图 (600×900)
- 游戏名称
- 运行状态圆点（绿色=运行中，灰色=未启动）
- 已运行时长（底部栏，如 "326h"）
- 置顶标记（up-arrow-icon）

交互：
- **单击** → 进入游戏详情页（备份管理）
- **双击** → 启动游戏
- **右键** → 上下文菜单（置顶/取消置顶、设置启动程序、打开存档/备份目录、移除）
- 不加 ▶ 播放按钮

### 3.3 运行状态

- **静态** — 封面上显示绿色圆点 + 运行中标签
- **Hover** — 运行中的游戏显示控制面板：停止按钮 + 本次运行时长
- 退出后圆点自动消失

### 3.4 窗口行为

- 关闭按钮 → 隐藏到托盘（保持现状）
- 左键托盘图标 → 呼出主窗口
- 右键托盘图标 → "显示窗口" / "退出"

---

## 4. 技术设计

### 4.1 Steam 游戏可执行文件检测

| 方式 | 描述 | 优先级 |
|------|------|--------|
| `steamlocate` crate | 解析 Steam 本地 VDF 文件，获取已安装游戏的 executable 字段 | 首选 |
| `steam://rungameid/<appid>` | 拿不到 exe 路径时的降级方案，放弃 PID 追踪 | 备选 |
| 用户手动配置 | 右键菜单"设置启动程序"，选择 exe 路径 | 兜底 |

- `steamlocate` 获取不到 executable 时，标记 ⚙ 图标
- 同时也提供 `steam://` 协议启动（右键菜单"用 Steam 启动"）

### 4.2 PID 追踪退出检测

```
CreateProcess(exe_path) → PID
  ↓
每 N 秒轮询（N 默认 5，设置可调 1-30）
  ↓
进程退出 → 触发自动备份（如已开启）→ 记录游玩时长
```

- 仅对直接启动的 exe 做 PID 追踪
- `steam://` 协议启动的游戏降级为按进程名轮询，或不做退出检测

### 4.3 游戏时长统计

**Steam 正版游戏：**
- 启动前读取 `Steam/userdata/<id>/config/localconfig.vdf`
- 解析 `Apps\{appid}\PlayedSeconds` 字段（云端同步数据）
- 退出后重新读取对比差异

**学习版/自定义游戏：**
- 本地记录 `{game_id, start_time, end_time, duration_seconds}` 会话
- 累计 `total_playtime_seconds` 字段

**两者统一：**
- 存会话记录 JSON（周报/月报/图表用）
- 在封面上显示 total_playtime

### 4.4 数据模型扩展

**UserGames 新增字段：**

```rust
pub struct UserGames {
    pub monitored: Vec<String>,
    pub pinned: Vec<String>,
    pub auto_backup: Vec<String>,
    pub path_overrides: Vec<(String, String)>,
    // 新增
    pub launch_configs: Vec<LaunchConfig>,
    pub play_sessions: Vec<PlaySession>,
    pub total_playtime: Vec<(String, u64)>,  // (game_id, seconds)
}
```

**新结构体：**

```rust
struct LaunchConfig {
    game_id: String,
    exe_path: String,        // 可执行文件绝对路径
    args: Option<String>,    // 启动参数
    launch_method: String,   // "direct" | "steam_protocol"
}

struct PlaySession {
    game_id: String,
    start_time: String,      // ISO 8601
    end_time: Option<String>,
    duration_seconds: Option<u64>,
}
```

### 4.5 截图管理数据模型

```rust
struct ScreenshotSource {
    game_id: String,
    source_type: String,     // "steam" | "custom"
    directory: String,       // 截图目录路径
}
```

- Steam 游戏：自动扫描 `userdata/<id>/760/remote/<appid>/screenshots/`
- 自定义游戏：用户手动指定目录
- 按游戏分组 + 时间线浏览（Phase 2）

### 4.6 进程检测配置

**Config 新增字段：**

```rust
pub process_check_interval_seconds: u64,  // 默认 5，范围 1-30
pub auto_backup_on_game_exit: bool,       // 默认 false
```

---

## 5. UI 与视觉

### 5.1 封面图

- Phase 1：保持现有 231×87 横条图
- Phase 2：升级为 Steam 600×900 竖版封面 (`library_600x900.jpg`)
- 兜底方案：游戏名首字母占位

### 5.2 窗口尺寸

- 默认：1100×750
- 最小：720×480
- 自由缩放，封面网格自动调整列数（Tailwind grid-cols 响应式）

### 5.3 启动台网格

- 封面视图默认 6~8 列（根据窗口宽度自适应）
- 置顶游戏排在最前面
- 运行中的游戏排第二优先级

---

## 6. 品牌改名范围

| 位置 | 旧值 | 新值 |
|------|------|------|
| 窗口标题 | `GameSave Backup` | `EasyGameHub` |
| 侧边栏 Logo文字 | `GameSave` | `EasyGameHub` |
| `tauri.conf.json` identifier | `com.doona.game-save-backup` | `com.easygamehub.app` |
| `tauri.conf.json` productName | `GameSave Backup` | `EasyGameHub` |
| 托盘提示 | `GameSave Backup` | `EasyGameHub` |
| 应用图标 | 保持不变 | 保持不变 |
| 代码 crate 名 | `doona_gamesave_backup` | `easygamehub` |
| npm package name | `doona-gamesave-backup` | `easygamehub` |
| 安装程序文件名 | `GameSave Backup_*.msi` | `EasyGameHub_*.msi` |

---

## 7. 错误处理与兼容性

### 7.1 exe 启动失败

- exe 路径不存在 → toast 错误提示
- 进程启动后立即退出（崩溃）→ toast 警告
- 权限不足 → toast 提示以管理员运行

### 7.2 Steam 未安装

- 启动台页面显示"未检测到 Steam 安装"
- 仍可通过自定义路径手动管理游戏

### 7.3 配置文件兼容

- 旧 `config.json` 缺失新字段 → 全部使用 `#[serde(default)]` 回退
- 旧 `user_games.json` 缺失新字段 → 不报错，使用空向量默认值

---

## 8. 确认的设计决策（grill-me 汇总）

| # | 决策 | 选择 |
|---|------|------|
| 1 | 启动+备份一体化，默认关闭 | 设置中开启 |
| 2 | Steam exe 检测 + 用户手动配置 | A+B 互补 |
| 3 | 退出后备份，不做启动前备份 | 仅退出后 |
| 4 | 封面图升级 Steam 600×900 | Phase 2 |
| 5 | 总览保持 Dashboard，启动台独立页面 | A |
| 6 | PID 追踪退出检测 | B |
| 7 | Steam 游戏优先直接启动 exe | A 优先 B 备选 |
| 8 | launch_configs 扩展 UserGames | A |
| 9 | 产品定位：全能游戏管家 | B |
| 10 | 实现优先级：P0-P5 | 按建议顺序 |
| 11 | 运行状态：静态标签 + hover 面板 | C |
| 12 | 启动台默认封面视图，可选列表 | B |
| 13 | 双击启动游戏 | B |
| 14 | 关闭窗口隐藏到托盘 | A |
| 15 | Steam localconfig.vdf 解析时长 + Web API 备选 | C |
| 16 | 截图管理 Steam 自动 + 自定义手动 | A+B |
| 17 | 产品名称 | EasyGameHub |
| 18 | 窗口响应式自适应 + 默认 1100×750 | C |
| 19 | steamlocate crate + 降级方案 | B |
| 20 | 实现路径：渐进式 | C |
| 21 | 进程检测间隔默认 5 秒，设置可调 | 5s 默认 |
| 22 | 封面置顶+运行状态，不加播放按钮 | 无 ▶ |
| 23 | 应用图标不变，其余全改 | — |
