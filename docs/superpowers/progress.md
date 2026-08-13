# Development Progress

## Current Workflow Request
- Topic: Bilibili 插件系统性扩展（热门分类/排行榜/追番/影视/UP主页/直播/动态/私信/专栏笔记/设置，参考 wiliwili，bpi-rs 收编）
- Stage 1 Requirement Exploration: Completed at 2026-08-11（经 grill-me 逐项确认 Q1-Q30）
- Design doc: docs/superpowers/specs/2026-08-11-bilibili-plugin-expansion-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-11
- Plan doc: docs/superpowers/plans/2026-08-11-bilibili-plugin-expansion-plan.md
- Stage 3 Plan Execution: P0-P4 completed（见下）；**P5 completed at 2026-08-12**（自动验证通过，Tauri 真实账号手测待补）
- **P8 默认清晰度设置（2026-08-13）** —— 设置页"默认清晰度模式"原只有"自动"一个选项（占位未完成），展开为 **自动 / 手动** 两种模式：手动时出现"默认清晰度"二级 Select（最高可用/1080P/720P/480P/360P，qn 80/64/32/16）；runtime config 加 `defaultQualityMode: "auto" | "manual"` + `defaultQualityQn: number`（pick 白名单 + 合法 qn 钳制）；WatchPage 读取后 `createPlayback` 传 `quality`（后端 `bilibili_create_playback` 本就支持 quality 参数 → playurl qn，dash 响应只含 ≤qn 的 track，ABR 自动选目标内最高）。验证：tsc 0 errors；插件 build + pack（bundle MD5 3c41e739）。手测待补：设置手动 1080P → 视频页清晰度上限生效。
**阶段 2 完成**：navigation 加 `history/watchLater/favorites/bangumi/liveHome` 5 视图 + open 系列；AccountLibraryTabs 拆为 4 个独立页（HistoryPage/WatchLaterPage/FavoritesPage（含 FavoriteManagePanel 管理模式）/BangumiPage，未登录/loading/error/empty 分支齐全）并删除原组件；新增 LiveHomePage（复用 LiveFeed 推荐流，侧边栏"直播"入口）；BiliSidebar 补全 9 项（首页/动态/直播/收藏/历史/稍后再看/追番/我的/设置，OPENERS 压栈式跳转保持返回栈）；runtime config 加 `sidebarAutoHide/sidebarPosition`，SettingsPage 通用 tab 加"侧边栏"组（悬停展开 Toggle + 位置 Select），折叠状态仍 localStorage；MinePage 改为个人概览（资料卡/登录面板 + 8 个入口卡片：历史/收藏/稍后再看/追番/设置/发布动态/私信/通知）；信息流卡片圆角 10→12px 微调。验证：tsc 0 errors；插件 build + pack（bundle MD5 341f42a9）。**手测待补**：侧边栏 9 项跳转与返回栈、4 个账号页加载、设置侧边栏偏好（悬停展开/右置）、我的概览入口、直播首页。
- **P9 设置页 Select 遮挡修复（2026-08-13）** —— 宿主 Select 下拉面板被玻璃卡片遮挡：卡片 `backdrop-filter` 创建层叠上下文，absolute + z-index 无法跨卡片。修复（宿主 src/components/ui/Select.tsx）：下拉面板 **createPortal 到 body + fixed 定位**（打开时测量触发器 rect，滚动/resize 重算，z-[9999]），所有插件 Select 同步受益。验证：宿主 build（plugin-sdk.js 98.49 kB）；tsc 0 errors；插件 bundle 不变（870fbfc1）。
- **P9 设置页 UI 优化（2026-08-13，grill 确认：左 tab/图标+描述行/玻璃卡片+toast）** —— SettingsPage 重构：左侧 tab 导航（图标+文字，168px 玻璃面板，当前项高亮）；右侧分组玻璃卡片（播放/倍速与清晰度/弹幕/侧边栏/数据），每行设置项 = 图标（宿主 ICONS 语义化）+ 名称 + 灰色描述 + 控件右对齐；保存反馈改右上角浮动 toast（成功绿/失败红，2.2s 自动消失）；数据 tab 的清理/打开改按钮行。验证：tsc 0 errors；插件 build + pack（bundle MD5 870fbfc1）。
- **P9 动态详情页重复进入（2026-08-13）** —— 详情页卡片可点击再次进详情导致返回栈累积：DynamicCard 加 `clickable` prop（默认 true），详情页传 false 禁用整卡点击（正文卡与转发内卡），图片预览/点赞等内部交互不受影响。验证：tsc 0 errors；插件 build + pack（bundle MD5 06833b79）。
- **P9 动态详情页评论限宽（2026-08-13）** —— 详情页所有区块（正文卡片/转发/标题/评论区域/加载更多）统一 `max-width: 640px` 居中（`.bili-dyn-detail > *`），不再横向撑满。验证：tsc 0 errors；插件 build + pack（bundle MD5 a89b3015）。
- **P9 修复（2026-08-13）** —— (1) 动态流中点图片放大后点遮罩关闭会进详情页：React portal 内容的事件沿 **React 组件树**冒泡到 DynamicCard 的 article（openCard）→ ImagePreview backdrop onClick 加 stopPropagation；(2) 页面位置记忆失效：P9 骨架后滚动发生在 `.bili-shell-content`，但 captureScroll/恢复仍读宿主 `.app-page-surface`（恒 0）→ 两处改 `.bili-shell-content`。验证：tsc 0 errors；插件 build + pack（bundle MD5 eca762ae）。
- **P9 动态图片大小统一·补全（2026-08-13）** —— 2 张图也统一为 3 列网格（占前两格），至此 1/2/3/9 张图片尺寸全部与九宫格每格一致。验证：插件 build + pack（bundle MD5 d1d1350a）。
- **P9 动态图片大小统一（2026-08-13）** —— 单张图片与满九宫格每格大小一致：`.bili-dynamic-images-1` 改用 3 列网格 + 图片占第一格（grid-column: 1，靠左），大小与九宫格完全统一。验证：tsc 0 errors；插件 build + pack（bundle MD5 6185c5fd）。
- **P9 动态页排版（2026-08-13）** —— 两处：(1) 动态卡片不再横向撑满：顶层卡片（`.bili-dynamic-page > .bili-dynamic-card` 与详情页 `.bili-dyn-detail-card > .bili-dynamic-card`）限宽 640px 居中（转发内卡不受影响）；(2) 单张图片限宽 320px 居中（`.bili-dynamic-images-1` grid minmax(0,320px) + justify-content center）。验证：tsc 0 errors；插件 build + pack（bundle MD5 6e820300）。
- **P9 动态详情页图片·真正修复（2026-08-13）** —— 用户要求图片在 **DynamicCard 内部**渲染（卡片自带九宫格），而非详情页在卡片外单独放大图。修复：DynamicCard 的 ImageBody 图片改为可点击（stopPropagation 不触发卡片跳转）+ 内部预览（复用 ImagePreview 组件，流与详情页一致）；DynDetailPage 去掉 `hideImages`、删除外部图片块与 preview 逻辑。验证：tsc 0 errors；插件 build + pack（bundle MD5 daca7b7a）。
- **P9 动态详情页图片位置（2026-08-13）** —— 用户指令两轮澄清后确认：图片**保留在正文卡片内**（bili-dyn-detail-card 中，DynamicCard 之后、转发之前）。验证：tsc 0 errors；插件 build + pack（bundle MD5 e8995b09）。
- **P9 图片预览修复（2026-08-13）** —— 评论区预览遮罩只盖住面板、图片居中在面板内：根因是 `.bili-video-detail-panel` 的 `backdrop-filter`（毛玻璃）创建 containing block，评论区内 `position: fixed` 被包含。修复：宿主 sdk 导出 `createPortal`（react-dom），ImagePreview 用 `createPortal(..., document.body)` 渲染到 body 突破包含块（动态详情页同步受益）。验证：宿主 build + tsc 0 errors；插件 build + pack（bundle MD5 e8995b09）。
- **P9 评论区图片放大·复用（2026-08-13）** —— 用户指出不该另搞一套：将 DynDetailPage 内联的图片预览（bili-image-preview-*）提取为**共享组件 ImagePreview**（行为/样式完全不变），动态详情页与评论区共用；删除自建的 ImageViewer 及其样式。验证：tsc 0 errors；插件 build + pack（bundle MD5 4c8ca54b）。
- **P9 评论区图片放大（2026-08-13）** —— 新增 ImageViewer 灯箱组件（fixed 遮罩 + 居中大图 + 多图左右切换 + 计数 + Esc/点外关闭 + 左右方向键切换），CommentItem 评论图片改为可点击按钮（zoom-in 光标）打开查看器。验证：tsc 0 errors；插件 build + pack（bundle MD5 8df9e845）。
- **P9 播放页互动条·修复（2026-08-13）** —— (1) 未收藏图标不显示：`star` 单独 key 未注册（只有 starFilled/starOutline）→ 补注册 `star,`；(2) 稍后再看图标改 playCircle（未）/playCircleFilled（已加入，play-circle.svg/fill 新增注册）。验证：宿主 build + tsc 0 errors；插件 build + pack（bundle MD5 5714f19a）。
- **P9 播放页互动条（2026-08-13）** —— 删除按钮文本（点赞/投币/收藏/分享/稍后再看/举报/更多），保留数值；图标化：投币=coin、分享=shareNetwork（宿主 ICONS 新增两个）、点赞 heart（线条）/heartFilled（已赞）、收藏 star（线条）/starFill（已收藏）、稍后再看 playlist（线条）/playlistFilled（已加入）、更多=list；label 转 aria-label/title。验证：宿主 npm run build（plugin-sdk 更新）+ tsc 0 errors；插件 build + pack（bundle MD5 b460571d）。
- **P9 代理问题·定位（2026-08-13）** —— 封面 502 根因排查（真实 reqwest 测试：单次/复用连接池/24 并发全部 200，排除上游与连接复用）：502 来自**缓存 io 路径**——`save_cover` 的 `enforce_cover_limit` 清理旧封面时 `remove_file` 失败（Windows 上 WebView 可能锁住文件）→ 保存失败 → 502。修复：**缓存尽力而为降级**——proxy_cover 读缓存失败当 miss、写缓存失败 log::warn 不阻断；enforce_cover_limit 删除失败跳过。另确认项目无 logger 初始化（log::error 静默丢弃），已用 warn 替代（需 logger 时再补初始化）。验证：cargo check 0 errors；bilibili 56 passed。
- **P9 代理问题（2026-08-13）** —— 封面/视频 502 + CORS 报错：加**统一 CORS middleware**（所有响应含错误都带 Access-Control-Allow-Origin，前端不再报跨域导致黑屏）+ **上游失败日志**（`bilibili proxy upstream ...`，定位 502 根因）。**教训：连接复用是用户要求的方向，未经同意不得回滚**——已恢复 MEDIA_CLIENT 复用，502 根因待日志定位后针对性修复。验证：cargo check 0 errors；bilibili 56 passed。
- **P9 直播改造·修复 12（2026-08-13）** —— 主程序右键刷新后搜索历史消失：`loadConfig()` 此前只在 SettingsPage/WatchPage 调用，**插件入口从未加载持久化配置**——启动时 state.config 是默认值（searchHistory 空），刷新（插件重挂载）即重置。修复：`index.tsx setup()` 里启动即 `loadConfig()` + `refreshLoginStatus()`。验证：tsc 0 errors；插件 build + pack（bundle MD5 40b9117e）。
- **P9 直播改造·修复 11（2026-08-13）** —— 搜索页优化：(1) 删除页内重复的搜索框+按钮（顶栏搜索框承担输入）；(2) 搜索历史/热搜点击改为 `openSearch(keyword)` 导航驱动（与顶栏同一路径，keyword 经导航参数同步到 SearchPage，修复点击不跳转）；(3) 搜索历史记录移到顶栏提交处（saveConfig withSearchHistory）。验证：tsc 0 errors；插件 build + pack（bundle MD5 634b31fd）。
- **P9 直播改造·修复 10（2026-08-13）** —— 追番页各分区"查看全部"内容相同：所有分区都传同一个 season_type（追番页固定 1）。修复：PgcSectionFeed 按分区推断——**style=follow（我的追番）→ openBangumi()（侧边栏追番页 follow 列表）**；其他分区取首个卡片的 seasonType 作为列表 season_type（国创推荐=4、番剧推荐=1，天然区分）。验证：tsc 0 errors；插件 build + pack（bundle MD5 3c52c13b）。
- **P9 直播改造·修复 9（2026-08-13）** —— 番剧最热/最新 tab 反了：curl 实测 item.order 字段确认 **order=0 是按更新时间（"昨天10:00更新"，最新）、order=1 是热度（柯南/超电磁炮）** → PgcListPage 交换 tab 映射（最热=1、最新=0，默认最热）。验证：tsc 0 errors；插件 build + pack（bundle MD5 b1954c4f）。
- **P9 直播改造·修复 8（2026-08-13）** —— 用户质疑"为什么要区分 PgcCard 和 VideoCard"：**彻底删除 PgcCard 组件**，追番/影视/排行榜全部**直接渲染 VideoCard**（VideoCard 导出 `pgcToVideoCard` 适配 helper：BiliPgcCard → BiliVideoCard；使用处传 `coverRatio="poster"` + `onClick={openSeason}` + meta 集数/评分）。PgcSectionFeed/PgcListPage/RankingPanel 三处替换。验证：tsc 0 errors；插件 build + pack（bundle MD5 bf209929）。
- **P9 直播改造·修复 7（2026-08-13）** —— 用户要求按热门/推荐卡片来（不要再搞两套）：**VideoCard 改造为可复用组件**（加 `onClick?` 覆盖点击、`coverRatio?: "video"|"poster"` 竖版海报、`meta?` 自定义 meta 行）；PgcCard 改为**内部复用 VideoCard**（番剧数据适配 BiliVideoCard + openSeason 覆盖 + 集数/评分 meta）；追番/影视容器统一 `bili-video-grid`（卡片错峰入场动画 `.bili-video-card:nth-child()` + hover 效果 + 布局全部与热门/推荐一致）；删除 bili-pgc-grid/bili-pgc-card 旧样式；**动画真相**：热门/推荐每次切换有动画是因为 `.bili-video-card` 有卡片级 `bili-card-in`（每次渲染都播），追番/影视此前用独立类无卡片动画——复用后自动一致；PgcSectionFeed 加 `key={mode}`（追番↔影视切换强制重挂载，容器动画重播）。验证：tsc 0 errors；插件 build + pack（bundle MD5 ee10dfc5）。
- **P9 直播改造·修复 6（2026-08-13）** —— 三个问题：(1) 追番/影视每次显示"正在加载"：`bilibili_pgc_tabs` 命令无缓存（推荐/热门有 10 分钟缓存）→ 加 `pgc-tabs` 命名空间缓存（key=mid:kind，POPULAR_TTL，PgcTabKind 加 tag()）；(2) PgcCard 无卡片外壳（裸图，VideoCard 有边框/背景/圆角/阴影）→ 样式对齐 VideoCard（grid gap 9 + padding 8 + border + radius 12 + shadow，封面改 `width: 100%` + `aspect-ratio: 3/4` 适配网格自适应宽度）。验证：cargo check 双 feature 0 errors；bilibili 56 passed；tsc 0 errors；插件 build + pack（bundle MD5 f9843074）。
- **P9 直播改造·修复 5（2026-08-13）** —— 追番/影视/直播动画：此前已加 `.bili-pgc-feed/.bili-live-feed` 的 `bili-view-in`（挂载播放），但追番页一直 -400 错误态掩盖；现增强为**内容就绪后网格再播一次**（`.bili-pgc-feed .bili-pgc-grid / .bili-live-feed .bili-live-grid` 加动画，加载完成卡片出现时播放）。验证：tsc 0 errors；插件 build + pack（bundle MD5 b4b631bd）。
- **P9 直播改造·修复 4（2026-08-13，最终修复）** —— 查看全部 -400 真正根因（curl 逐项实测定位）：**`season/index/result` 需要完整辅助参数**（st=1/type=1/sort=0/season_version/area/copyright/season_status/season_month/year/style_id 全 -1 + pagesize=20，PiliPlus 同款参数集），只传 order/is_finish 会 -400；`page/index/result` 连 `index_type=1&page=1` 都 -400（wiliwili 路径同样不可用，需登录态）；且真实响应 `has_next` 是**数字 1/0**（不是 bool，解码报错）。修复：bpi-rs `PgcIndexParams`（season_type/order/is_finish/page）+ `season_index` 带完整参数集（无 wbi）；`PgcIndexData.has_next: u8`；后端命令回 season 参数；前端 PgcListPage 固定选项（最热0/最新1 + 全部-1/连载0/完结1）；删除 pgc_condition/page-index 中间产物。验证：**真实请求测试 test_pgc_index_bangumi（--ignored）通过**；bpi-rs 1043 passed；bilibili 56 passed；cargo check 双 feature 0 errors；tsc 0 errors；插件 build + pack（bundle MD5 77d4c8c5）。
- **P9 直播改造·修复 3（2026-08-13）** —— 查看全部仍 -400：curl 实测定位（不再猜参数）——`pgc/page/index/result` 连 `index_type=1&page=1` 裸请求都返回 -400，**该接口需要 wbi 签名**（wiliwili 有 `api/util/wbi.cpp`；bpi-rs 已有 `sign_wbi_params`）。修复：`client.pgc_page_index` 请求前 `sign_wbi_params(query)`（condition 接口实测无需 wbi，保持原样）。验证：bpi-rs pgc_page 3 passed；bilibili 56 passed；cargo check 双 feature 0 errors。**手测待补**：追番/影视"查看全部"。
- **P9 直播改造·修复 2（2026-08-13）** —— 两处：(1) **顶栏搜索框被"返回"按钮向左推**：`bili-top-nav` 改对称 grid（`1fr auto 1fr`，品牌/actions 各占一列 justify start/end，搜索居中列 justify center）——右侧按钮增减不影响搜索位置；(2) **追番"查看全部"仍 -400**：此前用 `/pgc/season/index/result` + season_type + is_finish=-1 参数体系（season 接口参数要求不同/废弃）。**参考官方 wiliwili**（本地 D:\apps\appss\ws\ets2\wiliwili，`source/api/home_api.cpp` + `pgc_index.cpp`）：改用 `pgc/page/index/condition`（type=2&index_type 动态返回合法筛选 keyword）+ `pgc/page/index/result`（index_type：1追番/2电影/5电视剧/3纪录片/7综艺/102影视综合）；bpi-rs 重写 index.rs（PgcPageIndexParams.extra kv + client.pgc_page_condition/pgc_page_index，contract 3 单测含 condition fixture）；后端 `bilibili_pgc_condition` 新命令 + `bilibili_pgc_index` 改 keyword 透传（Option<String>）；前端 PgcListPage 重写（先拉 condition 动态渲染排序/连载选项，选择即 keyword 请求第一页）；MainPage/navigation/PgcSectionFeed 统一 indexType。验证：bpi-rs 1044 passed；bilibili 56 passed；cargo check 双 feature 0 errors；tsc 0 errors；插件 build + pack（bundle MD5 a298a811）。手测待补：查看全部不再 -400、排序/连载选项来自接口、顶栏搜索固定。
- **P9 直播改造·修复（2026-08-13）** —— 两处：(1) 追番/影视（bili-pgc-feed）/直播（bili-live-feed）补 `bili-view-in` 进入动画（与首页/动态/账号页同款，mode 切换组件重挂载即触发）；(2) 追番"查看全部"报 `-400 请求错误`：`is_finish=-1` 是非法值（B 站 index/result 只接受 0/1，全量应省略参数）→ bpi-rs `PgcIndexParams.is_finish` 改 `Option<i32>`（None 不传 query），season.rs 在 `is_finish < 0` 时不传；contract fixture/断言同步。验证：bpi-rs pgc_index 2 passed；bilibili 56 passed；cargo check 0 errors；tsc 0 errors；插件 build + pack（bundle MD5 17443883）。
- **P9 直播改造·收尾（2026-08-13）** —— 两处调整：(1) MenuPopover 全局菜单加滚动（`max-height: min(420px, calc(100vh - 24px)) + overflow-y: auto`，直播分区/所有菜单项多时内部滚动不溢出视口）；(2) 热门"每周必看"期数 tab 改为下拉菜单（触发按钮显示当前期名 + MenuPopover 期数列表，选中即收起，bili-weekly-select 定位容器）。验证：tsc 0 errors；插件 build + pack（bundle MD5 93766dab）。
- **P9 直播改造·块 3（2026-08-13）** —— 直播分区行折叠：父分区/子分区行各平铺前 8 个，超出部分收纳进"更多"按钮 + MenuPopover 下拉（点外/Esc 关闭，选中即收起；bili-live-area-more 虚线样式 + bili-menu-item-active 高亮当前选中项；bili-live-areas 加 position: relative 作菜单定位锚点）。验证：tsc 0 errors；插件 build + pack（bundle MD5 028a6115）。**至此 P9 三块全部完成**：直播分区真实拉流（块1）、番剧/影视查看全部 + tab 化（块2）、分区行更多下拉（块3）。
- **P9 直播改造·块 2 修复 5（2026-08-13）** —— 追番/影视页分区行改为 **tab 式**：顶部分区 tab（番剧推荐/国创推荐/猜你喜欢/我的追番…，空分区过滤、默认第一个、title 空时显示"推荐"），下方只显示选中分区的网格，"查看全部"在 tab 行右侧（作用于当前 tab）。验证：tsc 0 errors；插件 build + pack（bundle MD5 114470f4）。
- **P9 直播改造·块 2 修复 4（2026-08-13）** —— 用户明确要求：删除横列与横向滚动条，追番/影视分区行改为与其他页面一致的**网格布局**（`bili-pgc-track` flex 横滚 → `bili-pgc-grid` 多列，PgcListPage 同款）。"查看全部"仍在每行标题右侧（网格上方固定可见）。验证：tsc 0 errors；插件 build + pack（bundle MD5 106208c1）。
- **P9 直播改造·块 2 修复 3（2026-08-13）** —— 回滚横列末尾"查看全部"卡片（用户无法横向滚动到末尾，入口放末尾是错误决策）。**根本修复**：`.bili-home` 是 grid 容器且子项默认 `min-width: auto`——横列内容超宽时**整个首页被撑破**（标题行+按钮被推到视口外）。修复：`.bili-home` 加 `grid-template-columns: minmax(0, 1fr)`（子项可收缩）+ `.bili-pgc-feed` 加 `min-width: 0`；"查看全部"只保留在每行标题行右侧（B 站标准位置，容器不再被撑开后固定可见）。验证：tsc 0 errors；插件 build + pack（bundle MD5 9bd283b7）。
- **P9 直播改造·块 2 修复 2（2026-08-13）** —— 用户仍看不到"查看全部"入口：在标题行按钮之外，参考 B 站网页番剧页做法，**横列 track 末尾加"查看全部"卡片**（虚线竖卡 168px 同卡片宽度，横列可滚动必然可达）；标题为空时隐藏标题文本（只留按钮行）。验证：tsc 0 errors；插件 build + pack（bundle MD5 22191105）。**注意**：请确认重启 tauri dev（插件 bundle 从磁盘加载）。
- **P9 直播改造·块 2 修复（2026-08-13）** —— "查看全部"按钮被推到视口外：`.bili-pgc-section`（flex column）的 track 内容超宽时 `min-width: auto` 把整个 section（含标题行）撑破容器宽度，按钮到横向最右端。修复：section 加 `min-width: 0` + track 加 `max-width: 100%`（标题行保持容器宽内可见）。验证：tsc 0 errors；插件 build + pack（bundle MD5 e5a4ca00）。
- **P9 直播改造·块 2（2026-08-13）** —— 番剧/影视"查看全部"：bpi-rs 新增 `bangumi::index`（web `/pgc/season/index/result`，PgcIndexParams season_type/order/is_finish/page/pagesize + PgcIndexData list/has_next + client.season_index()，contract fixture 2 单测）；src-tauri `bilibili_pgc_index` 命令（lib.rs 注册）+ `BiliPgcIndexPage` DTO + season.rs pgc_index（复用 BiliPgcCard 映射）；SDK 三处 `season.pgcIndex()`；navigation 加 `pgcList` 视图 + `openPgcList(seasonType, title)`；MainPage 分支（title 显示 section.title）；新 PgcListPage（排序 最热/最新 + 连载 全部/连载中/已完结 + 分页"加载更多" + PgcCard 网格 bili-pgc-grid）；PgcSectionFeed 分区行标题行加"查看全部"（kind→season_type：bangumi=1/cinema=2，带行标题）。验证：`cargo test -p bpi-rs` 1043 passed；bilibili 56 passed；cargo check 双 feature 0 errors；tsc 0 errors；插件 build + pack（bundle MD5 786fd38a）。手测待补：追番/影视页"查看全部"→ 列表页筛选/排序/分页。**块 3 待办**：直播分区行"更多"下拉折叠。
- **P9 直播改造·块 1（2026-08-13，grill-me 确认：直播→番剧/影视→tabs 折叠 分块交付）** —— 直播分区真实拉流：bpi-rs 新增 `live::room_list`（web `xlive/web-interface/v1/second/getList`，LiveRoomListParams parent_area_id/area_id/page/page_size/sort_type + LiveRoomListData count/list/has_more + client.room_list()，contract fixture 2 个单测）；src-tauri `bilibili_live_rooms` 命令（lib.rs 注册）+ `BiliLiveRoomPage` DTO + live.rs room_list 映射（复用 BiliLiveRecommendRoom）；SDK 三处 `live.rooms()`；前端 LiveFeed 双模式："全部"推荐流（换一批）不变，具体分区用分区房间接口（切分区重载第一页 + "加载更多"累积 + has_more 耗尽显示"已加载全部" + 真实空态"该分区暂无直播"）。验证：`cargo test -p bpi-rs` 1041 passed；`cargo test bilibili` 56 passed；cargo check 双 feature 0 errors；tsc 0 errors；插件 build + pack（bundle MD5 0c9af9c1）。手测待补：直播分区真实房间、分页加载、空分区空态。**块 2/3 待办**：番剧/影视 season index"查看全部"列表页；直播分区行"更多"下拉折叠。
- **P9 修复（2026-08-13，收藏页排版）** —— 收藏页视频卡片变单列挤在左侧：`.bili-folder-videos` 本身是 150px 列的 grid，新增的 `.bili-video-grid` div 被当作其子项塞进单列。修复：`.bili-folder-videos > .bili-video-grid, > .bili-dynamic-load-more { grid-column: 1 / -1 }` 跨满全部列。验证：tsc 0 errors；插件 build + pack（bundle MD5 c1193512）。
- **P9 修复（2026-08-13，收藏页报错）** —— 收藏页报 "invalid cache entry: invalid type: map, expected a sequence"：根因是**旧版 favorite-items 缓存文件**（`data: [...]` 数组，旧 `Vec<BiliFavoriteItem>` 格式）与新格式 `BiliFavoritePage`（对象）不兼容，`cache::load_json` 解析失败直接抛错。修复：缓存是尽力而为层——解析失败（损坏/结构升级不兼容）时**删除该文件并返回 None 重建**，不再报错（所有命名空间缓存受益）；新增单测 `corrupt_cache_entry_is_discarded_not_errored`（数组格式缓存按对象读 → None + 文件删除）。wiliwili 无收藏夹列表功能可参考（只有视频收藏操作），故按缓存自愈思路修复。验证：`cargo test bilibili` 56 passed；cargo check 0 errors。
- **P9 修复（2026-08-13）** —— (1) **全站排行榜报错**：bpi-rs `VideoRankingListParams::with_rid` 用 `validate_positive` 拒绝 rid=0，但 B 站 ranking/v2 的 rid=0 是全站榜（合法）→ 改为直接接受（u32 保证非负）；`cargo test -p bpi-rs` 1039 passed。(2) **收藏夹只能显示 24 个**：后端 `favorite_items` 只返回单页（page_size 24）且不暴露 has_more → `BiliFavoritePage { items, has_more }`（复用已存在的 DTO 定义并补 BiliFavoriteItem 的 derive），命令返回类型 + SDK 三处类型同步；前端 FavoritesPage 改累积分页（切夹重载第一页 + "加载更多"按钮追加下一页，bili-dynamic-load-more 复用）。验证：cargo check 双 feature 0 errors；`cargo test bilibili` 55 passed；tsc 0 errors；插件 build + pack（bundle MD5 b2ec4687）。
- **P9 布局改造（2026-08-13，阶段 2 收尾 8）** —— 2 点调整：(1) 首页 tabs（推荐/热门/追番/影视/直播）从 HomeFeed 提层到 HomePage toolbar 并与刷新按钮同行（space-between 对齐）；HomeFeed 删除 tabs 渲染与 onXxx props（searchGuide/searchEmpty 保留给 SearchPage）；(2) 追番/影视/直播分支此前只有 PgcSectionFeed/LiveFeed（无 tabs 无返回入口），tabs 提层后任何 mode 都能直接切回推荐/热门。验证：tsc 0 errors；插件 build + pack（bundle MD5 f1f20f91）。
- **P9 布局改造（2026-08-13，阶段 2 收尾 7）** —— 3 点调整：(1) 顶栏整体上移 10%（`transform: translateY(-10%)`，悬浮贴顶更紧凑；内容区/侧栏顶部补偿 72→65px）；(2) 删除首页 feed 头部右侧视频条数文本（`{videos.length} 条`，bili-feed-heading 只留 tabs）；(3) 首页"刷新"按钮换 `<Icon name="reset">`（aria-label 刷新）。验证：tsc 0 errors；插件 build + pack（bundle MD5 e07a51cd）。
- **P9 布局改造（2026-08-13，阶段 2 收尾 6）** —— 侧栏与顶栏左端重叠修复：侧栏由 `padding-top: 72px` 补偿改为 `margin-top: 72px` 避让（侧栏整体从顶栏下缘开始，不再被顶栏覆盖；内容区保持顶部滚动穿越顶栏的悬浮效果不变）。验证：tsc 0 errors；插件 build + pack（bundle MD5 33d38de7）。
- **P9 布局改造（2026-08-13，阶段 2 收尾 5）** —— 顶栏悬浮效果修正：此前 flex 布局内容区在顶栏**下方**滚动（无重叠，视觉"裁切"）。改为对齐主程序 horizontal nav 方案：`.bili-top-nav` absolute top-0 left-0 right-0 z-40（覆盖在内容上方），`.bili-shell-body` 顶到 shell 顶部，`.bili-shell-content` 内容区从 shell 顶部开始滚动 + `padding-top: 72px` 补偿（初始不被遮挡、滚动后从半透明玻璃顶栏下方穿过），侧栏 `padding-top: 72px` 同补偿。验证：tsc 0 errors；插件 build + pack（bundle MD5 8679162e）。手测待补：滚动时内容穿过顶栏的悬浮效果。
- **P9 布局改造（2026-08-13，阶段 2 收尾 4）** —— 用户澄清第 5 点：要的是"像主程序导航栏那样**悬浮却不裁切内容**"（保留玻璃背景），不是透明。对齐宿主 `Layout.tsx`：顶栏/侧栏改用宿主玻璃类 `app-surface app-glass-titlebar` / `app-surface app-glass-sidebar`（与主程序 GlassSidebar 同一套玻璃体系），布局恢复 flex 固定（顶栏在 shell 顶部、侧栏 flex 项不随内容滚动），**去掉 sticky/max-height 限高**（此前限高 + overflow:hidden 会裁切侧栏内容），内容区保持独立滚动（flex-1 overflow-y-auto，主程序 main 同款）。验证：tsc 0 errors；插件 build + pack（bundle MD5 30d08089）。手测待补：玻璃悬浮观感、侧栏 8 项完整显示、内容区滚动不裁切。
- **P9 布局改造（2026-08-13，阶段 2 收尾 3）** —— 用户 5 点调整：(1) 动态/直播/账号内容/搜索页加 `bili-view-in` 进入动画（与首页/我的同款：bili-dynamic-page/bili-live-home/bili-page-library/bili-search-page）；(2) 删除右上角"打开 B 站"入口（MainPage actions home 分支；bili-link-button 样式保留——LivePage 直播间仍在用）；(3) 顶栏搜索按钮文字→`<Icon name="search">`（aria-label 搜索）；(4) 动态图标 chartLine→playtime（fill），历史 playtime→clock（避免重复），追番 starFilled→**新增宿主 `starFill`**（assets/fill/star-fill.svg 注册进 ICONS，侧栏+我的页两处，plugin-sdk.js 95.80 kB）；(5) 顶栏/侧栏改**透明悬浮**：去掉 border/background/backdrop-filter 遮罩，顶栏 sticky top:0、侧栏 sticky top:72px + align-self:flex-start + max-height 限高。验证：tsc 0 errors；宿主 npm run build（plugin-sdk 95.80 kB）+ 插件 build/pack（bundle MD5 00c6af43）。手测待补：五处动画、悬浮顶栏/侧栏观感、搜索图标按钮、动态/追番填充图标。
- **P9 布局改造（2026-08-13，阶段 2 收尾 2）** —— 用户 2 点调整：(1) 侧边栏删除"我的"项（保留右上角头像入口，右上角已是登录/头像按钮）；(2) 右上角"铃"文字与各页"返回"按钮换图标——宿主 ICONS 已有 `bell`/`skipBackFilled`（assets/regular/bell.svg 早已 import），BiliTopNav 通知按钮 `<Icon name="bell">`、MainPage actions 返回按钮 `<Icon name="skipBackFilled">`（aria-label 保留）。验证：tsc 0 errors；插件 build + pack（bundle MD5 67950d90，bell/skipBackFilled 各 1 处）。手测待补：顶栏铃铛图标、返回图标按钮在各详情页可用。
- **P9 布局改造（2026-08-13，阶段 2 收尾）** —— 用户 4 点调整：(1) 侧边栏 9 项 + 我的概览入口全部换宿主 Icon（home/chartLine/playFilled/bookmarkFilled/playtime/playlistFilled/starFilled/users/settings；通知铃铛无 bell 图标保持"铃"文字）；(2) 顶栏与"我的"页设置入口删除，仅保留侧边栏设置项（BiliTopNav 删设置按钮 + MinePage 删设置卡片 + styles 删死样式）；(3) "我的"页通知入口删除（顶栏铃铛已有）；(4) 私信并入通知页：MessagesPage 拆为 `MessageSessionList` 组件并入 NotificationsPage 新 tab（通知/私信），navigation `messages` 视图与 `openMessages` 删除，ChatPage 保留（从私信 tab 进入）。验证：tsc 0 errors；插件 build + pack（bundle MD5 cc6455d5）。手测待补：通知页双 tab 切换、私信会话进出、侧边栏图标观感、我的页 5 入口。
- **P9 布局改造（2026-08-13，参考 BewlyBewly；grill-me 逐项确认）** —— 共识：① 全局骨架（顶栏：品牌|全局搜索|通知/设置/头像 + 可折叠侧边栏，默认展开、autoHide 可选、位置默认左）② 侧边栏导航 9 项（首页/动态/直播/收藏/历史/稍后再看/追番/我的/设置）③ 视觉仅借鉴（悬浮半透明、圆点、大圆角），保持玻璃主题体系 ④ 顶栏搜索 → 独立 SearchPage ⑤ 播放页保留窄条侧栏 ⑥ 拆 4 页（收藏/历史/稍后再看/追番）+"我的"个人概览 ⑦ 信息流卡片仅微调 ⑧ 两阶段交付。**阶段 1 完成**：navigation 加 `search` 视图 + `openSearch`；HomeFeedTabs/HomeFeed 移除 search tab；HomePage 剥离搜索（保留刷新工具栏）；新增 SearchPage（导航关键词同步、历史面板、复用 usePagedFeed/HomeFeed）；新增 BiliSidebar（折叠/autoHide localStorage 记忆，BewlyBewly 式悬浮玻璃 + 圆点指示器 + 展开动画；阶段 1 放 首页/动态/我的/设置 4 项，直播等 9 项随阶段 2 拆页）；BiliTopNav 重写（品牌|TextField 搜索|通知铃铛（聚合未读角标）/设置/头像）；BiliAppShell 新骨架（顶栏 + body=侧边栏+内容区，`bili-shell` flex 全高、顶栏/侧边栏玻璃圆角 14px）；MainPage 接 search 分支。验证：tsc 0 errors；插件 build + pack（bundle MD5 5da78f0a）。**手测待补**：骨架观感、侧边栏折叠/autoHide、顶栏搜索 → SearchPage、首页搜索入口移除、滚动位置恢复。**阶段 2 待办**：拆 4 页（收藏/历史/稍后再看/追番）+"我的"概览 + 侧边栏 9 项 + 设置页侧边栏偏好 UI + 信息流卡片微调。
- **P8 MPD data: URI 内嵌模式（2026-08-13）** —— 用户选择"仅 data: URI 内嵌"：保持全轨 MPD + 手动切清晰度能力，把 manifest 请求改为前端内嵌（参考 bili-rust `data:application/dash+xml` 直接喂 dashjs）。改动：(1) `build_mpd(session, proxy_port)` BaseURL 绝对化（`http://127.0.0.1:{port}/bilibili/media/...`，相对路径无法相对 data: URI 解析）；(2) `BiliPlaybackSource` 加 `manifest` 字段（MPD 全文，一次 createPlayback 返回，无额外 IPC）；(3) PlayerShell 优先 `data:application/dash+xml;charset=utf-8,${encodeURIComponent(manifest)}`，`manifest_url` 保留兜底；(4) SDK 三处类型同步（plugin-template 精简版无 BiliPlaybackSource 跳过）；(5) 单测更新（绝对 URL 断言 + 签名）。验证：`cargo test bilibili` 55 passed；cargo check 双 feature 0 errors；tsc 0 errors；插件 build + pack（bundle MD5 56cde36d，含 data:application）。手测待补：打开视频起播链路无 manifest HTTP 请求。
- **P8 播放器起播性能优化（2026-08-13）** —— 用户反馈"打开视频要等几秒才能播放"：根因是 `proxy.rs` 的 `request_media_with_referer`/`request_cover` **每段请求都新建 reqwest::Client** → 每个分段都重新 TCP+TLS 握手 + DNS（B 站 dash 每视频数百段），叠加"最高可用"首段大轨 → 起播数秒。对照 bili-rust（stream.rs 全程用 `bili.http()` 单一客户端 + 连接池），改为 **OnceLock 全局 `MEDIA_CLIENT`**（连接池 pool_idle_timeout 120s，UA/超时不变），分段/封面/直播流共享连接复用。验证：cargo check（默认 + --no-default-features）0 errors；`cargo test bilibili` 55 passed。手测待补：打开视频起播时间是否显著缩短、快速切轨时卡顿减少。
- **P8 默认清晰度黑屏优化（2026-08-13）** —— 用户反馈 manual+最高可用时"每次打开先黑屏再切到最高分辨率"：根因是 dashjs ABR 开局先拉低轨，`STREAM_INITIALIZED` 后再 `setQualityFor` 切换导致二次缓冲黑屏。参考 `bili-rust`（ui/src/components/player.rs：playurl 返回全部清晰度时 ABR 会从最低起播，故 MPD 只保留所选 qn 单轨直选），用 dashjs 4.7.4 的 `abr.initialBitrate.video`（= 目标轨 bandwidth + 1）在 initialize 前设置：首段即拉目标清晰度，后续 `setQualityFor` 幂等 no-op 无切换。auto 模式不设（保持 ABR 自适应）。带宽 0 的罕见场景仍由原 setQualityFor 兜底。验证：tsc 0 errors；插件 build + pack（bundle MD5 2b3c1341）。手测待补：手动+最高可用 → 起播即最高无黑屏。
- **P8 默认清晰度修复（2026-08-13）** —— 用户反馈"选最高可用后视频页仍显示自动"：此前 manual+qn=0 时 `createPlayback` 不传 quality（等价自动），且 dashPlayer 无初始 mode 概念，开局永远是 ABR auto。修复：(1) dashPlayer options 加 `initialMode/initialQualityId`，STREAM_INITIALIZED 后若 initialMode=manual 则关 ABR + setQualityFor（开局即锁定清晰度，按钮显示具体清晰度而非"自动"）；(2) PlayerShell 加 `qualityMode/qualityQn` props，manual 时算 `initialQualityFor`（qn>0 → ≤qn 最高轨；qn=0 → 全部最高轨）；(3) 按钮 label 改用 QualityMenu 导出的 `qualityText`（codeLabel 规范化，避免显示数字 id）；(4) WatchPage 传 props。验证：tsc 0 errors；插件 build + pack（bundle MD5 806731b6）。手测待补：手动+最高可用 → 开局按钮显示最高清晰度。
- **P8 默认清晰度设置（2026-08-13，第一轮实现，见下）** —— 设置页"默认清晰度模式"原只有"自动"一个选项（占位未完成），展开为 **自动 / 手动** 两种模式：手动时出现"默认清晰度"二级 Select（最高可用/1080P/720P/480P/360P，qn 80/64/32/16）；runtime config 加 `defaultQualityMode: "auto" | "manual"` + `defaultQualityQn: number`（pick 白名单 + 合法 qn 钳制）；WatchPage 读取后 `createPlayback` 传 `quality`（后端 `bilibili_create_playback` 本就支持 quality 参数 → playurl qn，dash 响应只含 ≤qn 的 track，ABR 自动选目标内最高）。验证：tsc 0 errors；插件 build + pack（bundle MD5 3c41e739）。手测待补：设置手动 1080P → 视频页清晰度上限生效。
- **P8 专栏修复第十一轮（2026-08-13，用户实测反馈后补漏）** —— 三个遗漏：(1) **专栏 tab 无主图**：`BiliArticleCard` DTO/SDK 缺 `imageUrls` 字段 + 后端映射未在 banner_url 空时回退 `image_urls[0]` + 前端 ArticleCard 只读 bannerUrl → 补全（真实响应 banner_url 常空、主图在 image_urls[0]）；(2) **动态 tab 专栏卡片只显示"专栏"标签**：`DYNAMIC_TYPE_ARTICLE` 分支只读 `major.article`，但关注流（feed/all）为 **opus 结构（major.opus）** → 标题/摘要/封面全空 → 分支补 opus 兼容（title/summary/pics + articleId 由 comment_id_str 兜底），单测 `parse_article_dynamic_with_opus_major` 锁定；(3) 动态卡片点击进普通动态页：由 (2) 的 articleId=0 导致 → 修复 (2) 后 articleId 非 0 → openCard 直接 openArticle。验证：`cargo test bilibili` 55 passed；tsc 0 errors；宿主 plugin-sdk.js 95.42 kB；插件 build + pack（bundle MD5 一致 a9f534ea，含 imageUrls/点击阅读全文）。手测待补：专栏 tab 主图、动态 tab 专栏卡片缩略、点击进专栏页。
- **P8 专栏修复（2026-08-13，用户回退后按 PiliPlus 已验证逻辑重新实施）** —— 用户回退大量代码后要求重做两项（专栏评论问题暂停）：**动态 tab 专栏缩略/转发** + **专栏 tab 不显示专栏**。**A. 专栏 tab**：bpi-rs `SpaceArticleData.article_list` 加 `#[serde(alias = "articles")]`（真实字段名）+ 真实响应单测；`ArticleAuthor.level/fans` 加 default（space 响应缺）；`ArticleViewData.tags/categories/image_urls/origin_image_urls` 加 default（view 响应缺 tags）；`ArticleOpus` 补 `content/h5_content`（opus 专栏正文）；src-tauri `article_view` 顶层 content 空时回退 `opus.content`（JSON 段落）/`h5_content`（HTML）；前端 `JsonBody` 支持 opus 段落（`{paragraphs}` 对象：para_type 1 文本拼接含 link 节点、2 图片）。**B. 动态 tab**：bpi-rs `DynamicItem`（feed/all）补 `orig: Option<Box<DynamicItem>>`（转发完整原文）；src-tauri `parse_card` 加 `basic_comment_id` 参数（articleId 从 comment_id_str 兜底=cvid）；`DYNAMIC_TYPE_ARTICLE` 独立 article 分支（major.article.id/title/desc/covers）；`DYNAMIC_TYPE_OPUS` 按图拆分（有图 image / 无图 article，title/summary）；`orig` **无条件覆盖 forward**（feed + detail 两处，PiliPlus 只用 orig 递归）；`BiliDynamicCard` 加 `article_id`/`title` 字段（DTO + SDK 三处）；前端 `DynamicCard` 加 `ArticleBody`（封面/标题/摘要/专栏徽标/CV"点击阅读全文"）+ article 点击 openArticle（无 cvid 时 detail 查询兜底）+ `ForwardBody` article 分支；`DynDetailPage` article 类型加"阅读全文（CVxxx）"按钮；styles 补 `bili-dynamic-article`/`bili-dyn-article-read`（688/688 平衡）。单测：bpi-rs space 真实响应解析 + src-tauri 转发 orig→专栏内卡 2 个新增。验证：`cargo test bilibili` 54 passed；bpi-rs article 33 passed；cargo check（默认 + --no-default-features）0 errors；tsc 0 errors；宿主 plugin-sdk.js 95.42 kB；插件 build + pack（bundle MD5 一致 b64e06db，含 bili-dynamic-article/点击阅读全文/专栏文案）。手测待补：动态 tab 专栏卡片缩略与点击进专栏、转发专栏内卡专栏缩略、UP 主页专栏 tab 列表与详情正文。
- **P7 completed at 2026-08-12**（设置与打磨，自动验证通过，Tauri 手测待补）
- P7 review notes（对照设计 §3.5/§6.6/§6.7 与计划 T43-T48 review，修正 8 处后执行）：(R1) 现有设置项（进度同步/弹幕/倍速/清晰度模式/清理缓存/截图目录）已全部在宿主 settings section 里，迁移到 SettingsPage 时保持行为等价（含 loading/saving/message 状态），删除 index.tsx 注册即不双入口；(R2) `defaultFormat` 映射现有 `playbackMode`（dash→quality、mp4→compat），`autoPlay` 用 dashjs `initialize` 第 3 参数（该版本 d.ts 无 `playback.autoplay` 设置项）；(R3) 编码参数化：bpi-rs `play_url` 的 fnval 已是全 codec（16|64|128），无需按偏好改请求，**本地过滤白名单**实现——`is_supported_dash_stream` 参数化（avc→avc1/avc3、hevc→hev1/hevc1、av1→av01、audio→mp4a+flac）；FLAC 分支仅 `audio_preference=flac` 时插入，杜比恒跳过；(R4) 降级路径：偏好编码过滤后无视频 track → 同响应内自动回退 AVC 重过滤（会话内重建，不重新请求），durl 兜底保留；(R5) tsc 修复关键：sdk.d.ts 是脚本上下文（`declare global` 无效）→ 顶层 `declare namespace JSX { IntrinsicElements + LibraryManagedAttributes }`（去掉 1284 条 TS7026）；`LibraryManagedAttributes` 宽松会把组件 props 变 any 导致回调 TS7006 → 11 处回调参数手工标注；sdk.d.ts 缺 P5 消息接口定义（BiliMessageItem/Session/History/Unread/ReplyFeed 系列）与宿主字段不一致 → 按宿主逐字段对齐（含 NotificationsPage 引用不存在的 `sourceContent` 死字段，删除）；(R6) `useState`/`useRef` 保持精确签名（放宽成 any 会制造 TS7006），真实 bug 修调用点（SearchBox useRef 泛型、AccountLibraryTabs `tab.id as LibraryTab`、CommentItem 回调类型）；(R7) check-sdk-sync.mjs 用括号配对提取两文件 `bilibili:` 块 + `name(args` 方法名集合比对（54 个一致），build 脚本 `tsc --noEmit && node scripts/check-sdk-sync.mjs && esbuild`；(R8) 死代码按设计 §6.7 清理：宿主+插件 sdk `playback.proxyPort`（bilibili_proxy_port 命令保留，直播 danmakuWsUrl/图片代理仍用）、`useVideoInteraction.refresh`、types.ts `BilibiliRuntime`、后端 `bilibili_ping`（命令+lib.rs 注册）、styles.ts 完全重复 `.bili-button` 块（同选择器叠加规则保留，仅删逐字节重复）。
- P7 completed scope: `SettingsPage.tsx`（插件内设置页，tab 结构：播放器/弹幕/通用；播放器 tab：播放缓冲档位/默认视频格式/默认编码优先序/默认音质/自动起播/同步进度/倍速/清晰度模式；弹幕 tab：开关/字号/透明度/密度/速度；通用 tab：清理缓存/截图目录；含 loading/saving/message 状态）；MinePage "设置"入口（未登录也可见）+ `openSettings` 导航 + MainPage settings 分支接线；index.tsx 移除 `registerSettingsSection` 与 `BilibiliSettingsSection`（宿主设置区块不再出现）；runtime config 扩展 `bufferMode/defaultFormat/codecPreference/audioPreference/autoPlay` + `pick` 白名单钳制；WatchPage 读取新配置（playbackMode 由 defaultFormat 初始化、createPlayback 传 codec/audio、PlayerShell autoPlay/bufferMode）；dashPlayer `bufferSettings` 档位（fastSwitchEnabled + bufferTimeAtTopQuality/ToKeep）+ `initialize` AutoPlay 参数；后端 `PlaybackPreferences{codec,audio}` + `CodecPreference/AudioPreference::parse` + `is_supported_dash_stream` 参数化 + flac 偏好分支 + 降级重过滤，命令 `bilibili_create_playback` 加 `codec_preference/audio_preference`（season 路径同步），3 个新单测（hevc 偏好/av1 降级 avc/flac 音质）；T46：sdk.d.ts 修 JSX 声明 + 补消息接口 + `React` 命名空间 + build 脚本加 `tsc --noEmit`（**0 errors**）+ `check-sdk-sync.mjs`（54 方法一致）；T47 死代码清理（proxyPort/refresh/BilibiliRuntime/bilibili_ping/styles 重复块）。
- P7 scope guard: 未做硬件解码开关（设计 §3.5 明确不做）；默认音质 FLAC 需大会员（后端已保留 flac 音轨，实测待补）；bundle 体积只观察不裁剪（设计 §6.7）；未做设置项在线热切换（WatchPage 打开期间改设置需重新进播放页生效）；`bilibili_proxy_port` 命令保留（直播/图片代理仍用）。
- P7 verification: `cargo fmt`；`cargo check` 与 `--no-default-features` 0 errors；`cargo test bilibili` 53 passed（+3 编码/降级/音质单测）；`npm run build` passed（plugin-sdk.js 94.51 kB，无 `bilibili.playback.proxyPort`）；插件 `npm run build`（tsc 0 errors + check-sdk-sync OK + esbuild）`&& npm run pack` 写回两目录（bundle MD5 一致 caef702e）；bundle 仅 `from "sdk"`（53 处）、0 处 `@tauri-apps`、无 `registerSettingsSection`/`BilibiliSettingsSection`/`bilibili_ping`、P7 全部 UI 文案与 SettingsPage/bufferMode/codecPreference/audioPreference/autoPlay 在；styles.ts 花括号 625/625 平衡。
- P7 pending hand-test（`npm run tauri dev` 人工执行）：我的页设置入口、设置页三 tab、各设置项生效（缓冲/格式 dash-mp4 切换/编码 hevc-av1/音质 flac/自动起播关）、宿主"设置→插件"区块已消失、改设置后进播放页验证、以及 P0-P6 手测项与登录/播放/弹幕/动态/私信/直播不回退。
- **P7 设置下拉框失效修复（2026-08-12，用户实测反馈，P7 前旧设置区块同样存在）** —— 现象：设置页下拉框（Select）点击无法展示选项，点击后直接提示"设置已保存"。根因：**宿主 Select 内部是 `div` + `button`（非原生 select），却被 `<label className="bili-setting-field">` 包裹**——点击 label 任意位置（含 Select 头部）时，浏览器把点击转发给 label 关联的第一个可聚焦表单控件（即下拉面板里**第一个选项 button**，面板虽 `pointer-events-none` 仍在 DOM）→ 触发该选项 `onChange` 并 `setOpen(false)` → 表现为"下拉打开即关闭 + 值被改为第一项 + 设置已保存"（旧 index.tsx 设置区块同样写法，bug 一直存在，P7 迁移时未发现）。修复：SettingsPage 中**包 Select 的 6 处 `<label>` 全部改为 `<div>`**（类名不变，样式不受影响）；包 Toggle/Slider 的 `<label>` 保留——两者内部是原生 `<input>`（checkbox/range），label 包裹是正确语义。验证：`npx tsc --noEmit` 0 errors；插件 `npm run build`（含 tsc + check-sdk-sync）+ `pack` 写回两目录（bundle MD5 一致 e8a62106）。手测待补：设置页下拉展开/选项切换/保存提示。
- **P6 completed at 2026-08-12**（直播，自动验证通过，Tauri 真实账号手测待补）
- P6 review notes（对照设计 §6.3/§3.2 与计划 T37-T42 review，修正 11 处后执行）：(R1) src-tauri bpi-rs features 白名单补 `"live"`（P5 R5 教训）且 `axum` 需加 `features=["ws"]`；(R2) WS 桥挂在既有 proxy axum server（同端口），SDK `live.danmakuWsUrl` 复用 `bilibili_proxy_port` 命令拼 URL，无新增 URL 命令；(R3) bpi-rs `recommend()` 无分页参数（getMoreRecList 支持 page/page_size）→ 新增 `recommend_page(page, page_size)`，原 `recommend()` 与契约不动；(R4) `LiveWsClient::connect` 签名扩展为 `connect(host, wss_port, token, room_id)`（计划写 connect(host,token,room_id) 但 wss_port 必要，取 danmu_info host_list.wss_port）；测试经 `connect_url` 走本地 `ws://` mock（生产 `wss://` 需 tokio-tungstenite `rustls-tls-webpki-roots` feature）；(R5) bpi-rs 门禁 `legacy_tokio_tests_are_ignored_by_default` 要求 `#[tokio::test]` 默认 `#[ignore]` 且 ignore 必须写在 tokio::test **上方**（反向扫描）→ 两个本地 mock 集成测试默认忽略，`-- --ignored` 手动跑；(R6) 桥消息格式：bpi-rs `LiveWsMessage{cmd,data}` 转 `{"cmd","data"}` JSON 下发，插件 parse `DANMU_MSG`/`SEND_GIFT`/`SUPER_CHAT_MESSAGE`/`CONNECTION_ERROR`/`CONNECTION_LOST`；(R7) 心跳双通道：WS 协议 30s（bpi-rs 内部） + HTTP `web_heart_beat` 60s（LivePage setInterval，计划 T41"心跳保活"）；(R8) 分区筛选为**前端过滤**（推荐接口无分区参数，`live.areas` 仅提供分区列表，父/子分区名匹配，空则提示）；(R9) P4 直播卡片（计划 T27 "直播卡片 P6 后跳 live"）与 P5 scope guard 遗留的**通知流直播间跳转**一并接线；(R10) 直播流**无本地代理**（计划未安排，设计 §6.3 直接 mpegts.js 播 http-flv；B站直播流 CORS 开放），播放失败显示"外部打开直播间"逃生入口（计划风险表 1118）；(R11) `bilibili_live_stream` 传 `qn`（默认 10000）取 playUrl 流，切画质重新请求并重建播放器。
- P6 completed scope: bpi-rs `live/ws` 模块（`protocol.rs` 16 字节包头 encode/decode + zlib/brotli 解压 + `parse_cmds` cmd 分发；`heartbeat.rs` auth/心跳帧 + 30s 间隔 + 5s 认证超时；`mod.rs` `LiveWsClient::connect/connect_with_heartbeat/connect_url` + 断线重连（1/2/4/8/16/30s 退避最多 6 次）+ `CMD_CONNECTION_LOST` 信号，11 个单测 + 2 个本地 mock 集成测试（默认 ignore））；`live` feature 依赖 `tokio-tungstenite(connect,rustls-tls-webpki-roots)`/`futures-util`/`brotli`/`flate2`/tokio `time`；`recommend_page` 分页接口。src-tauri `core/bilibili/live.rs`（room/stream/recommend/areas/send_danmaku/heartbeat 6 函数）+ `live_bridge.rs`（axum WS 中转 `GET /bilibili/live/:room_id/danmaku`、房间注册表、broadcast 转发、引用计数归零自动断开上游）；proxy.rs 路由挂载；DTO 9 个（BiliLiveRoom/Stream/Quality/StreamUrl/RecommendRoom/RecommendPage/Area/SubArea/SendDanmakuResult）；6 命令 `bilibili_live_room/stream/recommend/areas/send_danmaku/heartbeat` 注册 lib.rs。SDK `live.*`（room/stream/recommend/areas/sendDanmaku/heartbeat/danmakuWsUrl）三处同步 + types.ts re-export。直播 tab：HomeFeedTabs live 激活、`LiveFeed`（推荐分页"换一批" + 父/子分区筛选 + 直播卡片封面/在线人数/主播头像/分区徽标）、HomePage 集成。`LivePage`（房间信息卡[标题/状态/在线/分区/简介/UP-uid→openSpace/外部打开] + mpegts.js 播放器 + 右侧弹幕列表[普通/礼物金色/SC 蓝色/系统] + 发送弹幕 30s 冷却失败保留输入 + 画质菜单 qn 重建流 + 60s 心跳 + 离开清理播放器/WS）+ `player/livePlayer.ts`（初始化/销毁/切画质/错误事件）+ mpegts.js 依赖；`openLive` 导航 + MainPage live 分支接线；NotificationsPage 通知流直播间跳转；DynamicCard 直播卡片直接进直播间；styles.ts 直播 feed/直播间/弹幕/画质菜单样式（花括号 625/625 平衡）。
- P6 scope guard: 直播流无本地代理（直连 http-flv，Referer/CORS 以手测确认，失败逃生外部打开）；分区筛选为前端过滤（无分区列表接口）；未做直播回放/主播管理/礼物舰长专属 UI（设计范围外）；WS 桥无插件连接时自动断开（引用计数）。
- P6 verification: `cargo fmt`；`cargo check` 与 `cargo check --no-default-features`（src-tauri 目录）均 0 errors；`cargo test bilibili`（48 passed，新增 live_bridge 注册表测试）；`cargo test plugins`（18 passed）；`cargo test --manifest-path crates/bpi-rs/Cargo.toml live`（84 passed，含门禁）；`cargo test --manifest-path crates/bpi-rs/Cargo.toml --features live live::ws -- --ignored`（2 passed，本地 mock 集成：认证/心跳/分发 + 认证拒绝）；`cargo test --manifest-path crates/bpi-rs/Cargo.toml --all-features`（1035 passed, 0 failed，基线 1005+30）；`npm run build` passed（plugin-sdk.js 94.63 kB 含 6 个新命令名 + bilibili_proxy_port）；插件 `npm run build && npm run pack` passed 并写回两目录（bundle MD5 一致 9ae6fc9d）；bundle 仅 `from "sdk"` 导入（53 处）、0 处 `@tauri-apps`、含 LivePage/LiveFeed/livePlayer/danmakuWsUrl/mpegts.js/SUPER_CHAT_MESSAGE/CONNECTION_LOST 与全部 P6 UI 文案（11 个中文转义核验）；`npx tsc --noEmit`：P6 新文件无新增非 JSX 类型错误（key/JSX.IntrinsicElements 为仓库既有 P7 待修类）。
- P6 pending hand-test（`npm run tauri dev` 人工执行）：直播 tab 推荐列表/分区筛选/换一批、进直播间、http-flv 播放（CORS/Referer 实测）、弹幕流（普通弹幕/礼物/SC）、发送弹幕 30s 冷却、切画质重建、60s 心跳保活、退出清理（播放器与 WS 无残留）、通知流直播间跳转、动态直播卡片进直播间、以及 P0-P5 手测项与登录/播放/弹幕/动态/私信不回退。
- **P6 直播弹幕不显示修复（两轮，2026-08-12）** —— 现象：直播画面正常、弹幕区无消息 → 修复后弹幕区提示"connection closed" → 再修复后**弹幕正常显示（用户实测通过）**。第一轮根因：`live_bridge` 用 `anonymous_client`（无任何 cookie）调 `getDanmuInfo` 触发 **wbi 风控（-352）**（bpi-rs 契约 fixtures 已有 anonymous -352 记录）→ 拿不到 token → 弹幕桥连接失败。修复：(1) 桥改 `optional_account_client`（登录态优先）；(2) proxy `start_proxy` 注入 `tool_dir` 到 `live_bridge::init`（OnceLock，桥无 AppState 访问权）；(3) 未登录时先请求 `login().nav()` 让 cookie jar 种上 **buvid**。第二轮根因：认证链路"connection closed"（服务端认证期断连）诊断不清 + 认证包 uid 恒为 0。修复：(1) bpi-rs `auth_frame` 加 `uid` 参数（登录 mid 或游客 0），`connect`/`connect_with_heartbeat`/`connect_url`/`run` 全链透传；(2) `connect_and_auth` 非 Binary 帧不再误判 Closed（之前收到任何非 Binary 帧即判连接关闭）；(3) 桥 `wss_port==0` fallback 443、token 为空显式报错、认证 uid 取当前登录 mid（`current_mid` 复用 cookie 解析）、`log::info` 诊断（host/wss_port/token_len/uid）。前端无需改动（CONNECTION_ERROR 系统消息已有提示路径）。验证：`cargo check`（默认 + --no-default-features）0 errors；`cargo test bilibili` 50 passed；bpi-rs live 84 passed；`cargo fmt`。**实测**：登录态进直播间弹幕（普通/礼物/SC）正常显示。
- **P6 直播流 403 修复（2026-08-12，用户实测反馈）** —— 现象：进直播间 mpegts.js 拉流报 `403 Forbidden`（`live-bvc...bilivideo.com/*.flv`），提示"直播流播放失败"。根因：浏览器（localhost:1420 页面）直连 B 站直播 CDN 触发 **Referer 校验 403**（wiliwili 桌面端无 Referer 能播，WebView 必带页面 Referer）。修复（遵循"代理只代理会话登记过的 URL"原则）：后端新增直播流代理——`live.rs` 加 `register_proxied_stream(url, port)` 登记表（rand 随机 key，上限 128 条自动清理最旧一半）+ `take_stream_url(key)` 取用即删；`proxy.rs` 新增路由 `/bilibili/live_stream/:key`（`request_media` 重构为 `request_media_with_referer` 参数化 Referer，直播流带 `https://live.bilibili.com/` + 浏览器 UA + Range/CORS 头转发）；命令 `bilibili_live_stream` 启动 proxy 后把 `durl[0].url` 替换为本地代理地址，前端零改动。验证：`cargo check`（默认 + --no-default-features）0 errors；`cargo test bilibili` 50 passed（新增登记表 roundtrip/清理 2 个单测）。手测待补：真实直播间播放。
- P5 review notes（对照设计 §2.1/§4.3 与计划 T32-T35 review，修正 5 处后执行）：(R1) **导航需新视图**：设计 §3.2 视图模型未含私信/通知 → `BiliNavView` 增加 `messages`/`chat{uid}`/`notifications` + openMessages/openChat/openNotifications（压栈可返回），MainPage 挂载 + 返回按钮/title；(R2) bpi-rs 私信接口按计划用 **web 版**（`/x/session/web/v1/session/sessions`+`/msg`，bilibili-API-collect），wiliwili 的 vc 版仅作参考；`MessageSendParams`/`MessageClient::send`（vc 版 web_im + wbi 签名）bpi-rs 已完整，直接复用不重复实现；(R3) `UnreadCountData` 无 `at` 字段 → at 置 0（@ 通知与回复合并展示）；私信未读用 `single_unread` 的 `Custom(4)` + `follow_unread`；(R4) 会话列表无头像/昵称（仅 talker_id）→ 前端用 UID 占位头像（`bili-profile-avatar-empty`），后续可扩展 chat_session 用户信息；(R5) src-tauri bpi-rs features 白名单补 `"message"`（tauri dev --no-default-features 教训）。
- P5 completed scope: bpi-rs `message/session.rs`（MessageSessionsParams/MessageHistoryParams/MessageSessionsData/MessageSession/MessageHistoryData/MessageItem 全字段 serde 容错 + 契约 fixture 2 份 + 4 个单测），client 增 `sessions()`/`messages()`（send 复用既有）；src-tauri `core/bilibili/message.rs`（5 函数：sessions/history/send/unread/reply_feed），命令 `bilibili_message_sessions/history/send/unread/reply_feed` 注册 lib.rs，DTO `BiliMessageSession/Item/SessionsPage/HistoryPage/Unread/ReplyFeedEntry/ReplyFeedPage`；SDK `message.*`（sessions/history/send/unread/replyFeed）三处同步 + types.ts 导出；前端 BiliNavView messages/chat/notifications + openMessages/openChat/openNotifications + MainPage 挂载；MessagesPage（会话列表 cursor 分页 + 未读角标 + UID 头像）；ChatPage（历史 cursor 分页向上翻页 + 30s 轮询新消息去重 + 发送文字失败保留输入 + 自己消息靠右）；NotificationsPage（reply_feed 分页 + 全部/回复/@我 筛选 + uri 解析跳转视频/动态）；MinePage 私信/通知/发布动态入口；BiliTopNav 未读角标（30s 轮询仅登录态）；styles.ts 私信/会话气泡/通知/角标样式（花括号平衡）。
- P5 scope guard: 会话列表仅 UID 展示（无头像昵称，R4 记录）；私信不发送图片/表情（设计排除）；@ 未读数不单独统计（R3）；通知流点击仅视频/动态跳转（其他链接不处理）；未做通知跳转直播间（P6）。
- P5 verification: `cargo fmt`；`cargo check` 与 `cargo check --no-default-features`（src-tauri 目录）均 0 errors；`cargo test bilibili`（47 passed）；`cargo test plugins`（18 passed）；`cargo test --manifest-path crates/bpi-rs/Cargo.toml message`（32 passed，新增 sessions/history 契约 2 个 + 模型容错单测）；`npm run build` passed（plugin-sdk.js 93.71 kB 含 5 个新命令名）；插件 `npm run build && npm run pack` passed 并写回两目录（bundle MD5 一致 86c47984）；bundle 含 MessagesPage/ChatPage/NotificationsPage 与全部 P5 UI 文案；`npx tsc --noEmit` 对 P5 改动文件无新增错误（既有 key/JSX 类别除外）。
- P5 pending hand-test（`npm run tauri dev` 人工执行）：我的页私信/通知入口、会话列表/未读、会话内历史消息翻页/30s 轮询/发送、通知流筛选与跳转、顶栏未读角标、以及 P0-P4 手测项与登录/播放/弹幕/动态不回退。
- P4 review notes（对照设计 §2.1/§3.2/§4.3 与计划 T26-T30 review，修正 7 处后执行）：(R1) **动态 feed 是 offset 游标分页**非页码 → 计划 `dynamic_all(page)` 改为 `bilibili_dynamic_all(offset, host_mid?)`（host_mid 存在时走空间动态 `feed/space`），DynamicPage 自建 offset 分页（usePagedFeed 是页码模型不适用）；(R2) **四类卡片由 modules 原始 JSON 解析**（参考 wiliwili DynamicArticleModule* 模型）：module_author/module_dynamic(major.archive|draw|live_play_info|forward)/module_stat 逐字段容错解析，纯文字（WORD/其他）降级 text 卡片显示正文；(R3) **dyn_id 超过 2^53**（如 1.1e18），JS Number 丢精度 → 评论 oid 全部改字符串传递：8 个 comment 命令 oid: String + parse_comment_oid，SDK 三处 comment 类型 oid: string|number，sdk.ts 实现层统一 String(args.oid)；(R4) bpi-rs `dynamic/space.rs` 只有占位注释 → 补 `space_dynamics` 接口（SpaceDynamicParams/SpaceDynamicData + 契约 fixture）支持 T30 空间动态；(R5) 转发列表返回 offset 分页（BiliDynamicForwardsPage 替代纯数组），DynDetailPage 支持加载更多；(R6) 发布成功通知用 runtime `dynamicPublished` 计数，DynamicPage 订阅后重载首屏（替代"插入本地列表"，自己发布的动态关注流会出现）；(R7) 评论 type 参数化：comment list 命令加 `type: Option<i64>`（默认 1），CommentPanel 加 oid/type props（动态 oid=dynId、type=17）。另顺手修复 P1 遗留 bug：SearchEmptyPanel 用 `item.show_name`（camelCase 后应为 `showName`，运行时一直是 undefined）。
- P4 completed scope: bpi-rs `dynamic/space.rs` 空间动态接口 + 契约；后端 `core/bilibili/dynamic.rs`（modules→BiliDynamicCard 四类卡片解析 + 6 个函数：all/detail/like/create_text/top/forwards），命令 `bilibili_dynamic_all/detail/like/create_text/top/forwards` 注册 lib.rs，DTO `BiliDynamicCard/Video/Live/Page/ForwardEntry/ForwardsPage/Created`；评论 8 命令 oid 字符串化 + list 加 type；SDK `dynamic.*`（all/detail/like/createText/top/forwards）三处同步 + comment oid/type 类型；导航 `{name:"dynamic"}` 顶层视图 + openDynDetail；BiliTopNav 动态 Tab；MainPage 动态页常驻挂载 + DynDetailPage 替换占位；DynamicPage（offset 分页 + 点赞乐观更新回滚 + 发布后重载）；DynamicCard（视频/图文/直播/转发四类 + 纯文字 text 降级 + isTop 徽标）；MinePage 发布动态入口 + DynamicPublishDialog（≤1000 字/30s 冷却/失败保留输入/点外关闭）；DynDetailPage（正文全文 + 图片大图预览翻页 + 转发列表懒加载 + CommentPanel type=17）；SpacePage 投稿/动态 tab（动态 offset 分页 + 点赞 + 自己空间置顶/取消置顶）；types.ts 补齐 P1 遗留导出（BiliUserSpace/BiliHotWord/BiliWeeklySeries/番剧类）并修 show_name→showName；styles.ts 动态页/卡片/发布弹层/大图预览/空间 tab 样式（花括号平衡）。
- P4 scope guard: 直播卡片点击不跳转（P6 填充 live 视图）；动态点赞不持久化状态（本地乐观更新）；转发列表仅详情页内加载；未做图片动态发布（设计排除）；未做动态转发（设计排除）。
- P4 verification: `cargo fmt`；`cargo check` passed（0 errors）；`cargo test bilibili`（46 passed，新增 5 个 modules 解析单测）；`cargo test plugins`（18 passed）；`cargo test --manifest-path crates/bpi-rs/Cargo.toml dynamic`（52 passed，新增 2 个 space 测试）；`npm run build` passed（plugin-sdk.js 93.08 kB 含 6 个新命令名）；插件 `npm run build && npm run pack` passed 并写回两目录（bundle MD5 一致 c116014a）；bundle 仅 `from "sdk"` 导入（48 处）、0 处 `@tauri-apps`、含 DynamicPage/DynamicCard/DynDetailPage/DynamicPublishDialog 与全部 P4 UI 文案；`npx tsc --noEmit` 对 P4 改动文件无新增错误（既有 JSX.IntrinsicElements/key 怪癖与 P2 遗留除外）。
- P4 pending hand-test（`npm run tauri dev` 人工执行）：顶层动态 Tab 关注流加载/翻页/点赞、四类卡片渲染（视频进播放/图文进详情/直播占位/转发展开）、发布动态（限频/刷新动态流）、动态详情（正文/图片大图/评论 type=17/转发列表）、UP 主页动态 tab（他人看动态、自己看置顶/取消置顶）、以及 P0-P3 手测项与登录/播放/弹幕不回退。
- P4 最终状态（2026-08-12，用户确认动态列表/详情/评论全部正常）：当前版本保持 **web 版接口**（用户回退后确认 web 版无 only_fans 500 问题，不切 desktop）；bpi-rs 不做 serde 容错（web 版 basic 完整）。最终生效的图片动态修复（最小集）：(1) `parse_dynamic_item`/`parse_detail_item` dyn_id 无条件用 `id_str`；(2) DRAW/OPUS 分支解析 `major.opus.pics[].url` + `major.opus.summary.text`（保留 draw/顶层 opus 兼容）；(3) `parse_draw_images` 兼容 src/url；(4) comment_id/comment_type basic 优先回退 module_stat（图片动态 opus 评论体系：oid=comment_id_str、type=comment_type）；(5) 前端评论 `oid={card.commentId||dynId}` `type={card.commentType||17}`；(6) DynamicCard `hideImages` prop（详情页大图网格替代卡片内图片，避免重复显示）+ openCard 空 dyn_id 拦截。验证：bilibili 47 passed（含真实 opus 单测）、plugins 18 passed、bpi-rs 52 passed、双 feature check 0 errors、bundle 两目录 MD5 一致。**经验教训**：多次大改导致反复回退——问题定位应以真实响应为准（用户提供 log.txt 后一次定位），修复保持最小集、单测锁定，避免防御性/结构性大改。
- P3 review notes（对照设计 §6.2/6.7 与计划 T21-T24 review，修正 4 处后执行）：(R1) **protobuf 解析**：bpi-rs `web_seg_wbi_proto` 返回原始 Bytes 且无 protobuf 依赖 → 在 src-tauri `danmaku.rs` 手写轻量 wire-format 解析器（ProtoReader + DmSegMobileReply.elems + DanmakuElem 7 字段），避免为单接口引入 prost 生成依赖；(R2) **分段加载驱动**：DanmakuOverlay 原来只轮询 videoRef，WatchPage 无 videoRef → PlayerShell 新增可选 `onTimeUpdate(seconds)` prop（ref 模式防闭包过期，timeupdate 触发），segmentLoader 由 updateTime 显式驱动（去掉 interval 轮询）；(R3) **overlay 增量合并**：分段会持续 append items，原 items effect 重置游标+清空可见会重播 → 改为按 id 去重合并（前插时按 cursor 处时间重建游标）；(R4) **send 返回 dmid**：撤回/self 标记需要真实 dmid → 后端 `send_danmaku` 返回 `BiliDanmakuSendResult{ok,message,dmid}`（`DanmakuPostData.dmid`），前端本地弹幕 id 用真实 dmid（响应无 dmid 才用 local- 前缀），SDK 三处 send 返回类型同步。
- P3 completed scope: 后端 `danmaku.rs` 新增 `danmaku_segment`（web_seg_wbi_proto + 轻量 protobuf 解析，失败降级 xml_list_so 截取同一段 6 分钟窗口）、`thumbup_danmaku`/`report_danmaku`（可选 content）/`recall_danmaku`，命令 `bilibili_danmaku_segment/thumbup/report/recall` 注册 lib.rs，`BiliDanmakuSendResult` DTO；SDK `danmaku.segment/thumbup/report/recall` + send 返回类型三处同步；前端 `danmaku/segmentLoader.ts`（每 6 分钟一段、当前段 ±2 段预取、内存缓存复用、段失败自动全量 XML 降级标记不重复回退）；WatchPage 分段驱动（mergeDanmaku 按 id 去重合并替代 sortDanmaku、selfDanmaku 登记 id→sentAt、撤回移除）；PlayerShell onTimeUpdate；DanmakuOverlay 增量合并 + **mode 2/3 固定弹幕**（layout.ts 独立固定轨道区 top/bottom 各独立槽位不占滚动轨道、renderer 输出 fixed 定位样式、styles.ts `.bili-danmaku-fixed*` 淡入淡出动画、`bili-danmaku-fade` keyframes）+ **self 弹幕操作**（5 分钟窗口 `bili-danmaku-self` 蓝框描边可点击，菜单 点赞/举报（6 个常用 reason 二级菜单）/撤回，未登录走 notLoggedIn 提示，4s 发送冷却保留）；`test-danmaku-layout.mjs` 补 5 组固定弹幕用例。
- P3 后续修复（用户反馈三轮）：(1) 弹幕点赞/举报入口 → 放开为**所有弹幕可点击**（原只限自己弹幕），菜单标题按 self 区分、撤回仅自己显示；(2) 自己发送弹幕不显示 → 游标回退用 `Math.min(minNewTime, lastTime-0.2)`（发送期间视频前进，max 会把游标推到新弹幕之后被永久跳过；Node 模拟验证）+ tick 按 aliveIds 去重防重复显示；(3) 操作菜单定位 → 由 fixed+clientX/Y 改为弹幕层内 absolute + getBoundingClientRect 相对坐标 + 越界向上/向左翻转；(4) 暂停时弹幕继续滚 → `bili-danmaku-paused` 类 + `animation-play-state: paused`。
- P3 scope guard: 未改既有 `bilibili_danmaku_list`（保留为降级路径）；未改弹幕设置/发送冷却/进度同步；未做高级弹幕（mode 5）与逆向滚动（mode 4）（设计范围外）；弹幕点赞状态不持久化（本地一次性操作）。
- P3 verification: `cargo fmt`；`cargo check` passed（0 errors）；`cargo test bilibili`（41 passed）；`cargo test plugins`（18 passed）；`npm run build` passed；插件 `npm run build && npm run pack` passed 并写回两目录；`npm run test:danmaku` passed；bundle 仅 `from "sdk"` 导入、0 处 `@tauri-apps`；宿主 plugin-sdk.js 含 4 个新命令名；`npx tsc --noEmit` 对改动文件无新增错误。
- P3 pending hand-test（`npm run tauri dev` 人工执行）：长视频分段弹幕逐段加载、seek 跳段同步、顶部/底部固定弹幕、发送弹幕描边 + 点赞/举报/撤回、暂停弹幕冻结、以及既有弹幕/播放不回退。
- P2 review notes（对照设计 §4.2/6.1 与计划 T14-T19 review，修正 9 处后执行）：(R1) **番剧播放流模型不兼容**：`BangumiVideoStreamData`（base: `VideoStreamData`，dash 为 `DashStreams`/`DashTrack`/`SegmentBase`）与视频 `PlayUrlResponseData`（`DashInfo`/`DashStream`/Value）字段结构一致但类型不同 → playback.rs 新增 `create_session_from_bangumi_stream` 字段级转换（Durl→DurlInfo 全等、DashTrack→DashStream 类型映射、SegmentBase→Value、timelength 取 dash.duration 或 durl[0].length、from="bangumi"），现有视频路径零改动；(R2) 评论 type 保持 Video（ep aid 作 oid）确认无改动；(R3) season 详情用 `detail_by_season_id`（episodes 含 aid/bvid/cid/ep_id/duration/cover/long_title），评分 rating、追番态 user_status.follow、简介 evaluate、最新集 new_ep.title；(R4) 追番列表 `bangumi_follow_list`（UserBangumiFollowListParams::new(mid) + with_kind Bangumi/Cinema + with_page，mid 由命令层 current_mid 提供）；(R5) ep 播放的 PlaybackSession bvid/aid/cid 用 ep 的字段（前端从详情分集传入），本地进度/上报复用现有命令；(R6) 新增 PgcCard/BiliPgcCard DTO（无 bvid 的番剧卡片，点击 openSeason）+ navigation.openSeason；(R7) WatchPage season 分支采用**适配层方案**：seasonToVideoDetail 把番剧详情适配为通用 BiliVideoDetail（owner/stats 空、pages=选集映射），播放/弹幕/评论/互动/进度全部基于 ep 的 aid/cid/bvid 自动生效，仅加 season 信息条（评分/最新集/追番按钮）+ 侧栏 hideOwner/pagesLabel="选集"；(R8) bpi-rs 新增 bangumi_tab/cinema_tab/season_rank（PgcTabData/PgcModule/PgcItem/PgcRankData 模型 + 契约），RankingPanel 增加"视频榜/PGC 榜"切换（season_type 分榜：番剧/国创/电影/电视剧/纪录片/综艺）；(R9) season_related 相关推荐接口 bpi-rs 无实现 → 后置（记 scope guard）。另 bpi-rs `models::stream` 模块由私有改公开并 re-export DashDolby/DashFlac/SegmentBase（src-tauri 转换层需要）。
- P2 completed scope: bpi-rs `bangumi/tab.rs`（bangumi_tab/cinema_tab/season_rank + 契约 3 份 + 单测，48 passed）；playback.rs `create_session_from_bangumi_stream` 转换层；后端新命令 6 个（`bilibili_season_detail`/`season_follow`/`pgc_tabs`/`pgc_rank`/`bangumi_follow_list`）+ `createPlayback` 扩展 seasonId/epId 分支；DTO `BiliSeasonDetail/Score/Episode`/`BiliPgcCard/Section`/`BiliBangumiFollow`；SDK `season.*`（detail/follow/pgcTabs/pgcRank/followList）+ playback 类型扩展，三处声明同步；追番/影视子 tab 激活 + PgcSectionFeed 分区行 + PgcCard（评分角标/新一集）；RankingPanel 视频榜/PGC 榜切换；SeasonPage（大封面/简介/评分/追番/选集网格，点集进 watch）；WatchPage season 适配分支（选集复用分 P UI、追番条、hideOwner、本地进度按 ep、createPlayback 带 epId）；我的页"追番" tab（grid + badge + 完结状态，点击开 season）。
- P2 scope guard: 未做 season_related 相关推荐（bpi-rs 无接口，后置）；未做番剧播放的收藏夹/稍后再看专用 UI（ep aid 走既有互动）；未做追番"分页加载更多"（首屏 15 条）；未做直播（P6）。
- P2 verification: `cargo fmt`；`cargo check` passed（0 errors）；`cargo test bilibili`（37 passed）；`cargo test --manifest-path crates/bpi-rs/Cargo.toml bangumi`（48 passed, 8 ignored）；`npm run build` passed；插件 `npm run build && npm run pack` passed 并写回两目录；bundle 仅 `from "sdk"` 导入、0 处 `@tauri-apps`、含 openSeason/PgcSectionFeed/SeasonPage；宿主 plugin-sdk.js 含新命令。
- P2 pending hand-test（`npm run tauri dev` 人工执行）：追番/影视页分区行、PGC 榜切换、season 详情/追番/选集、番剧播放（DASH/清晰度/弹幕/评论/进度续播）、我的页追番 tab、以及 P1 手测项（热门四分类/搜索/收藏夹管理/UP 主页）与既有播放登录不回退。

## Current Workflow Request
- Topic: Bilibili 插件系统性扩展（热门分类/排行榜/追番/影视/UP主页/直播/动态/私信/专栏笔记/设置，参考 wiliwili，bpi-rs 收编）
- Stage 1 Requirement Exploration: Completed at 2026-08-11（经 grill-me 逐项确认 Q1-Q30）
- Design doc: docs/superpowers/specs/2026-08-11-bilibili-plugin-expansion-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-11
- Plan doc: docs/superpowers/plans/2026-08-11-bilibili-plugin-expansion-plan.md
- Stage 3 Plan Execution: P0 completed at 2026-08-11；P1 completed at 2026-08-11（自动验证通过，Tauri 真实账号手测待补）
- P0 review notes（对照设计/计划与真实代码 review，修正 10 处跑偏点后执行）：(R1) 设计 §3.2 搜索"不占 tab"与已实施的"搜索第三 Tab"布局冲突 → 维持搜索 Tab 现状，首页子 tab=推荐|热门|搜索|追番|影视|直播（tab 条横向滚动），P1 联想/热搜/历史挂在搜索 Tab 内；(R2) bpi-rs 收编时 `.git` 备份到仓库外 `D:\apps\appss\ws\ets2\bpi-rs-git-backup\`（`crates/bpi-rs-git-backup/` 会被 git 跟踪）；(R3) 根 `.gitignore` 的 `bpi-rs/` 无前缀模式会匹配任意层级 bpi-rs 目录，收编必须删除该行；(R4) 不做无意义 ping 占位命令，只建 `core/bilibili/mod.rs` 模块声明骨架；(R5) SDK 命名空间：不设 `settings`（配置走 storage+runtime）、`favManage` 统一 `fav`、search 独立命名空间；(R6) ranking/suggest 命令归入新 `core/bilibili/ranking.rs`/`search.rs`（video.rs 已 605 行避免膨胀）；(R7) 收藏夹管理命令归入新 `core/bilibili/fav.rs`，library.rs 保留浏览；(R8) UP 主页 space_info/card/up_stat 逐项容错；(R9) watch 类型化采用向后兼容扩展（既有调用点不改，加可选 type/seasonId/epId 字段）；(R10) 每周必看按期数（number）查询，bpi-rs 模型无需改。另修复既有 bug：WatchSidebarTabs 引用未声明变量 `openOwnerSpace`（esbuild 无类型检查掩盖，点击 UP 行即 ReferenceError）→ 新增 `openSpace(mid)` 导航并接线。
- P0 completed scope: bpi-rs 收编为 `crates/bpi-rs`（删独立 .git 备份到仓库外、根 workspace members 增加、`.gitignore` 删 `bpi-rs/` 行、src-tauri 依赖改 `../crates/bpi-rs`，`cargo check` 通过、bpi-rs all-features 契约测试 1005 passed）；`BiliNavView` 扩展 watch 可选 season 字段 + space/season/live/settings/dynDetail/article 新视图，`MainPage` 挂占位面板与返回按钮；SDK bilibili 命名空间新增 ranking/search/fav/user/season/live/dynamic/message/note/article 骨架（宿主 sdk.ts + 官方插件 sdk.d.ts + 插件模板三处同步）；`core/bilibili` 新增 10 个模块声明；首页子 tab 扩为 推荐|热门|搜索|追番|影视|直播（追番/影视/直播禁用占位）。
- P0 scope guard: 未改播放内核/代理/MPD/弹幕/评论/进度；未注册新后端命令；追番/影视/直播 tab 仅占位。
- P0 verification: `cargo fmt`；`cargo check` passed；`cargo test --manifest-path crates/bpi-rs/Cargo.toml --all-features`（1005 passed, 198 ignored）；`npm run build` passed；插件 `npm run build && npm run pack` passed 并写回两目录；bundle 仅 `from "sdk"` 导入、0 处 `@tauri-apps`。
- P1 review notes（对照设计 §4.1 与计划 T7-T12）：ranking/series/precious/suggest/hotwords 均为匿名公开接口，与现有 search_videos 一致走 `BpiClient::new()`（设计"optional client"仅对登录态接口适用）；`popular_series_one` 参数实为**期数 number**（bpi-rs `PopularSeriesOneParams::new(number)`），非 series id，bpi-rs 模型无需补 id 字段；`FavResourceTransferParams` 需要当前用户 mid，由命令层 `current_mid` 提供（BpiClient 无 account() 读取方法）；`BiliVideoCard` 映射复用 `value_to_card`/`parse_duration`（已 pub 化）；搜索历史存插件 config（`searchHistory` 最多 10 条去重置顶，normalizeConfig 归一化）；`window.prompt` 在 WebView2 不可靠 → 新建/重命名/移动到全部用自实现弹层（InputDialog/ConfirmDialog/MoveDialog）；收藏夹管理"移动到"改为目标选择弹层（不逐条列出全部目标按钮）。
- P1 completed scope: 后端新命令 17 个（`bilibili_ranking_videos`/`weekly_series_list`/`weekly_series_one`/`precious_videos`/`search_suggest`/`search_hotwords`/`fav_folder_create/edit/delete`/`fav_resource_delete/move/copy/clean`/`user_space`/`user_videos`/`user_follow`）全部注册 lib.rs；DTO `BiliWeeklySeries`/`BiliHotWord`/`BiliPreciousVideos`/`BiliUserSpace`/`BiliUserSpaceLive`；SDK `ranking.*`/`search.*`/`fav.*`/`user.*` 填充并同步三处声明；热门二级分类 HotSubTabs（综合热门/排行榜/每周必看/入站必刷）+ RankingPanel（rid 分区选择）/WeeklyPanel（期切换）/PreciousPanel（头+网格）；搜索增强 SearchBox（suggest 联想下拉 300ms debounce）+ SearchEmptyPanel（历史可清空 + 热搜榜前 20）；收藏夹管理模式 FavoriteManagePanel（文件夹 CRUD + 资源多选批量删除/移动到 + 二次确认弹层 + 写后刷新）；UP 详情页 SpacePage（信息卡/统计/直播状态/关注乐观更新/投稿分页）+ `openSpace` 导航 + WatchSidebarTabs `onOpenSpace` 接线（修复既有 openOwnerSpace 未声明 bug）。
- P1 scope guard: 未改播放内核/代理/MPD/弹幕/评论/进度；未做追番/影视/直播真实内容（P2/P6）；未做收藏夹"复制/清空失效"UI（后端命令已备，UI 后置）；未做 UP 动态 tab（P4）。
- P1 verification: `cargo fmt`；`cargo check` passed（0 errors）；`cargo test bilibili`（37 passed）；`cargo test plugins`（18 passed）；`npm run build` passed；插件 `npm run build && npm run pack` passed 并写回两目录；bundle 仅 `from "sdk"` 导入、0 处 `@tauri-apps`、含 14 处新 SDK 调用；宿主 plugin-sdk.js 含新命令名。
- P1 pending hand-test（`npm run tauri dev` 人工执行）：首页热门四分类切换（综合热门/排行榜分区/每周必看期切换/入站必刷）、搜索联想/热搜/历史记录与清空、收藏夹管理模式全流程（新建/重命名/删除/多选删除/移动到/二次确认）、播放页点击 UP 进主页、UP 详情页关注/取关与投稿分页、以及登录/播放/弹幕/评论等既有功能不回退。

## Current Fixes (2026-08-11)
- **番剧播放修复（dashjs 毫秒猜测）** —— 现象：番剧详情/选集正常但播放 1-2 秒即停（video.duration≈1.5/2.0 秒），普通视频正常。排查过程：Rust 后端端到端验证全通（MPD/init/sidx/媒体段 206，第一段真实时长 5.005 秒）；前端 MediaSource hook 发现 `ms.duration=1.494`（dashjs 显式设置）。**决定性实验**：MPD 时长写死 `PT100S` → 能播 100 秒；真实 `PT1494S` → 1.494。**根因**：dashjs 对 MPD duration 中 **>1000 的值做"毫秒猜测"（÷1000）**（兼容某些工具生成毫秒单位的时长），1494 秒被解析为 1.494 秒 → 只缓冲第一段即 ended；107.25 秒（<1000）不受影响。**修复**（`playback.rs build_mpd`）：反向利用——MPD 时长写**毫秒值**（`PT{duration_ms}S`，真实 1494 秒 → `PT1494000S`），dashjs 猜测 ÷1000 后正好得到真实秒数；视频（PT107250S → 107.25）同样正确。测试断言同步更新。验证：`cargo test bilibili` 37 passed、`cargo test plugins` 18 passed、bpi-rs bangumi 48 passed、src-tauri `--no-default-features` 0 errors、主前端/插件 build+pack 通过、bundle 无 @tauri-apps 直连。
- **番剧详情反序列化修复（两轮）** —— 现象：打开部分番剧报 `failed to decode response (Data)`（大番剧 1.35MB 必现）。根因与修复见下方条目（tolerant 容错反序列化 + total 类型 i64 + 字段 default）。


- **番剧详情反序列化修复（两轮）** —— 现象：打开部分番剧报 `failed to decode response (Data) at line 1 column xxx`（大番剧 1.35MB 必现）。第一轮根因：bpi-rs `BangumiDetailResult` 链路大量字段缺 `#[serde(default)]`，真实响应中字段缺失（如首集 `stat` 为空对象、新番无 `link_type`/`toast_title`）→ 给 detail 链路 30+ 结构体批量补 default（220+ 处）+ 嵌套 struct（BangumiPayType/BangumiMainSection/BangumiBadgeInfo）derive Default。第二轮根因（用户反馈仍有大量番剧失败，参考 wiliwili `from_json` 的 contains+get_to 容错策略）：(1) `result.total = -1`（连载番剧）与模型 `u32` 冲突 → `total` 改 `i64`（bpi-rs + BiliSeasonDetail 同步）；(2) **根治**：在 `bangumi/info.rs` 增加 `tolerant` 容错反序列化模块（`de_string/de_u64/de_u32/de_i64/de_f64/de_bool`，基于 serde_json::Value 中转，null/缺失/类型漂移（数字↔字符串、负数↔无符号）全部回落默认值），批量应用到全部 String/数字/bool 字段（约 260 处）。验证：真实响应 11 部番剧（含 2 部 1.46MB 大番剧）全部解析通过；bpi-rs bangumi 48 passed；src-tauri `--no-default-features` check 0 errors；`cargo test bilibili` 37 passed。另排查期间确认 wiliwili 的 SeasonResultWrapper 用 nlohmann 手动 from_json 逐字段容错，且合集分集缺 bvid/duration/long_title/subtitle 需 contains 检查（serde default 已覆盖缺失场景）。


- **播放页分P栏加背景卡片** —— `.bili-sidebar-section`（分P 与相关推荐共用）原为透明容器，内部 `.bili-page-item` 用 `--card`（==背景色不可见）。用 `:has(.bili-page-list)` 只命中**分P区块**（相关推荐不含 `.bili-page-list` 不受影响），加与视频卡片同款卡片：`--muted` 55% 背景 + 边框 + 圆角 10px + 阴影（`--muted` 是既有可见卡片方案，`--card`==背景色不可见）。分P 项保留原样（轻微 pill 效果，与卡片区分）。验证：`npm run build`/`pack` passed 并写回两目录（MD5 一致），bundle 含 `.bili-sidebar-section:has(.bili-page-list)` 规则，styles.ts 花括号 345/345 平衡。
- **播放页组件级联进入（动画补充）** ——（见动画体系条目内的补充说明）
- **插件页面动画体系（参考网易云插件动画）** —— 原 bilibili 插件几乎无动画（仅少量 hover transition），改造成与网易云一致的弹性缓动 + 错峰进入 + 微交互：`.bili-shell` 加 `--bili-ease`/`--bili-spring` 缓动变量；`@keyframes bili-fade-in/slide-down/view-in/card-in/list-in/popover-in` 七个；进入动画（壳 opacity 淡入、顶栏 slide-down 40ms 延后、首页/我的 `bili-view-in` 位移淡入、播放页 opacity 淡入、视频卡片 `bili-card-in` 错峰逐卡延迟 20-140ms、评论卡片/状态提示淡入、弹层 popover scale-in）；微交互（视频卡片 hover 上浮 3px + 阴影加深、顶栏/feed/库 Tab 与账号按钮 hover 上浮 1px、菜单项/点赞点踩/播放控制按钮按下 scale 0.9）；`@media (prefers-reduced-motion: reduce)` 一键关闭全部动画/过渡。**关键约束**：`.bili-shell`/`.bili-watch` 是全屏播放器（`position: fixed`，styles.ts:463）的祖先，只给 opacity 动画不给 transform，避免制造 containing block 破坏全屏（同 P5 对容器查询的顾虑）。**补充（播放页组件级联）**：用户反馈播放页只有相关推荐卡片有动画 → 给播放页各组件补级联进入——`.bili-watch-grid`（opacity-only）、`.bili-player-shell`（`bili-view-in`，自身即全屏 fixed 元素、`backwards` 结束后 transform 还原故安全）、`.bili-player-overlay`、`.bili-danmaku-input`(50ms)、`.bili-interaction-wrap`(80ms)、`.bili-video-detail-panel`(120ms)、`.bili-comments`(170ms)、`.bili-watch-side`(60ms 整体上浮)、侧栏内 `.bili-owner-row`(40ms) 与 `.bili-sidebar-section`(0/90ms 错峰)；相关推荐卡片复用 `.bili-video-card` 已有错峰。以上全部纳入 `prefers-reduced-motion` 关闭清单。验证：`npm run build`/`pack` passed 并写回两目录（MD5 一致），bundle 含全部新增规则，styles.ts 花括号 344/344 平衡。
- **单页内跳转：点击视频即报 "Plugin render error: Cannot read properties of undefined (reading 'name')"** —— 根因：`navigation.ts` 的 `switchView` 里 `listeners.forEach((listener) => listener())` **没把新 view 传给监听器**，而监听器是 React 的 `setView` → `setView()` 空参调用 = `setView(undefined)` → MainPage 重渲染时 `view.name` 读 undefined 抛错，错误边界接管。`memory` 在报错前已更新（`switchView` 先 `memory = view` 再通知监听器），所以切走再切回（重挂 MainPage 走 `useState(getNavView)`）能正确显示播放页——与用户现象完全吻合。修复：改为 `listener(view)`。验证：`npm run build`/`pack` passed 并写回两目录（MD5 一致），bundle 内 `switchView` 为 `listeners.forEach((listener) => listener(view))`，`npx tsc --noEmit` 对改动文件无新增非 JSX 错误（既有 JSX.IntrinsicElements 除外）。
- **单页内跳转：三个独立页面合并为单页（参考网易云插件逻辑）** —— 原实现把首页/播放/我的注册为三个宿主页面，URL 级切换（`window.location.assign`）+ 整页卸载重挂 → 切换割裂、首页 feed 状态丢。重构：只注册一个页面（path=`home`，渲染 `MainPage`），新增 `src/navigation.ts`（模块级 view 状态 + 观看回退栈 + 各视图滚动记忆，宿主侧切走再回来仍回上次视图，对齐网易云 viewMemory）；`MainPage` 单 `BiliAppShell`+顶栏，**首页/我的常驻挂载用 `.bili-hidden` 显隐**（feed 已加载分页/搜索词/滚动都保住），**播放页按需挂载**（离开即卸载：停播放、存进度，行为同前）；`BiliTopNav` 首页/我的 Tab 与 `VideoCard`（首页/相关推荐/我的页库）改走 `navigateNav`/`openWatch`，播放页"返回"改 `goBackNav` 弹栈（播放页内连点相关视频可逐级返回），顶栏"播放"态由 MainPage 提供 subtitle=bvid + 返回按钮；删 `routes.ts` 与 `readQuery()`/`watchUrl`/`homeUrl`/`mineUrl`/`window.location.assign`。验证：`npm run build`/`pack` passed 并写回两目录（MD5 一致），bundle 含 `navigateNav`/`openWatch`/`goBackNav`/`MainPage`/`bili-hidden`，无 `window.location.assign`/`watchUrl`/`history.back` 残留，仅 `from "sdk"` 导入。
- **首页推荐"换一批"固定内容修复** —— 现象：进入首页 ABCD、刷新 CDEF、再刷新 GHIJ，重启软件/插件后仍是同一批。根因：后端 `recommend_videos(page)` 用 `fresh_idx(page)`/`fetch_row(page)`，B站 rcmd 对**同一 fresh_idx 返回固定批次**，重启回到 fresh_idx=1 就又是那批（wiliwili 也是会话内计数、重启回 1，bpi-rs 响应只暴露 `item` 无 feed_version token 可回传）。修复：`HomePage` 加**模块级随机会话种子** `RECOMMEND_SEED = Math.floor(Math.random() * 30) + 1`，推荐 fetcher 传 `RECOMMEND_SEED + page` 作为 fresh_idx → 每次插件加载从随机批次起点开始轮换，重启后首页内容不再固定。后端无需改（SDK 签名 `recommendVideos(page, refresh)` 不变，换一批仍 refresh 绕过缓存）。验证：`npm run build`/`pack` passed 并写回两目录（MD5 一致），bundle 含 `RECOMMEND_SEED = Math.floor(Math.random()` 模式，仅 `from "sdk"` 导入。
- **三个 Bug 修复** —— (1) **UP 头像不显示**：`VideoOwnerRow` 之前用裸 `<img src={owner.avatar}>`，B站头像 URL 在 webview 里 403（无 Referer/代理）→ 改用 `BiliImage`（走封面代理）。(2) **点赞使播放器黑屏 + 进度重置**：根因是 PlayerShell 的 dash effect deps 含 `startTime` 和 `rememberTime`，而 `rememberTime` 依赖的 `onPlaybackTime`（WatchPage 的 `rememberPlaybackTime`）是普通函数每次渲染新引用 → 点赞等操作触发 WatchPage 重渲染 → dash effect 清理并重建播放器 → 黑屏 + 进度重置。修复：dash effect deps 移除 `startTime` 和 `rememberTime`（只保留 `playback?.directUrl/manifestUrl/playbackId/syncVideoState`，切 P 时才重建），`startTime`/`rememberTime` 改为闭包取值。(3) **收藏菜单加滚动**：`FavoritePanel` 的收藏夹项包进 `.bili-folder-scroll`（max-height 280px + overflow-y auto），收藏夹多时菜单不无限拉长。验证：`npm run build`/`pack` passed 并写回两目录（MD5 一致），源码确认 dash deps 已去掉 startTime/rememberTime、VideoOwnerRow 用 BiliImage、bili-folder-scroll 生效，仅 `from "sdk"` 导入。
- **三处 UI 调整 + 评论区卡片根因修复** —— (1) **回复/展开回复/置顶/删除/举报合并到点踩右边**：CommentItem 把 `.bili-comment-thumbs` 与 `.bili-comment-actions` 合并为一行 `.bili-comment-actions`（顺序：点赞、点踩、回复、展开回复、置顶、删除、举报），删除 `.bili-comment-thumbs` 样式。(2) **视频卡片 + 相关推荐卡片加背景**：`.bili-video-card`（首页网格与相关推荐共用）从透明改为卡片——`color-mix(hsl(var(--muted)) 55%)` 背景 + 边框 + 圆角 + 内边距 + 阴影 + hover 阴影。(3) **评论区卡片根因**：找到两个真凶——(a) **遗留覆盖**：styles.ts 里第二个 `.bili-comments` 规则（注释在侧栏时代遗留）把 `border/background/box-shadow` 全设透明，覆盖了卡片效果 → 已删除；(b) **`--card` == `--background`**：宿主浅色主题 `--card: 0 0% 100%`、深色主题 `--card: 240 10% 3.9%`，与 `--background` **完全相同**，用 `--card` 当卡片背景在任何主题下都与页面背景一致、不可见 → `.bili-comments`/`.bili-video-detail-panel`/`.bili-video-card` 的卡片背景改用 `hsl(var(--muted))`（浅色=浅灰、深色=深灰，与页面明显区分）。验证：`npm run build`/`pack` passed 并写回两目录（MD5 一致），bundle 内 `.bili-comments` 仅一条规则（muted 背景+边框+阴影、无透明覆盖），`bili-comment-thumbs` 已移除，仅 `from "sdk"` 导入。
- **三处 UI 调整（上一批）** —— (1) 播放器截图按钮补 hover：`ScreenshotButton` 旧类 `bili-player-icon-button` 已无样式，改 `bili-ctrl-btn`。(2) 删除首页热门精选横列（HotRow 组件 + 样式）。(3) 点赞/点踩缩 30%（`.bili-thumb` min-height 22px、图标 14px、字号 11px）。
- **评论点赞/点踩换成拇指样式 + 移到底部左侧（参考 animotion/点赞点踩）+ 评论区卡片背景** —— (1) `CommentItem` 移除左侧心形 rail（`bili-comment-rail` 及样式），点赞/点踩改为**拇指图标按钮**（`bili-thumb` 胶囊，参考的 thumbs-up/down SVG 内联，hover 图标放大 1.3x、active 强调粉色 + 边框/底色），放在评论内容下方 `bili-comment-thumbs` 组（评论左下，与头像左对齐）；actions 行移除旧的文字"点踩"。(2) 评论区容器 `.bili-comments` 从硬编码深色半透明改为**主题卡片背景**（`hsl(var(--card) / 0.65)` + `color-mix(var(--border))` 边框 + 圆角 + 阴影）；`.bili-comment-card` 改为透明行 + 底部细分割线（避免卡片套卡片），置顶评论用 cyan 淡底色。验证：`npm run build`/`pack` passed 并写回两目录（MD5 一致），bundle 含 `bili-thumb`/`bili-comment-thumbs`/`bili-thumb-icon` 及拇指 SVG path，`bili-comment-rail` 已移除，仅 `from "sdk"` 导入。
- **样式重构：播放器控制栏 + 评论区（参考 animotion/视频控制栏、视频评论，抽为共享组件）** —— (1) 新增共享组件 `VideoPlayerControls.tsx`：从 PlayerShell 抽出控制栏，参考样式为圆形图标按钮（`bili-ctrl-btn`，hover 圆底）、细进度条（`bili-player-seek` 用 `--progress` 渐变 + 圆形滑块）、`playbar`+时间，**hover 显示控件**（`bili-player-controls-hidden` 淡出，PlayerShell 用 `hovering`/`!isPlaying`/`!canControl`/弹层打开 计算 `controlsVisible`）；PlayerShell 移除内联控制栏与 `formatDuration`/`pad`/Icon 残留。(2) 新增共享组件 `CommentItem.tsx`：评论卡片参考样式为左侧点赞 rail（`bili-comment-rail` 爱心图标+计数+分隔线）+ 用户行（`bili-comment-user` 圆形头像/昵称/时间）+ 内容 + 操作 + 回复/举报；主评论编辑器改为圆角容器 + accent 圆形发送按钮；`CommentPanel` 的 `renderComment` 改为渲染 `<CommentItem>`，回复列表/编辑器经 `repliesSlot` 传入，`reportReasons`/`ReportDraft` 移到 CommentItem 导出，移除 `CommentPanel` 未用的 `BiliImage`/`formatTime`。验证：`npm run build`/`pack` passed 并写回两目录（MD5 一致），bundle 含 `VideoPlayerControls`/`CommentItem`/`bili-ctrl-btn`/`bili-player-playbar`/`bili-comment-rail` 等，仅 `from "sdk"` 导入。注：插件无 styled-components，参考组件的 styled.div 已翻译为 `styles.ts` 的 CSS 类方案；回复项保留原紧凑行 + 点赞/点踩/回复/删除/举报交互（未按参考做成纯展示）。
- **Bug：很多组件完全没有卡片效果、直接铺在页面上** —— 根因：宿主主题变量（`--card`/`--foreground`/`--border`/`--muted-foreground`/`--muted`）在宿主里定义的是 **HSL 三元组**（如 `--card: 240 10% 3.9%`），宿主组件库用 `hsl(var(--card))` 消费；而插件 styles.ts 把这些变量**裸当颜色**用（`var(--card, #272b36)`），解析成 `color-mix(in srgb, 240 10% 3.9% 78%, transparent)` 是**非法 CSS**，声明被浏览器丢弃 → 卡片背景、边框、文字颜色全部失效 → 只剩默认白底黑字、元素直接铺在页面上。修复：用脚本把 styles.ts 里全部 110 处宿主变量引用包上 `hsl()`（`var(--card, #272b36)` → `hsl(var(--card, 0 0% 100%))`，等），恢复卡片背景/边框/文字色。验证：`npm run build`/`pack` passed，bundle 含 110 处 `hsl(var(--` 包裹、无裸 `var(--card, #` 残留，仅 `from "sdk"` 导入。注：播放器控制条内 `--bili-accent`/`--bili-cyan` 是插件自有十六进制变量，不受影响，未改。
- **Bug：投币/收藏/更多/清晰度/弹幕点击无反应** —— 根因：MenuPopover 的 document `mousedown` 监听在**打开弹层的同一次点击**里就触发（触发按钮在 popover ref 之外），弹层开一下就被立刻关闭，表现为"无反应"。修复：MenuPopover 新增 `triggerRef`（点外关闭时把触发按钮视为"内部"），`CoinPanel`/`FavoritePanel`/`WatchMoreMenu`/`DanmakuSettingsPopover`/QualityMenu 弹层全部传入对应触发按钮 ref（互动条传 `coinAnchorRef`/`favoriteAnchorRef`/`moreAnchorRef`，控制栏新增 `qualityTriggerRef`/`danmakuTriggerRef`）。验证：`npm run build`/`pack` passed，bundle 含 `triggerRef`（16 处）。
- **UI 优化：组件库使用 + 减少文字选项** —— (1) 互动条按钮加图标：点赞=`heartFilled`、收藏=`starFilled`/`starOutline`（按 active）、稍后再看=`bookmarkFilled`、举报=`warning`（投币/分享/更多因库内无 coin/share/dots 图标保持文字）；`.bili-interaction-button` 从 2 列 grid 改 flex 容纳 图标+文字+数值。(2) 清晰度选项加选中对勾（`check` 图标，active 项显示，`bili-quality-option-main` 样式）。(3) 收藏夹项选中加 `check` 图标。播放器控制条（seek/volume/rate/图标按钮）按既定决策保持专用控件（视频控制密度与行为稳定，库组件无 disabled/会与暗色叠层冲突），未转换。

## Current Workflow Request
- Topic: Bilibili 插件页面布局与逻辑重设计（逻辑 + 布局一次到位，不碰信息架构）
- Stage 1 Requirement Exploration: Completed at 2026-08-11（经 grill-me 逐项确认）
- Design doc: docs/superpowers/specs/2026-08-11-bilibili-layout-logic-redesign.md
- 用户已确认的关键范围：首页抽 `usePagedFeed`、搜索成为第三 Tab、顶部热门精选行 + 主网格；播放页评论回主区全宽、右侧内容栏只放分P + 相关推荐、清晰度/弹幕进控制栏 popover、两行图标化控制栏、弹层统一菜单样式；我的页顶部账号卡 + 可拼统计；最小窗口侧栏折叠；抽 `usePagedFeed` + `useVideoInteraction` 两个 Hook，`runtime.ts` 全局 store 保留。
- Stage 2 Implementation Planning: Completed at 2026-08-11
- Plan doc: docs/superpowers/plans/2026-08-11-bilibili-layout-logic-redesign-plan.md
- Stage 3 Plan Execution: P0 completed at 2026-08-11；P1 completed at 2026-08-11；P2 completed at 2026-08-11；P3 completed at 2026-08-11；P4 completed at 2026-08-11；P5 completed at 2026-08-11（自动验证通过，Tauri 真实账号手测待补）
- P0 review notes: 实现前严格对照设计/计划与真实代码 review，修正 6 处跑偏点——(R1) `reload()` 语义改为"换一批"（page+1 + 绕过缓存，对齐现有"刷新"行为，不是刷新当前页）；(R2) 搜索实例 `key` 用已提交关键词状态而非实时输入框，并处理同词重提交；(R3) HomePage 保留 `mode` 选择器，热门懒加载对齐现有"点 Tab 才请求"；(R4) `useVideoInteraction` 接收 `{aid,bvid,ownerMid,loggedIn}` deps 与登录门控；(R5) 相关推荐组件命名统一为 `RelatedPanel`；(R6) 评论由 `PlayerShell` 在 `watch-main` 底部渲染、侧栏改两个堆叠区块移除 `defaultTab`/`focusMoreNonce`、"更多"改互动条本地弹菜单。设计/计划文档已同步修正。
- P0 completed scope: 新增 `src/hooks/usePagedFeed.ts`（分页状态机，key 变化自动 reset、enabled 惰性加载、reload=换一批、reset=重载第一页、请求序号丢弃过期响应）；新增 `src/hooks/useVideoInteraction.ts`（互动状态加载/乐观更新回滚/投币非乐观/busy 串行锁/登录门控，deps 含 loggedIn）；HomePage 用三个 `usePagedFeed` 实例替换三套 page 计数器与三个 load 函数，保留 `mode` 选择器、推荐 mount 加载、热门懒加载、搜索已提交关键词驱动；WatchPage 用 `useVideoInteraction` 收敛互动状态与回调，`PlayerShell` props 接口保持不变。均保持行为不变重构。
- P0 scope guard: 未改 Rust 后端、SDK 命令、播放代理、MPD、DASH/MP4 fallback、进度 reporter、弹幕/评论/账号 API、`runtime.ts` 全局 store 结构；未动首页/播放页布局（P0 只重构逻辑，布局在 P1-P4）。
- P0 verification: `cd scripts/official-plugins/bilibili && npm run build` passed；`cd scripts/official-plugins/bilibili && npm run pack` passed and wrote back `plugins/com.easygamehub.bilibili` plus `resources/defaults/plugins/com.easygamehub.bilibili`；bundle 检查仅 `from "sdk"` 导入、0 处 `@tauri-apps` 直连。
- P0 pending hand-test: `npm run tauri dev` 后检查首页推荐/热门/搜索切换、搜索提交/同词重提交/空词回推荐、刷新换一批，以及播放页互动条显示与登录态点赞/投币/收藏/稍后再看/关注行为不回退。
- P1 review notes: 对照设计 §5.1/5.2/5.3 与计划 T6/T7/T8 review，明确 6 点——(P1-1) 设计 §5.1 搜索框画在顶栏，但计划 P1 未安排移动搜索框，保持页面 body 现状记观察；(P1-2) HotRow 由 HomeFeed 渲染（heading 与 grid 之间），HomeFeed 仍纯展示，HotRow 作为自取数叶子；(P1-3) HomeFeed 新增 `searchGuide` prop 区分"搜索 Tab 无关键词"（引导空态）与"搜索无结果"（暂无视频）；(P1-4) 热门精选行始终显示（含搜索模式），已回写设计 §5.3 锁定；(P1-5) 横向滚动行内 VideoCard 定宽 200px 样式；(P1-6) T8 纯展示化由 P0 数据装配方式天然满足。其中 P1-4 已回写设计文档。
- P1 completed scope: `HomeFeedTabs` 增加"搜索"Tab（mode==="search" 高亮）；`HomeFeed` 新增 `searchGuide` 引导空态（"输入关键词开始搜索"）、渲染 `HotRow`、`onSearch` 回调；新增 `src/components/HotRow.tsx`（独立取 popularVideos 第一页前 8 个，横向滚动，`usePagedFeed` key="hotrow"，失败只隐藏该行）；`HomePage` 新增 `switchToSearch`（点击搜索 Tab 切到 search mode，无关键词时显示引导空态）并传 `onSearch`/`searchGuide`；styles.ts 新增 `.bili-hot-row`/`.bili-hot-track`/`.bili-hot-track .bili-video-card` 定宽样式。三 Tab 各自独立 feed 数据、刷新只刷当前、搜索提交/空词回推荐行为保留。
- P1 scope guard: 未移动搜索框进顶栏（计划未安排，记观察）；未改播放页/我的页；未改 Rust 后端与 SDK；未改 `runtime.ts` 全局 store 结构。
- P1 verification: `cd scripts/official-plugins/bilibili && npm run build` passed；`cd scripts/official-plugins/bilibili && npm run pack` passed and wrote back `plugins/com.easygamehub.bilibili` plus `resources/defaults/plugins/com.easygamehub.bilibili`；bundle 检查仅 `from "sdk"` 导入、0 处 `@tauri-apps` 直连；bundle 内 70 个 P1 UI 字符串转义全在（Python 大小写不敏感核验）。
- P2 review notes: 对照设计 §6.1/6.2/6.4 与计划 T10/T11/T12 review，明确 6 点——(P2-1) **阶段衔接缺口**：T11/T12 把清晰度/弹幕/更多从侧栏移出但 P3(T14-16)才放进控制栏 popover 和更多菜单，严格照做会让两阶段间短暂丢失这些功能 → 决议：P2 把它们作为**临时区块**渲染在主区详情下方（`bili-temp-settings`，标记 P3 迁移后移除），互动条"更多"改为 scrollIntoView 该区块，保证无回归；(P2-2) WatchSidebarTabs 从"5 Tab + defaultTab + focusMoreNonce"重构为接收 pages/selectedPageCid/onSelectPage/bvid/aid，渲染分P + 相关推荐两个堆叠区块；(P2-3) 新增 RelatedPanel 独立取 video.related，失败显示空态；(P2-4) 布局移到 WatchPage：WatchPage 组合 `.bili-watch-grid`（PlayerShell 主区 + WatchSidebarTabs 侧栏），PlayerShell 只返回 watch-main，全屏 `fixed inset:0` 不依赖网格；(P2-5) 侧栏滚动迁移到 `.bili-watch-side`，清理死掉的 `.bili-watch-tabs` 样式与响应式规则；(P2-6) 切 P 进度上报由 progressReporter.destroy() 的 save(true) 兜底，移到侧栏直接调 onSelectPage 行为不变。
- P2 completed scope: `CommentPanel` 从侧栏移入主区 `watch-main` 底部（复用 `bili-comments` 全宽样式）；新增 `src/components/RelatedPanel.tsx` 接线 `sdk.bilibili.video.related`（死代码接线）；`WatchSidebarTabs` 重写为右侧内容栏（分P 列表 + 相关推荐两个堆叠区块，移除 Tab 机制、defaultTab、focusMoreNonce）；`PlayerShell` 职责收缩为主区渲染器（播放内核 + 弹幕输入 + 互动条 + UP 行 + 详情 + 临时设置 + 评论），移除侧栏面板与 watch-grid 包装；`WatchPage` 组合 `.bili-watch-grid`（PlayerShell + WatchSidebarTabs）并直连传 onSelectPage；styles.ts 新增 `.bili-related-list`/`.bili-temp-settings`，侧栏滚动迁移到 `.bili-watch-side`，删除 `.bili-watch-tabs`/`.bili-watch-tab*`/`.bili-watch-tab-panel` 样式与响应式规则。
- P2 scope guard: 未改 createDashPlayer/requestPlaybackFallback/createProgressReporter；未改进度/弹幕/评论/互动 API；未改 Rust 后端与 SDK；清晰度/弹幕/更多设置仅临时移位（P3 迁移到控制栏/菜单），功能无丢失。
- P2 verification: `cd scripts/official-plugins/bilibili && npm run build` passed；`cd scripts/official-plugins/bilibili && npm run pack` passed and wrote back `plugins/com.easygamehub.bilibili` plus `resources/defaults/plugins/com.easygamehub.bilibili`；bundle 仅 `from "sdk"` 导入、0 处 `@tauri-apps` 直连；bundle 含 `bili-related-list`/`bili-temp-settings`/`RelatedPanel`，`bili-watch-tabs` 已移除，41 个 P2 UI 中文转义全在（Python 大小写不敏感核验）。
- P3 review notes: 对照设计 §6.3/D8/D10 与计划 T14/T15/T16 review，明确 7 点——(P3-1) **图标可用性**：sdk 提供 `playFilled/pauseFilled/speaker/speakerMute/fullscreen/screenshots/settings/playtime/playlistFilled` 等，无倍速/清晰度/弹幕专用图标 → 用"图标 + 小标签"（倍速=playtime+数值、清晰度=settings+当前清晰度、弹幕=playlistFilled+开/关）；(P3-2) 控制栏改两行（顶行进度条+时间，底行 flex 图标按钮，窄屏 `overflow-x: auto`）；(P3-3) 清晰度/弹幕 popover 在 `.bili-player-shell` 内绝对定位（right:12/bottom:80），覆盖在控制栏上方；(P3-4) 新增共享 `MenuPopover`（点外/Esc 关 + 菜单样式），四个弹层统一；触发按钮用 `onMouseDown` 切换避免 toggle/dismiss 冲突；(P3-5) 互动条 popover（投币/收藏/更多）用**按钮测位锚定**到 `.bili-interaction-wrap`（避免 `.bili-interaction-bar` 的 `overflow-x:auto` 裁剪），更多右对齐、投币/收藏左对齐；(P3-6) 移除 P2 临时设置区块（`bili-temp-settings` 样式、scrollToMore/moreSectionRef）；(P3-7) VideoInteractionBar props 从 `onMore` 改为 `onExternalOpen/onCopyLink/onOpenScreenshotFolder`。
- P3 completed scope: 控制栏两行 + 图标化（`bili-player-controls-top`/`-bottom`，播放/音量/倍速/清晰度/弹幕/截图/全屏，ScreenshotButton 用 `screenshots` 图标）；新增 `MenuPopover.tsx`（共享菜单样式浮层 + 点外/Esc 关）；新增 `DanmakuSettingsPopover.tsx`（弹幕设置从 PlayerShell 迁入）；新增 `WatchMoreMenu.tsx`（更多 = 外部打开/复制链接/截图目录）；`CoinPanel`/`FavoritePanel` 重写为菜单样式弹层（`bili-menu-heading`/`bili-menu-item`/关闭）；`VideoInteractionBar` 更多改本地弹 WatchMoreMenu，popover 用按钮测位锚定；移除 P2 主区临时设置区块与其样式；styles.ts 新增 `.bili-menu-popover`/`.bili-menu-*`/`.bili-popover-anchor`/`.bili-player-rate-wrap`，删除 `.bili-temp-settings`/`.bili-popover-panel*`，更新 640px 响应式（窄屏隐藏音量/倍速）。
- P3 scope guard: 未改 createDashPlayer/requestPlaybackFallback/createProgressReporter/进度/弹幕/评论 API；未改 Rust 后端与 SDK；投币/收藏确认流程不变（弹层只改视觉 + 补点外/Esc 关闭）；清晰度/弹幕/更多功能从主区临时区块迁入控制栏 popover / 更多菜单，无丢失。
- P3 verification: `cd scripts/official-plugins/bilibili && npm run build` passed；`cd scripts/official-plugins/bilibili && npm run pack` passed and wrote back `plugins/com.easygamehub.bilibili` plus `resources/defaults/plugins/com.easygamehub.bilibili`；`npx tsc --noEmit` 对 P3 改动文件无新增非 JSX 错误（既有 JSX.IntrinsicElements/隐式 any 除外）；bundle 仅 `from "sdk"` 导入、0 处 `@tauri-apps`；bundle 含 `bili-menu-popover`/`bili-player-controls-top`/`-bottom`/`MenuPopover`/`WatchMoreMenu`/`DanmakuSettingsPopover`，`bili-temp-settings`/`bili-popover-panel`/`bili-watch-tabs` 已移除，38 个 P3 UI 中文转义全在（Python 大小写不敏感核验）。
- P4 review notes: 对照设计 §7.1/7.2/7.3 与计划 T18/T19/T20 review，明确 5 点——(P4-1) 统计字段**从现有 SDK 调用拼出**（无需新后端命令）：稍后再看数 = `toviewList().length`、收藏夹数 = `favoriteFolders().length`、收藏视频 = `sum(mediaCount)`；历史条数因 `historyList` 分页无 total 不取（避免假统计）；(P4-2) 登录态分工：已登录用 `AccountCard`（头像/昵称/UID/统计/退出登录），未登录用 `LoginPanel`（二维码），MinePage 按 `loggedIn` 二选一；(P4-3) `.bili-mine` 从两列改单列（账号卡上、账号库下），AccountLibraryTabs 内部不变；(P4-4) 统计 `Promise.all` 任一失败隐藏统计行，不做空卡，保留头像/昵称/UID/退出登录；(P4-5) AccountCard 复用 runtime `logout()`。
- P4 completed scope: 新增 `src/components/AccountCard.tsx`（头像 `BiliImage` + 昵称 + UID + 三个可拼统计 + 退出登录，统计失败隐藏行）；`MinePage` 已登录渲染 `AccountCard`、未登录渲染 `LoginPanel`，下方保留 `AccountLibraryTabs`；styles.ts `.bili-mine` 改单列，新增 `.bili-account-card*` 样式（flex 卡片、圆形头像、统计区右对齐、窄屏 flex-wrap）。修复 `BiliAppShellProps.children` 必填 → 可选（同 MenuPopover 的 JSX 检查怪癖，P4 前即存在）。
- P4 scope guard: 未新增后端命令/SDK 方法；未改 `bpi-rs`；未改 AccountLibraryTabs 的历史/稍后再看/收藏夹功能；统计仅展示不参与账号写操作。
- P4 verification: `cd scripts/official-plugins/bilibili && npm run build` passed；`cd scripts/official-plugins/bilibili && npm run pack` passed and wrote back `plugins/com.easygamehub.bilibili` plus `resources/defaults/plugins/com.easygamehub.bilibili`；`npx tsc --noEmit` 对 P4 改动文件无新增非 JSX 错误；bundle 仅 `from "sdk"` 导入、0 处 `@tauri-apps`；bundle 含 `bili-account-card`/`AccountCard`，22 个 P4 UI 中文转义全在（Python 大小写不敏感核验）。
- P5 review notes: 对照设计 §9/D12 与计划 T21/T22/T23/T24/T25 review，明确 5 点——(P5-1) **既有 640px 媒体查询在 Tauri 窗口内是死代码**（窗口 minWidth 720px，viewport 永远 ≥720>640，从不触发），T21 要的"最小窗口侧栏收起"必须让断点覆盖 720px → 断点改 `@media (max-width: 820px)`（窗口≤820 窄模式、720 必触发、默认 1100 宽模式）；(P5-2) 不用容器查询（`container-type: inline-size` 引入 `contain: layout` 会改变 `position: fixed` 全屏播放器的 containing block，破坏全屏），viewport 断点更安全；(P5-3) 侧栏收起 = `WatchSidebarTabs` 加 `open` 状态 + toggle 条（窄屏内容默认隐藏、点开展开，不常驻占宽）；(P5-4) 首页降列由 `repeat(auto-fill, minmax(196px,1fr))` 自适应（650px 容器~3 列）、控制栏不换行由 P3 底行 `overflow-x:auto` 满足，无需改；(P5-5) T24 手测是人工步骤，CLI 无法跑 Tauri 窗口，自动验证（build/pack）+ 记录待手测项。
- P5 completed scope: `WatchSidebarTabs` 加可展开面板（`open` 状态 + `bili-watch-side-toggle` 条"分P · 相关推荐 / 展开·收起"，内容包在 `bili-watch-side-content`，窄屏默认隐藏、`.bili-watch-side-open` 展开）；styles.ts 断点 640→820、新增 `.bili-watch-side-toggle`/`.bili-watch-side-content` 基础样式与窄屏收起规则。
- P5 scope guard: 未改宿主 SDK、Rust 后端、播放核心；未用容器查询（避免 `contain: layout` 破坏全屏）；断点改为 820 覆盖窗口 minWidth 720。
- P5 verification: `cd scripts/official-plugins/bilibili && npm run build` passed；`cd scripts/official-plugins/bilibili && npm run pack` passed and wrote back `plugins/com.easygamehub.bilibili` plus `resources/defaults/plugins/com.easygamehub.bilibili`；`npx tsc --noEmit` 对 T21 改动文件无新增非 JSX 错误；`npm run build`（主应用）passed（仅既有 Vite dynamic import/chunk size warnings），plugin-sdk.js 构建通过（SDK 未破坏）；bundle 仅 `from "sdk"` 导入、0 处 `@tauri-apps`；bundle 含 `bili-watch-side-toggle`/`-content`/`-open`，820px 断点在。
- P5 pending hand-test（T24 清单，需 `npm run tauri dev` 人工执行）：1) 首页默认推荐、推荐/热门/搜索三 Tab 各自独立不互相覆盖；2) 刷新只刷当前模式；3) 搜索提交进搜索 Tab、空词不进入搜索空态；4) 首页热门精选行 + 主网格；5) 播放页评论区全宽不在侧栏；6) 右侧内容栏只有分P + 相关推荐，相关推荐有数据；7) 清晰度/弹幕在控制栏 popover；8) 控制栏两行图标化；9) 投币/收藏/更多/弹幕设置弹层统一菜单样式、点外/Esc 关闭；10) 我的页账号卡显示真实统计；11) 缩到最小窗口（720px）侧栏收起为可展开面板、主链路全宽；12) DASH 高清/兼容播放/清晰度切换/弹幕/评论/互动/进度/截图/收藏/稍后再看不回退。另含历史遗留：二维码登录、真实播放、评论/弹幕/投币/进度写回/收藏写操作等真实账号手测。

## Current Workflow Request
- Topic: Bilibili 播放页互动增强（参考 wiliwili/Web 端交互，优先普通视频客户端增强）
- Stage 1 Requirement Exploration: Completed at 2026-08-11（经 grill-me 逐项确认）
- Design doc: docs/superpowers/specs/2026-08-11-bilibili-interactions-design.md
- 用户已确认的关键范围：先做普通视频客户端增强，不做番剧/直播；第一批做点赞/取消点赞、投币、收藏、稍后再看、分享/复制链接、举报外部打开、更多低频操作、关注/取消关注 UP；互动条放播放页主区播放器下方，显示和操作合一；关注 UP 放 UP 信息行；互动状态播放页初始加载；B 站协议优先补进 `bpi-rs`；点赞/收藏/稍后再看/关注可乐观更新失败回滚，投币不乐观更新；当前播放页即时更新，相关缓存失效，不做全局复杂同步；本轮不做 UP 主空间页。
- Stage 2 Implementation Planning: Completed at 2026-08-11
- Plan doc: docs/superpowers/plans/2026-08-11-bilibili-interactions-plan.md
- Stage 3 Plan Execution: Completed at 2026-08-11（自动验证通过，Tauri 手测待补）
- Completed scope: P0 review 确认 `bpi-rs` 已有点赞、投币、投币状态、收藏、稍后再看、关注/取关和 UP 卡片能力，本轮未重复改协议层；新增 EasyGameHub `BiliVideoInteractionState` / stats / owner DTO、`core::bilibili::interaction` 聚合服务和 interaction commands；宿主 SDK、官方插件声明和插件模板声明新增 `sdk.bilibili.interaction.*`；播放页新增播放器下方网页式互动条、投币确认面板、收藏夹面板、UP 信息/关注行；右侧 `更多` Tab 移除收藏/稍后再看主互动，只保留外部打开、复制链接、截图目录；点赞、稍后再看、关注做乐观更新失败回滚，投币不乐观更新；收藏/稍后再看/视频详情相关缓存写操作后失效；官方插件 bundle 已写回内置插件目录。
- Scope guard: 未修改播放代理、MPD、DASH/MP4 fallback、清晰度切换、弹幕、评论和进度同步；未实现番剧、直播、动态、UP 主空间页、笔记、三连或复杂举报表单。当前普通视频“是否已点赞”的可靠读取接口尚未补充，初始状态保守为未点赞，用户点击后按本轮操作状态展示。
- Verification: `cargo fmt`；`cargo check` passed（仅既有 warnings）；`cargo test bilibili` passed（34 passed，1 ignored legacy live API test）；`cargo test --manifest-path bpi-rs/Cargo.toml video` passed（122 passed，44 ignored）；`cargo test --manifest-path bpi-rs/Cargo.toml user` passed（100 passed，30 ignored）；`cd scripts/official-plugins/bilibili && npm run build` passed；`npm run build` passed（仅既有 Vite dynamic import/chunk size warnings）；`cd scripts/official-plugins/bilibili && npm run pack` passed and wrote back `plugins/com.easygamehub.bilibili` plus `resources/defaults/plugins/com.easygamehub.bilibili`。
- Pending hand-test: `npm run tauri dev` 后检查播放页互动条显示、登录态点赞/投币/收藏/稍后再看/关注、分享复制、举报外跳、右侧更多低频操作，以及 DASH 高清/兼容播放/清晰度切换/弹幕/评论不回退。

## Current Workflow Request
- Topic: Bilibili 插件 UI 布局优化（从功能面板堆叠调整为视频客户端布局）
- Stage 1 Requirement Exploration: Completed at 2026-08-11（经 grill-me 逐项确认）
- Design doc: docs/superpowers/specs/2026-08-11-bilibili-ui-redesign.md
- 用户已确认的关键 UI 决策：插件定位为内容消费客户端；首页第一屏只服务找视频/看视频；首页使用 `推荐` / `热门` Tab；账号内容进入独立 `我的` 视图；播放页使用播放器主区 + 右侧单任务 Tabs；评论默认进入播放页 `评论` Tab；播放器内只保留高频控制；低频控制进入右侧 Tabs；小屏下 Tabs 移到播放器下方；视觉融合 Bilibili/wiliwili 客户端布局与 EasyGameHub 玻璃主题。
- Stage 2 Implementation Planning: Completed at 2026-08-11
- Plan doc: docs/superpowers/plans/2026-08-11-bilibili-ui-redesign-plan.md
- Stage 3 Plan Execution: UI implementation completed at 2026-08-11（自动验证通过，Tauri 手测待补）
- Completed scope: 新增 `BiliAppShell` / `BiliTopNav` / `HomeFeed` / `HomeFeedTabs` / `WatchSidebarTabs` / `MinePage`；首页移除常驻登录和账号库侧栏，改为视频 feed 优先；新增独立 `mine` 页面集中登录、历史、稍后再看和收藏夹；播放页保留播放内核，右侧改为 `分P` / `清晰度` / `弹幕` / `评论` / `更多` 单任务 Tabs；评论从播放器下方移入 `评论` Tab；低频外部打开、截图目录、稍后再看和收藏操作移入 `更多` Tab；补齐顶栏、首页 feed、我的页、播放页 Tabs 和小屏播放器下方 Tabs 样式。
- Scope guard: 未修改 Rust 后端、Bilibili SDK 方法、播放代理、MPD、DASH/MP4 fallback、进度 reporter、弹幕读取/发送、评论 API、收藏/稍后再看 API。
- Verification: `cd scripts/official-plugins/bilibili && npm run build` passed；`cd scripts/official-plugins/bilibili && npm run pack` passed and wrote back `plugins/com.easygamehub.bilibili` plus `resources/defaults/plugins/com.easygamehub.bilibili`；`npm run build` passed（仅既有 Vite dynamic import/chunk size warnings）。
- Component-library follow-up: 用户确认组件可以使用组件库后，已改为从插件 SDK 使用宿主导出的 `Button` / `TextField` / `Toggle` / `Slider` / `Select`，覆盖首页搜索与按钮、顶栏/Tab、登录面板、弹幕输入、播放页弹幕设置、更多操作和插件设置区；播放器控制条仍保留专用控件以维持视频控制密度和行为稳定。验证：`cd scripts/official-plugins/bilibili && npm run build` passed；`npm run pack` wrote back built-in plugin；`npm run build` passed（仅既有 Vite warnings）。
- Pending hand-test: `npm run tauri dev` 后检查首页推荐/热门/搜索、我的页登录和账号内容、播放页 DASH 高清/兼容模式/清晰度切换/分P/弹幕/评论/更多操作、小屏 Tabs。

## Current Workflow Request
- Topic: Bilibili 内置视频插件（参考 wiliwili 产品能力，接入 bpi-rs，内置 DASH 播放）
- Stage 1 Requirement Exploration: Design draft completed at 2026-08-10
- Design doc: docs/superpowers/specs/2026-08-10-bilibili-plugin-design.md
- 用户已确认的关键范围：内置插件；直接打通 SDK 和专用代理；首页/播放页分离；普通投稿视频优先；二维码登录；DASH 内置播放；默认 ABR；播放中无缝清晰度切换；写回并读取 B 站观看进度；历史/稍后再看/收藏夹；评论读写；普通文本弹幕发送；快捷键、倍速、截图、外部打开、轻量缓存。
- Stage 2 Implementation Planning: Completed at 2026-08-10
- Plan doc: docs/superpowers/plans/2026-08-10-bilibili-plugin-plan.md
- Stage 3 Plan Execution: P0 completed at 2026-08-10
- P0 completed scope: `bpi-rs` path dependency; Bilibili Rust core/command skeleton; `bilibili_ping` command registration; plugin `bilibili` permission allowlist and SDK empty namespace; official `com.easygamehub.bilibili` plugin skeleton; build/pack sync to `plugins/` and `resources/defaults/plugins/`.
- P0 review notes: `bpi-rs` features match the plan and local `rustc 1.97.1` satisfies `rust-version = "1.85"`; `video` icon is not present in `src/lib/icons.ts`, so the P0 skeleton uses existing `playFilled` icon until a formal icon mapping is added.
- P0 verification: `cargo fmt`; `cargo check`; `cargo test plugins`（18 passed）；`cargo test bilibili`（1 passed, 1 ignored legacy live API test）；`npm run build`; `cd scripts/official-plugins/bilibili && npm install && npm run build && npm run pack`; bundle imports only from `"sdk"`.
- Stage 3 Plan Execution: P1 completed at 2026-08-10
- P1 review notes: 严格限制在账号登录与 Cookie 存储；未提前实现 P2 首页数据、P3 播放代理、DASH 播放、评论、弹幕、历史、稍后再看或收藏夹；账号 store 使用 `AppState.tool_dir` 下的 `bilibili_account.enc.json`，Cookie 只在 Rust 侧经 `SecureStore` 加密保存，不返回前端。
- P1 completed scope: `core::bilibili::account` 实现二维码 key/check、Cookie 规范化保存/读取/清理和单测；`core::bilibili::client` 实现匿名/登录态 client 构建与 `login_status`；Tauri 注册 `bilibili_login_qr_key` / `bilibili_login_qr_check` / `bilibili_login_status` / `bilibili_logout`；`sdk.bilibili.account` 暴露登录方法并强制 `bilibili` 权限；官方 Bilibili 插件首页新增登录面板和 runtime 轮询状态，播放页保持 P1 骨架。
- P1 verification: `cargo fmt`（随后收回非 P1 rustfmt 差异）；`cargo test bilibili`（4 passed，1 ignored legacy live API test）；`cargo check`; `npm run build`; `cd scripts/official-plugins/bilibili && npm run build && npm run pack`; bundle imports only from `"sdk"`。
- P1 hand-test fix: 用户扫码登录后报 `account requires DedeUserID, SESSDATA, bili_jct, and buvid3`；根因是二维码登录 Set-Cookie 可能不带 `buvid3`，保存前过早按完整 `Account` 校验。已改为登录成功后 Rust 侧通过 `misc.buvid` / `misc.buvid3` 补齐 `buvid3` 再加密保存，并加回归测试 `normalize_cookie_header_accepts_login_cookie_with_buvid_fallback`。验证：该测试通过、`cargo test bilibili`（5 passed，1 ignored legacy live API test）、`cargo check` 通过。
- P1 startup fix: `npm run tauri dev` 使用 `cargo run --no-default-features`，而补 `buvid3` 依赖 `bpi-rs` 的 `misc` feature；已把 `"misc"` 加入 `src-tauri/Cargo.toml` 的显式 feature 列表。验证：`cargo check --no-default-features --manifest-path src-tauri/Cargo.toml` 通过；清理残留 Vite 进程占用 1420 后，`npm run tauri dev` 成功编译并运行 `EasyGameHub.exe`。
- Stage 3 Plan Execution: P2 completed at 2026-08-10
- P2 review notes: 严格限制在首页主链路；只接入匿名公开视频搜索和热门列表、视频卡片、首页 Tab 占位与跳转到播放页空壳；未实现 P3 视频详情/播放代理、P4 DASH、P5 进度、P6 弹幕、P7 历史/稍后再看/收藏夹真实数据、P8 评论或 P9 缓存。
- P2 completed scope: 新增 `BiliVideoCard` 稳定 DTO；`core::bilibili::video` 提供 search result / popular item / ranking item 映射和缺字段 fallback 单测；新增 `bilibili_search_videos` / `bilibili_popular_videos` 命令并注册；`sdk.bilibili.home` 暴露 `searchVideos` / `popularVideos` 并强制 `bilibili` 权限；官方 Bilibili 插件首页实现搜索框、热门默认加载、刷新、视频卡片、外部打开 B 站、账号登录栏、历史/稍后再看/收藏夹占位 Tab、`watchUrl(video)` 跳转封装；播放页仍只显示传入 bvid/cid。
- P2 verification: `cargo test bilibili`（7 passed，1 ignored legacy live API test）；`cargo check --no-default-features --manifest-path src-tauri/Cargo.toml`; `cargo check`; `npm run build`; `cd scripts/official-plugins/bilibili && npm run build && npm run pack`; bundle imports only from `"sdk"`。
- P2 hand-test: 打开首页、查看热门、搜索关键词、点击视频进入播放页空壳路由尚未执行。
- Stage 3 Plan Execution: P3 completed at 2026-08-10
- P3 review notes: 严格限制在视频详情、分 P、续播字段、取流 session、MPD、本地代理、SDK 扩展和播放页详情空壳；未提前实现 P4 dash.js attach/播放器控制/播放中清晰度切换 UI，未实现 P5 进度写回与截图，未实现 P6 弹幕、P7 账号内容、P8 评论或 P9 缓存/结构化错误完善。
- P3 completed scope: 新增 `BiliVideoDetail` / `BiliVideoPage` / `BiliVideoStats` / `BiliOwner` / `BiliPlaybackSource` / `BiliQualityOption` DTO；`core::bilibili::video` 接入 `view`、`page_list`、`player_info_v2`（未登录/失败时详情仍返回且续播为空）和 `related_videos`；新增 `select_initial_page` 纯函数测试；新增 `core::bilibili::playback` 内存播放会话、2 小时过期、track 查询、MPD 生成和清晰度选项；新增 `core::bilibili::proxy` 专用 `127.0.0.1` 代理，提供 manifest/media/cover 路由，media 只转发已登记 session track 并转发 Range/Referer/UA/CORS；新增 `bilibili_video_detail` / `bilibili_related_videos` / `bilibili_proxy_port` / `bilibili_create_playback` commands 并注册；`sdk.bilibili.video` 和 `sdk.bilibili.playback` 已扩展；官方插件新增独立 `WatchPage`、`PlayerShell`、`QualityMenu`，展示详情、分 P、manifest URL 和清晰度列表，不 attach dash.js。
- P3 verification: `rustfmt --edition 2021`（仅 P3 Rust 文件）；`cargo test bilibili`（11 passed，1 ignored legacy live API test）；`cargo check --no-default-features --manifest-path src-tauri/Cargo.toml`; `cargo check`; `npm run build`; `cd scripts/official-plugins/bilibili && npm run build && npm run pack`; bundle 头部确认仍从 `"sdk"` external 导入，未发现 `@tauri` 直连。
- Stage 3 Plan Execution: P4 completed at 2026-08-10
- P4 review notes: 严格限制在 DASH 播放器接入、ABR/手动清晰度切换、播放器控制、倍速、音量、快捷键和网页内全屏；未实现 P5 持久进度/B 站进度写回/截图，未实现 P6 弹幕数据读取或发送，未实现 P7-P9 账号内容、评论、缓存和结构化错误扩展。T27 中“保存旧进度”按 P4 边界解释为播放页内存态，仅用于当前页面切 P 续播。
- P4 completed scope: 新增 `scripts/official-plugins/bilibili/src/player/dashPlayer.ts`，封装 dash.js 初始化、fast switch、默认 ABR、手动 representation 切换、实际清晰度读取、错误转换、倍速设置和销毁；新增 `scripts/official-plugins/bilibili/src/player/keyboard.ts`，实现 Space、方向键、M、F、D、Esc 快捷键且输入控件聚焦时禁用；`PlayerShell` 接入真实 `<video>`、dash player 生命周期、自定义控制条、播放/暂停、seek、音量、静音、倍速、网页内全屏、错误重载和外部打开入口；`QualityMenu` 改为自动/手动清晰度交互菜单且切换不重新取流；`WatchPage` 增加当前页面生命周期内的 cid 播放时间记录、切 P 前记忆时间、重载 playback source，并优先使用页内进度或 B 站详情返回的续播时间初始化播放器；`styles.ts` 补齐播放器、控制条、清晰度按钮和移动端样式。
- P4 verification: `cd scripts/official-plugins/bilibili && npm run build` 通过；`cd scripts/official-plugins/bilibili && npm run build && npm run pack` 通过并同步 `plugins/com.easygamehub.bilibili` 与 `resources/defaults/plugins/com.easygamehub.bilibili`；`cargo check` 通过（仅既有 warnings）；`npm run build` 通过（仅 Vite 既有动态导入/chunk size warnings）；bundle 检查未发现 `@tauri` 直连，且保留 `from "sdk"` external 导入。额外执行 `npx tsc --noEmit` 时因插件当前缺少全局 JSX 声明，既有组件批量报 `JSX.IntrinsicElements`，该检查不是计划验证命令且未作为 P4 阻塞项。
- P4 hand-test: 播放普通视频、暂停/seek/音量/倍速、自动/手动清晰度、切 P、网页内全屏/Esc 尚未执行。
- P4 playback fix: 用户实测报告 `DASH 播放错误 31: Must have @mediaPresentationDuration on MPD or an explicit @duration on the last period.`；根因是 Rust 侧生成的静态 MPD 未写入点播总时长。已在 `PlaybackSession` 保存 `PlayUrlResponseData.timelength`，并在 MPD 根节点写入 `mediaPresentationDuration`、在 `Period` 写入 `duration`。先添加失败断言复现，再修复。验证：`cargo test bilibili::playback::tests::mpd_uses_local_track_urls_without_remote_urls` 通过；`cargo test bilibili` 11 passed、1 ignored；`cargo check` 通过（仅既有 warnings）。
- Stage 3 Plan Execution: P5 completed at 2026-08-10
- P5 review notes: 严格限制在本地进度保存、B 站观看进度节流上报、读取本地进度续播、外部打开和当前帧截图；未实现 P6 弹幕读取/渲染/发送，未实现 P7 历史/稍后再看/收藏夹，未实现 P8 评论，未实现 P9 通用缓存清理、完整设置区和结构化错误统一收敛。`syncProgress` 只读取插件 storage 中可能存在的布尔值，默认 true，正式设置区留给 P9。
- P5 completed scope: 新增 `core::bilibili::cache`，用 `tool_dir/bilibili/progress.json` 保存 `bvid`/`aid`/`cid`/`progressSeconds`/`updatedAt`，同一视频分 P覆盖更新、不同 cid 隔离；截图保存到 `tool_dir/bilibili/screenshots`，base64 支持 data URL 前缀，文件名做白名单清理并固定 `.png`；新增并注册 `bilibili_save_local_progress` / `bilibili_load_local_progress` / `bilibili_report_progress` / `bilibili_open_video` / `bilibili_save_screenshot` / `bilibili_open_screenshot_folder`；`bilibili_report_progress` 使用 `VideoWatchProgressParams`，未登录返回 `ok=false,message=notLoggedIn`，前端不阻断播放；宿主 SDK、官方插件声明和插件模板声明同步 P5 Bilibili API；官方插件新增 `progressReporter.ts`、`frameCapture.ts`、`ScreenshotButton.tsx`，播放页加载详情后按“请求 cid > B 站进度 > 本地进度 > 第一 P”选页，播放器每 5 秒保存本地进度、每 20 秒尝试写回 B 站，pause/ended/切 P/unmount 补一次，seek 后 3 秒内跳过普通周期写回；播放失败和侧栏外部打开改走 SDK command，播放器控制条新增截图按钮，侧栏新增截图目录入口。
- P5 verification: `cargo test bilibili` 14 passed、1 ignored legacy live API test；`cargo check` 通过（仅既有 warnings）；`npm run build` 通过（仅 Vite 既有动态导入/chunk size warnings，构建产物随后恢复不纳入源码修改）；`cd scripts/official-plugins/bilibili && npm run build` 通过；`cd scripts/official-plugins/bilibili && npm run pack` 通过并同步 `plugins/com.easygamehub.bilibili` 与 `resources/defaults/plugins/com.easygamehub.bilibili`；bundle 检查显示 P5 API 已打入官方插件产物，未发现 `@tauri` 直连。
- P5 hand-test: 播放到 30 秒后离开再进入续播、登录后 B 站历史进度写回、截图保存并打开截图目录、外部打开视频尚未执行。
- Stage 3 Plan Execution: P6 completed at 2026-08-10
- P6 review notes: 严格限制在弹幕读取、普通滚动弹幕 overlay、播放器内弹幕设置和普通文本弹幕发送；未实现 P7 历史/稍后再看/收藏夹，未实现 P8 评论，未实现 P9 轻量缓存清理、完整设置区和结构化错误统一收敛。后端读取采用 `bpi-rs` XML 弹幕能力，因当前仓库未生成 protobuf dm 模型，避免在 EasyGameHub 内手写不稳定协议解析。
- P6 completed scope: 新增 `BiliDanmakuItem` DTO；新增 `core::bilibili::danmaku`，实现当前分 P弹幕读取、弹幕文本最小清理、颜色格式化、普通文本弹幕发送、空/超长消息拒绝和单测；新增并注册 `bilibili_danmaku_list` / `bilibili_send_danmaku`；宿主 SDK、官方插件声明和插件模板声明同步 `sdk.bilibili.danmaku.list/send` 并强制 `bilibili` 权限；官方插件新增 `danmaku/layout.ts`、`danmaku/renderer.ts`、`DanmakuOverlay.tsx`、`DanmakuInput.tsx`，播放页按分 P拉取弹幕，overlay 根据 `video.currentTime` 推进并在 seek 后重置游标，轨道布局限制同屏数量；播放器侧栏提供弹幕开关、字号、透明度、密度、速度；播放器下方输入条支持未登录禁用、回车发送、100 字限制、成功本地插入、失败保留输入和 4 秒冷却，弹幕隐藏时仍可发送并提示。
- P6 verification: `cd scripts/official-plugins/bilibili && npm run test:danmaku` 通过（同时间不同轨道、超过同屏上限丢弃）；`cd scripts/official-plugins/bilibili && npm run build` 通过；`cargo test bilibili` 17 passed、1 ignored legacy live API test；`cargo check` 通过（仅既有 warnings）；`npm run build` 通过（仅 Vite 既有动态导入/chunk size warnings，构建产物随后恢复不纳入源码修改）；`cd scripts/official-plugins/bilibili && npm run pack` 通过并同步 `plugins/com.easygamehub.bilibili` 与 `resources/defaults/plugins/com.easygamehub.bilibili`；bundle 检查未发现官方插件直连 `@tauri`。
- P6 hand-test: 播放页加载弹幕、开关弹幕、调字号/透明度/密度/速度、seek 后同步、登录后发送普通弹幕尚未执行。
- Stage 3 Plan Execution: P7 completed at 2026-08-10
- P7 review notes: 严格限制在账号内容读取和当前视频的小范围账号操作；未实现 P8 评论区，也未实现 P9 缓存清理、完整设置区或结构化错误统一收敛。收藏夹只开放列表、资源读取和当前视频收藏/取消收藏；未暴露清空历史、清空稍后再看、批量删除、移动资源、删除收藏夹等高风险能力。
- P7 completed scope: 新增 `BiliHistoryItem` / `BiliToViewItem` / `BiliFavoriteFolder` / `BiliFavoriteItem` DTO；新增 `core::bilibili::library`，通过 `bpi-rs` 读取稿件历史、稍后再看、用户创建/收藏的收藏夹和收藏夹视频资源，并实现稍后再看添加/移除与当前视频收藏/取消收藏；新增并注册 `bilibili_history_list` / `bilibili_toview_list` / `bilibili_toview_add` / `bilibili_toview_remove` / `bilibili_favorite_folders` / `bilibili_favorite_items` / `bilibili_favorite_video`；宿主 SDK、官方插件声明和插件模板声明同步 `sdk.bilibili.library.*`；首页账号 Tab 接入历史、稍后再看、收藏夹左侧 folder list + 右侧资源列表，复用 `VideoCard` 并显示观看进度；播放页侧栏新增稍后再看添加/移除、收藏夹选择器、目标收藏夹收藏/取消收藏和失败回滚提示。
- P7 verification: `cargo check` 通过（仅既有 warnings）；`cargo test bilibili` 18 passed、1 ignored legacy live API test；`npm run build` 通过（仅 Vite 既有动态导入/chunk size warnings，构建产物随后恢复不纳入源码修改）；`cd scripts/official-plugins/bilibili && npm run build` 通过；`cd scripts/official-plugins/bilibili && npm run pack` 通过并同步 `plugins/com.easygamehub.bilibili` 与 `resources/defaults/plugins/com.easygamehub.bilibili`；bundle 检查未发现官方插件直连 `@tauri`。
- P7 hand-test: 登录后打开历史、稍后再看、收藏夹，从账号内容进入播放页，添加/移除稍后再看，收藏/取消收藏当前视频尚未执行。
- Stage 3 Plan Execution: P8 completed at 2026-08-10
- P8 review notes: 严格限制在评论区；未实现 P9 轻量缓存清理、完整设置区、结构化错误统一收敛或分发验收扩展。评论读取可匿名携带可选登录态，评论写操作统一要求登录 Cookie/CSRF；删除、举报、置顶等敏感操作只由 UI 二次确认后触发。
- P8 completed scope: 新增 `BiliComment` / `BiliCommentMember` / `BiliCommentContent` / `BiliCommentPage` / `BiliReportReason` DTO；新增 `core::bilibili::comment`，接入 `bpi-rs` 评论列表、楼中楼回复、发布、点赞/点踩、删除、置顶和举报，`type` 固定为视频 `1`，空评论/空举报补充内容后端拒绝；新增并注册 `bilibili_comment_list` / `bilibili_comment_replies` / `bilibili_comment_add` / `bilibili_comment_like` / `bilibili_comment_dislike` / `bilibili_comment_delete` / `bilibili_comment_top` / `bilibili_comment_report`；宿主 SDK、官方插件声明和插件模板声明同步 `sdk.bilibili.comment.*`；官方插件新增 `CommentPanel` 并挂到播放页下方，支持热门/最新/最多赞切换、分页、楼中楼展开、主评论与回复、点赞/点踩乐观更新失败回滚、删除确认、举报原因选择与确认、置顶权限按钮和失败保留输入。
- P8 verification: `cargo fmt` 通过；`cargo check` 通过（仅既有 warnings）；`cargo test bilibili` 21 passed、1 ignored legacy live API test；`npm run build` 通过（仅 Vite 既有动态导入/chunk size warnings）；`cd scripts/official-plugins/bilibili && npm run build` 通过；`cd scripts/official-plugins/bilibili && npm run pack` 通过并同步 `plugins/com.easygamehub.bilibili` 与 `resources/defaults/plugins/com.easygamehub.bilibili`；bundle 检查未发现官方插件直连 `@tauri`。
- P8 hand-test: 播放页读取评论、展开楼中楼、发布评论/回复、点赞/点踩、删除自己的评论、举报取消与确认、UP 主置顶/取消置顶尚未执行，需登录真实账号后手测。
- Stage 3 Plan Execution: P9 completed at 2026-08-10
- P9 review notes: 严格限制在缓存、结构化错误、设置区、内置分发同步和文档收尾；未新增视频下载、离线缓存、番剧/直播播放、权限绕过或额外高风险账号整理能力。播放 URL 仍只存在 Rust 内存 playback session；Cookie/CSRF 仍只在 Rust 侧使用，不进入插件 storage、轻量缓存或日志。
- P9 completed scope: `core::bilibili::cache` 增加轻量 JSON 缓存、封面磁盘缓存、过期判断、封面总量裁剪、namespace 清理和 `clear_cache`；搜索/热门、视频详情、历史、稍后再看、收藏夹、评论列表/回复接入 TTL 缓存，账号相关缓存 key 均带当前 B 站 mid 以避免切换账号串读，评论/收藏/稍后再看写操作后清理相关缓存；`proxy.rs` 的 `/bilibili/cover/:cache_key` 接入封面缓存并限制 B 站图片 host；新增并注册 `bilibili_clear_cache`；commands 统一将 `BiliErrorDto` 序列化为稳定错误字符串，SDK 统一解析为 `BiliSdkError`，官方插件 runtime 按错误 kind 显示登录/VIP/风控/网络/代理/API 等提示；官方插件注册 Bilibili settings section，设置同步进度、默认弹幕开关/字号/透明度/密度/速度、默认倍速、默认自动清晰度，并提供清理缓存和打开截图目录；`VideoCard` 使用本地封面代理 URL；`pack.mjs` 已确认同步 manifest、bundle、assets，`core/plugins.rs` 已确认内置更新保留 `config.json` 和 disabled 状态；`docs/plugin-development.md` 补充 `bilibili` 权限说明。
- P9 verification: `cargo fmt` 通过；`cargo test bilibili` 27 passed、1 ignored legacy live API test；`cargo test plugins` 18 passed；`cargo check` 通过（仅既有 warnings）；`npm run build` 通过（仅 Vite 既有动态导入/chunk size warnings）；`cd scripts/official-plugins/bilibili && npm run build` 通过；`cd scripts/official-plugins/bilibili && npm run pack` 通过并同步 `plugins/com.easygamehub.bilibili` 与 `resources/defaults/plugins/com.easygamehub.bilibili`；bundle 检查未发现官方插件直连 `@tauri`。
- P9 hand-test: T58 的 17 项 Tauri 桌面端到端真实账号手测尚未执行；需要人工在 `npm run tauri dev` 中完成二维码登录、真实播放、评论/弹幕/收藏/进度写回/截图/禁用重载清理等验收。
- Active stage: Stage 3 P9 自动化实现与验证完成，Tauri 真实账号手测待人工执行。

## Current Workflow Request
- Topic: Monica Steam 参考功能增强（A 移动确认 / B Guard 强化 / C 库统计 / D 商城详情+多区价格 / E 好友·聊天·通知）
- Stage 1 Requirement Exploration: Completed at 2026-08-08（范围经用户确认：E 做完整含群聊/语音/贴纸图片；D 商店详情+多区价格；文档组织为一份总设计+一份总计划）
- Design doc: docs/superpowers/specs/2026-08-08-monica-steam-features-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-08
- Plan doc: docs/superpowers/plans/2026-08-08-monica-steam-features-plan.md
- Active stage: Stage 3 P5 完成（CM 版社交，待用户手测确认后进入 P6）
- 阶段划分：P0 基础（AuthEntry 扩展 identity_secret/steam_id）→ P1 A → P2 B → P3 C → P4 D → P5 E1 → P6 E2 → P7 E3 → P8 E4 → P9 E5 语音 spike（go/no-go）
- 关键约束：Monica-Steam 为 GPL-3.0 Android 项目，仅参考协议不复制代码；A/E 依赖 Steam 非公开接口有失效/风控风险；E5 语音预计砍

### Stage 3 P0 完成情况（2026-08-08，审查先行）
- **审查发现并修正设计错误**：设计 §3.1 的 `ck` 来源有误——确认/拒绝的 `ck` 参数取 getlist 响应里该条确认的 `key` 字段（不重新派生），主密钥 `k` 始终用 tag `conf`。已修订设计文档。
- 审查确认可行项：`ring::hmac`（SHA1）无需新依赖；`SteamSession{steam_id, access_token, refresh_token}` 供 P1 命令层读活动会话；AuthEntry 老 JSON 反序列化安全（Option→None / serde skip Vec→空）。
- T1 `AuthEntry` 扩展完成：新增 `identity_secret_encrypted`（`#[serde(skip)]`，SecureStore `identity_secret_<id>` 存储）、`steam_id`、`revocation_code`；load/save/remove_entry 同步维护；`import_mafile` 解析 identity_secret/steam_id/revocation_code（缺 identity_secret 仍可导入）；`commands/authenticator.rs` AuthEntryDto 增 steam_id/device_id/serial_number、add_auth_entry 字面量补字段。3 个新测试（完整 maFile、缺 identity_secret、老 JSON 兼容）。
- T2 `steam-sdk/src/crypto/mobile_conf.rs`：`generate_confirmation_key`（HMAC-SHA1 over tag\0+time_le8 → base64+hex）+ getlist/action URL 构造。KAT 向量由独立 Python 参考实现交叉验证（2 个密钥向量 + 2 个 URL 结构 + percent_encode）。
- T3 `steam-sdk/src/client/mobile_conf.rs`：`get_pending` / `respond`（ureq + sessionid cookie + access_token 查询参数；403 → 会话失效 Auth 错误；success=false → ApiError）。
- P0 验证：`cargo test authenticator` 5 passed、`cargo test mobile_conf` 5 passed、steam-sdk 全量 `cargo test --lib` 64 passed、工作区 `cargo check`（src-tauri + steam-sdk）通过。

### Stage 3 P1 + P2 完成情况（2026-08-08，用户指示 P1+P2 一起做）
- **审查发现并修正第二处设计偏差**：`PendingConfirmation` DTO 里的 `risk`/`time`（风险/剩余时间）字段 mobileconf 协议不返回——已改为协议实际数据（id/key/kind/description），风险色由 kind 前端派生、不做倒计时。设计 §3.4、计划 T6 已同步修订。
- **P1 A 移动确认**：
  - T4 `commands/steam_guard.rs`（新）：`get_pending_confirmations` / `respond_confirmation`，经活动会话↔AuthEntry（steam_id 匹配）解析 mobileconf 上下文；`steam_auth::session_store_path` / `refresh_session_if_needed` 改 pub(crate)；`authenticator::store_path` 改 pub(crate)；lib.rs 注册 3 命令。`session_id` 由 `device_id` SHA-256 派生（`crypto/mobile_conf::session_id_from_device_id`，避免 ring 依赖进 src-tauri）。
  - T5 `src/lib/steamGuard.ts`（新）封装 3 命令 + `PendingConfirmation` 类型入 steamCommunity.ts。
  - T6 Authenticator.tsx 新增「待确认」Tab（TabButtons 切换，轮询 15s，类型徽标 + 描述 + 确认/拒绝，未绑定/未登录错误态 + 重试）。
  - T7 zh/en i18n 键（tabTokens/tabConfirm/confirm*/kind* 等）。
- **P2 B Guard 强化**：
  - T9 `export_mafile` 命令（Steam 条目重组 maFile JSON）+ Authenticator Steam 条目「导出 maFile」图标按钮（save 对话框 + write_theme_file 落盘）。
  - T10 ProfilePanel 概览显示当前账号 5 位 Steam Guard 码 + 倒计时条 + 点击复制（get_auth_entries 1s 轮询，steam_id 匹配）。
  - T11 Authenticator Steam 条目状态徽标（已绑定会话/序列号/缺 identity_secret），后端 AuthEntryDto 增 `has_identity_secret`。
- P1+P2 验证：`cargo check`（工作区）通过、`cargo test mobile_conf` 5 passed、`npm run build`（tsc+vite+sdk）通过。
- 待用户手测（T8）：真实账号登录 → 导入 maFile → 待确认列表/确认/拒绝；概览验证码；maFile 导出。

### Stage 3 P3 完成情况（2026-08-08，C 游戏库统计）
- **审查结论**：GetOwnedGames 需 API key + cached steam_id（`get_steam_inventory` 同步命令）；`get_steam_prices` 用 `get_app_details`（无需 key/会话，CNY）可复用于价值计算；本地库 `local_inventory::get_local_games`（无 key）作为无 key 回退。Playtime 页已有 stat 卡 + bar/pie/list，T14 为增量。
- **T12** `get_library_stats`（async 命令）：web 优先（GetOwnedGames）/本地回退（local_inventory），source 标注；owned/total/avg；价值 = 前 100 游戏 store 现价求和（CNY，`get_app_details` cc=cn）；`distribution` 9 档小时分桶；`top_games` 前 48（热力图网格数据）。
- **T13** `get_library_completion(limit?)`（async 命令）：web 优先（`get_achievements_with_info`，需 key，串行 + 80ms 节流，限 50）；无 key/无数据回退本机 Steam（`get_achievements_local_first` 进程内，Windows）；均无 → source "none"。**按用户此前指正**：无全球百分比回退。
- **T14** Playtime.tsx：新增「总价值」stat 卡（¥N，仅当有价格数据）；chartMode 增「热力图」（GitHub 风格网格，色块按小时分档，悬停显游戏名+时长，数据优先 stats.topGames 回退本地）；新增「成就完成度」区块（进度条 + 已解锁/总数 + 百分比，无 key 引导文案）。i18n 键（totalValue/heatmap/completion* 等）。
- P3 验证：`cargo check`（工作区）通过、`npm run build`（tsc+vite+sdk）通过。
- 待用户手测：Playtime 页统计卡/热力图/完成度（有/无 API key 两种情形）。

### Stage 3 P4 完成情况（2026-08-08，D 商城详情 + 多区价格）
- **审查发现并修正**：多区价格列表里香港区 Steam cc 码应为 `hk`（`hkd` 是货币码）——已修正；多区价格需一个按 cc 的轻量价格函数（`get_app_price_in_region`）；FX 表需区分「分/整单位」货币（JPY/KRW 为整单位）。
- **T15** `store.rs`：`AppDetail` 扩展 screenshots/pc_requirements/supported_languages/metacritic/recommendations_total/dlc/detailed_description/about_the_game/website；`detail_from_data` 统一构造；新增 `get_app_details_full`（单游戏 + 指定 cc）与 `get_app_price_in_region`（多区用）。store 测试 10 passed（fixture 覆盖新字段）。
- **T16** `crypto/fx.rs`（新）：18 币种静态汇率表（`per_cny` + `base_is_cents`）+ `to_cny`/`currency_info`。fx 测试 4 passed（含 JPY/KRW 整单位换算、未知币种 None）。
- **T17** `steam_community.rs`：`get_store_detail`（全字段 + DLC 详情限 8，cn 参考价）与 `get_multi_region_price`（8 区并发，`std::thread::scope`，CNY 换算，风控区跳过）；lib.rs 注册。
- **T18** `StoreDetailDialog.tsx`（新，`size="lg"`）：头图/类型与发行元信息/简介/多区价格对比表（区徽+现价+折后+折扣+≈CNY）/截图（缩略图+大图切换）/DLC 列表/配置要求/支持语言/商店打开按钮。接入 GameSearchBox（结果行加 info 按钮）与 WishlistPanel（卡片加 info 按钮）。DTO + i18n 键（store*）。
- P4 验证：`cargo check`（工作区）通过、steam-sdk `cargo test --lib` 68 passed、`npm run build` 通过。
- 待用户手测：愿望单/搜索点 info → 商店详情弹窗（截图/多区价格/DLC/配置）。

### Stage 3 P5 完成情况（2026-08-08，E1 好友 + 私聊）
- **审查结论**（走 Steam 网页聊天非公开协议 `ISteamWebUserPresenceOAuth`，access_token 认证，无 key 依赖）：
  - 计划 T19 的 `get_player_summaries(api_key)` 改为 **OAuth 变体**（`ISteamWebUserPresenceOAuth/GetPlayerSummaries/v1`，用 access_token，无需 API key）——与 Steam 网页聊天实际一致。
  - **计划缺口补上**：聊天无历史加载（仅 PollStatus 增量）→ 补 `GetChatMessageLog`（`get_chat_history`），否则打开会话为空。
  - PollStatus 长轮询游标（umqid/message）按 steam_id 内存持久化，保证增量。
- **T19** `steam-sdk/src/client/social.rs`（新）：`get_friends` / `get_player_summaries`（OAuth，100 分块）/ `poll_status`（长轮询）/ `send_message` / `get_chat_message_log`；5 个解析/编码测试通过。
- **T20** `commands/steam_social.rs`（新）：`get_friends`（好友+presence 合并）/ `get_friend_profile` / `poll_chat`（游标持久化）/ `send_chat_message` / `get_chat_history`；lib.rs 注册 5 命令；`POLL_CURSORS` 用 OnceLock（HashMap 非 const 修复）。
- **T21** `src/lib/steamSocial.ts`（新）：FriendDto/ChatMessageDto + 5 个命令封装。
- **T22** `SocialPanel.tsx`（新）：双栏（好友列表含头像/在线状态点/游戏中 + 聊天面板）；选好友加载历史（50 条）；**递归长轮询**（10s，保持游标活跃，只接收当前会话消息，时间戳去重）；发送即时乐观追加 + Enter 快捷发送；未登录引导。接入 SteamHub 新增「社交」Tab。
- **T23** i18n 键（tabSocial/social*）。
- P5 验证：`cargo check`（工作区）通过、steam-sdk `cargo test --lib` 73 passed、`npm run build` 通过。
- 待用户手测：Steam 登录 → 社交 Tab → 好友列表（在线状态）→ 打开会话加载历史 → 收发一条消息。

### Stage 3 P5 修订完成情况（2026-08-08，社交改走 CM 协议）
- **实测推翻 P5 原方案**：网页聊天 REST（`ISteamWebUserPresenceOAuth/*`）全部 404 已废弃；用户指出 Monica Steam 聊天正常——原因是它实现 **CM（Connection Manager）protobuf 持久连接**。经确认：SDK 已编译全部 111 个 proto（CMsgClientLogon/FriendMsg/FriendsList/PersonaState 等全在），仅缺 websocket 与连接生命周期。用户决策：**全部走 CM**。
- **协议还原（参考 Monica 源码，非复制代码）**：
  - bootstrap：`/chat/clientjstoken`（cookie steamLoginSecure=<id>||<token>）拿 webLogonToken；`ISteamDirectory/GetCMListForConnect`（免 key）拿 ws 端点（websockets+steamglobal，仅 443）。
  - 帧格式：`[u32 eMsg|0x80000000][u32 headerLen][CMsgProtoBufHeader][body]`；CMsgMulti(1) 解包（gzip）。
  - 登录：EMSG 5514（CMsgClientLogon：protocol 65580 / client_os 4294966596 / ui 4 / chat 2 / 80 "anonymous" / 103 webLogonToken），等 751 响应设 session_id。
  - 好友：767 CMsgClientFriendsList；在线状态：704 CMsgClientPersonaState（头像 CDN URL 由 avatar_hash 拼）。
  - 发消息：服务方法 EMSG 151 + target_job_name "FriendMessages.SendMessage#1" + jobId 关联（body：1 partner/fixed64、2 type/1、3 文本（转义 [）、4 contains_bbcode/true），响应 147。
  - 收消息：EMSG 146/152 + "FriendMessagesClient.IncomingMessage"（body：1 partner、2 type、4 文本、5 ts/fixed32、6 ordinal、7 echo）。
  - 历史：Web API 服务方法 `IFriendMessagesService/GetRecentMessages/v1`（input_protobuf_encoded，sender 为 accountid 需 +0x110000100000000 转 steamid64）。
  - 心跳：703 CMsgClientHeartBeat（45s）。
- **新增 steam-sdk 依赖**：tokio / tokio-tungstenite(native-tls) / futures-util / flate2。
- **新模块 `steam-sdk/src/cm/`**：`proto_wire`（最小 protobuf 读写）、`frame`（信封编解码+CMsgMulti）、`bootstrap`（token+端点）、`client`（CmClient：登录握手、后台任务、好友/persona/消息共享态、服务方法发送+jobId 关联、心跳、is_alive）。
- **重写 `client/social.rs`**：移除废弃 OAuth REST；保留 Web API 历史（GetRecentMessages + accountid 转换）。
- **重写 `commands/steam_social.rs`**：进程级 `ACTIVE_CM`（OnceLock<Mutex<Option<(steam_id, CmClient)>>>），`ensure_cm` 复用/重连；get_friends/poll_chat/send_chat_message/get_chat_history 全部走 CM（历史除外）；poll_chat 改为即时取缓冲消息（回显剔除，UI 乐观追加覆盖）。
- **前端**：SocialPanel 递归长轮询改 `setInterval`(3s)；steamSocial.ts pollChat 参数可选。
- 验证：steam-sdk `cargo test --lib` **80 passed**（cm 8 + social 4）、工作区 `cargo check`、`npm run build` 全部通过。
- 待用户手测：Steam 登录 → 社交 Tab → 好友列表（在线状态/头像）→ 打开会话加载历史 → 收发一条消息；断线后自动重连。

### P5 好友列表改为 REST（参考 Monica `SteamFriendsService`，2026-08-08）
- **实测发现**：Monica 的好友列表**不走 CM 推送的 CMsgClientFriendsList**，而是 `ISteamUserOAuth/GetFriendList/v1`（access_token，无需 key）+ `ISteamUserOAuth/GetUserSummaries/v1` 拿资料。CM 只用于实时聊天。我们的 CM 推送路径一直空（767 未到/解析偏差），故照 Monica 改为 REST。
- `client/social.rs`：新增 `FriendRelation` / `UserSummary` + `get_friend_list` / `get_user_summaries`（OAuth 端点，100 分块）；2 个解析测试。social 6 passed。
- `commands/steam_social.rs`：`get_friends` / `get_friend_profile` 改为 REST 合并（relationship=="friend" 过滤 + GetUserSummaries 资料）；`online_state` 改 i32；`poll_chat`/`send_chat_message` 仍走 CM。
- 另：`steam-sdk/Cargo.toml` ureq 加 `native-certs`（信任 Windows 系统证书库，解决代理/加速工具对 steamcommunity.com 的 TLS 中间人导致 UnknownIssuer）。
- 验证：`cargo check`（工作区）、social 6 + cm 8 + login 5 passed、前端构建通过。
- 待用户手测：好友列表（REST 数据源）、聊天（CM）。

### P5 好友链路修复完成（2026-08-08，用户实测通过）
- **关键修复**（实据驱动）：`ISteamUserOAuth/GetFriendList` 与 `GetUserSummaries` 的 **OAuth 变体返回裸顶层结构**——`{friends:[...]}` / `{players:[...]}`，无 `friendslist`/`response` 包装。两个接口改为依次接受 `friendslist.friends` / `response.friends` / 顶层 `friends`（及 players 同款），字段手写健壮解析（friend_since/relationship/personastate 数字或字符串均可），结构异常时错误带原始响应片段。
- 附加：解析不再用 serde 严格反序列化（会因字段类型不匹配静默丢好友）。
- 验证：social 8 + cm 8 + login 5 passed、steam-sdk 全量 86 passed、工作区 cargo check、前端构建通过。
- **用户实测通过**：好友列表正常显示（头像/昵称/在线状态）。
- 待验证：聊天（CM 发/收一条消息）。

### P5 聊天链路修复完成（2026-08-08，用户实测通过）
- **历史 400 根因**：`GetRecentMessages` 的 `input_protobuf_encoded` 值含 base64 `+`/`/`/`=`，直接拼进 URL 查询串时 `+` 被当成空格 → Steam 解码损坏 protobuf → 400。改为 `percent_encode` 编码该值。**请求体本身已验证正确**（字段 1/2 双方 steamid、3=count、4=start_from_most_recent、6=request_bbcode）。
- 历史解析对数字字段改用 `get_number`（proto_wire 新增，通吃 varint/fixed64/fixed32），避免固定线类型漏读。
- 诊断机制：结构异常时错误带原始响应片段/字段结构；前端不再吞历史错误（显示在聊天面板）。
- 验证：social 8 + cm 8 + login 5 passed、steam-sdk 全量 86 passed、cargo check、前端构建通过。
- **用户实测通过**：发送消息好友能收到（CM send）、刷新后历史可读回（GetRecentMessages）。
- 待确认：接收对方回复（CM IncomingMessage + 3s 轮询）。
- **用户实测确认**：接收对方回复正常（CM IncomingMessage + 轮询）。**P5（E1 好友 + 私聊）全部完成**：好友列表/在线状态（REST）、发送（CM）、接收（CM 入站）、历史（GetRecentMessages）。
- Active stage: Stage 3 P5 完成，P6（E2 群聊）待用户批准开始。

### Stage 3 P6 完成情况（2026-08-08，E2 群聊基础文字）
- **审查结论**（参考 Monica `SteamGroupChatService`/`SteamGroupChatRealtimeParser`）：
  - 群聊走 **CM 服务方法 `ChatRoom.<Method>#1`**：`GetMyChatRoomGroups` / `GetMessageHistory` / `SendChatMessage` / `AckChatMessage`；群/频道 ID 为 uint64。
  - 实时入站：`ChatRoomClient.NotifyIncomingChatMessage`（字段 1/2=group/chat id、3=sender steamid、4=body、5=ts、7=ordinal）。
  - **计划偏差**：`join_chat_group`（邀请码加入）在 Monica 无可靠请求规格 → **延后**，v1 为「列出我的群 + 文字收发」；补 `get_group_history`（打开群必需）。
- **T24**：cm::client 重构 `Cmd::SendMessage` → **通用 `Cmd::CallService`**（method + request + reply），新增 `call_service`/`take_group_messages`/`GroupIncoming`，handle_envelope 处理 `ChatRoomClient.NotifyIncomingChatMessage`；commands 新增 `get_chat_groups`/`get_group_history`/`send_group_message`/`poll_group_messages` + DTO 与 proto 解析（群列表 pair→summary→rooms、历史消息、发送）。
- **T25**：SocialPanel 新增**好友/群聊模式切换**（TabButtons）：群列表（名+最近消息）→ 选群加载默认频道历史 → 3s 轮询群消息 → 发送（乐观追加+Enter）。
- **T26**：i18n 键（socialFriends/socialGroups/socialGroupsEmpty）。
- 验证：`cargo check`（工作区）、steam-sdk 86 passed、`npm run build` 通过。
- 待用户手测：社交 Tab → 群聊 → 群列表 → 打开群看历史 → 发/收群消息。
- **用户实测通过**：群聊收发正常；另修复两处——(a) 群聊自我回显导致消息显示两遍（`poll_group_messages` 丢弃 sender=自己，前端乐观追加）；(b) `CM logon failed (eresult=5)`（LoggedInElsewhere，重启后旧连接未释放）：`CmClient::close()` + `connect` 遇 eresult=5 延迟重试一次 + `ensure_cm` 重连前关闭旧连接。**P6 完成**。
- Active stage: Stage 3 P6 完成，P7（E3 通知页）待用户批准开始。

### Stage 3 P7 完成情况（2026-08-08，E3 通知页）
- **审查结论**：
  - 聚合走 option A：实时从来源生成通知 + 只持久化 `read_ids`（`steam_notifications.json`，更安全，符合设计 §8 不存正文）。
  - 新闻范围（wishlist ∪ watchlist 的 app_ids）由前端传入（SteamHub 已有 `monitoredAppIds`）。
  - **计划偏差**：好友状态通知需持续 presence 变化追踪（后台快照+diff），成本高 → **延后**记录；T28 系统通知（tauri-plugin-notification）标记为后置可选，不阻塞 P7。
- **T27** `commands/steam_notifications.rs`（新）：`get_notifications(app_ids)` 聚合 降价事件（复用 `drop_events_path`/`load_drop_events`，改 pub(crate)）+ 关注游戏新闻（`get_news_feed`，date 转 "YYYY-MM-DD HH:MM:SS" 排序）+ 待确认（`get_pending_confirmations`，best-effort）；稳定 id（`drop:<appid>:<date>` / `news:<appid>:<ts>` / `confirmation:<id>`），未读标记 + 倒序 + 截断 100；`mark_notifications_read(ids)` 合并 read_ids；lib.rs 注册。`State` 传值需 `clone`（Tauri State 非 Copy）、`get_pending_confirmations` 为同步调用。
- **T29** `NotificationsPanel.tsx`（新）：时间线（类型徽标/标题/副标题/时间/未读高亮 + 左侧 primary 条）+ 全部已读；fetch 后写入 steamHubCache（`notifications` + `notificationsUnread`）；SteamHub 新增「通知」Tab + **未读计数徽标**（Tab 上）。
- **T30** i18n 键（tabNotifications/notifications*）。
- 验证：`cargo check`（工作区）、steam-sdk 86 passed、`npm run build` 通过。
- 待用户手测：产生一条降价/新闻/待确认 → 通知 Tab 出现 + 未读计数 → 全部已读 → 徽标消失。

### Stage 3 P8 完成情况（2026-08-09，E4 贴纸 / 图片）
- **审查结论**（参考 Monica `SteamChatCatalogService` / `SteamChatAttachmentUploader` / `SteamChatRichMediaModels`）：
  - **图片**：走 Steam 网页聊天三段式上传协议（`beginfileupload` 预约 UGC 槽 + 返回签名 cloud_url/request_headers → PUT 文件 → `commitfileupload` 提交目标会话）。**提交本身即把图片插入会话**（Monica 上传成功后只 `refreshThread()`，从不发第二条消息；commit 的 `friend_steamid`/`chat_group_id`+`chat_id` 字段即目标）。会话 cookie 用 `steamLoginSecure=<steamid>||<access_token>`（与 CM bootstrap 同款，实测可用）。
  - **贴纸**：目录走 CM `ClientGetEmoticonList`(236)→`ClientEmoticonList`(237)，解析 field 2（贴纸 name=1）；发送就是普通文本消息 `chat_entry_type=1` + body `/sticker <name>`（与 Monica 一致，Steam 端按 slash-command 渲染为贴纸）；渲染识别 `/sticker name` 与历史 BBCode `[img]url[/img]`。
  - **计划偏差**：计划写 `client/social.rs::send_sticker`，实际贴纸属 CM 通道 → 实现在 `cm/client.rs`（`send_sticker`/`get_sticker_catalog`），`social.rs` 只加 `upload_chat_image`（REST）。
- **T31** `client/social.rs::upload_chat_image`（begin→PUT→commit，multipart 手工构造 + 逐 header 应用 request_headers，过滤 Host/Cookie/Content-Length/Authorization；30MB 上限；json_success 兼容 int/bool）+ `cm/client.rs` `get_sticker_catalog`（新增 `Cmd::GetEmoticonList` + `EMSG_CLIENT_EMOTICON_LIST` 相关响应 + `parse_sticker_list` + `percent_encode_path`）+ `send_sticker`；`commands/steam_social.rs` 新增 `upload_chat_image`/`upload_group_image`（`image::ImageReader` 取尺寸）/`get_sticker_catalog`/`send_sticker_message`；lib.rs 注册。
- **T32** `steamSocial.ts` 新增 `StickerDto` + 4 个封装 + `stickerImageUrl`；`SocialPanel.tsx` 图片按钮（plugin-dialog 选图→上传→toast+`refreshTick` 重取历史）+ 贴纸按钮/选择器（懒加载网格）+ 消息渲染 `ChatMessageContent`（`/sticker`→贴纸图、`[img]`→图片、否则文本，好友与群聊共用）；i18n 键（zh/en 各 6）。
- 验证：`cargo check`（工作区）✅、steam-sdk **92 passed**（+6：sticker 解析×2、percent encode、multipart、mime/header、file name）、`npm run build` ✅。
- **实测两处协议修正（2026-08-09）**：
  - **贴纸超时（`Steam CM request timed out`）**：`ClientGetEmoticonList`/`ClientEmoticonList` 的 EMSG 实为 **9330/9331**（我最初写成旧值 236/237，Steam 不认 → 无响应）；且此类客户端消息按 Monica `SteamCmPersistentConnection` 用 **`JOB_ID_NONE` 发送、响应只按 eMsg 匹配**（Steam 不回显 job id）→ 新增 `CmData.emoticon_pending` 槽位按 eMsg 解析。
  - **图片 rejected（`beginfileupload rejected`）**：真实响应**无顶层 `success`**（以 `{"ugcid":...,"timestamp":...}` 开头），`success` 缺失即成功；且 `ugcid`/`timestamp`/`hmac` 在顶层（Monica 读 `result`）→ 改为 `has_explicit_failure`（仅显式 `success:0` 才算失败）+ 顶层/result 双处读取 + timestamp 兼容字符串数字。
  - **图片 commit 失败（`commitfailed (HTTP 500): {"success":16,...}`，即「服务器错误 commit 16」）**：对照仓库内**已工作的** WinNative `chat_image.rs` 参考实现发现差异——(a) `file_sha` 必须是**文件内容的真实 SHA1**（commit 校验它，随机值 → 16），(b) commit 表单**缺 `file_size`**，(c) 上传请求应为 **`application/x-www-form-urlencoded`**（非 multipart），(d) cookie 用 `sessionid=` 在前 + `steamLoginSecure=steamid%7C%7Ctoken`（`||` 百分号编码）。全部按参考实现修正，URL 兜底构造 `https://images.steamusercontent.com/ugc/{ugcid}/{sha_upper}/`。
- 待用户手测：社交 → 好友/群聊 → 图片按钮发图（对方可见 + 历史回读）、贴纸按钮打开选择器 → 点贴纸发送、接收端图片/贴纸渲染。
- **实测再修复**：发图后前端显示原始 BBCode → Steam 真实图片消息是富标签 `[img src=<url> thumbnail_src=<url> srcset="..." width=.. height=..][url=..]url[/url][/img]`（内层非裸 URL）→ `ChatMessageContent` 改为 `extractImgSrc`：先解富标签（优先 `thumbnail_src` 缩放缩略图），再回退普通 `[img]url[/img]`。`npm run build` ✅。
- **用户实测通过**：好友能收到图片、贴纸目录与发送正常、前端图片/贴纸渲染正常。**P8 完成**。
- **P9（E5 语音 spike）用户决定不做（2026-08-09）**——保持 no-go，不进入调研。**Monica Steam 参考功能增强（A–E）至此全部计划阶段收尾**（P0–P8 已实现并验证，P9 明确不做）。
- **全量代码 review 修复（2026-08-09）**：对照设计/计划审查 A–E 全部实现，修复 6 项——
  1. `ensure_cm` 连接失败叠加重试（N 个 3s 轮询 × 90s 退避）→ 新增 **CM 连接冷却**（失败后 30s 内快速失败，不再排队叠加）+ `connect_with_seed` 把旧连接缓冲消息**接续到新会话**（重连不丢消息，Steam 重连不重放）。
  2. `AuthEntry::uuid_v4()` 时钟纳秒熵 → 改用 `rand::thread_rng` 随机 UUID v4。
  3. `mobile_conf::request()` 字符串 `contains("403")` → 新增 `get_with_headers_ureq` 保留 ureq 状态，直接 `match Error::Status(403, _)`。
  4. `get_wishlist` 重定向到 HTML 时返回 JSON 解析错误 → 非 JSON 体统一映射 `NotFound("wishlist_private")`，前端干净回退本地关注列表。
  5. CM 重连旧缓冲丢消息 → 见 1（`connect_with_seed`）。
  6. (a) maFile 导出复用 `write_theme_file` → 新增 `save_mafile` 命令；(b) 贴纸目录首载失败不重试 → 仅成功才标记已加载；(c) Playtime 无完成度文案误导 → `completionNoApiKey` 改 `completionUnavailable` 文案更准确。
  - 验证：steam-sdk 92 passed、`cargo check` ✅、`npm run build` ✅。
- **第二轮 review 修复（2026-08-09）**：补查会话/价格核心 + 全部命令层 + 前端 hooks/组件，再修 4 项——
  1. **`upsert_session` 换账号登录不停用旧账号** → `active_session()` 返回最旧活动会话，聊天/确认/愿望单全用错账号 → 改为**登录即停用所有其他会话**（+ 回归测试 `test_second_login_deactivates_previous`）。
  2. **src-tauri `authenticator.rs` 还有一处时钟纳秒 `uuid_v4()`**（第一轮只修了 steam-sdk 版）→ 同样改用 `rand`。
  3. **`is_expired()` 时钟回拨时 `num_seconds() as u64` 回绕巨大值 → `elapsed + grace` 溢出（debug 崩溃）** → `max(0)` 防御。
  4. **`ensure_cm` 冷却检查在快路径之前** → 理论上可用连接会被 stale cooldown 误拒 → 调为**快路径优先**。
  - 验证：steam-sdk **93 passed**（+1 会话回归）、`cargo check` ✅、`npm run build` ✅。
- **第三轮 review（2026-08-09）**：补查认证核心（login/totp/secure_store）+ lib.rs 全量装配 + steam_helper 桥接 + 前端 hooks/DTO，修复 1 项、记录 2 项——
  1. **`totp_remaining_seconds` 负 time_offset（时钟偏移大）时 `time_step - elapsed` u64 下溢（debug 崩溃）** → 改用 `rem_euclid`。
  2. **记录（不改）**：`secure_store` 密钥仅由 `COMPUTERNAME`+固定常量经 PBKDF2 派生 → 属**可破解的静态混淆**而非真加密（懂主机名即可解密全部会话/maFile）。建议改用 Windows DPAPI 做密钥托管（会破坏既有存储，需迁移流程，超出 A–E 范围）。
  3. **记录（潜在）**：`formatPriceCents` 对所有货币 ÷100，JPY/KRW（整币制）会显示错——当前所有调用路径都传 CNY（cc=cn 固定），仅潜在。
  - 复核无恙：login.rs（JWT sub 提取、checkdevice 触发邮件码、RSA 随机填充）、totp RFC 向量、lib.rs 全命令注册、steam_helper 子进程桥接（helper 模式窗口前短路）、useSteamSession、steamCommunity 工具函数。
  - 验证：steam-sdk 93 passed、`cargo check` ✅、`npm run build` ✅。
- **第三轮遗留项落地（2026-08-09）**：
  1. **secure_store → Windows DPAPI 托管密钥**：新增 `master_key` 字段（DPAPI user-scope 加密的 32 字节密钥 blob，base64 存盘）。密钥材料不变，**旧存储首次打开时自动迁移**（把现有密钥 DPAPI 保护后落盘，条目无需重加密，零数据风险）；新存储立即 DPAPI 绑定。非 Windows 保留 hostname PBKDF2 回退。DPAPI 用 windows-sys `CryptProtectData/UnprotectData`（0.59 的 `CRYPT_INTEGER_BLOB`，`LocalFree` 手动 extern 声明）。**修复：懂主机名即可解密的静态混淆 → 真·用户级 at-rest 加密**。
  2. **`formatPriceCents` 整币制感知**：JPY/KRW 为整币制（1980 → ¥1980，而非 ÷100 → ¥19.80），新增 `WHOLE_UNIT_CURRENCIES` 集。
  - 验证：steam-sdk **95 passed**（+2：`store_is_keyed_per_platform`/`legacy_store_migrates_on_open`）、`cargo check` ✅、`npm run build` ✅。
- **货币换算单位不一致修复（2026-08-09）**：多区价格 `≈ ¥0.30`（应为 ¥29.80）——`fx::to_cny` 返回**元**（29.8→30），但字段名 `cny_cents`/前端 `formatPriceCents` 按**分**处理，被除了两次。修复：`to_cny` 改为返回 **CNY 分**（`×100`），与字段名和格式化器一致。验证：fx 4 passed、steam-sdk 95 passed。
- **JPY/KRW 换算 100 倍偏高修复（2026-08-09）**：多区价格 JP ≈ ¥5361.60 / KR ≈ ¥3619.20（应为 ¥53.62 / ¥36.19）——**Steam 实际把 JPY/KRW 的 `final`/`initial` 数值字段也存成 100 分之一**（¥1,117 存为 111700），只是 `final_formatted` 显示时去掉小数。之前 fx.rs 把 JPY/KRW 标成 `base_is_cents: false`（整币制）→ 未除 100 → 恰好 100 倍偏高。修复：fx.rs JPY/KRW 改 `base_is_cents: true` + 文档更正；前端 `formatPriceCents` 撤销整币制分支（所有货币统一 /100，GameSearchBox/PriceChartDialog 的 JPY/KRW 显示也随之正确）。验证：fx 4 passed、steam-sdk 95 passed、`npm run build` ✅。

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 1 Requirement Exploration: Completed at 2026-08-06（设计经 grill-me 访谈 13 轮逐项确认）
- Design doc: docs/superpowers/specs/2026-08-06-doona-music-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-06
- Plan doc: docs/superpowers/plans/2026-08-06-doona-music-plan.md
- Stage 3 Plan Execution: P0 completed at 2026-08-06
- P0 scope completed (T1-T2 + 文档审查修订):
  - 审查修订：计划 T4 命令名改全称、T11 命令数 22→25、T5 补 capabilities `store:default`；设计 3.2 `runtime-box.ts`→`runtime.ts`、3.5 目录树统一为 `src/netease/`。
  - T1: `npm create tauri-app@latest doona-music -- --template react-ts --manager npm --yes` 于 `D:\apps\appss\ws\ets2`，git init 完成。
  - T2a: 前端依赖按设计 2.1 降至 React 18（react@18.3.1、@types/react@18），补 tailwindcss@3.4.19 + postcss + autoprefixer。
  - T2b: Cargo.toml 补音乐核心依赖（reqwest json+stream、axum 0.7、url/urlencoding、base64/cbc/aes/qrcode/rand/num-bigint/image/log、tauri-plugin-store 2），并按审查结论追加 `tauri` `tray-icon` feature（P4 托盘必需，提前编译）。
- P0 Verification:
  - `npm run build` passed（tsc + vite build）。
  - `cargo check` passed（1m08s 全量依赖解析成功）。
- Active stage: Stage 3 P2 未开始（待用户批准继续）

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- 阶段编号修正（用户指示）：P1=T1-T6、P2=T7-T9、P3=T10-T14、P4=T15-T16、P5=T17；计划文档已同步。
- Stage 3 Plan Execution: P2 completed at 2026-08-06
- P2 scope completed (T7-T9):
  - T7: HOST `src/components/ui/` 剪裁拷贝 16 个通用组件（Button/Checkbox/ContextMenu/Dialog/GlassCard/GlassSurface/Icon/OtpInput/SearchInput/Select/Slider/TabButtons/TextField/Toast/Toggle/glassClasses）；重写 barrel `index.ts`（剔除 14 个游戏/宿主专用件）；**Toast.tsx 裁剪**：去 react-i18next（DOONA 无 i18n）与宿主 backup 事件监听，保留 onToast 通道。
  - T8: `lib/icons.ts` + `lib/toast.ts` 拷贝；icons.ts 引用的 87 个 SVG（28 fill + 59 regular）按引用清单精确拷贝至根 `assets/`；hooks（useAnimation/useCountUp）与 `themeName.ts` 确认无 UI 组件引用，按计划"如被引用"条款跳过。
  - T9: HOST `tailwind.config.ts`/`postcss.config.js` 拷贝；新写 `src/styles/tokens.css`（@tailwind 指令 + :root/.dark HSL 变量写死宿主默认主题 + UI 组件引用的动画 keyframes/glass/scrollbar 类，剔除 app-liquid-glass/game-cover-card 等宿主专属段）；main.tsx 引入；App.tsx 换成临时 UI 冒烟页（替换掉引用已删除 greet 命令的模板页）。
- P2 执行中发现并修正的偏差：
  - DOONA 模板 tsconfig 开了 `noUnusedLocals/noUnusedParameters` 而 HOST 显式关闭 → 对齐 HOST 设为 false（保持 vendored 组件原样，不改组件代码）。
  - icons.ts 依赖 `../../assets/fill|regular/*.svg?raw`（HOST 根目录 1500+ 图标集），按引用清单只拷 87 个。
  - Select 组件 `name` 为必填 prop（HOST 原样）。
- P2 Verification:
  - `npm run build` passed（tsc + vite，CSS 33.7kB，组件编译零错误）。
  - 临时展示页（Button/Dialog/Toast/TextField/Slider/Toggle/Checkbox/Select/SearchInput）`npm run tauri dev` 渲染待用户手动确认。
- Active stage: Stage 3 P5 完成（用户手测全项通过），项目交付完成

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 3 Plan Execution: P5 completed at 2026-08-06
- P5 scope completed (T17):
  - 用户手测（真实网易云账号）10 项冒烟清单全部通过：
    1. QR 登录、手机验证码登录 ✓
    2. 搜索四 tab（单曲/歌单/专辑/歌手）✓
    3. 歌单分页（滚动加载 + 加载更多）✓
    4. 播放/暂停/下一首/上一首/播放模式/音量 ✓
    5. 歌词 + 翻译、封面主题色切换 ✓
    6. 喜欢/取消喜欢 ✓
    7. 展开播放器、迷你播放器 ✓
    8. 缓存恢复（重启后播放位置/队列/最近/搜索历史）✓
    9. 托盘（关窗继续播、托盘菜单控制、重新显示窗口）✓
    10. 音质设置、无版权试听片段标记 ✓
  - 冒烟前处理：kill 遗留 vite dev server（PID 34576，占 1422 与 tauri dev 冲突）。
- P5 Verification: `npm run tauri dev` 手测全项通过；无失败项需回滚。

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 3 Plan Execution: P4 completed at 2026-08-06
- P4 scope completed (T15-T16):
  - T15: 新建 `src-tauri/src/tray.rs`：`TrayIconBuilder` 菜单 5 项（显示窗口/播放暂停/上一首/下一首/退出），左键单击托盘显示主窗口，播放控制命令 `app.emit("tray:play-pause|prev|next")` 走前端 runtime（`togglePlay/prevTrack/nextTrack`）；`lib.rs` `on_window_event` 拦截 `CloseRequested` → `prevent_close()` + `hide()`（宿主模式照搬）；`App.tsx` `listen` 三个托盘事件映射到 runtime，卸载时清监听。
  - T16: `tauri.conf.json`：`productName: "Doona Music"`、`identifier: "com.doona.music"`、`bundle.targets: ["nsis"]`、窗口 1100x720（min 800x560）；CSP 严格化：`default-src 'self'` + `connect-src ipc: http://ipc.localhost http://127.0.0.1:*`（Tauri IPC + 本地音乐/封面代理）+ `media-src/img-src http://127.0.0.1:* data: blob:` + `style-src 'unsafe-inline'` + `script-src 'self'`（无 unsafe-eval）。
  - 应用图标：Python+PIL 脚本 `scripts/gen_icons.py` 自绘音符渐变图标，生成 16-512 PNG + icon.ico/icon.png（替换 Tauri 模板图标）。
- P4 执行中发现并修正的偏差：
  - `cargo check` 报 `emit` 需 `tauri::Emitter` trait 显式引入，补 `use tauri::Emitter`。
  - 计划原案 CSP `connect-src http://127.0.0.1:*` 需补 Tauri 2 IPC 域名（`ipc:` / `http://ipc.localhost`），否则 `invoke` 会被 CSP 拦截。
- P4 Verification:
  - `cargo check` + `cargo test` passed（0 测试）；`cargo fmt` 执行。
  - `npm run tauri build` passed：产出 `Doona Music_0.1.0_x64-setup.exe`（3.0M, NSIS）+ release exe（14M, 2m40s 编译）。
  - 托盘/关窗隐藏手测项待用户 `tauri dev` 确认（计划 T15 verify）。

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 3 Plan Execution: P3 completed at 2026-08-06
- P3 scope completed (T10-T14):
  - T10: HOST 插件 `src/styles.ts` 原样拷贝至 DOONA `src/netease/styles.ts`（CSS 变量自带 fallback 无需改动）；`lyrics.ts` 一并拷贝（ExpandedPlayer 依赖 `activeLyricIndex`）。
  - T11: 新建 `src/netease/sdk-bridge.ts` 封装 25 个 `music_*` invoke 命令（参数名与 commands/music.rs 对齐）+ `storage`（tauri-plugin-store）+ `ui.notify`→showToast；HOST `src/types.ts` 拷贝至 `src/netease/types.ts`（`import from "sdk"` 改本地类型）。
  - T12: HOST `src/runtime.ts` 拷贝至 `src/netease/runtime.ts`：`runtime.init(sdk)` 由 App 传 bridge，`dispose()` 保留供卸载调用；订阅/状态机模式原样。
  - T13: HOST 插件 `src/index.tsx`（2827 行）按 Python 行号区间脚本机械拆分为 42 文件：`AppShell.tsx`（MusicPage→AppShell，view 状态机保留）、8 个 `views/*`、32 个 `components/*`、`helpers/constants.ts`（手写类型/常量）与 `helpers/format.ts`（纯函数）、2 个 hooks；sdk import 改 `../../components/ui`；漏切组件 `LibraryTabs`/`DiscoveryTabs`（原插件未调用）补建 `components/PanelTabs.tsx` 保持 1:1。
  - T14: `src/App.tsx` 挂载 `<AppShell/>` + `useEffect` runtime.init/dispose；main.tsx 已引 tokens.css。
- P3 执行中发现并修正的偏差：
  - HOST 插件从 `sdk` 导入 Button/Icon/TextField/Dialog/Slider，DOONA 对应 `src/components/ui`（P2 剪裁版）；拆分脚本最初指向不存在的 `../ui`，改为 `../../components/ui`。
  - `Icon` 组件 `name` 原为严格 `IconName` 联合类型，拆分组件传入 `string`（meta/icon 字面量表）→ 放宽为 `IconName | string` 且 `ICONS[name] ?? ""` 兜底。
  - PlayerBar `onSongContextMenu` 原必需，但宿主 ExpandedPlayer 内 `<PlayerBar state onExpand={()=>undefined}/>` 未传（宿主构建宽松）→ DOONA strict 下改可选 + QueuePopover 内 `?? (() => undefined)` 兜底。
  - sdk-bridge 初版误用 `Store.load()` 实例方法（v2 plugin-store 为静态 `Store.load`，实例自动加载）→ 删除冗余 `await s.load()`。
  - 拆分后 `../../lib/icons` 依赖 87 个 SVG：先误拷至 `src/assets/`，按相对路径（`../../assets` = 根）修正拷至根 `assets/`（174 个文件含 dup 无 MISSING）。
- P3 Verification:
  - `npx tsc --noEmit` passed（零错误）。
  - `npm run build` passed（185 modules，JS 342.93kB，CSS 34.66kB）。
  - dev server 冒烟：1422 被遗留 node（PID 34576）占用，临时 `--port 1424 --strictPort` 启动正常；`tauri dev` 播放器页面（未登录态）待用户手动确认。

## Current Workflow Request
- Topic: Doona Music 独立网易云播放器（插件 → 独立桌面应用）
- Stage 3 Plan Execution: P1 completed at 2026-08-06
- P1 scope completed (T3-T6):
  - T3: HOST `core/music/` 六文件（cookie/login/models/netease/proxy/weapi/mod.rs）拷贝至 DOONA `src-tauri/src/core/music/`；mod.rs 本就是纯模块声明，无需改写；新建 `core/mod.rs` 声明 `pub mod music`。
  - T4: `commands/music.rs` 照搬（264 行，25 个 `music_*` 命令 + 私有 `logged_in_cookie`）；新建 `commands/mod.rs`；lib.rs 注册全部 25 命令。
  - T5: lib.rs 注册 store 插件；代理为**懒加载**（照搬 HOST：`music_proxy_port` 命令内 `get_proxy_port()` 为 None 时 `start_proxy()`，setup 不主动拉代理——review 修正，与设计 3.4"或懒加载"一致）；capabilities/default.json 放行 `store:default`。
  - T6: 冒烟——首次 `tauri dev` 因 1420 端口被宿主 dev server（node PID 15948）占用而失败，DOONA 独立端口改为 1422（vite.config.ts + tauri.conf.json devUrl）；用户手动确认 dev 窗口正常。
- P1 执行中发现并修正的偏差：
  - T2 依赖漏项（P1 编译时暴露）：`anyhow = "1"`（cookie.rs/login.rs 直接使用）、`tokio = { version = "1", features = ["net","time"] }`（login.rs `tokio::time::sleep`、proxy.rs `tokio::net::TcpListener`）、`cipher = "0.4"`（weapi.rs `use cipher::{...}`）；三者 HOST Cargo.toml 均有，已补入 DOONA 并同步修订计划 T2。
  - 计划 T5 原案"setup 启动 start_proxy()"与 HOST 实际懒加载行为不符，已改为懒加载并同步修订计划。
- P1 Verification:
  - `cargo check` passed（初次 2.76s，依赖已缓存）。
  - `cargo test music` passed: 10 passed, 0 failed（cookie/weapi/login 单测）。
  - `npm run tauri dev`：窗口正常（用户手动确认）。
- Active stage: Stage 3 P2 未开始（待用户批准继续）
- 关键结论：
  - 新工程 `D:\apps\appss\ws\ets2\doona-music\`，独立 git 仓库，Tauri 2 + React 18 + Vite + Tailwind + Rust。
  - 产品名 Doona Music，identifier `com.doona.music`，仅 NSIS 打包，无自动更新。
  - 单主窗口 + 托盘常驻（关窗继续播）；B1 轻重构（runtime 订阅模式 + view 状态机沿用，不上 router/状态库）。
  - Rust core/music 六模块 + UI 库通用组件 + icons/hooks + Tailwind/静态主题基座全部 vendored。
  - 功能 1:1 全量保留；文案硬编码中文，i18n 后置。

## Current Workflow Request
- Topic: 网易云音乐插件内手机号/二维码登录
- Stage 1 Requirement Exploration: Completed at 2026-08-05
- Design doc: docs/superpowers/specs/2026-08-05-netease-in-page-login-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-05
- Plan doc: docs/superpowers/plans/2026-08-05-netease-in-page-login-plan.md
- Stage 3 Plan Execution: P1 completed at 2026-08-05
- P1 scope completed:
  - T1: 新增 `LoginQrKeyResult`、`LoginQrCheckResult`、`CaptchaSentResult` 后端模型。
  - T2: 新增 AES-CBC、PKCS7、随机数、大整数和二维码生成依赖。
  - T3: 新增 `core::music::weapi` 纯函数，覆盖 weapi 参数加密、chainId 和二维码 data URL 单元测试。
  - T4: 新增 `post_weapi` 网络 helper，包含请求头、表单加密、响应 JSON 和 Set-Cookie 归一化。
  - T5: 新增二维码 key 创建后端函数。
  - T6: 新增二维码状态检查、803 登录成功 Cookie 保存和 `music:login-success` / `music:login-failed` 事件。
  - T7: 新增手机号短信验证码发送后端函数。
  - T8: 新增手机号短信验证码登录后端函数，成功后复用 Cookie 保存和登录态验证。
  - T9: 新增并注册 `music_login_qr_key`、`music_login_qr_check`、`music_login_send_captcha`、`music_login_cellphone` Tauri commands。
- Verification:
  - `cd src-tauri && cargo check` passed after T1/T2/T4/T5/T6/T7/T8.
  - `cd src-tauri && cargo test music::weapi` passed after T3.
  - `cd src-tauri && cargo test music && cargo check` passed after T9 and final cleanup.
  - `cargo fmt --check` was not used as a gate because the repository currently has broad pre-existing rustfmt diffs outside this P1 scope; no unrelated Rust files were reformatted.
- Stage 3 Plan Execution: P2 completed at 2026-08-05
- P2 scope completed:
  - T10: `src/plugins/music-types.ts` 新增 `LoginQrKeyResult`、`LoginQrCheckResult`、`CaptchaSentResult`。
  - T11: `src/plugins/sdk.ts` 新增 `music.loginQrKey`、`music.loginQrCheck`、`music.sendLoginCaptcha`、`music.loginCellphone`，并保持 `music` 权限检查。
  - T12: `scripts/official-plugins/netease-music/src/sdk.d.ts` 和 `types.ts` 同步登录结果类型与 SDK 方法声明。
- P2 Verification:
  - `npm run build` passed after T10.
  - `npm run build` passed after T11.
  - `cd scripts/official-plugins/netease-music && npm run build` passed after T12.
  - Final `npm run build` passed after progress update.
- Stage 3 Plan Execution: P3 completed at 2026-08-05
- P3 scope completed:
  - T13: `scripts/official-plugins/netease-music/src/runtime.ts` 保留 `openLoginWindow()` 兼容方法，并新增 `createQrLogin`、`checkQrLogin`、`sendLoginCaptcha`、`loginWithCellphone`。
  - T14: `scripts/official-plugins/netease-music/src/index.tsx` 新增插件内 `LoginDialog`，支持二维码生成、2 秒轮询、过期刷新、手机号验证码发送和倒计时。
  - T15: 顶部账号登录按钮和未登录空态登录按钮改为打开插件内 Dialog，不再默认调用外部登录窗口。
  - T16: `scripts/official-plugins/netease-music/src/styles.ts` 新增登录 Dialog、二维码面板、手机号表单和小屏适配样式。
  - T17: 登录相关错误提示增加二维码、验证码和请求频繁场景映射；扫码等待、已扫码、过期等可恢复状态显示在 Dialog 内。
- P3 Verification:
  - `cd scripts/official-plugins/netease-music && npm run build` passed after T13.
  - `cd scripts/official-plugins/netease-music && npm run build` passed after T14/T15.
  - `cd scripts/official-plugins/netease-music && npm run build` passed after T16/T17.
  - Final `cd scripts/official-plugins/netease-music && npm run build` passed after progress update.
- Stage 3 Plan Execution: P4 completed at 2026-08-05
- P4 scope completed:
  - T18: Rust 音乐相关测试和后端编译验证完成。`cargo fmt --check` 显示大量无关历史格式差异，因此按 `AGENTS.md` 最小改动规则未执行会批量改写仓库的 `cargo fmt`。
  - T19: 官方网易云插件完成 `npm run build` 和 `npm run pack`，已同步 `plugins/com.easygamehub.netease-music` 与 `resources/defaults/plugins/com.easygamehub.netease-music`。
  - T20: 主应用 `npm run build` 通过，包含 TypeScript、Vite 主应用和插件 SDK 构建。
  - T21: 手动交互验证因当前工具环境无法可靠控制 Tauri 桌面窗口和真实扫码/短信验证码流程，未执行；需要人工在应用内验收登录 Dialog。
  - T22: 进度文档已更新。
- P4 Verification:
  - `cd src-tauri && cargo fmt --check` failed with broad pre-existing rustfmt diffs outside this feature scope; no Rust files were reformatted.
  - `cd src-tauri && cargo test music` passed: 8 passed, 0 failed.
  - `cd src-tauri && cargo check` passed.
  - `cd scripts/official-plugins/netease-music && npm run build` passed.
  - `cd scripts/official-plugins/netease-music && npm run pack` passed.
  - Bundle import check confirmed generated plugin bundles import from `"sdk"`.
  - `npm run build` passed.
  - Final `npm run build` passed after progress update.
- Active stage: Stage 4 Test-Driven Validation not started
- Notes:
  - 当前设计结论为可实现。
  - 后端参考 go-musicfox 的 `LoginQRService`、`CaptchaSentService`、`LoginCellphoneService` 接口语义。
  - 需要新增 Rust 最小 `weapi` 请求能力；不保存明文密码，不做破解或会员绕过。

## Current Workflow Request
- Topic: NetEase music official plugin
- Stage 1 Requirement Exploration: Completed at 2026-08-04
- Design doc: docs/superpowers/specs/2026-08-04-netease-music-plugin-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-04
- Plan doc: docs/superpowers/plans/2026-08-04-netease-music-plugin-plan.md
- Stage 3 Plan Execution: P1 completed at 2026-08-04
- P1 scope completed:
  - T1: Rust plugin permission whitelist accepts `music`; unknown permissions still fail.
  - T2: Frontend SDK permission type, plugin template type declarations, and plugin documentation reserve `music`.
  - T3: Plugin unload now runs `sdk.lifecycle.onDispose()` callbacks, then optional module `teardown()`, then clears registrations/listeners/loaded state.
- Verification:
  - `cd src-tauri && cargo test plugins` passed.
  - `npm run build` passed.
  - `cd scripts/plugin-template && npm run build` passed.
- Stage 3 Plan Execution: P2 completed at 2026-08-04
- P2 scope completed:
  - T4: Rust music backend dependencies added. `reqwest 0.12` resolved successfully alongside transitive dependencies; a direct minimal `tokio` dependency was added for axum proxy TCP listening and login polling.
  - T5: `tauri-plugin-store` registered in the Tauri builder.
  - T6: `core::music` module and shared music data models added.
  - T7: NetEase cookie parsing, normalization, login-cookie detection, local `music-cookies.json` storage helpers, and unit tests added.
  - T8: Read-only NetEase client added for search, login status, user playlists, playlist tracks/range, song URL fallback, and lyrics.
  - T9: Official login WebView command added; it polls WebView cookies, stores `MUSIC_U` cookies, validates login status, and emits `music:login-success` / `music:login-failed`.
  - T10: Local `127.0.0.1` audio/cover proxy added with http/https validation, Range forwarding, CORS/CORP headers, and streaming response bodies.
  - T11: Tauri music commands registered for login, search, playlists, song URL, lyrics, and proxy port.
- Verification:
  - `cd src-tauri && cargo check` passed.
  - `cd src-tauri && cargo test music` passed.
  - `npm run build` passed.
- Stage 3 Plan Execution: P3 completed at 2026-08-04
- P3 scope completed:
  - T12: Frontend music types added in `src/plugins/music-types.ts` and synchronized to plugin template declarations.
  - T13: `sdk.music` added to `PluginSdk`; all methods enforce `music` permission and map to Tauri music commands or local proxy URL helpers.
  - T14: Plugin development documentation now describes the `music` permission, lifecycle cleanup, music SDK calls, trial snippets, and no account-write/no bypass restrictions.
- Verification:
  - `npm run build` passed.
  - `cd scripts/plugin-template && npm run build` passed.
- Stage 3 Plan Execution: P4 completed at 2026-08-04
- P4 scope completed:
  - T15: Official NetEase music plugin project added under `scripts/official-plugins/netease-music`.
  - T16: Module-level `Audio` runtime added with subscriptions, state updates, queue, playback mode, volume, quality, and disposal.
  - T17: Login/status/logout and user playlist loading wired through `sdk.music`.
  - T18: Search, playlist loading, and paged playlist track loading implemented.
  - T19: Queue playback implemented through `sdk.music.songUrl()` and local audio proxy helpers; trial snippets are marked, unavailable tracks are prompted/skipped without bypass logic.
  - T20: LRC and translated lyric parsing plus active-line calculation added.
  - T21: Three-column player UI added for account/playlists, search/tracks, player/lyrics/queue.
  - T22: `npm run pack` copies `manifest.json` and `bundle.js` to `plugins/com.easygamehub.netease-music` and `resources/defaults/plugins/com.easygamehub.netease-music`.
  - T23: Built-in plugin startup sync added in Rust; default plugins install/update from resources, keep disabled records disabled, and preserve `config.json`.
- Verification:
  - `cd scripts/official-plugins/netease-music && npm install` passed with one moderate esbuild audit warning.
  - `cd scripts/official-plugins/netease-music && npm run build` passed.
  - `cd scripts/official-plugins/netease-music && npm run pack` passed.
  - Official bundle imports only from `"sdk"`.
  - `cd src-tauri && cargo test plugins` passed.
  - `cd src-tauri && cargo check` passed.
  - `npm run build` passed.
- Active stage: Stage 3 P5 not started.

## Current Workflow Request
- Topic: 插件系统（plugin system）
- Stage 1 Requirement Exploration: Completed at 2026-08-04（设计经 grill-me 访谈逐项确认）
- Design doc: docs/superpowers/specs/2026-08-04-plugin-system-design.md
- Stage 2 Implementation Planning: Completed at 2026-08-04
- Plan doc: docs/superpowers/plans/2026-08-04-plugin-system-plan.md
- Stage 3 Plan Execution: P1 已完成（T1-T11，2026-08-04）
  - 验证：cargo test 35 passed、cargo check、npm run build（含 sdk lib 构建）、dev 服务器 SDK 模块 200
  - 待人工验收：npm run tauri dev → 设置→插件 → 安装 C:\Users\JT\AppData\Local\Temp\opencode\hello-plugin.zip → 检查加载/启停/错误展示
- Active stage: Stage 3 P2（等待 P1 人工验收；P2 已实现并自动化验证）

### P3 完成情况（T17-T20，2026-08-04）
- T17 `scripts/plugin-template/`：package.json（esbuild `--bundle --format=esm --external:sdk --jsx=transform`）、src/index.tsx（registerSettingsSection + registerPage + events.on + storage 读写示例）、tsconfig.json、README.md（构建 → 打包 → 安装三步）、manifest.json、sdk.d.ts/types.ts（类型镜像）
  - 前置：sdk.ts 增加 **default export**（React 表面）——设计 3.1 要求 `import React from "sdk"` 经典转换写法，原 SDK 无默认导出
  - verify：`npm install && npm run build` → dist/bundle.js 2.7kb，仅 `from "sdk"` ✓
- T18 `scripts/examples/webdav-backup/`：`backup:completed` → `core.listSnapshots` 最新快照（已按时间降序，[0] 即最新）→ `fetch` PUT 快照元数据 JSON 到配置 URL；设置区块 URL/用户名/密码（storage 持久化，Basic Auth）；附带 `mock-dav.mjs` 本地 mock 服务（PUT/GET/OPTIONS + CORS，`node mock-dav.mjs [port]`）
  - verify：build 3.3kb 仅 `from "sdk"` ✓；mock 冒烟 PUT/GET/CORS 正常；**端到端验收跳过**（用户指示）
- T19 `scripts/examples/stats-page/`：registerPage 侧边栏页面「备份统计」（icon chart），`core.listGames()` + `core.listSnapshots(id)` 汇总（游戏数/快照总数/总占用/最近备份 + 逐游戏明细表）
  - verify：build 3.1kb 仅 `from "sdk"` ✓
- T20 `docs/plugin-development.md`（SDK API 参考/manifest 规范/权限表/打包步骤/限制）+ progress.md 更新
- 三个 zip 均已打包并验证（zipfile 校验 valid，条目 = manifest.json + bundle.js 在 zip 根）：
  - `scripts/plugin-template/plugin-template.zip`
  - `scripts/examples/webdav-backup/webdav-backup.zip`
  - `scripts/examples/stats-page/stats-page.zip`

### P3 执行中发现的偏差（相对计划文档，已修正）
11. **sdk.ts 无 default export**：设计 3.1 的模板写法 `import React from "sdk"` 需要默认导出 → sdk.ts 补 React 表面 default export（不影响命名导出/既有加载器）
12. **打包工具坑**：GNU tar `-a` 不支持 zip 格式（产出伪 zip 头）；Compress-Archive 保留 `dist/` 层级破坏入口白名单 → 实际打包用 Python zipfile（arcname 打平到 zip 根），README 统一用 Windows 自带 bsdtar `tar -a -cf` 并在 dist 目录内执行（示例已按此打包验证）
13. T18 mock dav 冒烟通过后端到端实测按用户指示跳过（验收待补）

### P2 完成情况（T12-T16，2026-08-04）
- T12 `backup:started`：core/backup.rs `run_single_task` 开头 emit；`backup:failed` 两条失败路径已有，保持现状
- T13 sdk.core/storage/notify：P1 已实现（命令名/参数核对无误：get_games、get_game_by_id(gameId)、get_snapshots(gameId)、backup_now(gameId, note?)）
- T14 `src/plugins/events.ts`：本地 Emitter + Tauri 适配（listen backup:started/completed/failed 转发同总线）；sdk.events 接入（onForPlugin 按插件绑定，unload 时 removePluginListeners）；game:added/game:removed 发射点 = AddGameDialog 三处 add + GameList handleRemoveConfirm
- T15 App.tsx `useRoutes` 动态合并插件路由 `/plugin/:id/:page`（PluginPage + ErrorBoundary），Layout 侧边栏 SidebarMenu 后追加插件导航区块
- T16 PluginManagerSection 每插件渲染 settingsSections（ErrorBoundary 包裹）
- 新增 `src/plugins/ErrorBoundary.tsx`（设计 3.7 防御隔离的必要实现）

### P2 执行中发现的偏差（相对计划文档，已修正）
7. **lib.rs 事件名统一问题（设计 3.5 的正确实现所需）**：event_cb 原先把 backup:started/failed/queue_changed 全部 emit 为 `backup:completed`（payload.event 区分）。按设计 3.5 改为 `emit(event, payload)` 独立事件名；连带 Toast.tsx 补 `listen("backup:failed")`（原失败 toast 逻辑在 backup:completed 内检查 payload.event，拆分后失效）
8. **SDK 产物打包了 @tauri-apps/api**（invoke/listen 内联进 plugin-sdk.js）：vite.sdk.config.ts 仅 external react/react-dom。若把 tauri api 也 external，import map 需指向哈希化 chunk（react 覆辙），故维持打包 —— 走全局 `__TAURI_INTERNALS__` 契约，webview 内功能正确，仅少量重复体积
9. 测试插件 bundle.js 的 sdk 须为模块级变量（setup 参数非闭包可见），已修正
10. **回归修复**：T15 重写 App.tsx 时误删 `ActiveThemeProvider`/`GlobalThemeStyle`/`GlobalAppearanceStyle` 包裹层 → 外观/主题设置失效；已恢复为 `useRoutes` 外层包裹（构建通过，待用户确认恢复生效）

### Review/执行中发现并修正的偏差（相对计划文档）
1. 计划 T2「id 冲突拒绝」与设计 3.8「同 id 覆盖=更新」矛盾 → 按设计执行：install_plugin 同 id 原子覆盖
2. 前端需 plugins_dir 绝对路径（convertFileSrc）→ get_plugin_registry 返回 DTO 附加 plugins_dir 字段
3. loader 需 entry/permissions → PluginRecord 持久化这两个字段（安装时写入）
4. 构建方案修正（计划 T7 原案产物导出名被压缩器改写 + react 双实例问题）：
   - 应用构建单入口 + manualChunks 固定 react chunk 为 react.js
   - SDK 改为独立 lib 构建（vite.sdk.config.ts）→ dist/plugin-sdk.js 保留导出名
   - import map prod 分支增加 react / react-dom 指向 /react.js
   - package.json build 追加 `vite build --config vite.sdk.config.ts`
5. 全量测试暴露 tempdir 并行竞争（共享目录）→ 每测试唯一目录（线程名）
6. P2 补充：插件页面渲染需 ErrorBoundary（设计防御隔离意图的必要实现）

---

## 历史记录（2026-07）

## Stage 1 Requirement Exploration
- Completed at: 2026-07-23
- Design doc: docs/superpowers/specs/2026-07-23-easygamehub-design.md

## Stage 2 Implementation Planning
- Phase 1 plan: docs/superpowers/plans/2026-07-23-easygamehub-plan.md
- Phase 2 plan: docs/superpowers/plans/2026-07-23-easygamehub-phase2-plan.md

## Stage 3 Plan Execution
- Phase 1: Completed 2026-07-23 (24 tasks A-G)
- Phase 2: Completed 2026-07-23 (18 tasks H-L)

## Stage 4 Test-Driven Validation
- Not started (user declined)

## Stage 5 Browser Verification
- Not started (user declined)

## Current Workflow Request
- Topic: launcher / game list / steam inventory view settings system
- Stage 1 Requirement Exploration: Completed at 2026-07-26
- Design doc: docs/superpowers/specs/2026-07-26-view-settings-design.md
- Stage 2 Implementation Planning: Completed at 2026-07-26
- Plan doc: docs/superpowers/plans/2026-07-26-view-settings-plan.md
- Active stage: Stage 3 Plan Execution
- Current progress: Group A completed and verified (`cargo check`, `cargo test view_settings -- --nocapture`); Group B completed and verified (`npx tsc --noEmit`); Group C completed and verified (`npx tsc --noEmit`)
- Group D status: partially started, then stopped at user request after the user reverted their version
- Additional fix applied during Group A verification: updated existing `src-tauri/src/core/scanner.rs` test fixtures to include the required `popular` field so the planned Rust test command could run
- Current state: development paused by user request; do not continue unless explicitly resumed

## Current Workflow Request
- Topic: 社交缓存（好友 / 私聊 / 群聊）—— 参考 Monica Steam 缓存分层，为已完成 E1/E2 的社交模块补缓存优化
- Stage 1 Requirement Exploration: In progress（2026-08-09）
- Design doc: docs/superpowers/specs/2026-08-09-social-cache-design.md
- 关键决策：缓存落 Rust `core/social_cache.rs` + per-account SecureStore（加密）；cache-first 双阶段（load 快读 + refresh 慢刷）；投递状态（Sent/Pending/FailedRetryable）+ 合并去重 + 裁剪（500 Sent / 64 非 Sent）
- 阶段划分：S1 缓存内核（纯 Rust+单测）→ S2 好友+私聊接入 → S3 群聊接入 → S4 会话快照+未读（可砍）
- 待用户批准设计后进入 Stage 2 计划文档
- Stage 2 Implementation Planning: Completed at 2026-08-09
- Plan doc: docs/superpowers/plans/2026-08-09-social-cache-plan.md
- 用户已确认：S4 会话列表纳入；好友/群列表走双阶段；群聊过期未确认→FailedRetryable、私聊→Verifying
- 待用户批准计划后进入 Stage 3 执行（S1→S2→S3→S4）
- Stage 3 Plan Execution: Completed 2026-08-09（S1–S4 全部任务实现并验证）
  - S1 缓存内核：`core/social_cache.rs`（类型/bound 500+64/recover 私聊→verifying·群聊→failedRetryable/merge 身份键+60s对账/SecureStore per-account 封装+归属守卫+写穿辅助）；18 单测
  - S2 好友+私聊：load/refresh_friends、open/refresh_chat、send_chat_message 返回 DTO+持久化 Pending/FailedRetryable、poll_chat 写穿+correlate_friend_echo；前端 SocialPanel 缓存先行+气泡状态/重试+dedupKey 修复（原 dedupKey 模板串内嵌组件调用是坏键）
  - S3 群聊：load/refresh_groups、open/refresh_group_chat、send_group_message 写 Sent（群无 echo）、poll_group_messages 写穿；前端群缓存先行
  - S4 会话+未读：append_* bump 未读（非活跃）+open_* 清零+poll 参数 active_partner/active_group、load/refresh_sessions（friends+threads 派生）、前端好友行未读徽标+末条预览
  - 验证：`cargo test --workspace`（src-tauri 81 + steam-sdk 95 passed）、`cargo check --workspace`、`npm run build` 全绿
- 待手测（Stage 4 清单）：离线缓存秒开+陈旧提示；重启后离线消息合并补回；发送失败→重试；多账号缓存隔离；未读徽标+清零
- 手测修复（2026-08-09）：
  1. 未读徽标只在刷新后清零 → 根因：open_chat 在 Rust 侧清零未读，但前端打开会话后未重读 sessions。修复：chat-open effect 在 openChat 解析后调用 refreshSessionsList()，徽标即时清零。
  2. 切回社交页签每次显示加载中 → 根因：SteamHub 条件渲染 `{tab==="social" && <SocialPanel/>}`，切走卸载/切回重挂，React 状态全丢。修复：SocialPanel 保持挂载（CSS hidden 切换），聊天状态/滚动/选中跨 Tab 保留；CM 轮询后台持续计未读。附带：账号切换时重置 selected/messages/groups/sessions（keep-mounted 不再重挂导致旧账号选中残留）；好友在线状态补 60s 静默周期刷新（原先靠重挂刷新）。
  - 验证：npm run build 通过。
- 撤销（2026-08-09）：「切回社交页显示加载中」的 keep-mounted 修复被撤销（用户要求），恢复 SteamHub 条件渲染 + 移除连带改动（好友/群/会话 effect 的账号切换重置、60s 好友周期刷新）。**保留**未读徽标即时清零修复（chat-open effect 的 refreshSessionsList()）。
- 全面 Review 第 1 轮（2026-08-09，对照设计/计划文档）—— 修复 7 项：
  1. merge 误标失败：refresh_chat 会把刚发出还在途的 Pending 错标 FailedRetryable（服务器历史未及时含它）→ 加 now_ts 年龄门槛，仅超窗（60s）才标失败
  2. merge 重复：同秒发两条相同内容会同时认领同一服务器孪生 → twins 消费式匹配（每服务器消息只被认领一次）
  3. echo 自愈缺失：correlate_friend_echo 只匹配 Pending，误标 FailedRetryable 后 echo 救不回 → 改匹配任意非 Sent
  4. 未读竞态：refresh_chat/refresh_group_chat 强制写 unread=0，可能覆盖刷新在途新到达的未读 → 改保留缓存未读，清零仅由 open_* 负责
  5. 空文本守卫：send_chat_message/send_group_message 裸调可发空消息 → 补 Err 守卫
  6. 计划遗漏：T21 要求的群行未读徽标当时未实现 → ChatGroupRoomDto.unread_count 由群线程快照派生（load/refresh_groups），前端群行徽标 + open 后/非活跃新消息时重读列表
  7. 前端重复：跨秒发送时乐观气泡（本地 ts）与服务器确认版（服务器 ts）去重键不同，永久重复 → unionMessages/unionGroupMessages 对自己消息按正文去重
  - 新增测试：merge_keeps_recent_unmatched_pending_pending、merge_consumes_twins_for_identical_sends、echo_self_heals_failed_retryable
  - 验证：cargo test --workspace（src-tauri 84 + steam-sdk 95）、cargo check --workspace、npm run build 全绿
- 全面 Review 第 2 轮（2026-08-09，命令层并发/错误路径/前端竞态）—— 修复 2 项：
  1. poll_group_messages 写穿会 append 自己发的群消息（CM 回显自己的发送）→ 缓存重复 + 非活跃时给自己计未读 → 写穿循环跳过 self（send_group_message 已写 Sent）
  2. 群行徽标/预览用 rooms[0]，但 UI 打开的是 defaultChatId → defaultChatId 非首个 room 时打开群清错未读 → 前端改优先用 defaultChatId 对应 room
  - 核对无问题：命令层 SOCIAL_CACHE_LOCK 串行无锁序死锁；18 命令全部注册；refresh_* 保留未读（round1 修复）流程正确；SecureStore 每命令 open 一次、get 走内存条目（无 N 次文件读）；空闲 poll 早退不打开缓存；失败路径保留缓存+陈旧标记；贴纸/图片不走实时写穿由历史兜底（E4 范围）
  - 验证：cargo test --workspace（src-tauri 84 + steam-sdk 95）、cargo check --workspace、npm run build 全绿
- 全面 Review 第 3 轮（2026-08-09，CM/存储边界/前端交互）—— 修复 3 项：
  1. SecureStore::save() 非原子写：fs::write 全量覆盖，进程崩溃/断电中途写入会损坏整个 store（社交缓存频繁写 + auth_store 密钥同路径）→ 改为临时文件 + rename 原子写（readers 只见旧或新，绝无半写）
  2. ChatSessionEntry.unread_count 缺 serde(default) → 防御性补齐（与线程快照一致）
  3. active 会话标记未按 socialMode 门控：切到 friends 模式后 selectedGroup 仍旧值，群轮询仍视其为"当前会话"不计未读；image 上传 refreshTick 在 friends 模式会误跑群 effect 清掉旧群未读（反向同理）→ chat-open effect 按 socialMode 门控 + deps 加入 socialMode；poll active 参数按 socialMode 门控
  - 核对无问题：steamSocial.ts 全部契约与 Rust 一致（camelCase/元组/Option 参数）；CM 重连 seed 与写穿只处理一次不重复；群自消息跳过（round2）正确；round1 merge/echo 修复在流程重读下成立；i18n 键齐全
  - 验证：cargo test --workspace（src-tauri 84 + steam-sdk 95 含 secure_store 原子写）、cargo check --workspace、npm run build 全绿
- Token 过期修复（2026-08-10，用户报告"离线缓存"+CM 不可用）：
  - 根因：access token 过期（JWT exp 08-09）但 refresh token 有效；自动刷新静默失败（refresh_access_token 非200→Ok(None) 且调用方 let _ 吞错）→ 旧 token 一直用 → GetFriendList 401 + CM 拒绝
  - 修复1：refresh_access_token 非200/无token 改返回 Err（带 status+响应片段），签名 Result<Option<String>>→Result<String>
  - 修复2：resolve_session 记录刷新失败 + is_expired() 时返回"Steam 登录已过期，请重新登录"；CM_COOLDOWN_MESSAGE 去猜测化
  - 修复3：新增 jwt_timestamps()；is_expired() 优先用 JWT exp（不再依赖可能错误的硬编码 expires_in_seconds）；登录/刷新写入真实 exp-iat 到 expires_in_seconds（原硬编码3600）
  - 事故：用户补 steam-sdk 缺失文件时覆盖了未提交的 token.rs/cm/client.rs（connect_with_seed 丢失）→ 已恢复 HEAD 版 cm/client.rs + 重新应用 token/session 修复
  - 验证：cargo test --workspace（src-tauri 84 + steam-sdk 96 含 test_jwt_timestamps）、cargo check、npm run build 全绿
