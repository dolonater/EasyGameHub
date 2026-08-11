# Bilibili 播放页互动增强实施计划

> 创建日期：2026-08-11  
> 状态：Stage 2 计划草案，待批准执行  
> 设计文档：`docs/superpowers/specs/2026-08-11-bilibili-interactions-design.md`  
> 执行目标：普通投稿视频播放页互动条、UP 关注、互动状态加载和缓存失效。  
> 非目标：番剧、直播、UP 主空间页、动态、笔记编辑、下载、三连、复杂举报表单。

## 执行原则

- 每个阶段开始前先对照设计文档和本计划 review，防止范围滑到番剧/直播/UP 空间。
- B 站协议能力优先放进 `bpi-rs`，EasyGameHub 只做 DTO、权限、缓存和插件 SDK。
- 不修改播放代理、DASH/MP4 fallback、MPD 生成、播放器 fallback 策略。
- 投币不做乐观更新。
- 点赞、收藏、稍后再看、关注允许乐观更新，但失败必须回滚。
- 每个阶段完成后运行对应验证命令。

## 全局验证命令

Rust：

```powershell
cargo test bilibili
cargo test --manifest-path bpi-rs/Cargo.toml video
cargo test --manifest-path bpi-rs/Cargo.toml user
cargo check
```

前端与插件：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

手测：

```powershell
npm run tauri dev
```

## P0 严格 Review 与 `bpi-rs` 能力审查

### T1 对照设计和现有实现审查范围

文件：

- `docs/superpowers/specs/2026-08-11-bilibili-interactions-design.md`
- `docs/superpowers/plans/2026-08-11-bilibili-interactions-plan.md`
- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/components/WatchSidebarTabs.tsx`
- `src-tauri/src/core/bilibili/video.rs`
- `src-tauri/src/core/bilibili/library.rs`

检查：

- 本轮只做普通视频互动。
- 互动条放主区，不放右侧 Tabs。
- 关注 UP 放 UP 信息行。
- `更多` Tab 保留低频操作。

预期：

- 确认不改播放核心。

### T2 审查 `bpi-rs` 已有能力

文件：

- `bpi-rs/src/video/action.rs`
- `bpi-rs/src/video/info/view.rs`
- `bpi-rs/src/video/info/detail.rs`
- `bpi-rs/src/fav/action.rs`
- `bpi-rs/src/historytoview/toview.rs`
- `bpi-rs/src/user/info.rs`
- `bpi-rs/src/user/relation/*`

检查：

- 复用 `video.like`、`video.coin`、`video.coin_status`。
- 复用现有收藏和稍后再看能力。
- 确认视频详情是否能提供 `liked` / `favorite` / `coin` 相关状态。
- 确认 UP 信息是否能提供 `following` / `follower`。
- 确认是否已有关注/取关写操作。

预期：

- 形成明确缺口清单。

## P1 补齐 `bpi-rs` 互动缺口

### T3 补普通视频互动状态读取缺口

文件：

- `bpi-rs/src/video/info/view.rs`
- `bpi-rs/src/video/info/detail.rs`
- `bpi-rs/src/video/action.rs`
- 对应 `bpi-rs/tests/contracts/video/...`

编辑：

- 如果现有响应模型已有字段但未暴露，补 serde 字段。
- 如果状态需要单独接口，新增参数和 client 方法。
- 加 fixtures 解析测试。
- 加参数序列化测试。

验证：

```powershell
cargo test --manifest-path bpi-rs/Cargo.toml video
```

预期：

- 能稳定得到 liked、coin count、favorite/toView 所需状态中的视频侧数据。

### T4 补 UP 关注/取关写操作

文件：

- `bpi-rs/src/user/relation/action.rs`（新，若不存在）
- `bpi-rs/src/user/relation/mod.rs`
- `bpi-rs/src/user/client.rs`
- `bpi-rs/src/user/params.rs` 或 relation params 文件
- 对应 `bpi-rs/tests/contracts/user/relation-write/...`

编辑：

- 封装 `/x/relation/modify`。
- 参数：
  - `fid`
  - `act`：关注 / 取消关注
  - `re_src` 默认网页端来源。
- 不实现分组移动。
- Cookie/CSRF 由 `bpi-rs` request helper 处理。

测试：

- 参数拒绝 mid=0。
- act 只允许关注/取消关注。
- contract endpoint/method/query/body 匹配。

验证：

```powershell
cargo test --manifest-path bpi-rs/Cargo.toml user
```

预期：

- EasyGameHub 可调用关注/取关。

## P2 EasyGameHub 后端 DTO、commands 和 SDK

### T5 新增互动 DTO 和核心服务

文件：

- `src-tauri/src/core/bilibili/models.rs`
- `src-tauri/src/core/bilibili/video.rs`
- `src-tauri/src/core/bilibili/library.rs`
- `src-tauri/src/core/bilibili/cache.rs`
- `src-tauri/src/core/bilibili/mod.rs`

编辑：

- 新增：
  - `BiliVideoInteractionState`
  - `BiliVideoInteractionStats`
  - `BiliOwnerInteractionState`
- 实现：
  - `interaction_state(tool_dir, aid/bvid)`
  - `like_video(...)`
  - `coin_video(...)`
  - `favorite_video_interaction(...)`
  - `toview_video_interaction(...)`
  - `follow_owner(...)`
- 状态聚合优先复用现有详情、收藏、稍后再看和 user info。
- 避免遍历所有收藏夹判断收藏状态；若无法准确判断，在 DTO 中区分 `favorited` 和 `favoriteFolders`。

测试：

- 纯函数统计更新。
- 乐观回滚所需 DTO 可序列化。
- 缓存 key 带 mid，避免账号串读。

验证：

```powershell
cargo test bilibili
cargo check
```

### T6 新增 Tauri commands

文件：

- `src-tauri/src/commands/bilibili.rs`
- `src-tauri/src/lib.rs`

编辑：

新增并注册：

```text
bilibili_interaction_state
bilibili_like_video
bilibili_coin_video
bilibili_favorite_video_interaction
bilibili_toview_video_interaction
bilibili_follow_owner
bilibili_copy_share_link
bilibili_open_report
```

规则：

- 写操作要求登录。
- 投币参数只允许 1 或 2。
- 举报第一版打开网页端，不提交接口。
- 分享复制链接可通过宿主能力或返回 URL 让前端写剪贴板；若宿主无剪贴板能力，先用 `navigator.clipboard` fallback。

验证：

```powershell
cargo check
```

### T7 扩展插件 SDK 类型和运行时实现

文件：

- `src/plugins/sdk.ts`
- `src/plugins/types.ts`
- `scripts/plugin-template/src/sdk.d.ts`
- `scripts/plugin-template/src/types.ts`
- `scripts/official-plugins/bilibili/src/sdk.d.ts`
- `scripts/official-plugins/bilibili/src/types.ts`

编辑：

新增：

```ts
sdk.bilibili.interaction.*
```

所有方法要求 `bilibili` 权限。

验证：

```powershell
npm run build
cd scripts/official-plugins/bilibili
npm run build
```

## P3 播放页互动条 UI

### T8 新增互动条组件

文件：

- `scripts/official-plugins/bilibili/src/components/VideoInteractionBar.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/CoinPanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/components/FavoritePanel.tsx`（新）
- `scripts/official-plugins/bilibili/src/styles.ts`

编辑：

- 按顺序渲染：
  - 点赞
  - 投币
  - 收藏
  - 分享
  - 稍后再看
  - 举报
  - 更多
- 使用宿主 SDK 组件库 `Button` / `Icon` / `Toggle`。
- 图标 + 数字/文字一体。
- active 高亮。
- 窄屏横向滚动。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T9 播放页加载互动状态

文件：

- `scripts/official-plugins/bilibili/src/pages/WatchPage.tsx`
- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/types.ts`

编辑：

- 视频详情加载成功后调用 `sdk.bilibili.interaction.state(...)`。
- 切视频/切 P 不重复刷新和当前 aid 无关的状态。
- 未登录时仍显示统计，写操作 disabled 或提示登录。
- 状态错误不阻塞播放。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T10 实现点赞、稍后再看、关注乐观更新

文件：

- `VideoInteractionBar.tsx`
- `WatchPage.tsx`
- UP 信息组件，如 `VideoOwnerRow.tsx`（新）

编辑：

- 点赞：切换 active 和 likeCount，失败回滚。
- 稍后再看：切换 active，失败回滚。
- 关注：UP 信息行按钮切换 active，失败回滚。
- 失败统一 `sdk.ui.notify(errorMessage(err))`。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T11 实现投币和收藏确认面板

文件：

- `CoinPanel.tsx`
- `FavoritePanel.tsx`
- `VideoInteractionBar.tsx`

编辑：

- 投币：
  - 选择 1/2。
  - 可选同时点赞。
  - 提交期间 disabled。
  - 成功后刷新互动状态。
- 收藏：
  - 加载收藏夹。
  - owned 收藏夹可点。
  - 提交 add/del media ids。
  - 成功后刷新互动状态。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

### T12 调整右侧 `更多` Tab

文件：

- `scripts/official-plugins/bilibili/src/components/PlayerShell.tsx`
- `scripts/official-plugins/bilibili/src/components/WatchSidebarTabs.tsx`

编辑：

- 从右侧 `更多` 移除主要互动：
  - 稍后再看。
  - 收藏。
- 保留：
  - 外部打开。
  - 复制链接。
  - 截图。
  - 截图目录。
  - 播放源/调试信息如有必要。

验证：

```powershell
cd scripts/official-plugins/bilibili
npm run build
```

## P4 缓存、错误、打包和验收

### T13 缓存失效

文件：

- `src-tauri/src/core/bilibili/cache.rs`
- `src-tauri/src/core/bilibili/video.rs`
- `src-tauri/src/core/bilibili/library.rs`

编辑：

- 点赞/投币后失效当前视频详情/互动状态缓存。
- 收藏成功后清理收藏夹相关缓存。
- 稍后再看成功后清理稍后再看缓存。
- 关注成功后清理 UP 信息/关系缓存。

验证：

```powershell
cargo test bilibili
cargo check
```

### T14 结构化错误补齐

文件：

- `src-tauri/src/core/bilibili/errors.rs`
- `scripts/official-plugins/bilibili/src/runtime.ts`

编辑：

- 投币不足/上限保持 API message。
- 关注风控、收藏权限不足、登录过期展示明确提示。
- 写操作失败不打断播放。

验证：

```powershell
cargo test bilibili
cd scripts/official-plugins/bilibili
npm run build
```

### T15 全量构建和写回

命令：

```powershell
cargo test bilibili
cargo check
npm run build
cd scripts/official-plugins/bilibili
npm run build
npm run pack
```

预期：

- 插件 bundle 写回：
  - `plugins/com.easygamehub.bilibili`
  - `resources/defaults/plugins/com.easygamehub.bilibili`

### T16 Tauri 手测

命令：

```powershell
npm run tauri dev
```

检查：

1. 打开普通视频播放页。
2. 互动条显示点赞、投币、收藏、分享、稍后再看、举报、更多。
3. 未登录时写操作提示登录或 disabled。
4. 登录后点赞/取消点赞可用，失败回滚。
5. 投币 1/2 个确认面板可用，成功后统计更新。
6. 收藏夹选择可用，成功后状态更新。
7. 稍后再看切换可用，我的页稍后再看缓存刷新。
8. 分享复制链接可用。
9. 举报打开网页端。
10. UP 信息行关注/取消关注可用。
11. DASH 高清、兼容播放、清晰度切换、弹幕、评论均不回退。

### T17 文档收尾

文件：

- `docs/superpowers/progress.md`
- `docs/superpowers/specs/2026-08-11-bilibili-interactions-design.md`
- `docs/superpowers/plans/2026-08-11-bilibili-interactions-plan.md`

编辑：

- 记录完成阶段、验证命令、手测结果和执行中发现的设计偏差。

## 回退规则

| 触发条件 | 处理 |
| --- | --- |
| 需要改播放代理或 MPD 才能实现互动 | 停止，说明偏离范围 |
| 投币状态无法可靠确认 | 投币后只显示成功提示并刷新详情，不做本地猜测 |
| 收藏状态无法准确判断 | UI 显示“收藏管理”，不显示全局已收藏 active |
| 关注接口风控或不稳定 | 降级为外部打开 UP 空间关注 |
| 互动状态接口影响播放加载速度 | 状态异步加载，播放详情和取流不等待互动状态 |

## 完成定义

- 设计文档验收标准全部满足。
- `bpi-rs` 缺口有测试覆盖。
- EasyGameHub commands 和 SDK 权限封装完成。
- 播放页互动条显示/操作合一。
- UP 信息行关注可用。
- 缓存失效和错误提示符合设计。
- 构建、打包、写回通过。

