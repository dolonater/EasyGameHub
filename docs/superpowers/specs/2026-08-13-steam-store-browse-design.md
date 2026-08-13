# Steam 商店浏览设计文档（商城页）

> 创建日期：2026-08-13
> 状态：Stage 1 草案（待用户批准）
> 依赖设计：`docs/superpowers/specs/2026-08-08-monica-steam-features-design.md` §6（D 商城增强，已完成详情页/多区价格）
> 前置共识：经 grill-me 逐项确认 Q1–Q14，全部决策与本设计一致

---

## 1. 背景与目标

EasyGameHub 的 Steam 集成目前只能**搜索后关注**：`GameSearchBox` → `search_steam_games` → `add_manual_watch`。商店侧只有单游戏详情弹窗（`StoreDetailDialog`），没有任何浏览型 UI。

本设计新增**完整的应用内商店浏览**：首页轨道 + 分类/筛选/排序网格 + 卡片直接关注，使"逛商店→关注→跟踪价格/新闻"成为闭环。

### 关键约束

- **免 key**：全部浏览数据源是 store.steampowered.com 的公开 JSON 接口，不需要 Steam Web API Key。
- **无官方标签接口**：Steam 标签浏览（探索队列）走 `/api/explore`（POST + sessionid），v1 明确不做。
- **复用既有设施**：关注流程（`steam_watchlist.json` + `steamHubCache`）、详情弹窗、共享 ureq 客户端、缓存惯例全部复用。

---

## 2. 现状盘点（相关既有能力）

| 能力 | 位置 | 备注 |
|------|------|------|
| 商店搜索 | `steam-sdk/src/client/store.rs::search_games` | `/api/storesearch/`，固定 `cc=cn` |
| 商店详情 + 多区价格 | `get_store_detail` / `get_multi_region_price` + `StoreDetailDialog` | 已实现（D 增强） |
| 关注/取消关注 | `add_manual_watch` / `remove_manual_watch` / `get_manual_watchlist` | 写 `steam_watchlist.json` |
| 关注状态缓存 | `src/lib/steamHubCache.ts` | 模块级 `useSyncExternalStore`，跨路由存活 |
| 共享 HTTP 客户端 | `commands/steam_api.rs::shared_client` | `OnceLock<SteamHttpClient>`（ureq 连接池） |
| 批量详情 | `steam-sdk/src/client/store.rs::get_app_details` | 并行度 8 |
| 路由/导航 | `src/App.tsx`、`src/components/ui/SidebarMenu.tsx` | 侧边栏 steam 组目前只有 `/steam` 一项 |
| 卡片组件 | `GameCard` / `GameBannerCard` | 可复用 |
| 图片 CDN | `shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/{appid}/capsule_616x353.jpg` | 前端 `<img>` 直连，无需后端 |

### 关键缺口（本设计要补的）

1. **无任何浏览型数据接口**——只有搜索和单游戏详情。
2. **无浏览 UI**——无轨道、无网格、无分类/排序/筛选。
3. 侧边栏/导航无商店入口；`icons.ts` 无商店语义图标。

---

## 3. 数据源与协议

全部走 `store.steampowered.com` 免 key JSON 接口（沿用 `SteamHttpClient` + `Referer` 头惯例）：

### 3.1 浏览网格（`/api/storesearch/`）

与现有 `search_games` 同端点，参数化扩展：

| 参数 | 值 | 说明 |
|------|----|------|
| `term` | 用户输入（可选） | 空则纯浏览 |
| `category1` | genre id（可选，如 19=Action） | **固定 genre 大类列表**（Q2 决策），前端持有 id→名称映射（i18n） |
| `sort_by` | 白名单枚举 | `relevance`（默认）/ `Price_ASC` / `Price_DESC` / `Reviews_DESC` / `Released_DESC` |
| `specials` | `1` | 只看打折 |
| `cc` | 8 区之一 | 默认 `cn`（Q6/Q7 决策） |
| `l` | 固定 `schinese` | 与 cc 解耦（Q9 决策） |
| `start` / `count` | 分页 | 默认 count=15，`start` 递增做"加载更多" |

> 实现时以真实请求验证 `start`/`count` 与 `category1` 参数有效性；若有出入，回退方案见 §9 风险表。

响应条目（`StoreSearchItem` 现有字段 + 扩展）：`id`、`name`、`tiny_image`、`price.final/initial/discount_percent/currency`、`release_date`、`platforms`、`metacritic_score`。

### 3.2 首页轨道（`/api/featured` + `/api/featuredcategories/`）

- `/api/featured`：主"精选推荐"轨道，由 `featured_win` / `featured_mac` / `featured_linux` / `large_capsules` 四个数组组成，**合并 + 按 appid 去重**。条目字段：`id`/`type`/`name`/`discount_percent`/`original_price`/`final_price`/`currency`/`small_capsule_image`/`header_image`/`windows_available`/`mac_available`/`linux_available`（三个 `*_available` 布尔，无 `platforms` 对象；**无** metacritic_score 与 release_date）。
- `/api/featuredcategories/`：`specials`/`top_sellers`/`new_releases`/`coming_soon` 四轨的 **`items` 为完整条目对象数组**（同 `/api/featured` 条目字段，含名称/价格/折扣/图/平台），**不是 appid 列表**——无需批量 appdetails 补齐，直接映射即可。`genres` 等其余字段跳过。
- 两个请求合并为**一个后端命令** `get_store_home`，避免前端多次 IPC 与多份加载态。
- > 接口结构对照 SteamWebAPI2（babelshift）`SteamStore.cs` 模型核实（2026-08-13 修复记录：此前误以为 featured 顶层有 `featured` 数组、rails items 为 appid 数字列表，导致解析失败——商城页报"加载失败"）。

### 3.3 区域（Q6/Q7/Q8/Q9 决策）

- 固定 8 区列表：`cn,us,jp,kr,de,gb,au,hk`，与 `get_multi_region_price` 同一口径；默认 `cn`。
- `cc` 随切换器变，`l` 永远 `schinese`。
- 非 cn 区卡片**只显示本地币种**（不做 CNY 换算）；换算只保留在 `StoreDetailDialog`（fx.rs 静态表 + 每游戏多区对比）。

---

## 4. 后端设计

### 4.1 steam-sdk（`steam-sdk/src/client/store.rs`）

- `BrowseItem` 结构：`app_id, name, tiny_image/capsule_image, final_price_cents, initial_price_cents, discount_percent, currency, platforms, release_date, metacritic_score`。
- `browse_games(client, BrowseParams) -> Result<BrowseResult>`：`BrowseParams { term, category, sort, specials, cc, start, count }`；`BrowseResult { total, items: Vec<BrowseItem> }`。
- `featured(client, cc, l) -> Result<Vec<BrowseItem>>`：/api/featured 四个数组合并去重解析（平台由 `*_available` 布尔映射）。
- `featured_categories(client, cc, l) -> Result<Vec<FeaturedRail>>`：`FeaturedRail { id, name, items: Vec<FeaturedItem> }`（条目为完整对象，直接映射 BrowseItem，无需 appdetails 补齐）。
- `sort_by` 白名单枚举解析（非法值拒绝或回退 relevance）。
- 解析单测：三个接口的离线 fixture + 缺字段默认。

### 4.2 Tauri command 层（新文件 `src-tauri/src/commands/steam_store.rs`）

| 命令 | 说明 |
|------|------|
| `browse_steam_games(term?, category?, sort?, specials?, cc?, start?, count?)` | 透传 → SDK `browse_games` |
| `get_store_home(cc?, l?)` | `/api/featured`（四数组合并去重）+ `/api/featuredcategories`（四轨，items 为完整条目直接映射）；返回 `StoreHomeDto { featured, rails }` |

- **缓存**（Q5 决策）：查询键级**内存缓存 TTL 10 分钟**，无文件缓存。浏览键 = `term|category|sort|specials|cc|start`；首页键 = `cc|l`。缓存放在 command 层（`Mutex<HashMap<String, (Instant, Value)>>` 或复用现有缓存模式）。
- 复用 `shared_client`；失败时沿用 1 次重试 + 250ms 退避惯例。
- `lib.rs` 注册两个命令。
- `commands/mod.rs` 暴露新模块。

### 4.3 DTO（前端 `src/lib/steamCommunity.ts`）

```ts
interface BrowseItemDto {
  appId: number;
  name: string;
  capsuleImage?: string;      // CDN 由前端按 appId 拼，此字段仅 /api/featured 直供时用
  finalPriceCents?: number;
  initialPriceCents?: number;
  discountPercent?: number;
  currency: string;
  platforms: { windows: boolean; mac: boolean; linux: boolean };
  releaseDate?: string;
  metacriticScore?: number;
}
interface FeaturedRailDto { id: string; name: string; items: BrowseItemDto[]; }
interface StoreHomeDto { featured: BrowseItemDto[]; rails: FeaturedRailDto[]; }
```

---

## 5. 前端设计

### 5.1 路由与导航

- 新路由 `/steam/store` → `src/pages/steam/Store.tsx`（Q3 决策：独立路由页面，不塞 Steam Hub tab）。
- 侧边栏 steam 组新增"商城"项（`SidebarMenu.tsx` 加 `storeLabel` prop，`Layout.tsx` 侧边栏 + 顶部导航两处传入；`to: "/steam/store"`，同一 steam 组）。
- 图标：`src/lib/icons.ts` 新增商店语义图标（`assets/regular/store.svg` 或 cart 风格 SVG，随仓库图标惯例注册）。
- `App.tsx` 注册路由。

### 5.2 页面结构（Q10/Q12 决策）

```
/steam/store
├── 视图一：首页（无筛选时默认）
│   ├── 精选推荐轨道：大卡横幅（复用 GameBannerCard）
│   └── 4 条轨道（热销/促销/新品/即将推出）：横向滚动卡片行
├── 视图二：浏览网格（任一筛选/搜索生效时）
│   ├── 单行工具栏：搜索框 | 分类下拉 | 排序下拉 | 只看打折 Toggle | 区域下拉
│   └── 卡片网格 + "加载更多"按钮（start 递增，耗尽显示"已加载全部"）
```

- 工具栏任一条件变化 → 重置到第 1 页并重新请求（缓存键含全部条件）。
- 分类：固定 genre 列表（id → i18n 名称），约 12 个（Action/Adventure/Casual/Indie/MMO/Racing/RPG/Simulation/Sports/Strategy 等，实现时按 storesearch category1 有效值核对）。
- 排序选项：相关度/价格升/价格降/评测数/发售日期。
- 区域切换：8 区 Select；切换即重置首页或网格（含缓存键 cc）。
- 语言 `l` 不暴露 UI，后端固定 `schinese`。

### 5.3 卡片（Q4/Q8 决策）

- 复用 `GameCard` 骨架（或网格内卡片样式），显示：capsule 图（CDN 直连）、名称、折扣价（原价删除线）、折扣百分比、平台图标、Metacritic（有则）。
- 价格：`formatPrice(cents, currency)` 新 helper——CNY `¥x.xx`、USD `$x.xx`、其他币种回退 `x.xx {currency}`；非 cn 区只显本地币种。
- 卡片本体点击 → 打开现有 `StoreDetailDialog`（复用 `get_store_detail`，含多区价格表）。
- **关注按钮**：读 `steamHubCache.watchItems` 判定"已关注"，点击调 `add_manual_watch` / `remove_manual_watch`，乐观更新 + 失败回滚（复用 NewsFeed/WishlistPanel 现有交互模式）。关注状态跨页面即时同步（Q11 决策）。

### 5.4 状态管理

- 页面级 state 管理当前视图条件（组件内），不新增全局状态。
- 首页数据（`get_store_home`）与网格数据（`browse_steam_games`）各自独立加载/loading/error/empty 分支。
- 加载态：首页轨道骨架；网格首屏骨架 + 加载更多按钮 loading。
- 错误态：接口失败 → 错误文案 + 重试按钮（不阻塞其他轨道/区块）。

### 5.5 i18n

- `src/i18n/zh.ts` / `en.ts`：`steam.storeLabel`（侧边栏"商城"）、工具栏标签、分类名称、排序项、空态/错误/已加载全部/关注/已关注等全部新文案键。
- 复用现有 `steam.*` 命名空间。

---

## 6. 明确不做（v1 排除清单）

| 项 | 原因 |
|----|------|
| 标签浏览/探索队列（`/api/explore` sessionid 方案） | 脆、需 cookie 管理；二期评估 |
| 卡片 CNY 换算 | fx 表静态会过时；换算留在详情弹窗 |
| 本地已拥有标记 | 本地库匹配噪音 + 性能成本 |
| 公开愿望单并集 | 只有个人愿望单 tab 有语境 |
| 文件级缓存 | 浏览是探索行为，落盘无价值 |
| 侧边栏筛选区 | 单行工具栏已够，窄窗口适配简单 |
| 自定义区域配置 | 8 区固定口径 |
| 排序"名称"等低频项 | 白名单保持精简 |

---

## 7. 验证方式

- **Rust**：`cargo test store`（SDK 解析 fixture 单测：browse/featured/featuredcategories + 缺字段默认 + sort 白名单）；`cargo fmt`、`cargo check`。
- **前端**：`npm run build`（tsc + vite + sdk）。
- **集成手测**（`npm run tauri dev`）：首页 4 轨道加载；搜索/分类/排序/打折/区域切换生效；"加载更多"翻页；非 cn 区价格币种正确；关注/取消后切到 Steam Hub 新闻/愿望单即时同步；点卡片开详情弹窗；断网/接口失败错误态与重试。

---

## 8. 风险与回退

| 风险 | 应对 |
|------|------|
| storesearch 的 `start`/`count`/`category1`/`specials` 参数与预期不符 | 实现第一步先真实请求验证参数形态（curl/单测 --ignored），不符则按实际调整（如 category 改传 `filter`，分页改前端累积） |
| `/api/featured` / `/api/featuredcategories` 结构变动 | 解析层隔离在 `featured`/`featured_categories`（已按 SteamWebAPI2 模型核实）；单接口失败仅首页不可用，错误态可见具体消息（前端错误态展示后端错误文本） |
| 图片 CDN 直连在部分网络环境加载慢 | 前端懒加载（`loading="lazy"`），与现有 GameCard 行为一致 |
| 非 cn 区部分游戏不可售/价格缺失 | 条目缺失字段按空处理，卡片显示"暂无价格" |

---

## 9. 阶段划分

```
P1  SDK：browse_games + featured + featured_categories + 解析单测（fixture）
P2  Command：steam_store.rs（browse_steam_games + get_store_home + 内存缓存）+ lib.rs 注册
P3  前端数据层：steamCommunity.ts DTO + formatPrice helper + steamStore.ts 命令封装
P4  页面骨架：/steam/store 路由 + 侧边栏入口 + 图标 + i18n 键
P5  首页视图：4 轨道（大卡 + 横向滚动行）
P6  浏览网格：工具栏（搜索/分类/排序/打折/区域）+ 网格 + 加载更多
P7  卡片交互：关注按钮（steamHubCache 乐观更新）+ StoreDetailDialog 接线
P8  手测冒烟 + 回退修复
```

每阶段一个门禁，独立验收。
