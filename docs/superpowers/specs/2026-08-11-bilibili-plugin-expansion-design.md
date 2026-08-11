# Bilibili 插件系统性扩展设计文档

> 创建日期：2026-08-11
> 状态：Stage 1 设计草案，待批准
> 工作流：`programming-workflow` Stage 1 Requirement Exploration
> 参考项目：`D:\apps\appss\ws\ets2\wiliwili`（产品能力与接口行为参考，不复制 C++/XML 源码）、本仓库收编后的 `crates/bpi-rs`
> 关联文档：`docs/superpowers/specs/2026-08-10-bilibili-plugin-design.md`（主链路 P0-P9 已实施）、`docs/superpowers/plans/2026-08-10-bilibili-plugin-plan.md`

## 1. 背景与目标

Bilibili 官方内置插件已完成主链路（登录、推荐/热门/搜索、DASH/兼容播放、进度同步、截图、弹幕、历史/稍后再看/收藏夹、评论、缓存、设置区），当前定位为普通投稿视频客户端。

本次设计把插件系统性扩展为**接近完整的观众侧 B 站客户端**：在保留现有播放内核、代理、账号与评论能力的前提下，新增热门分类、排行榜、追番、影视、UP 详情页、直播观看、动态、私信、专栏/笔记、弹幕增强、收藏夹管理与设置扩展。

所有 B 站协议能力统一收编进 bpi-rs（收编后位于主仓库 `crates/bpi-rs`），EasyGameHub 后端只做命令转发与 DTO 映射，插件前端零直连 B 站。

## 2. 范围定义

### 2.1 纳入范围

| 能力 | 说明 |
| --- | --- |
| 热门 tab 分类 | 首页 `热门` 子 tab 内嵌二级分类：综合热门、排行榜、每周必看、入站必刷 |
| 排行榜 | 视频榜按分区（rid）切换，默认全站；PGC 榜随 P2 pgc 接口提供 |
| 搜索增强 | 输入联想（suggest）、空态热搜榜（hotwords）、本地搜索历史（可清空） |
| 收藏夹管理 | 文件夹新建/重命名/删除；文件夹内多选批量删除/移动到其他收藏夹；危险操作二次确认 |
| UP 详情页 | 信息卡（头像/昵称/签名/统计/直播状态）、关注/取关、投稿视频 tab（动态 tab 归 P4） |
| 追番/影视 | 首页子 tab，modules 分区行渲染；番剧推荐/国创推荐/猜你喜欢；影视正在热播/电影/电视剧/纪录片/综艺/猜你喜欢 |
| 番剧播放 | season 详情视图 + watch 视图扩展（选集列表、追番按钮、ep 评论、ep 级本地进度） |
| 追番功能 | 我的页追番 tab（`bangumi_follow_list`）、season 详情页追/取消追番 |
| 弹幕增强 | seg.so 分段懒加载（XML 降级）、mode 2/3 顶部/底部固定弹幕、弹幕点赞/举报/撤回 |
| 动态 | 顶层动态 Tab：关注流 + 视频/图文/转发/直播四类卡片 + 点赞 |
| 动态发布/详情/置顶 | 纯文字发布；动态详情视图（正文全文/图片大图/评论 type=17/转发列表）；自己动态置顶/取消 |
| 私信 | 会话列表、会话内历史消息、发送文字消息；30s 轮询；未读角标 |
| 通知流 | 回复/@ 列表（`reply_feed` 分页）+ 未读角标 + 跳转 |
| 直播 | 首页子 tab（推荐 feed + 分区）、直播间视图（mpegts.js 播放、弹幕 WS、发送弹幕、画质切换） |
| 专栏/笔记 | 专栏阅读视图（JSON 段落优先、HTML 白名单 sanitize、点赞/投币、UP 专栏 tab、搜索可进）；笔记轻量（视频详情页入口 + 阅读弹层） |
| 设置扩展 | 设置入口迁入插件内（新 settings 视图），先做播放器 tab：播放缓冲档位、默认视频格式、编码优先序、音质选择、详情页自动起播 |
| 基础设施 | bpi-rs 收编为主仓库 crate；导航/视图模型扩展；SDK 命名空间分组扩展 |

### 2.2 不纳入范围（非目标）

| 类别 | 排除项 |
| --- | --- |
| 内容形态 | 视频/番剧下载、音频/音乐、磁盘媒体缓存（≈下载，复活后放弃） |
| 播放能力 | 杜比全景声（E-AC3 无授权）、硬解开关（WebView2 无 API） |
| 直播 | 直播开播/主播管理、礼物/舰长专属 UI（弹幕流内特殊消息样式除外）、直播回放 |
| 社交 | 图片动态发布（宿主 SDK 无文件选择 API）、动态转发评论、私信图片/表情消息、回复/@ 之外的实时消息 |
| 其他 | DLNA 投屏、投稿/创作中心、第三方插件开放 `bilibili` 权限（保持官方专属） |

## 3. 已确认决策

### 3.1 总体定位

- 系统性扩展为完整观众侧客户端；分 8 期 + 前置基建执行（见 §5）。
- `wiliwili` 只作产品行为参考；B 站 API 优先经 bpi-rs 调用，不在 EasyGameHub 内手写重复协议。
- 插件页面不接触 Cookie、CSRF 与原始播放 URL；代理只代理会话登记过的 URL。

### 3.2 信息架构（对齐 wiliwili 三层结构）

- **顶层 Tab**：`首页`（子 tab：推荐/热门/搜索/追番/影视/直播）、`动态`、`我的`。追番/影视/直播在 P2/P6 填充，P1 先渲染禁用占位；tab 条横向滚动容纳 6 项。
- **热门二级分类**：综合热门/排行榜/每周必看/入站必刷。
- **搜索**：维持 layout-redesign 已实施的"搜索第三 Tab"形态（搜索框在 feed 区顶部），不移动不删除；P1 的联想/热搜/历史挂在搜索 Tab 内。
- **视图模型**（`navigation.ts` 的 `BiliNavView` 扩展）：
  - `watch` 扩展为 `{type:"video", bvid,aid,cid} | {type:"season", seasonId, epId}`
  - 新增：`space`（mid）、`season`（seasonId，详情页）、`live`（roomId）、`settings`、`dynDetail`（dynId）、`article`（aid 专栏 id）
  - 笔记用视频详情页内弹层，不设独立视图
- 追番/影视页渲染为 modules 分区行（每 module 一行横向卡片），猜你喜欢支持翻页；不做 wiliwili 式子 tab 嵌套。

### 3.3 bpi-rs 收编与扩展策略

- bpi-rs 从独立 git 仓库收编为主仓库 `crates/bpi-rs`：删除其独立 `.git`、加入根 `Cargo.toml` workspace members、保留 MIT LICENSE 与作者署名、src-tauri 依赖改 `path = "../crates/bpi-rs"`。
- 缺失能力一律扩展进 bpi-rs（收编后即主仓库代码，一次提交）：P2 的 `/pgc/page/pc/bangumi/tab`、`/pgc/page/pc/cinema/tab`、`/pgc/season/rank/web/list`、PGC 索引接口；P5 的私信会话列表/历史消息两接口；P6 的直播 WS 客户端（`live_ws` 模块，协议解析 + 心跳）。
- 新接口遵循 bpi-rs 现有契约测试基建（`tests/contracts/**` + probe）。

### 3.4 权限与 SDK

- 保持单一 `bilibili` 权限；SDK 内按命名空间分组（现有 `account/home/video/playback/danmaku/comment/library/cache/interaction` 保留）+ 新增 `ranking`、`search`（suggest/hotwords）、`fav`（收藏夹管理）、`user`、`season`、`live`、`dynamic`、`message`、`article`、`note`，全部 `requirePerm("bilibili")`；`settings` 不设命名空间（设置项全部走 `sdk.storage` + 插件 runtime config，编码/音质参数经 `playback.createPlayback` 扩展传递）。

### 3.5 播放器设置修正表（P7）

| 设置项 | 决策 |
| --- | --- |
| 硬件解码开关 | 不做（WebView2 无 API，删除） |
| 解码缓存 | 改为"播放缓冲"档位（dashjs 预读 buffer，小/中/大/自动） |
| 视频格式 | 默认 DASH 高清 / MP4 直链兼容（对应现有 playbackMode） |
| 视频编码 | AVC（默认）/HEVC/AV1 优先序，后端 track 过滤参数化 + 播放失败自动降级 AVC |
| 视频音质 | 标准 AAC / 无损 FLAC（需会员，待实测）；杜比不提供 |
| 详情页直接播放 | 自动起播开关 |

## 4. 数据源映射

### 4.1 P1 数据源（全部已具备）

| 功能 | 端点（wiliwili 参考） | bpi-rs 现状 |
| --- | --- | --- |
| 综合热门 | `/x/web-interface/popular` | `video_ranking.popular_list` 已有 |
| 每周必看 | `/x/web-interface/popular/series/list` + `series/one` | `popular_series_list` / `popular_series_one` 已有 |
| 入站必刷 | `/x/web-interface/popular/precious` | `popular_precious` 已有 |
| 排行榜 | `/x/web-interface/ranking/v2` | `ranking_list`（支持 rid）已有 |
| 搜索建议/热搜 | suggest / hotwords | `search.suggest` / `search.hotwords` 已有 |
| 收藏夹管理 | fav CRUD | `fav.action` 全套已有 |
| UP 详情页 | space_info/card/uploaded_videos/modify_relation | `user.*` 全部已有 |

### 4.2 P2 数据源（bpi-rs 需新增）

| 功能 | 端点 | 新增位置 |
| --- | --- | --- |
| 追番页 | `/pgc/page/pc/bangumi/tab` | bpi-rs bangumi 模块新接口 |
| 影视页 | `/pgc/page/pc/cinema/tab` | bpi-rs bangumi 模块新接口 |
| PGC 排行榜 | `/pgc/season/rank/web/list` | bpi-rs bangumi 模块新接口 |
| PGC 索引 | `/pgc/page/index/result` + `/condition` | bpi-rs bangumi 模块新接口（P2 视工作量可选） |
| 番剧播放 | `/pgc/player/web/v2/playurl` | `bangumi.video_stream` 已有，复用 |

### 4.3 P3-P8 数据源

| 功能 | bpi-rs 现状 |
| --- | --- |
| seg.so 分段弹幕 | `danmaku.web_seg_proto/web_seg_wbi_proto` 已有 |
| 弹幕点赞/举报/撤回 | `danmaku.thumbup/report/recall` 已有 |
| 动态流/点赞/详情/置顶 | `dynamic.all/like/detail/set_top/remove_top` 已有 |
| 动态纯文字发布 | `dynamic.create_text` 已有 |
| 私信会话/历史 | **新增** `/x/session/web/v1/session/sessions` + `.../msg` |
| 私信发送/未读 | `message.send` / `unread_count` 已有 |
| 通知流 | `message.reply_feed` 已有 |
| 直播流/房间/推荐 | `live.stream/room_info/recommend/area_list` 已有 |
| 直播弹幕 WS | `live.danmu_info`（host+token）已有；**WS 客户端与协议解析需新增 `live_ws` 模块** |
| 直播心跳 | `live.web_heart_beat` 已有 |
| 专栏 | `article.view/cards/action` 已有（content type=0 HTML / type=3 JSON） |
| 笔记 | `note.info/list` 已有（私有视频笔记为主） |

## 5. 分期规划

| 期 | 内容 |
| --- | --- |
| **前置 P0** | bpi-rs 收编 `crates/bpi-rs` + workspace；导航/视图模型扩展；SDK 命名空间分组骨架 |
| **P1** | 热门 tab 分类、排行榜 rid 分区、搜索建议/热搜/历史、收藏夹管理模式、UP 详情页 |
| **P2** | bpi-rs 补 pgc 接口、追番/影视子 tab 分区行、season 视图、watch 番剧播放、追番 tab/按钮 |
| **P3** | seg.so 分段弹幕（XML 降级）、mode 2/3 固定弹幕、弹幕点赞/举报/撤回 |
| **P4** | 动态流+四类卡片+点赞、纯文字发布、dynDetail 详情视图、空间置顶 |
| **P5** | 私信会话/历史/发送（bpi-rs 补 2 接口）、30s 轮询、未读角标、通知流 |
| **P6** | 直播 tab（推荐+分区）、live 视图、mpegts.js、后端 WS 中转（`live_ws` 进 bpi-rs）、心跳双通道 |
| **P7** | 插件内 settings 视图 + 播放器 tab、tsc 类型检查、sdk.d.ts 同步校验、死代码/样式清理 |
| **P8** | 专栏（article 视图 + sanitize + UP 专栏 tab + 搜索）、笔记轻量（视频详情页入口 + 阅读弹层） |

## 6. 技术方案要点

### 6.1 番剧播放链路

- `createPlayback` 命令扩展 `season_id`/`ep_id` 参数；后端调 `bangumi.video_stream`，复用现有播放会话 + MPD + 代理 + 质量映射 + 进度上报基建。
- 本地进度按 ep 隔离；评论区 oid 用 ep 的 aid（type=1）。

### 6.2 弹幕分段

- 切 seg.so：每 6 分钟一段，按播放窗口前后预取（当前段 ±2 段），段缓存复用；seg.so 失败降级现有 XML `dm/list.so` 全量路径。
- mode 2/3 固定弹幕：布局算法增加固定弹幕独立轨道区，与滚动弹幕分区。
- 自己发送的弹幕在 B 站撤回窗口（5 分钟）内 overlay 特殊描边 + 点击撤回。

### 6.3 直播架构

- 播放：mpegts.js（flv.js 维护分支）播 http-flv；bundle 增量约 200KB。
- 弹幕：src-tauri 用 axum 起 WS 桥（`127.0.0.1:port/bilibili/live/:room_id/danmaku`）；B 站侧 WS 客户端（tokio-tungstenite + 16 字节包头 + zlib/brotli 解压 + JSON cmd 分发）实现于 bpi-rs `live_ws` 模块；心跳双通道（WS 协议 30s + HTTP `web_heart_beat`）。
- 直播间：房间信息卡 + 播放器 + 弹幕 + 发送弹幕 + 画质切换（qn）；礼物/舰长/SC 以弹幕流特殊消息样式展示。

### 6.4 专栏渲染安全

- `article.view` 的 content：type=3 JSON 段落优先渲染；type=0 HTML 走白名单 sanitize（允许标签/属性白名单，禁止脚本/事件处理器），无法 sanitize 时降级纯文本。

### 6.5 私信与通知

- bpi-rs 新增会话列表/历史消息接口；会话页 30s 轮询新消息；发送仅文字；未读角标 `unread_count`。
- 通知流：`reply_feed` 分页列表 + 类型筛选（回复/@），点击跳转对应视频/动态。

### 6.6 设置架构

- 设置入口迁入插件内：我的页设置入口 + 新 `settings` 视图（先播放器 tab，后续扩展）；宿主"设置→插件"区块移除，避免双入口。
- 播放缓冲/格式/编码/音质/自动起播按 §3.5 修正表实现。

### 6.7 质量打磨

- 插件 `npm run build` 增加 `tsc --noEmit` 类型检查；建立 `sdk.d.ts` 与宿主 `sdk.ts` 同步校验机制（版本标记 + 脚本比对）；清理已知死代码（`sdk.d.ts:306` proxyPort、`useVideoInteraction.refresh`、`types.ts` BilibiliRuntime、后端 `bilibili_ping` 等）与 `styles.ts` 重复定义；bundle 体积只观察不裁剪。

## 7. 验证基线（每期验收）

```powershell
cargo fmt
cargo check
cargo test bilibili
cargo test plugins
npm run build
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

- 新增 bpi-rs 接口跑 `cargo test --manifest-path crates/bpi-rs/Cargo.toml <module>` 契约测试。
- 每期完成 Tauri dev 手测清单（登录、真实播放、新功能主链路、回归不回退）。
- 插件 bundle 检查：仅 `from "sdk"` 导入、无 `@tauri-apps` 直连。

## 8. 完成定义

- P0-P8 全部任务完成，所有自动验证通过。
- 插件禁用/重载/卸载后无播放器、弹幕循环、进度上报、WS 连接和轮询定时器残留。
- Cookie、CSRF、原始播放 URL 不暴露给插件页面或日志。
- 文档更新：本规划文档、`docs/plugin-development.md`（权限与 bpi-rs 收编说明）、`docs/superpowers/progress.md`。
