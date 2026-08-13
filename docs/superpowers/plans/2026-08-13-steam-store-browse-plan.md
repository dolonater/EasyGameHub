# Steam 商店浏览实施计划（商城页）

> 创建日期：2026-08-13
> 依赖设计：`docs/superpowers/specs/2026-08-13-steam-store-browse-design.md`
> 阶段门禁：每阶段结束需用户批准后再进入下一阶段；每任务后跑对应验证命令。

验证命令速查（仓库根目录）：
- SDK 单测：`cargo test -p steam-sdk store`（在 `steam-sdk/` 内则为 `cargo test store`）
- Rust 全量检查：`cargo check`
- 格式化：`cargo fmt`
- 前端：`npm run build`（tsc + vite + sdk）
- 集成手测：`npm run tauri dev`

---

## P1 SDK（browse + featured 数据源）

**T1** `steam-sdk/src/client/store.rs`：
- 扩展 `StoreSearchItem` 解析字段（`price.initial`/`price.discount_percent`/`price.currency`、`release_date`、`platforms`、`metacritic_score`，缺字段用 Option/默认）。
- 新增 `BrowseParams { term: Option<String>, category: Option<u32>, sort: Option<BrowseSort>, specials: bool, cc: String, start: u32, count: u32 }` 与 `BrowseSort` 枚举（Relevance/PriceAsc/PriceDesc/ReviewsDesc/ReleasedDesc，实现 `as_param()` 输出 storesearch `sort_by` 值，非法值回退 relevance）。
- 新增 `browse_games(client, params) -> Result<BrowseResult>`：URL 拼 `term/category1/sort_by/specials/cc/start/count`（cc 默认 `cn`，`l=schinese` 固定，`Referer` 头沿用）；`BrowseResult { total, items: Vec<BrowseItem> }`。
- 新增 `BrowseItem` 结构（app_id/name/tiny_image/final_price_cents/initial_price_cents/discount_percent/currency/platforms/release_date/metacritic_score）。
- 新增 `featured(client, cc, l) -> Result<Vec<BrowseItem>>`（`/api/featured`，条目自带完整信息）。
- 新增 `featured_categories(client, cc, l) -> Result<Vec<FeaturedRail>>`（`FeaturedRail { id, name, items: Vec<u32> }`；`/api/featuredcategories/` 的 specails/top_sellers/new_releases/coming_soon 四轨，跳过 genres）。
- 测试：离线 fixture 解析（browse 含全部筛选参数响应 / featured / featuredcategories）、缺字段默认、sort 白名单映射。
- verify：`cargo test -p steam-sdk store`；`cargo fmt`

**T2**（前置验证，先行确认参数形态）真实请求冒烟（`--ignored` 单测或临时 curl）：确认 storesearch 的 `start`/`count`/`category1`/`specials` 参数行为与响应字段。若与 T1 假设不符，回退设计 §8 方案调整 T1 后再继续。
- verify：该单测/命令输出符合预期（total 数、翻页偏移、分类过滤生效）

---

## P2 Command 层

**T3** `src-tauri/src/commands/steam_store.rs`（新）：
- `browse_steam_games(term: Option<String>, category: Option<u32>, sort: Option<String>, specials: bool, cc: Option<String>, start: u32, count: u32) -> Result<BrowseResult>`（camelCase 参数；sort 字符串经 SDK 枚举解析）。
- `get_store_home(cc: Option<String>) -> Result<StoreHomeDto>`：`/api/featured`（四数组合并去重）→ featured；`/api/featuredcategories` → rails（**items 为完整条目对象，直接映射 BrowseItemDto，无需批量 appdetails**——2026-08-13 按 SteamWebAPI2 模型核实修正）。
- 内存缓存：`Mutex<HashMap<String, (Instant, Value)>>`，TTL 10 分钟；键 = `browse|term|category|sort|specials|cc|start|count` 与 `home|cc`。错误不缓存。
- 复用 `steam_api.rs` 的 `shared_client()`；错误 `map_err(|e| e.to_string())?`。
- `commands/mod.rs` 暴露 `steam_store` 模块；`src-tauri/src/lib.rs` `generate_handler!` 注册两命令。
- verify：`cargo fmt`；`cargo check`

---

## P3 前端数据层

**T4** `src/lib/steamCommunity.ts`：新增 `BrowseItemDto` / `FeaturedRailDto` / `StoreHomeDto` / `BrowseResultDto` 类型（对齐设计 §4.3）。

**T5** `src/lib/steamStore.ts`（新）：封装 `browseSteamGames(params)` 与 `getStoreHome(cc?)`（`invoke("browse_steam_games", ...)` / `invoke("get_store_home", ...)`）。

**T6** `src/lib/format.ts`（或现有格式化模块）：新增 `formatPrice(cents, currency)`——CNY `¥x.xx`、USD `$x.xx`、JPY/KRW 无小数位、其他回退 `x.xx {currency}`；`formatPriceCents` 保持不动。
- verify：`npm run build`

---

## P4 页面骨架（路由 + 导航 + i18n）

**T7** `src/pages/steam/Store.tsx`（新）：页面外壳（标题区 + 内容容器 + loading/error/empty 分支骨架），先渲染空态/占位；后续 P5–P7 填充。
- `src/App.tsx`：注册 `{ path: "/steam/store", element: <Store /> }`。

**T8** 侧边栏/顶部导航：`src/components/ui/SidebarMenu.tsx` 加 `storeLabel` prop；steam 组加 `{ key: "store", group: "steam", to: "/steam/store", label: storeLabel, icon: "store" }`；`src/components/Layout.tsx` 两处（侧边栏 + 水平导航）传入 `storeLabel={t("steam.storeLabel")}`。

**T9** `src/lib/icons.ts`：新增商店语义图标（`assets/regular/store.svg` 新增文件，参照现有图标惯例；若无合适 SVG 素材，回退用现有 `cart` 语义相近图标并注明）。
- `src/i18n/zh.ts` / `en.ts`：`steam.storeLabel` 及后续 P5–P7 全部新文案键（一次性补全：首页轨道标题/工具栏/分类/排序/空态/错误/已加载全部/关注/已关注）。
- verify：`npm run build`

---

## P5 首页视图（4 轨道）

**T10** `Store.tsx` 首页模式：无筛选条件时 `getStoreHome(cc)` 加载；精选轨道大卡横幅（复用 `GameBannerCard`，有则用，无则横向大卡），其余 4 轨横向滚动行（轨道标题 + 小卡行，`loading="lazy"`）；单轨失败跳过；整页错误态 + 重试按钮。
- verify：`npm run build`

---

## P6 浏览网格（工具栏 + 分页）

**T11** `Store.tsx` 浏览模式：单行工具栏（搜索 TextField 防抖 350ms——参照 `GameSearchBox`；分类 Select（固定 genre id 列表 + i18n 名称，约 12 个）；排序 Select（5 项白名单）；"只看打折" Toggle；区域 Select（8 区，默认 cn））。任一条件变化 → 重置 start=0 重新请求。

**T12** 网格 + 加载更多：`browseSteamGames` 累积（start += count）；"加载更多"按钮（loading 态、耗尽显示"已加载全部"）；空态（无结果文案）；错误态 + 重试。
- verify：`npm run build`

---

## P7 卡片交互（关注 + 详情）

**T13** 卡片渲染：capsule 图（CDN 直连 + lazy）、名称、`formatPrice`（非 cn 区本地币种）、原价删除线 + 折扣百分比、平台图标、Metacritic（有则）。

**T14** 关注按钮：读 `useSteamHubCache().watchItems` 判定已关注；点击 `add_manual_watch` / `remove_manual_watch` 乐观更新（参照 `useSteamWatchlist` 与 NewsFeed 交互模式，失败回滚）；点击卡片本体 → 打开 `StoreDetailDialog`（复用 `get_store_detail`）。
- verify：`npm run build`

---

## P8 手测冒烟

**T15** `npm run tauri dev` 人工验证清单（对照设计 §7）：
1. 侧边栏"商城"入口 → `/steam/store`；返回后再进状态保留（组件卸载可接受重置）
2. 首页 4 轨道加载与横向滚动；单轨失败不影响整体
3. 搜索/分类/排序/打折/区域各自生效且互斥重置分页；非 cn 区价格币种正确
4. "加载更多"翻页 + 耗尽提示；空结果空态
5. 卡片关注 → 切 Steam Hub 新闻/愿望单即时同步；取消关注反向同步
6. 点卡片开详情弹窗（含多区价格表）
7. 断网/接口失败 → 错误态 + 重试可用
- 验收：用户确认冒烟清单全部通过；发现缺陷回到对应阶段修复

---

## 收尾

- 更新 `docs/superpowers/progress.md` 记录本工作流完成情况。
