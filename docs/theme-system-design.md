# 主题系统设计文档

> 创建日期: 2026-07-24
> 状态: 待实施

---

## 一、设计目标

在现有亮/暗二元切换之上，构建**高度自定义主题引擎**，支持：

- 完整调色板编辑（16 个 CSS 变量）
- 预设 + 自由编辑 + 导入导出
- 页面级主题绑定（不同页面可设不同主题）
- 亮/暗两套变量内置于每个主题

---

## 二、数据模型

### 2.1 `themes.json` — 主题存储

```typescript
interface ThemesData {
  themes: Theme[];              // 所有主题
  globalDefault: string;        // 全局默认主题 ID
  pageBindings: PageBindings;   // 页面绑定
}

interface Theme {
  id: string;                   // 唯一标识，如 "ocean-blue"
  name: string;                 // 显示名称，如 "深海蓝"
  isPreset: boolean;            // 内置预设 or 用户创建
  light: ThemeVariant;          // 亮色变量
  dark: ThemeVariant;           // 暗色变量
}

interface ThemeVariant {
  background: string;           // "240 10% 3.9%" — H S% L%
  foreground: string;
  card: string;
  "card-foreground": string;
  primary: string;
  "primary-foreground": string;
  secondary: string;
  "secondary-foreground": string;
  muted: string;
  "muted-foreground": string;
  accent: string;
  "accent-foreground": string;
  destructive: string;
  "destructive-foreground": string;
  border: string;
  input: string;
  ring: string;
}

interface PageBindings {
  launcher: string | null;      // 主题 ID，null = 使用全局默认
  inventory: string | null;
  playtime: string | null;
  settings: string | null;
}
```

### 2.2 `config.json` — 新增字段

在现有 `Config` struct 中新增：

```rust
pub struct Config {
    // ...现有字段
    pub theme_mode: String,  // "light" | "dark"，从 localStorage 迁移至此
}
```

### 2.3 radius 不纳入主题

`--radius` 保持为全局设置（在设置页单独配置），不作为主题变量。切换主题不改变圆角。

---

## 三、Fallback 链路

```
页面绑定主题 → 全局默认主题 → 系统默认主题（不可删除）
```

- **系统默认**（`system-default`）：当前灰白/灰黑配色，不可删除，作为最终 fallback
- **全局默认**：用户在设置中选择的任意主题，未绑定页面的默认选项
- **页面绑定**：在主题编辑器 → 页面绑定 Tab 中为每个页面指定，覆盖全局默认

---

## 四、内置预设主题（5 套）

| ID | 名称 | 风格描述 |
|---|---|---|
| `system-default` | 系统默认 | 当前灰白/灰黑（不可删除） |
| `ocean-blue` | 深海蓝 | 暗蓝底色 + 蓝白强调，VS Code Dark+ 风格 |
| `warm-amber` | 暖琥珀 | 深褐底色 + 琥珀金主色，Steam 风格 |
| `forest-green` | 墨绿森 | 暗绿基调 + 翠绿强调，护眼风格 |
| `cherry-pink` | 樱粉 | 软粉/玫红强调，女性向 |

---

## 五、Rust 后端

### 5.1 Tauri 命令

| 命令 | 参数 | 返回 | 说明 |
|---|---|---|---|
| `get_themes_data` | — | `ThemesData` | 读取 `themes.json` |
| `save_themes_data` | `data: ThemesData` | `()` | 写入 `themes.json` |

> 导入/导出文件读写走前端 `@tauri-apps/plugin-dialog`，后端不参与文件选择。

### 5.2 存储位置

```
{tool_dir}/
  ├── config.json       # 现有配置 + theme_mode
  └── themes.json       # 主题数据（新增）
```

### 5.3 预设管理

内置预设硬编码在 Rust 中。当 `themes.json` 不存在（首次启动）时自动写入默认预设。提供 `reset_preset_themes` 命令恢复内置预设。

---

## 六、React 架构

### 6.1 两层 Context

```
ThemeDataProvider          — 主题库数据 + 全局默认 + 页面绑定（不常变）
  └─ ActiveThemeProvider   — 根据当前 route + 亮/暗模式解析 CSS 变量（随页面/主题变化）
       └─ 各页面组件
            └─ <div style={{ ...activeVars }}>   // 内联注入到页面根 div
```

### 6.2 Hooks

```typescript
// 获取当前页面的激活 CSS 变量（用于注入到根 div）
function useActiveTheme(): Record<string, string>

// 获取主题数据（用于设置页/编辑器）
function useThemeData(): {
  themes: Theme[];
  globalDefault: string;
  pageBindings: PageBindings;
  themeMode: "light" | "dark";
  setGlobalDefault: (id: string) => void;
  setPageBinding: (page: string, id: string | null) => void;
  setThemeMode: (mode: "light" | "dark") => void;
  saveTheme: (theme: Theme) => void;
  deleteTheme: (id: string) => void;
}
```

### 6.3 运行时 CSS 变量注入

每页通过 `useActiveTheme()` 获取当前主题的 CSS 变量对象，以内联样式注入页面根 `<div>`：

```tsx
// 示例：Launcher 页面
function Launcher() {
  const vars = useActiveTheme("launcher");
  return (
    <div style={vars}>
      {/* 页面内容，所有 Tailwind token 自动继承内联变量 */}
    </div>
  );
}
```

变量作用域自然限制在该页面子树内，不同页面可同时使用不同主题。

### 6.4 亮/暗模式

- 亮/暗模式继续通过 `<html>` 上的 `.dark` class 切换（保持 Tailwind `darkMode: "class"` 兼容）
- 模式状态从 localStorage 迁移到 `config.json` → `theme_mode` 字段
- 主题编辑器的预览抽屉内有独立的亮/暗预览切换（仅影响预览，不影响实际渲染）

---

## 七、UI 设计

### 7.1 设置页 — 主题区域结构

**上半部分："当前使用"**

```
┌─ 当前使用的主题 ─────────────────────────────┐
│                                                │
│  全局默认:  [深海蓝          ▼]               │
│                                                │
│  页面绑定:                                     │
│  启动台     深海蓝                             │
│  库存       墨绿森                             │
│  时长统计   使用全局默认                       │
│  设置       使用全局默认                       │
│                                    [管理绑定]  │
└────────────────────────────────────────────────┘
```

**下半部分："所有主题"**

```
┌─ 所有主题 ────────────────────────────────────┐
│                                                │
│  ●●●●●●  深海蓝      [编辑] [复制] [导出] [删] │
│  ●●●●●●  暖琥珀      [编辑] [复制] [导出] [删] │
│  ●●●●●●  墨绿森      [编辑] [复制] [导出] [删] │
│  ●●●●●●  樱粉        [编辑] [复制] [导出] [删] │
│  ●●●●●●  系统默认    [编辑] [复制]             │
│                                                │
│  [+ 新建主题]  [导入主题]  [恢复预设]          │
└────────────────────────────────────────────────┘
```

### 7.2 编辑抽屉（右侧滑入，400-500px）

**Tab 1 — 变量编辑**

```
┌─ 编辑主题: 深海蓝 ─────────────────── [×] ────┐
│ [变量编辑] [页面绑定]                           │
│                                                 │
│ ┌─ 预览 ────────────────────────────────────┐  │
│ │ ┌──────────────────────────┐               │  │
│ │ │  Card Title              │               │  │
│ │ │  Some description text   │               │  │
│ │ │  [Primary Button]        │               │  │
│ │ └──────────────────────────┘               │  │
│ │ [input___________________]                  │  │
│ │ ┌──────────────────────────────────────┐   │  │
│ │ │ ■ bg  ■ fg  ■ card  ■ pf             │   │  │
│ │ │ ■ sc  ■ sf  ■ mutd ■ mf              │   │  │
│ │ │ ■ acc ■ af  ■ dst  ■ df              │   │  │
│ │ │ ■ bdr ■ inp ■ ring                   │   │  │
│ │ └──────────────────────────────────────┘   │  │
│ └────────────────────────────────────────────┘  │
│                                                 │
│ 预览模式: [☀ 亮色] [☾ 暗色]                     │
│                                                 │
│ ┌─ 变量列表 ────────────────────────────────┐  │
│ │ ▶ ■ background          240  10%  3.9%   │  │
│ │   [━━━━━━━━━━━━━━━━━━] [━━━━━━] [━━━━━━] │  │
│ │   H: 240             S: 10%    L: 3.9%   │  │
│ │                                           │  │
│ │ ▶ ■ foreground          0     0%    98%  │  │
│ │ ▷ ■ card                240  10%  3.9%   │  │
│ │ ▷ ■ card-foreground     0     0%    98%  │  │
│ │ ▷ ■ primary             0     0%    98%  │  │
│ │ ▷ ... (其余 11 个)                        │  │
│ └───────────────────────────────────────────┘  │
│                                                 │
│                              [取消]  [保存主题]  │
└─────────────────────────────────────────────────┘
```

**Tab 2 — 页面绑定**

```
┌─ 页面绑定 ─────────────────────────────────────┐
│                                                 │
│  启动台 (Launcher)                              │
│  [深海蓝                        ▼]             │
│                                                 │
│  库存 (Inventory)                               │
│  [墨绿森                        ▼]             │
│                                                 │
│  时长统计 (Playtime)                            │
│  [使用全局默认                  ▼]             │
│                                                 │
│  设置 (Settings)                                │
│  [使用全局默认                  ▼]             │
│                                                 │
└─────────────────────────────────────────────────┘
```

每个下拉选项包含：所有主题 + "使用全局默认"（置顶）。

### 7.3 变量编辑控件

每个 HSL 变量展开后：

- **HSL 三滑块**：色相（0-360 渐变条）、饱和度（0-100%）、亮度（0-100%）
  - 拖拽滑块时实时更新上方预览
  - 也可直接输入数值
- **高级按钮**：展开二维 S-L 色板 + 水平 H 色条（类 Photoshop 拾色器）
- **可选 `<input type="color">`** 作为快捷拾色补充

颜色值与 HSL 格式一一对应（`"H S% L%"`），无需格式转换。

### 7.4 迷你预览

编辑抽屉内置预览区，分两部分：
- **上方**：模拟 UI 组件（卡片含标题/正文/按钮、输入框、文本行），反映真实使用效果
- **下方**：4×4 色块矩阵，一眼看到完整调色板

编辑器内支持独立的亮/暗预览切换（不影响实际渲染的主题模式）。

---

## 八、关键行为

### 8.1 删除主题

```
确认弹窗:

  ┌─────────────────────────────────────────────────┐
  │ 确定要删除"深海蓝"吗？                           │
  │                                                  │
  │ ⚠ 此主题正被以下位置使用：                       │
  │   · 全局默认主题                                 │
  │   · Launcher 页面                                │
  │                                                  │
  │ 删除后这些位置将自动使用"系统默认"。              │
  │                                                  │
  │                              [取消]  [确认删除]  │
  └─────────────────────────────────────────────────┘
```

- 确认后自动 fallback（被影响的页面/全局默认 → 系统默认）
- 系统默认主题不可删除

### 8.2 复制主题

- 点击复制 → 立即创建副本，名称为 `"{原名}（副本）"`
- 如果 `"{原名}（副本）"` 已存在，追加数字：`"{原名}（副本2）"`
- 不弹出编辑面板，用户可在列表中自行点击编辑

### 8.3 导入/导出

**导出单个主题**
```
导出文件: 深海蓝.dth.json
内容: { type: "theme", data: Theme }
```

**导出全部主题**
```
导出文件: doona-themes-backup.json
内容: { type: "collection", data: Theme[] }
```

**导入**
- 自动检测文件格式（单主题 / 合集）
- 合集导入时，ID 冲突的主题询问是否覆盖
- 导入的主题 `isPreset: false`

文件选择/保存使用 `@tauri-apps/plugin-dialog`，在前端完成 JSON 序列化/反序列化。

### 8.4 恢复预设

- 点击"恢复预设" → 确认弹窗："将恢复所有内置预设主题，现有同名自定义主题将被覆盖。继续？"
- 恢复的预设 `isPreset: true`
- 系统默认主题始终被恢复

---

## 九、图表颜色自动派生

[Playtime.tsx](../src/pages/Playtime.tsx) 中当前硬编码的 `PALETTE`（9 色进度条）和 `PIE_COLORS`（15 色饼图）改为从主题自动生成。

**算法**：
1. 取当前主题的 `primary` 色相 `H`
2. 从 `H - 60°` 开始，每次 `+30°`（色相环均匀分布）
3. 饱和度/亮度取 `accent` 和 `muted` 的插值
4. 保证相邻颜色在色相环上至少间隔 20° 以上，避免视觉混淆

这样切换主题时图表颜色自动适配，无需用户手动配置。

---

## 十、实施计划

### 第一阶段：核心主题引擎

- [ ] Rust: `Theme` / `ThemesData` 数据结构 + `themes.json` 读写
- [ ] Rust: `get_themes_data` / `save_themes_data` Tauri 命令
- [ ] React: `ThemeDataProvider` + `ActiveThemeProvider` 两层 Context
- [ ] React: `useActiveTheme()` hook + 页面根 div 内联注入
- [ ] React: 设置页 → 主题列表（色块预览 + 名称 + 操作按钮）
- [ ] React: 编辑抽屉 → 变量编辑 Tab（HSL 三滑块 + 迷你预览）
- [ ] React: 新建 / 复制 / 删除主题
- [ ] config.json 新增 `theme_mode` 字段
- [ ] 内置预设硬编码 + 首次启动写入

### 第二阶段：页面绑定

- [ ] React: 编辑抽屉 → 页面绑定 Tab（4 个下拉选择器）
- [ ] React: 设置页 → "当前使用"区域（全局默认 + 绑定一览）
- [ ] React: Fallback 链路实现（页面 → 全局 → 系统默认）
- [ ] 删除安全确认（告知影响 + 自动回退）
- [ ] 亮/暗模式迁移至 config.json

### 第三阶段：导入导出 + 图表适配

- [ ] 导入/导出（单主题 + 合集）
- [ ] 恢复内置预设
- [ ] 图表颜色自动派生算法
- [ ] 高级色板（二维 S-L + H 条）— 可选增强

---

## 附录：决策汇总

| # | 决策 | 选项 |
|---|---|---|
| 1 | 自定义范围 | D — 完整调色板 + 组件级覆盖 |
| 2 | 编辑方式 | C — 预设 + 自由编辑 + 导入导出 |
| 3 | 组件级粒度 | A — 页面级绑定 |
| 4 | 亮/暗关系 | A — 每个主题内含 light + dark |
| 5 | 预设可修改性 | C — 全部平权，预设可编辑 |
| 6 | 持久化方式 | C — 独立 themes.json（Rust 管理） |
| 7 | 编辑器位置 | C — 设置页列表 + 独立编辑抽屉 |
| 8 | 变量编辑控件 | D — HSL 三滑块 + 可选高级色板 |
| 9 | 页面绑定入口 | 全部在主题编辑器内管理 |
| 10 | CSS 注入机制 | A — 页面根 div 内联样式 |
| 11 | 绑定数据存储 | D — 绑定独立存储，主题纯色值 |
| 12 | Fallback | C — 页面 > 全局 > 系统默认 |
| 13 | 导入导出格式 | C — 单文件 + 合集自动识别 |
| 14 | 编辑器预览 | D — 模拟 UI + 色块矩阵 |
| 15 | 内置预设 | A — 5 套（系统默认+深海蓝+暖琥珀+墨绿森+樱粉） |
| 16 | 绑定编辑 UI | B — 独立 Tab，每个页面一个下拉 |
| 17 | 设置入口结构 | C — 上半当前使用 + 下半所有主题 |
| 18 | 删除安全性 | C — 确认弹窗告知影响 + 自动 fallback |
| 19 | 复制行为 | A — 直接复制 + "（副本）"后缀 |
| 20 | React 架构 | B — 两层 Context（Data + Active） |
| 21 | 亮/暗切换位置 | C — 设置页 + 编辑器内预览切换 |
| 22 | 可编辑变量 | B — 16 个颜色变量，radius 独立 |
| 23 | 图表颜色 | C — 从主题主色自动派生 |
| 24 | Rust 命令 | C — 读写 themes.json，导入导出走前端 |
| 25 | 编辑面板形式 | B — 右侧抽屉 |
| 26 | 亮/暗持久化 | B — 收入 config.json |
| 27 | 迷你预览 | C — 模拟 UI + 色块矩阵 |
| 28 | 颜色选择器 | D — HSL 滑块 + 可选高级色板 |
| 29 | 实施顺序 | A — 一期全做（按三阶段组织） |
