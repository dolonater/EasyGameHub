# EasyGameHub Phase 2 — 实现计划

> 基于设计文档 [2026-07-23-easygamehub-design.md](../specs/2026-07-23-easygamehub-design.md)
>
> 范围：Steam 时长同步 / 时长详情页 / 封面升级 / 截图管理 / 游戏库美化

---

## 任务概览

| 分组 | 任务数 | 说明 |
|------|--------|------|
| H. Steam 时长同步 | 3 | VDF 解析 + 同步逻辑 |
| I. 时长详情页 | 4 | 统计卡片 / 柱状图 / 列表 / 路由 |
| J. 封面升级 | 2 | 600×900 竖版封面 + 回退 |
| K. 截图管理 | 5 | 扫描 / 缩略图 / 预览 / 自定义目录 |
| L. 游戏库美化 | 4 | 标签 / 收藏 / 排序增强 / 筛选栏 |
| **合计** | **18** | |

---

## H. Steam 时长同步

### H1. 解析 localconfig.vdf
**文件：** `src-tauri/src/core/steam_sync.rs`（新建）

```rust
/// 从 Steam localconfig.vdf 解析所有游戏的 PlayedSeconds
/// 返回 HashMap<app_id, played_seconds>
pub fn parse_steam_playtime() -> Result<HashMap<u32, u64>, String>
```

逻辑：
1. `steamlocate::SteamDir::locate()` 获取 Steam 安装路径
2. 扫描 `userdata/<id>/config/localconfig.vdf`
3. 用 `keyvalues-serde`（steamlocate 已依赖）解析 VDF
4. 遍历 `UserLocalConfigStore\Software\Valve\Steam\apps\<appid>` 节点
5. 提取每个 app 的 `PlayedSeconds` 值
6. 获取 Steam ID：优先从 `config/config.vdf` 的 `ConnectCache` 解析，失败则扫描 `userdata/` 子目录

**验证：** `cargo check`

### H2. 同步命令
**文件：** `src-tauri/src/commands/process.rs`（追加）

```rust
#[tauri::command]
pub fn sync_steam_playtime(state: tauri::State<'_, AppState>) -> Result<Vec<PlaytimeInfo>, String>
```

逻辑：
1. 调用 `parse_steam_playtime()` 获取 Steam 数据
2. 加载 `UserGames` + `GamesDb`
3. 按 `steam_app_id` 匹配，将 Steam 时长写入 `total_playtime`
4. Steam 时长权威，直接覆盖本地值
5. 保存 `user_games.json`
6. 返回所有更新的 `PlaytimeInfo`

**验证：** `cargo check`

### H3. 触发时机
**文件：** `src-tauri/src/lib.rs`

在 `run()` 的 setup 闭包中，应用启动后自动调用一次 `sync_steam_playtime`。

`src/pages/Settings.tsx`：设置页添加"同步 Steam 时长"按钮。

**验证：** `cargo check` + `npx tsc --noEmit`

---

## I. 时长详情页

### I1. 后端聚合命令
**文件：** `src-tauri/src/commands/process.rs`（追加）

```rust
#[derive(Serialize)]
pub struct PlaytimeStats {
    pub total_seconds: u64,
    pub weekly_seconds: u64,
    pub monthly_seconds: u64,
    pub daily_average: u64,
    pub daily_breakdown: Vec<DayPlaytime>,  // 近 30 天
    pub per_game: Vec<GamePlaytime>,
}

#[derive(Serialize)]
pub struct DayPlaytime { pub date: String, pub seconds: u64 }

#[derive(Serialize)]
pub struct GamePlaytime { pub game_id: String, pub game_name: String, pub seconds: u64, pub sessions: usize, pub last_played: Option<String> }

#[tauri::command]
pub fn get_playtime_stats(state: tauri::State<'_, AppState>) -> Result<PlaytimeStats, String>
```

逻辑：从 `UserGames.play_sessions` 聚合计算所有统计数据。

**验证：** `cargo check`

### I2. 时长详情页 UI
**文件：** `src/pages/Playtime.tsx`（新建）

组件结构：
- `PlaytimeOverview` — 4 个统计卡片（总时长/本周/本月/日均）
- `PlaytimeBarChart` — 纯 CSS 柱状图（近 14 天，用 Tailwind `h-*` 按比例渲染柱子高度）
- `PlaytimeTable` — 排序表格：游戏名、总时长(h)、会话次数、最近游玩

**验证：** `npx tsc --noEmit`

### I3. 路由注册
**文件：** `src/App.tsx` — 添加 `<Route path="/playtime" element={<Playtime />} />`

**文件：** `src/components/Layout.tsx` — 侧边栏在"总览"后添加"时长统计"入口

### I4. i18n
**文件：** `src/i18n/zh.ts` `en.ts` — 新增 `playtime` 命名空间

---

## J. 封面升级

### J1. 更新封面 URL 获取函数
**文件：** `src/lib/types.ts`

```ts
// 新增：竖版封面优先，横条回退
export function getSteamCoverUrl(appId: number | null): string | null {
  if (!appId) return null;
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/library_600x900.jpg`;
}
// 保留旧函数作为回退
export function getSteamHeaderUrl(appId: number | null): string | null {
  if (!appId) return null;
  return `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/capsule_231x87.jpg`;
}
```

### J2. 更新 GameCard 和 GameIcon
**文件：** `src/components/GameCard.tsx`

- 封面容器 `aspect-[16/10]` → `aspect-[2/3]`（竖版比例）
- `<img>` 主 URL 改为 `getSteamCoverUrl`，`onError` → `getSteamHeaderUrl`

**文件：** `src/components/GameIcon.tsx`

- 同样更新 URL 优先级

**文件：** `src/pages/Launcher.tsx` — 列表视图封面图标同步更新

**验证：** `npx tsc --noEmit`

---

## K. 截图管理

### K1. 截图数据模型
**文件：** `src-tauri/src/core/db.rs`

```rust
// UserGames 新增字段:
#[serde(default)]
pub screenshot_sources: Vec<ScreenshotSource>,

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScreenshotSource {
    pub game_id: String,
    pub source_type: String,  // "steam" | "custom"
    pub directory: String,
}
```

### K2. Steam 截图自动扫描
**文件：** `src-tauri/src/core/steam_sync.rs`（追加）

```rust
/// 为所有 Steam 游戏自动配置截图目录
/// 扫描 userdata/<id>/760/remote/<appid>/screenshots/
pub fn auto_detect_screenshot_dirs(db: &GamesDb) -> Vec<ScreenshotSource>
```

逻辑：
1. 获取 Steam ID（从 `config.vdf` 或扫描 `userdata/`）
2. 遍历 DB 中有 `steam_app_id` 的游戏
3. 检查 `760/remote/<appid>/screenshots/` 是否存在
4. 存在则返回 `ScreenshotSource { game_id, "steam", dir }`

### K3. 截图浏览命令
**文件：** `src-tauri/src/commands/screenshots.rs`（新建）

```rust
#[derive(Serialize)]
pub struct ScreenshotFile { pub path: String, pub name: String, pub size_bytes: u64 }

#[tauri::command]
pub fn get_screenshots(state: tauri::State<'_, AppState>, game_id: String) -> Result<Vec<ScreenshotFile>, String>

#[tauri::command]
pub fn add_screenshot_dir(state: tauri::State<'_, AppState>, game_id: String, directory: String) -> Result<(), String>
```

`get_screenshots`：扫描该游戏所有截图目录，按修改时间降序返回图片文件列表（`.jpg` `.png` `.bmp`）。

### K4. 截图浏览页面
**文件：** `src/pages/Screenshots.tsx`（新建）

- 左侧：游戏列表（带截图数量的游戏）
- 右侧：缩略图网格（`grid-cols-3 md:grid-cols-4 lg:grid-cols-5`）
- 点击缩略图 → 全屏大图浮层（`position: fixed; inset: 0; bg-black/80`），左右箭头翻页
- 右键缩略图：在资源管理器打开 / 复制图片路径
- 缩略图用 `<img>` 原生 lazy loading

### K5. 路由 + 侧边栏
**文件：** `src/App.tsx` — `/screenshots` 路由

**文件：** `src/components/Layout.tsx` — 侧边栏"截图管理"入口

**验证：** `npx tsc --noEmit` + `cargo check`

---

## L. 游戏库美化

### L1. 数据模型扩展
**文件：** `src-tauri/src/core/db.rs`

```rust
// UserGames 新增:
#[serde(default)]
pub favorites: Vec<String>,           // 收藏的 game_id
#[serde(default)]
pub game_tags: Vec<(String, Vec<String>)>,  // (game_id, [tag, tag])
```

UserGames 方法新增：
```rust
pub fn is_favorite(&self, id: &str) -> bool
pub fn toggle_favorite(&mut self, id: &str)
pub fn get_tags(&self, id: &str) -> Vec<String>
pub fn set_tags(&mut self, id: &str, tags: Vec<String>)
pub fn all_tags(&self) -> Vec<String>  // 去重后的全部标签
```

### L2. 收藏/标签命令
**文件：** `src-tauri/src/commands/games.rs`（追加）

```rust
#[tauri::command] pub fn toggle_favorite(state, game_id) -> Result<bool>
#[tauri::command] pub fn get_favorites(state) -> Result<Vec<String>>
#[tauri::command] pub fn set_game_tags(state, game_id, tags: Vec<String>) -> Result<()>
#[tauri::command] pub fn get_all_tags(state) -> Result<Vec<String>>
```

### L3. GameCard 收藏星标 + 标签
**文件：** `src/components/GameCard.tsx`

- 新增 prop：`isFavorite`, `tags: string[]`
- 右上角显示 ⭐（收藏时金色，否则灰色半透明）
- 底部标签行：最多显示 2 个标签小徽章，其余用 "+N" 表示

### L4. 启动台筛选栏 + 排序增强
**文件：** `src/pages/Launcher.tsx`

- 顶部添加标签筛选栏：横向滚动标签 chips，点击切换选中（多选 OR 逻辑）
- 排序新增两个选项：
  - "游戏时长" `playtime` — `b.total_playtime - a.total_playtime`
  - "最近游玩" `last_played` — 按最后会话时间降序
- 排序优先级：收藏 > 置顶 > 运行中 > 排序键

---

## 执行顺序

```
H1 → H2 → H3     (Steam 时长同步，无前端依赖)
  ↓
I1 → I2 → I3 → I4 (时长详情页，依赖 H1 H2 数据)
  ↓
J1 → J2           (封面升级，独立)
  ↓
K1 → K2 → K3 → K4 → K5 (截图管理，独立)
  ↓
L1 → L2 → L3 → L4 (游戏库美化，独立)
```

每组内任务必须顺序执行，组之间可调整顺序。每步完成后验证 `cargo check` 或 `npx tsc --noEmit`。

---

## 预期产出

| 文件 | 类型 |
|------|------|
| `src-tauri/src/core/steam_sync.rs` | 新建 |
| `src-tauri/src/commands/screenshots.rs` | 新建 |
| `src/pages/Playtime.tsx` | 新建 |
| `src/pages/Screenshots.tsx` | 新建 |
| `src-tauri/src/core/db.rs` | 修改（ScreenshotSource, favorites, game_tags） |
| `src-tauri/src/commands/process.rs` | 修改（sync_steam_playtime, get_playtime_stats） |
| `src-tauri/src/commands/games.rs` | 修改（favorite/tags 命令） |
| `src-tauri/src/commands/mod.rs` | 修改 |
| `src-tauri/src/lib.rs` | 修改（注册新命令 + 启动同步） |
| `src/lib/types.ts` | 修改（新封面 URL 函数） |
| `src/components/GameCard.tsx` | 修改（竖版比例 + 收藏星标 + 标签） |
| `src/components/GameIcon.tsx` | 修改（封面 URL 优先级） |
| `src/pages/Launcher.tsx` | 修改（标签筛选栏 + 排序增强） |
| `src/App.tsx` | 修改（新路由） |
| `src/components/Layout.tsx` | 修改（新侧边栏项） |
| `src/i18n/zh.ts` `en.ts` | 修改（playtime/screenshots/tags i18n） |
