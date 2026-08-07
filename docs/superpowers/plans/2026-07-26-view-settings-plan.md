# 启动台 / 游戏列表 / Steam 库存视图设置系统实现计划

> 基于设计文档 [2026-07-26-view-settings-design.md](../specs/2026-07-26-view-settings-design.md)
>
> 范围：视图设置数据层 / 页面级持久化 / 主弹窗 / 预设管理子弹窗 / 预设导入导出 / 三页面接入

---

## 0. 执行原则

- 严格按任务顺序执行，不提前跳做后续 UI 细节。
- 每个任务完成后立即运行对应验证命令。
- 先建立数据层与类型，再接入页面，再补齐预设管理与导入导出。
- 与设计文档保持一致：页面配置与预设库分离，`common` 不受视图预设覆盖。
- 现有 `localStorage` 视图模式仅在迁移阶段读取一次，最终以 `view-settings.json` 为唯一持久化来源。

---

## 1. 任务概览

| 分组 | 任务数 | 说明 |
|------|--------|------|
| A. Rust 视图设置存储与命令 | 5 | 新建 `view-settings.json` 数据层、默认预设、命令注册 |
| B. 前端类型与 Hook | 5 | TypeScript 类型、Context/Hook、页面状态与预设操作 |
| C. 通用 UI 组件 | 4 | 大型居中弹窗、主弹窗、预设管理子弹窗、样式与图标 |
| D. 页面接入与渲染适配 | 5 | Launcher / GameList / Inventory 的接入与视图参数生效 |
| E. 导入导出与冲突处理 | 3 | 单个预设、整库导入导出、冲突处理弹窗 |
| F. 回归与迁移清理 | 3 | 清理 `localStorage` 依赖、补 i18n、全量类型检查 |
| **合计** | **25** | |

---

## A. Rust 视图设置存储与命令

### A1. 新建 Rust 数据模型与默认预设
**文件：** `src-tauri/src/core/view_settings.rs`（新建）

新增 Rust 数据结构：

- `ViewSettingsData`
- `PageViewSettings`
- `PageViewBinding<T>`
- `ViewPresetLibrary<T>`
- `ViewPreset<T>`
- `CommonViewSettings`
- `ListViewSettings`
- `GridViewSettings`
- `ViewPage`
- `ViewKind`

实现：

- `default_view_settings_data()`
- `preset_list_view_settings()`
- `preset_grid_view_settings()`
- `load_view_settings(path)`
- `save_view_settings(path, data)`
- `reset_builtin_view_presets(data)`

要求：

- `launcher` / `gameList` / `inventory` 三页默认存在完整配置
- 内置列表预设包含：紧凑 / 标准 / 信息增强 / 横幅
- 内置封面预设包含：紧凑 / 标准 / 海报墙 / 信息卡片墙
- “标准”预设内容先映射当前现状
- 页面 `list` / `grid` 初始 `mode` 为 `preset`
- 页面 `values` 始终持有有效快照

**验证：** `cargo check`

---

### A2. 添加 Rust 单元测试
**文件：** `src-tauri/src/core/view_settings.rs`

新增测试：

- 缺失文件时自动创建默认 `view-settings.json`
- 保存后可完整 roundtrip
- 重置内置预设时不删除自定义预设
- 删除预设后页面快照仍保留的辅助逻辑测试（若放入 core helper）

**验证：** `cargo test view_settings -- --nocapture`

---

### A3. 将视图设置模块接入 `core` 与 `AppState`
**文件：**
- `src-tauri/src/core/mod.rs`
- `src-tauri/src/lib.rs`

编辑内容：

- 在 `core/mod.rs` 中注册 `pub mod view_settings;`
- 在 `AppState` 中新增 `view_settings_path: PathBuf`
- 在 `run().setup()` 中初始化 `tool_dir.join("view-settings.json")`
- 将该路径写入 `AppState`

**验证：** `cargo check`

---

### A4. 新建 Tauri 命令模块
**文件：** `src-tauri/src/commands/view_settings.rs`（新建）

新增命令：

```rust
#[tauri::command]
pub fn get_view_settings_data(state: tauri::State<'_, AppState>) -> Result<ViewSettingsData, String>

#[tauri::command]
pub fn save_view_settings_data(state: tauri::State<'_, AppState>, data: ViewSettingsData) -> Result<(), String>

#[tauri::command]
pub fn reset_builtin_view_settings_presets(state: tauri::State<'_, AppState>) -> Result<ViewSettingsData, String>

#[tauri::command]
pub fn read_view_settings_file(path: String) -> Result<String, String>

#[tauri::command]
pub fn write_view_settings_file(path: String, content: String) -> Result<(), String>
```

要求：

- `read_*/write_*` 风格与主题系统一致
- `reset_builtin_view_settings_presets` 只恢复内置预设，不清空自定义预设和页面配置

**验证：** `cargo check`

---

### A5. 注册命令导出
**文件：**
- `src-tauri/src/commands/mod.rs`
- `src-tauri/src/lib.rs`

编辑内容：

- `commands/mod.rs` 增加 `pub mod view_settings;`
- `generate_handler![]` 注册上一步全部视图设置命令

**验证：** `cargo check`

---

## B. 前端类型与 Hook

### B1. 扩展 TypeScript 类型定义
**文件：** `src/lib/types.ts`

新增类型：

- `ViewPage = "launcher" | "gameList" | "inventory"`
- `ViewKind = "list" | "grid"`
- `ViewSettingsData`
- `PageViewSettings`
- `PageViewBinding<T>`
- `ViewPresetLibrary<T>`
- `ViewPreset<T>`
- `CommonViewSettings`
- `ListViewSettings`
- `GridViewSettings`
- `ViewPresetSource = "builtin" | "custom"`

补充辅助类型：

- `ViewPresetMatchState = "preset" | "adjusted"`
- `ViewPresetLibraryKind = "list" | "grid"`

要求：

- 字段名与 Rust `serde(rename_all = "camelCase")` 兼容
- `GameList` 页面 key 统一采用 `gameList`

**验证：** `npx tsc --noEmit`

---

### B2. 新建视图设置 Hook / Context
**文件：** `src/hooks/useViewSettings.tsx`（新建）

实现：

- `ViewSettingsProvider`
- `useViewSettings()`
- `resolvePageFromPathname(pathname)`
- `useCurrentPageViewSettings()`
- `usePageViewConfig(page)`

Context 中提供：

- `data`
- `loading`
- `refresh()`
- `setPageDefaultView(page, kind)`
- `savePageSettings(page, draft)`
- `applyPresetToPageView(page, kind, presetId)`
- `setAdjustedPageView(page, kind, values)`
- `saveAsCustomPreset(kind, name, description, values)`
- `updatePreset(kind, presetId, values)`
- `renamePreset(kind, presetId, name)`
- `deletePreset(kind, presetId)`
- `copyPreset(kind, presetId)`
- `reorderCustomPresets(kind, orderedIds)`
- `resetBuiltins()`

逻辑要求：

- 页面编辑默认只更新页面配置，不直接写回预设库
- 若页面处于 `preset` 状态并且值仍等于对应预设，则继续保持 `preset`
- 只要手调参数偏离预设，即转为 `adjusted`
- 删除正在被引用的预设时，相关页面自动冻结为当前 `values`
- 跨页面应用预设时，返回一个 `ignoredFields` 数组，供 UI 弹 toast

**验证：** `npx tsc --noEmit`

---

### B3. 为不同页面定义字段裁剪器
**文件：** `src/hooks/useViewSettings.tsx`

新增 helper：

- `sanitizeListSettingsForPage(page, values)`
- `sanitizeGridSettingsForPage(page, values)`
- `getSupportedListFields(page)`
- `getSupportedGridFields(page)`

要求：

- 启动台可支持运行状态、徽章、备份信息
- 游戏列表可支持路径、快照信息
- Steam 库存可支持 AppId、安装状态、游玩时长
- 不支持字段在应用时忽略并回传给 UI

**验证：** `npx tsc --noEmit`

---

### B4. 将 Provider 接入应用根部
**文件：** `src/App.tsx`

编辑内容：

- 在 `ThemeDataProvider` 内或其旁边加入 `ViewSettingsProvider`
- 使 `Layout` 与三个目标页面都能访问该 Context

要求：

- 不打乱现有 `ThemeModeProvider` / `ThemeDataProvider` / `ScrollActivityProvider` 的相对职责
- 保持运行时上下文层次清晰

**验证：** `npx tsc --noEmit`

---

### B5. 添加配置迁移与旧键清理辅助逻辑
**文件：** `src/hooks/useViewSettings.tsx`

在初次加载时做一次迁移：

- 读取旧 `localStorage` 键
  - `doona-launcher-view`
  - `doona-view`
  - `doona-inventory-view`
- 若 `view-settings.json` 尚未有用户改动，则用旧值填充各页 `defaultView`
- 迁移成功后移除旧键或标记为已迁移

要求：

- 迁移逻辑只触发一次，不反复覆盖新设置
- 迁移完成后以 `view-settings.json` 为唯一来源

**验证：** `npx tsc --noEmit`

---

## C. 通用 UI 组件

### C1. 扩展图标常量与基础样式
**文件：**
- `src/lib/icons.ts`
- `src/index.css`

编辑内容：

- 在 `ICONS` 中新增齿轮、复制、下载、删除、导入等需要的图标常量；若现有素材不足，先使用已存在图标或文本按钮占位，但常量结构先统一
- 新增大型居中弹窗与预设卡片相关样式类
- 新增预设管理器列表样式

要求：

- 风格与现有 `liquid-btn` / `liquid-segment`、弹窗样式体系兼容
- 不引入页面级 fluid glass 效果

**验证：** `npx tsc --noEmit`

---

### C2. 新建主视图设置弹窗组件
**文件：** `src/components/ViewSettingsDialog.tsx`（新建）

实现：

- 大型居中弹窗，portal 到 `document.body`
- 顶部摘要区
- 列表/封面预设卡片区（横向滚动或自适应换行）
- `通用 / 列表视图 / 封面视图` 三个 Tab
- 底部：取消 / 恢复默认 / 保存

Props 至少包含：

```ts
open: boolean;
page: ViewPage;
initialTab?: "common" | "list" | "grid";
onClose: () => void;
```

行为要求：

- 打开时基于当前页面配置创建本地草稿
- 保存时统一写回页面配置
- 取消时丢弃草稿
- 当某视图处于 `adjusted` 状态时，在对应预设区显示“已调整”文本说明
- 提供“另存为预设”“更新到当前预设”“管理预设”入口

**验证：** `npx tsc --noEmit`

---

### C3. 新建预设管理子弹窗组件
**文件：** `src/components/ViewPresetManagerDialog.tsx`（新建）

实现：

- 大型居中子弹窗或叠层弹窗
- 顶部两个 Tab：列表预设 / 封面预设
- 分组展示：内置预设 / 自定义预设
- 自定义预设支持：排序、重命名、删除、复制、导入、导出
- 内置预设支持：编辑（通过“更新到当前预设”来源实现）、删除、导出
- 提供“一键恢复全部内置预设”按钮

要求：

- 只有自定义预设可排序
- 内置预设顺序固定
- 删除操作需确认
- 对同名导入冲突只负责弹出二选三对话框，不在此任务内实现文件读写细节

**验证：** `npx tsc --noEmit`

---

### C4. 复用现有 Settings 导入冲突模式，补齐 i18n
**文件：**
- `src/i18n/zh.ts`
- `src/i18n/en.ts`
- 视情况新增 `src/components/ViewPresetImportConflictDialog.tsx`，或内联到管理器

新增文案：

- 视图设置入口、主弹窗标题、页签标题
- 预设名称、描述、已调整、另存为预设、更新到当前预设
- 导入导出文案
- 冲突处理文案
- 恢复内置预设确认文案
- 不支持字段已忽略提示文案

要求：

- 文案命名空间与现有 `theme.*` 保持相似组织方式，例如 `viewSettings.*`

**验证：** `npx tsc --noEmit`

---

## D. 页面接入与渲染适配

### D1. 启动台接入视图设置与默认视图来源
**文件：** `src/pages/Launcher.tsx`

编辑内容：

- 用 `useViewSettings()` 替换现有 `localStorage` 视图模式初始化
- 顶部视图切换按钮改为更新页面 `defaultView`
- 在 list/grid 切换区旁增加齿轮按钮
- 点击齿轮打开 `ViewSettingsDialog`
- 依据当前视图决定弹窗默认页签

要求：

- 保留现有动画、排序、搜索、右键菜单行为
- 不修改现有双击启动逻辑

**验证：** `npx tsc --noEmit`

---

### D2. 游戏列表接入视图设置与默认视图来源
**文件：** `src/pages/GameList.tsx`

编辑内容：

- 使用 `gameList` 页面的视图配置替换 `doona-view`
- `monitored / available` 共用同一套页面设置
- 工具栏增加齿轮按钮
- list/grid 切换更新 `defaultView`

要求：

- `page`、`search`、`batchMode`、`available` 分页等状态不纳入视图系统
- 不打破现有批量操作与对话框行为

**验证：** `npx tsc --noEmit`

---

### D3. Steam 库存接入视图设置与默认视图来源
**文件：** `src/pages/steam/Inventory.tsx`

编辑内容：

- 使用 `inventory` 页面的视图配置替换 `doona-inventory-view`
- 工具栏增加齿轮按钮
- list/grid 切换更新 `defaultView`

要求：

- 保留现有排序、过滤、隐藏项、搜索、右键菜单与编辑信息弹窗行为

**验证：** `npx tsc --noEmit`

---

### D4. 将页面视图参数映射到现有渲染
**文件：**
- `src/pages/Launcher.tsx`
- `src/pages/GameList.tsx`
- `src/pages/steam/Inventory.tsx`
- 视情况补充 `src/components/GameCard.tsx`
- 视情况补充 `src/components/GameBannerCard.tsx`

实现内容：

- 根据当前页面的 `list.values` / `grid.values` 控制模板与字段显隐
- 第一版至少实现以下视觉差异：
  - 列表：紧凑 / 标准 / 信息增强 / 横幅
  - 封面：紧凑 / 标准 / 海报墙 / 信息卡片墙
- 显隐字段按页面能力裁剪
- `common` 中的密度 / 圆角 / 阴影参数对现有类名做有限映射

要求：

- “标准”预设效果与当前版本接近
- 不引入新的页面级布局闪动
- 若某模板需要新子组件，可新增最小必要组件，但避免大规模重构三页骨架

**验证：** `npx tsc --noEmit`

---

### D5. 为预设切换与忽略字段添加用户反馈
**文件：**
- `src/components/ViewSettingsDialog.tsx`
- `src/components/ViewPresetManagerDialog.tsx`
- 视情况 `src/components/Notification.tsx` 调用处

实现内容：

- 应用跨页面共享预设时，如存在被忽略字段，通过 `showToast` 轻提示
- 删除被引用预设后，对当前页若受影响也给出提示
- 恢复全部内置预设后给出成功提示

**验证：** `npx tsc --noEmit`

---

## E. 导入导出与冲突处理

### E1. 单个预设导出
**文件：** `src/components/ViewPresetManagerDialog.tsx`

实现内容：

- 使用 `@tauri-apps/plugin-dialog` 的 `save()` 选择路径
- 导出格式：

```json
{
  "type": "view-preset",
  "version": 1,
  "kind": "list" | "grid",
  "data": { ...preset }
}
```

- 文件写入走 `write_view_settings_file`

**验证：** `npx tsc --noEmit`

---

### E2. 整库导出与导入解析
**文件：** `src/components/ViewPresetManagerDialog.tsx`

实现内容：

- 整库导出格式：

```json
{
  "type": "view-preset-library",
  "version": 1,
  "kind": "list" | "grid",
  "data": [ ...presets ]
}
```

- 导入时支持识别单个预设与整库两种格式
- 读取文件内容使用 `read_view_settings_file`
- 导入后所有条目统一转为自定义预设

**验证：** `npx tsc --noEmit`

---

### E3. 同名冲突处理弹窗
**文件：** `src/components/ViewPresetManagerDialog.tsx` 或拆出独立组件

实现内容：

- 当导入项与本地同名预设冲突时，弹出冲突处理对话框
- 支持：覆盖 / 保留两份 / 取消
- “保留两份”时自动重命名新导入项，如 `名称（导入）` / `名称（导入 2）`

要求：

- 若整库中有多项冲突，先汇总后统一处理
- 不在无交互情况下静默覆盖

**验证：** `npx tsc --noEmit`

---

## F. 回归与迁移清理

### F1. 清理旧视图模式 `localStorage` 读写点
**文件：**
- `src/pages/Launcher.tsx`
- `src/pages/GameList.tsx`
- `src/pages/steam/Inventory.tsx`

删除或替换：

- 旧 `loadViewMode()` helper
- `localStorage.getItem(...)`
- `localStorage.setItem(...)`

要求：

- 页面默认视图完全由 `useViewSettings()` 提供
- 不保留双写状态

**验证：** `npx tsc --noEmit`

---

### F2. 全量类型检查与 Rust 编译检查
**文件：** 无

执行命令：

- `npx tsc --noEmit`
- `cargo check`

预期结果：

- 无新增 TypeScript 编译错误
- 无新增 Rust 编译错误
- 若存在旧 warning，可记录但不阻断，只要非本次新增问题

---

### F3. 手工核对实现是否回到设计边界
**文件：**
- `docs/superpowers/specs/2026-07-26-view-settings-design.md`
- `docs/superpowers/progress.md`

核对项：

- 未引入标签级配置
- 未让预设覆盖 `common`
- 未让页面编辑隐式写回预设库
- 导入项未进入内置预设分组
- 删除被引用预设时页面转为快照而非回退标准

将 Stage 3 的待执行状态写入 `docs/superpowers/progress.md`。

**验证：** 无命令；以文档核对为准

---

## 2. 执行顺序摘要

按以下顺序执行：

1. A1 → A2 → A3 → A4 → A5
2. B1 → B2 → B3 → B4 → B5
3. C1 → C2 → C3 → C4
4. D1 → D2 → D3 → D4 → D5
5. E1 → E2 → E3
6. F1 → F2 → F3

不得跳过 A/B 直接做页面 UI。

---

## 3. 验证命令清单

### 后端相关
```bash
cargo check
cargo test view_settings -- --nocapture
```

### 前端相关
```bash
npx tsc --noEmit
```

### 阶段收尾
```bash
npx tsc --noEmit && cargo check
```

---

## 4. 预期交付结果

完成本计划后，应得到：

1. 新的 `view-settings.json` 子系统
2. Rust / TypeScript 双端完整类型与持久化逻辑
3. 三个页面统一的齿轮入口与大型视图设置弹窗
4. 列表 / 封面两套内置预设与自定义预设库
5. 预设管理子弹窗
6. 单个预设与整库导入导出能力
7. 页面“已调整”状态与预设跟随/脱离机制
8. 移除旧的视图模式 `localStorage` 直读直写依赖
