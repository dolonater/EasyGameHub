# 启动台 / 游戏列表 / Steam 库存视图设置系统设计文档

> 创建日期：2026-07-26  
> 状态：Stage 1 已批准

---

## 1. 背景与目标

为以下三个页面新增统一的“视图设置”能力：

- 启动台 `launcher`
- 游戏列表 `gameList`
- Steam 库存 `inventory`

目标不是只增加一个样式开关，而是建立一套可复用的页面视图系统，覆盖以下能力：

- 在页面工具栏中提供独立齿轮按钮，进入视图设置入口
- 为每个页面保存独立的视图配置，但三页共享统一数据结构
- 同时支持列表视图与封面视图的预设选择、参数微调和页面级保存
- 将当前现有界面收编为正式预设中的“标准”方案，保证升级后默认体验不突变
- 提供自定义预设库，支持跨页面按视图类型复用
- 支持复制、重命名、删除、排序、导入、导出与恢复内置预设

---

## 2. 范围定义

### 2.1 第一版纳入范围

第一版覆盖以下能力：

- 页面级默认视图选择：列表 / 封面
- 页面级通用视觉参数
- 列表视图预设与高级参数
- 封面视图预设与高级参数
- 信息显示项开关
- 内置预设与自定义预设库
- 预设管理子弹窗
- 单个预设与整库导入导出

### 2.2 第一版明确不纳入范围

以下内容不在第一版内：

- 单击 / 双击行为自定义
- 右键菜单项裁剪
- Hover 交互逻辑编排
- 字段顺序拖拽排序
- 模块级自由布局编辑
- `monitored / available` 这类子标签级单独配置
- 交互行为级预设包

---

## 3. 当前基线与迁移原则

### 3.1 当前基线

当前三个页面已经各自存在可用的 `list / grid` 双视图实现，并且已完成动画、信息密度与图标统一等基础打磨。新系统不从空白开始，而是在现有实现上做“参数化 + 预设化”。

### 3.2 标准预设映射

现有界面将被收编为正式预设中的“标准”：

- 列表视图：`标准`
- 封面视图：`标准`

这两组标准预设分别对应当前线上 UI 的 list / grid 外观，作为默认回退点和迁移基线。

### 3.3 现有持久化迁移

当前视图模式分散保存在前端 `localStorage`：

- 启动台：`doona-launcher-view`
- 游戏列表：`doona-view`
- Steam 库存：`doona-inventory-view`

新系统上线后，页面默认视图统一迁移到 `view-settings.json`，不再依赖散落的本地键值。

### 3.4 游戏列表页的子标签范围

游戏列表页内部包含 `monitored` 与 `available` 两个标签，但它们共用同一份页面视图配置，不拆成标签级配置。与 `available` 标签强绑定的交互元素（如添加按钮显隐）不纳入第一版视图参数。

---

## 4. 核心产品原则

### 4.1 页面配置与预设库分离

系统分为两层：

1. **页面当前配置**：决定当前页面实际呈现效果
2. **预设库**：按视图类型共享的模板资产

页面弹窗中调整参数时，默认只改变当前页面配置，不会隐式写回共享预设。若需要把当前效果沉淀回预设库，必须显式执行“更新到当前预设”或“另存为预设”。

### 4.2 预设按视图类型共享

预设库按视图类型拆分，而不是按页面拆分：

- 列表预设库 `list`
- 封面预设库 `grid`

三个页面共享这两类预设库；页面不支持的字段在应用时自动忽略并提示。

### 4.3 通用设置独立

页面的 `common` 设置独立存在，不跟随列表预设或封面预设变化。预设只作用于对应视图层：

- 列表预设只改 `list`
- 封面预设只改 `grid`
- `common` 不被任何视图预设覆盖

---

## 5. 页面级交互设计

### 5.1 工具栏入口

在三个页面现有的视图切换区旁边新增一个独立齿轮按钮：

- 位置贴近 list / grid 切换按钮
- 语义明确指向“当前页面的视图设置”
- 不与现有 list / grid 切换按钮合并

### 5.2 容器形态

点击齿轮按钮后，打开**大型居中弹窗**，而非右侧抽屉。弹窗具备：

- `createPortal(..., document.body)`
- 半透明模糊 backdrop
- 与现有 `ui_animations` 设置联动的开关动画
- 独立内部滚动区

### 5.3 默认落点

弹窗默认打开到用户当前正在使用的视图页签：

- 当前是 `list` → 默认落到“列表视图” Tab
- 当前是 `grid` → 默认落到“封面视图” Tab

“通用”页签不是默认落点，但始终可切换进入。

### 5.4 主弹窗结构

主弹窗采用三段结构：

1. **顶部摘要区**
   - 当前页面名称
   - 默认视图
   - 当前列表预设名
   - 当前封面预设名
2. **预设区**
   - 列表预设卡片
   - 封面预设卡片
3. **主体 Tab 区**
   - 通用
   - 列表视图
   - 封面视图
4. **底部操作区**
   - 取消
   - 恢复默认
   - 保存

### 5.5 摘要信息显示策略

主弹窗顶部摘要只显示当前预设名，不额外显示“跟随预设 / 已调整”等状态标签。状态变化由当前选中项、可用操作以及内部数据语义体现，不在摘要区堆叠说明。

---

## 6. 主弹窗的参数组织

### 6.1 通用页签

`common` 只放页面级、可同时影响 list 与 grid、且不会和预设语义冲突的参数。第一版建议字段：

- `defaultView`: `list | grid`
- `contentDensity`: `compact | standard | comfortable`
- `cardRadius`: `small | medium | large`
- `shadowLevel`: `none | soft | medium`

这些参数由页面自行维护，不跟任何预设绑定。

### 6.2 列表视图页签

列表页签由“预设 + 高级参数”组成。

#### 内置预设

- 紧凑
- 标准
- 信息增强
- 横幅

#### 第一版高级参数

- `template`: `compact | standard | info-rich | banner`
- `rowGap`: 行间距等级
- `bannerWidth`: `narrow | standard | wide`
- `titleLines`: `1 | 2`
- 信息显隐项（按页面能力裁剪显示）
  - `showPath`
  - `showAppId`
  - `showLastBackup`
  - `showSnapshotCount`
  - `showPlaytime`
  - `showInstallState`
  - `showRunningState`
  - `showBadges`

### 6.3 封面视图页签

封面页签同样采用“预设 + 高级参数”。

#### 内置预设

- 紧凑
- 标准
- 海报墙
- 信息卡片墙

#### 第一版高级参数

- `template`: `compact | standard | poster-wall | info-card-wall`
- `gridDensity`: `compact | standard | relaxed`
- `cardGap`: 网格间距等级
- `coverScale`: `tight | standard | showcase`
- 信息显隐项（按页面能力裁剪显示）
  - `showTitle`
  - `showSubtitle`
  - `showLastBackup`
  - `showSnapshotCount`
  - `showPlaytime`
  - `showInstallState`
  - `showRunningState`
  - `showBadges`

### 6.4 页面能力裁剪

三个页面共享统一的信息架构，但只显示当前页面真正支持的字段，不展示不可用占位项。第一版遵循以下原则：

- 启动台优先暴露运行状态、收藏/置顶、备份信息
- 游戏列表优先暴露路径与快照信息
- Steam 库存优先暴露 AppId、安装目录、体积、游玩时长、安装状态
- `available` 标签独有的按钮级元素不纳入统一参数集

---

## 7. 预设选择与页面状态

### 7.1 列表 / 封面预设独立选择

系统中列表与封面预设是两套独立入口，不存在“一个页面总预设同时覆盖 list + grid”的设计：

- 列表视图选择一个列表预设
- 封面视图选择一个封面预设
- 通用设置不受这两个选择影响

### 7.2 页面状态：纯预设 vs 已调整

页面在某个视图上有两种工作状态：

- `preset`：纯预设状态，页面当前值与预设库一致
- `adjusted`：已调整状态，页面在预设基础上被手动修改过

### 7.3 跟随规则

仅当页面处于 `preset` 状态时，才会跟随预设库后续更新；一旦用户手动修改高级参数，页面转为 `adjusted` 状态，不再自动跟随该预设。

### 7.4 当前视图切换的持久化

顶部 list / grid 按钮保留，并继续承担高频切换职责。但切换结果不再写散落的 `localStorage`，而是同步更新该页面的 `defaultView`。

---

## 8. 预设库设计

### 8.1 预设分类

预设按来源分两类：

- **内置预设**：系统随应用交付的官方预设
- **自定义预设**：用户保存、复制或导入得到的预设

### 8.2 内置预设与自定义预设的展示

在主弹窗预设区与预设管理器中，内置预设与自定义预设分组展示，不混成单一长列表。

### 8.3 自定义预设的来源

用户可以从当前页面当前视图的草稿，点击“另存为预设”，进入命名流程并保存为新的自定义预设。

### 8.4 预设库的共享范围

自定义预设按视图类型跨页面共享：

- 列表自定义预设可在启动台 / 游戏列表 / Steam 库存的列表视图中复用
- 封面自定义预设可在三个页面的封面视图中复用

### 8.5 导入项身份

不论导入源最初是内置还是自定义，导入到当前应用后统一落入**自定义预设**分组，不会成为新的内置预设。

---

## 9. 预设管理与高风险操作

### 9.1 主弹窗与管理子弹窗职责分离

主弹窗负责：

- 选择预设
- 调整当前页面效果
- 另存为预设
- 更新到当前预设

更重的库操作放进单独的“预设管理”子弹窗：

- 重命名
- 删除
- 排序
- 复制
- 导入
- 导出
- 恢复内置预设

### 9.2 管理器结构

管理子弹窗顶部使用两个 Tab：

- 列表预设
- 封面预设

### 9.3 排序规则

只有**自定义预设**支持排序。内置预设顺序固定，不参与拖拽或上下移动。

### 9.4 编辑预设的显式入口

页面参数修改默认不写回共享预设。若要覆盖当前预设定义，必须显式点击“更新到当前预设”。

### 9.5 当前绑定的是内置预设时

若页面当前绑定的是内置预设，而用户又点击“更新到当前预设”，系统弹出二选一确认：

- 覆盖这个内置预设
- 另存为新的自定义预设

### 9.6 删除正在被页面使用的预设

若删除的预设仍被某些页面绑定：

- 删除操作允许继续
- 受影响页面不会回退到别的预设
- 页面会自动冻结为当前效果的 `adjusted` 快照
- 页面不丢样式，只是失去后续跟随关系

### 9.7 恢复内置预设

系统提供“一键恢复全部内置预设”的全局操作：

- 重建所有官方内置预设内容
- 不影响自定义预设
- 不清空页面当前配置

---

## 10. 导入导出规则

### 10.1 导出粒度

支持两种导出粒度：

- 单个预设导出
- 某一类库整库导出（整个列表预设库 / 整个封面预设库）

### 10.2 冲突处理

导入时若本地已存在同名预设，弹出冲突处理对话框，提供三个选项：

- 覆盖现有预设
- 保留两份（对新导入项自动重命名）
- 取消导入

### 10.3 跨页面兼容

同类视图预设跨页面应用时，如果其中某些字段当前页面不支持：

- 支持的字段正常应用
- 不支持的字段自动忽略
- 应用完成后给出轻提示，说明有若干字段被忽略

---

## 11. 存储设计

### 11.1 独立文件

新系统使用独立存储文件：

- `view-settings.json`

不将视图系统塞入现有 `config.json`，原因如下：

- 视图系统具有独立生命周期
- 会持续演化出预设库、导入导出与恢复逻辑
- 与 `themes.json` 类似，更适合作为独立子系统文件

### 11.2 顶层结构

推荐数据模型：

```ts
export type ViewPage = "launcher" | "gameList" | "inventory";
export type ViewKind = "list" | "grid";

export interface ViewSettingsData {
  version: 1;
  pageSettings: Record<ViewPage, PageViewSettings>;
  presetLibraries: {
    list: ViewPresetLibrary<ListViewSettings>;
    grid: ViewPresetLibrary<GridViewSettings>;
  };
}

export interface PageViewSettings {
  defaultView: ViewKind;
  common: CommonViewSettings;
  list: PageViewBinding<ListViewSettings>;
  grid: PageViewBinding<GridViewSettings>;
}

export interface PageViewBinding<TSettings> {
  presetId: string | null;
  mode: "preset" | "adjusted";
  values: TSettings;
  lastPresetId: string | null;
}

export interface ViewPresetLibrary<TSettings> {
  builtins: ViewPreset<TSettings>[];
  customs: ViewPreset<TSettings>[];
}

export interface ViewPreset<TSettings> {
  id: string;
  name: string;
  isPreset: boolean;
  description: string;
  values: TSettings;
}
```

### 11.3 建议字段结构

```ts
export interface CommonViewSettings {
  contentDensity: "compact" | "standard" | "comfortable";
  cardRadius: "small" | "medium" | "large";
  shadowLevel: "none" | "soft" | "medium";
}

export interface ListViewSettings {
  template: "compact" | "standard" | "info-rich" | "banner";
  rowGap: "tight" | "standard" | "relaxed";
  bannerWidth: "narrow" | "standard" | "wide";
  titleLines: 1 | 2;
  showPath?: boolean;
  showAppId?: boolean;
  showLastBackup?: boolean;
  showSnapshotCount?: boolean;
  showPlaytime?: boolean;
  showInstallState?: boolean;
  showRunningState?: boolean;
  showBadges?: boolean;
}

export interface GridViewSettings {
  template: "compact" | "standard" | "poster-wall" | "info-card-wall";
  gridDensity: "compact" | "standard" | "relaxed";
  cardGap: "tight" | "standard" | "relaxed";
  coverScale: "tight" | "standard" | "showcase";
  showTitle?: boolean;
  showSubtitle?: boolean;
  showLastBackup?: boolean;
  showSnapshotCount?: boolean;
  showPlaytime?: boolean;
  showInstallState?: boolean;
  showRunningState?: boolean;
  showBadges?: boolean;
}
```

### 11.4 数据语义说明

- `presetId`: 当前页面此视图绑定的预设 ID
- `mode = "preset"`: 页面完全跟随预设
- `mode = "adjusted"`: 页面脱离预设，使用当前快照值
- `lastPresetId`: 记录最近一次来源预设，便于“更新到当前预设”与提示文案
- `values`: 始终保存当前视图的有效值，确保删除预设后可直接冻结为快照

---

## 12. 与现有实现的对接原则

### 12.1 动画与容器

新弹窗应沿用当前项目已经验证过的以下原则：

- 遮罩与弹窗通过 `createPortal(..., document.body)` 渲染
- 背景采用当前统一的 `soft-backdrop`
- 开关动画遵守全局 `ui_animations` 配置

### 12.2 当前组件基础

第一版不强制立刻把所有 list / grid 渲染都抽到统一组件，但设计上应允许逐步收敛为“模板 + 参数”的形式：

- `GameCard` 作为封面视图共享基础
- `GameBannerCard` 作为横幅风格的重要参考
- 三个页面各自内联的 list 结构后续逐步提取为模板组件

### 12.3 标准预设的实现要求

无论后续如何重构组件，迁移完成后必须保证：

- 若用户未主动变更，三个页面默认外观与当前版本基本一致
- “标准”预设渲染效果与当前版本匹配

---

## 13. 设计审查结论

本设计已经完成以下冲突与边界检查：

1. **页面配置与预设库职责已分离**：日常页面调整不会误伤共享预设
2. **通用设置与视图预设边界已固定**：预设不覆盖 `common`
3. **跨页面共享的兼容策略已明确**：不支持字段忽略并提示
4. **被引用预设删除后的安全行为已确定**：冻结为当前快照，不丢页面效果
5. **内置预设的高权限编辑与恢复机制已闭环**：允许修改删除，但保留“一键恢复全部内置预设”
6. **导入身份边界已清楚**：导入项统一转为自定义预设，不污染内置基线
7. **游戏列表双标签的复杂度已收敛**：`monitored / available` 共用同一页配置，避免状态矩阵膨胀

当前设计不存在阻塞性的占位项、未决选择或相互矛盾项，可进入 Stage 1 审批。
