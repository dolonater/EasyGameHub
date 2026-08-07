# 组件级液态玻璃（Liquid Glass）设计文档

> 日期：2026-07-26
> 状态：待实现
> 参考来源：`animotion/yzrt-master/纯CSS液态玻璃`

---

## 一、背景与目标

当前项目已经尝试过将 fluid-glass / glassmorphism 风格应用到页面级区域，但实践结果表明：

- 大面积面板/页面使用液态玻璃会让 UI 变得过于实验性
- 容易影响信息可读性
- 大容器级玻璃效果在真实产品里容易显得“塑料感”或“过度装饰”

参考项目 `animotion/yzrt-master/纯CSS液态玻璃` 的实现后，判断这类视觉语言更适合：

- 按钮
- 胶囊型切换控件
- 小型操作控件
- badge / chip / icon button

**目标**：
将液态玻璃效果从“页面级 / 面板级”收敛为**组件级视觉增强**，只作用于交互控件，不大面积覆盖页面容器。

---

## 二、设计原则

### 1. 小组件优先，不做整页液态玻璃
液态玻璃效果只适用于小面积交互组件，不再对以下元素使用：

- 页面背景
- 大卡片容器
- 大面板
- 整个侧边栏
- 整个弹窗主体
- 整块列表区域

### 2. 玻璃是“强调”，不是“基底”
液态玻璃用于提升交互质感，而不是替代整个设计系统。

### 3. 兼容现有主题系统
颜色、边框、高光必须尽量基于现有 token：

- `--background`
- `--card`
- `--border`
- `--foreground`
- `--muted-foreground`
- `--primary`

避免写死整套亮/暗颜色。

### 4. 优先纯 CSS
本阶段不引入 `three` / `@react-three/fiber` / `@react-spring/web`。
只使用现有前端技术栈：

- React
- Tailwind
- CSS
- CSS 伪元素
- `backdrop-filter`

---

## 三、参考项目关键实现点

参考文件：
- `animotion/yzrt-master/纯CSS液态玻璃/index.html`
- `animotion/yzrt-master/纯CSS液态玻璃/css/styles.css`

### 借鉴点

#### 1. 多层 inset 高光与暗边
```css
box-shadow:
  inset 2px -2px 1px -1px rgba(255,255,255,.9),
  inset -2px 2px 1px -1px rgba(255,255,255,.9),
  inset 6px -6px 1px -6px rgba(255,255,255,.55),
  inset -6px 6px 1px -6px rgba(255,255,255,.55),
  inset 0 0 2px rgba(0,0,0,.8),
  0 4px 8px rgba(0,0,0,.2);
```
作用：提升液态玻璃边缘厚度感。

#### 2. 对角高光膜层
```css
background: linear-gradient(
  45deg,
  rgba(255,255,255,.8) 0%,
  transparent var(--tr),
  transparent calc(100% - var(--tr)),
  rgba(255,255,255,.8) 100%
);
```
作用：制造液态边缘高光与表面流动感。

#### 3. 圆形/胶囊内圈 overlay
```css
.circle-overlay
```
作用：增强按钮膜层感。

#### 4. 轻量 blur + 极淡背景
```css
background: rgba(255,255,255,.04);
backdrop-filter: blur(2px);
```
作用：保留透明感，不做大块毛玻璃。

### 不直接照搬的点

#### 1. `filter: contrast(3)`
不全局使用。会让真实产品中的文本和边缘发脏。

#### 2. 过强的塑料质感
原 demo 是展示性质，产品里要减弱：
- inset 白边强度
- 黑边强度
- blur 强度

#### 3. 所有控件同一强度
实际产品中不同控件层级需要不同风格强度。

---

## 四、组件层级设计

### 1. `liquid-btn`
适用于：
- 普通操作按钮
- 次级按钮
- 弹窗底部按钮

特点：
- 轻液态
- 可读性优先
- 高光较弱
- 边缘柔和

### 2. `liquid-segment`
适用于：
- list/grid 视图切换按钮
- segmented control
- tab-like 小切换器

特点：
- 更明显的胶囊感
- active 态更强
- 非 active 态更轻

### 3. `liquid-icon-btn`
适用于：
- 小图标按钮
- 迷你 action
- 折叠箭头按钮（可选）

特点：
- 紧凑
- 高光集中
- 不喧宾夺主

### 4. `liquid-chip`（可选第二阶段）
适用于：
- badge
- preset 标签
- 小状态标记

---

## 五、第一批落地范围

### A. 三处视图切换按钮
文件：
- `src/pages/Launcher.tsx`
- `src/pages/GameList.tsx`
- `src/pages/steam/Inventory.tsx`

目标：
- list/grid 按钮从普通按钮改成 `liquid-segment`
- 仅影响按钮本身，不影响视图内容容器

### B. 设置页主题区操作按钮
文件：
- `src/pages/Settings.tsx`

目标：
- 编辑 / 复制 / 删除 / 导出
- 新建主题 / 恢复预设 / 导入 / 导出全部
- 统一改成 `liquid-btn`

### C. 设置页恢复默认设置按钮
文件：
- `src/pages/Settings.tsx`

目标：
- 作为更强一点的液态按钮样例

---

## 六、第二批（如果第一批效果好）

### A. About 页按钮
文件：
- `src/pages/About.tsx`

### B. 弹窗底部通用按钮
文件：
- `src/components/Dialog.tsx`
- `src/components/EditGameDialog.tsx`
- 以及其他确认对话框内按钮

### C. 主题折叠箭头（可选）
文件：
- `src/pages/Settings.tsx`

---

## 七、不纳入本次范围

以下元素本轮不做液态玻璃：

- 页面背景
- 大容器卡片
- Dashboard 统计卡容器
- 侧边栏导航
- 输入框
- 下拉框
- 大弹窗主体
- 面板整体背景

原因：
- 可读性风险高
- 风格容易过载
- 已验证页面级 liquid glass 不适合当前项目方向

---

## 八、样式设计建议

### `liquid-btn`
建议包含：
- 微透明背景
- 轻 blur
- 上下/左右轻微 inset 高光
- 弱阴影
- 轻微 hover 高光增强

### `liquid-segment`
建议包含：
- 胶囊圆角
- inactive：轻玻璃感
- active：更强高光和更实一点的玻璃底
- 图标支持浅/暗模式一致表现

### `liquid-icon-btn`
建议包含：
- 小尺寸圆角
- 中心聚焦高光
- hover 时略增强亮边

### 深色模式
统一原则：
- 降低白色高光强度
- 提升局部边缘对比
- 保持图标和文字可读性

---

## 九、实现文件

### 新增/修改文件

#### 主要样式
- `src/index.css`
  - 新增 `liquid-btn`
  - 新增 `liquid-segment`
  - 新增 `liquid-icon-btn`
  - 可能新增 `liquid-chip`

#### 主要页面
- `src/pages/Launcher.tsx`
- `src/pages/GameList.tsx`
- `src/pages/steam/Inventory.tsx`
- `src/pages/Settings.tsx`

#### 如需统一图标逻辑
- `src/lib/icons.ts`
  - 保持现有 `ICONS` 常量复用

---

## 十、验证方式

### 视觉验证
1. 启动台 list/grid 切换按钮是否呈现液态胶囊感
2. 游戏列表 list/grid 切换按钮是否与启动台一致
3. Steam 库存 list/grid 切换按钮是否一致
4. 设置页主题区的小按钮是否有液态玻璃感，但不影响可读性
5. 浅色/暗色模式下按钮文字和图标都清晰可见

### 交互验证
1. hover 时高光是否增强但不过分夸张
2. active / inactive 状态是否足够清楚
3. 按钮不会因为 blur 导致点击区域不清晰

### 代码验证
- `npx tsc --noEmit`

---

## 十一、推荐实施顺序

1. 在 `src/index.css` 中实现 `liquid-btn` / `liquid-segment`
2. 先替换三处视图切换按钮
3. 再替换设置页主题区按钮
4. 最后微调深浅色模式表现

---

## 十二、推荐结论

本项目的 liquid-glass 最佳方向不是“页面级液态玻璃”，而是：

> **组件级液态玻璃**

只在高交互、小体量控件上使用，才能既保留实验感，又不损害整体产品可用性和信息密度。
