# Bilibili 播放页互动增强设计文档

> 创建日期：2026-08-11  
> 状态：Stage 1 设计已确认，待进入实施计划执行  
> 关联主设计：`docs/superpowers/specs/2026-08-10-bilibili-plugin-design.md`  
> 关联 UI 设计：`docs/superpowers/specs/2026-08-11-bilibili-ui-redesign.md`  
> 参考项目：`D:\apps\appss\ws\ets2\wiliwili`、`D:\apps\appss\ws\ets2\EasyGameHub\bpi-rs`  
> 目标范围：普通投稿视频播放页互动增强；不做番剧、直播、UP 主空间页、动态、笔记编辑或视频下载。

## 1. 背景

Bilibili 插件当前已完成普通视频的播放主链路和 UI 重构：播放页已经以播放器为核心，并通过右侧 Tabs 承载分 P、清晰度、弹幕、评论和更多操作。

下一步要把普通视频客户端体验做厚。用户明确希望参考网页端交互，点赞、投币、收藏、分享等不应拆成“状态展示”和“操作按钮”两套，而应像 B 站网页端一样在播放器下方合并展示与操作。

本设计只补普通视频互动闭环，不扩到番剧、直播或 UP 主空间。

## 2. 已确认决策

### 2.1 本轮定位

本轮优先做“普通视频客户端增强”，不做番剧/直播等新内容类型。

### 2.2 第一批功能

纳入：

- 点赞 / 取消点赞。
- 投币，支持 `1 个 / 2 个`，可选“同时点赞”。
- 收藏，弹出收藏夹选择。
- 稍后再看。
- 分享 / 复制链接。
- 举报，第一版跳网页端或外部打开，不在插件内提交复杂举报表单。
- 更多，保留外部打开、截图、截图目录等低频操作。
- 关注 / 取消关注 UP，放在 UP 信息行，不放进视频互动条。

不纳入：

- 记笔记。
- UP 主空间页。
- 动态、番剧、直播。
- 三连快捷操作。
- 批量收藏夹管理、移动收藏、删除收藏夹。

### 2.3 互动条位置

互动条放在播放页主区、播放器下方、标题/简介上方或 UP 信息附近，显示和操作合一。

右侧 `更多` Tab 不再承载主要互动操作，只放低频辅助操作。

### 2.4 互动条顺序和形态

顺序：

```text
点赞 → 投币 → 收藏 → 分享 → 稍后再看 → 举报 → 更多
```

形态：

- 图标 + 数字/文字一体按钮。
- active 状态高亮。
- disabled 状态明确。
- 投币、收藏点击后弹小面板。
- 窄屏横向滚动，不换成多行堆叠。

### 2.5 UP 关注位置

关注 UP 放在 UP 信息行：

- UP 头像。
- UP 昵称。
- 粉丝/投稿简要信息。
- `关注 / 已关注` 按钮。

点击 UP 信息可预留未来进入 UP 主空间页，但本轮不实现空间页。

### 2.6 数据加载策略

播放页加载视频详情时同步加载或补查互动状态：

- 是否已点赞。
- 已投币数量。
- 是否已收藏。
- 是否已稍后再看。
- 是否已关注 UP。
- 点赞、投币、收藏、分享数量。
- UP 主粉丝数、关注状态。

按钮进入页面时必须显示准确状态，不等用户点击后才查询。

### 2.7 分层原则

B 站协议能力优先进入 `bpi-rs`：

- 接口 endpoint。
- 参数校验。
- 响应模型。
- 契约测试或 fixtures。

EasyGameHub 只负责：

- DTO 稳定化。
- Cookie/CSRF 安全边界。
- 缓存和失效。
- 错误转换。
- 插件 SDK 权限封装。

插件前端不直接知道 B 站原始接口结构。

### 2.8 乐观更新策略

允许乐观更新并失败回滚：

- 点赞 / 取消点赞。
- 稍后再看。
- 收藏。
- 关注 / 取消关注。

不做乐观更新：

- 投币。投币不可逆，必须等接口成功后再更新状态和统计。

举报：

- 第一版不在插件内提交，不涉及乐观更新。

### 2.9 缓存与状态更新

- 播放页当前视频状态立即更新。
- 相关视频详情缓存失效或更新。
- 收藏/稍后再看成功后清理对应账号内容缓存。
- 首页列表不做全局强制同步，下一次刷新自然更新。

## 3. 当前能力审查

### 3.1 `bpi-rs` 已有能力

已观察到的普通视频互动能力：

- `bpi-rs/src/video/action.rs`
  - `VideoLikeParams`
  - `VideoCoinParams`
  - `VideoCoinStatusParams`
  - `video.like(...)`
  - `video.coin(...)`
  - `video.coin_status(...)`
- `bpi-rs/src/fav/*`
  - 收藏夹列表。
  - 收藏夹内容。
  - 收藏/取消收藏资源。
- `bpi-rs/src/historytoview/*`
  - 历史。
  - 稍后再看列表。
  - 稍后再看添加/移除。
- `bpi-rs/src/user/*`
  - UP 信息。
  - 关系统计。
  - 关注列表/粉丝列表读取。
  - UP 投稿列表读取。

### 3.2 本轮可能需要补齐的 `bpi-rs` 能力

需要实施前严格 review：

- 普通视频“是否已点赞”的状态来源：
  - 优先从视频详情/详情增强接口中提取。
  - 若现有模型未暴露，补 DTO 映射或补状态接口。
- 普通视频“是否已收藏”的状态来源：
  - 优先复用收藏夹资源状态或视频详情字段。
  - 不通过遍历所有收藏夹粗暴判断。
- UP 主关注/取关写操作：
  - 若 `bpi-rs` 尚无 `/x/relation/modify` 封装，本轮补 `user::relation::action`。
  - 支持关注与取消关注；第一版不做分组移动。
- 分享统计：
  - 只展示视频统计里的 `share`。
  - 复制链接不一定调用 B 站“分享上报”接口，除非 `bpi-rs` 已有稳定封装。

## 4. 后端 DTO 设计

新增或扩展 DTO：

```text
BiliVideoInteractionState {
  aid: u64
  bvid: String
  liked: bool
  coinCount: u32
  favorited: bool
  toView: bool
  followingOwner: bool
  stats: BiliVideoInteractionStats
  owner: BiliOwnerInteractionState
}

BiliVideoInteractionStats {
  likeCount: u64
  coinCount: u64
  favoriteCount: u64
  shareCount: u64
}

BiliOwnerInteractionState {
  mid: u64
  name: String
  avatar: String
  followerCount: u64
  following: bool
}

BiliCoinRequest {
  aid?: u64
  bvid?: String
  multiply: u8
  alsoLike: bool
}

BiliFavoriteRequest {
  rid: u64
  addMediaIds: Vec<String>
  delMediaIds: Vec<String>
}
```

`BiliOperationResult` 可继续复用。

## 5. 命令和 SDK 设计

建议新增 SDK 分组：

```ts
sdk.bilibili.interaction = {
  state(args: { aid?: number; bvid?: string; ownerMid?: number }): Promise<BiliVideoInteractionState>;
  like(args: { aid?: number; bvid?: string; liked: boolean }): Promise<BiliVideoInteractionState>;
  coin(args: { aid?: number; bvid?: string; multiply: 1 | 2; alsoLike: boolean }): Promise<BiliVideoInteractionState>;
  favorite(args: { rid: number; addMediaIds?: string[]; delMediaIds?: string[] }): Promise<BiliVideoInteractionState>;
  toView(args: { aid: number; bvid?: string; toView: boolean }): Promise<BiliVideoInteractionState>;
  followOwner(args: { mid: number; following: boolean; aid?: number; bvid?: string }): Promise<BiliVideoInteractionState>;
  copyShareLink(args: { bvid: string }): Promise<BiliOperationResult>;
  openReport(args: { bvid: string }): Promise<BiliOperationResult>;
}
```

对应 Tauri commands：

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

也可复用已有 `library.favoriteVideo` / `library.addToView` / `library.removeToView`，但前端最好通过 `interaction` 分组获得统一状态刷新。

## 6. 前端 UI 设计

### 6.1 播放页主区结构

```text
播放器
弹幕输入条
视频互动条
UP 信息行 + 关注按钮
标题 / 统计 / 简介
右侧 Tabs
```

### 6.2 互动条

按钮：

| 按钮 | 状态 | 行为 |
| --- | --- | --- |
| 点赞 | active 表示已点赞 | 点击切换，失败回滚 |
| 投币 | 显示已投币数或总投币数 | 弹面板选择 1/2 个、是否同时点赞，成功后更新 |
| 收藏 | active 表示已收藏 | 弹收藏夹选择，失败回滚 |
| 分享 | 显示分享数 | 复制链接并提示 |
| 稍后再看 | active 表示已加入 | 点击切换，失败回滚 |
| 举报 | 普通按钮 | 外部打开网页端举报入口 |
| 更多 | 普通按钮 | 打开低频菜单或切到右侧 `更多` Tab |

### 6.3 投币面板

- 选择 `1 个` / `2 个`。
- `同时点赞` Toggle，默认按 B 站常见习惯开启。
- 显示登录要求、余额/限制错误。
- 成功后关闭面板并刷新互动状态。

### 6.4 收藏面板

- 复用收藏夹列表。
- owned 收藏夹可选。
- 当前已收藏的文件夹 active。
- 勾选后提交 add/del media ids。
- 成功后刷新互动状态和收藏夹状态。

### 6.5 UP 信息行

- 显示 UP 头像、昵称、粉丝数。
- `关注 / 已关注` 按钮。
- 未登录时 disabled 或提示登录。
- 点击 UP 信息预留未来空间页入口，当前可外部打开 UP 空间。

## 7. 错误处理

| 错误 | UI 行为 |
| --- | --- |
| 未登录 | 按钮 disabled 或点击提示登录 |
| 登录过期 | 提示重新登录 |
| 风控 | 回滚乐观状态，提示稍后再试 |
| 硬币不足 | 投币面板提示，不改变状态 |
| 已投币上限 | 显示接口返回信息，不改变状态 |
| 收藏夹权限不足 | 对应收藏夹置灰或失败提示 |
| 网络错误 | 允许重试 |
| 举报入口失败 | 复制网页链接作为 fallback |

## 8. 安全与隐私

- Cookie 和 CSRF 仍只在 Rust 侧使用。
- 插件前端不接触原始 Cookie。
- 不输出敏感请求参数到日志。
- 投币属于不可逆账号操作，必须二次确认或显式面板确认。
- 不做自动三连，不做批量操作。

## 9. 验收标准

- 播放页播放器下方出现网页端风格互动条。
- 点赞/取消点赞状态显示正确，失败能回滚。
- 投币必须通过确认面板，成功后状态和统计更新。
- 收藏弹出收藏夹选择，成功后状态更新。
- 稍后再看可切换，账号内容缓存被清理。
- 分享可复制链接。
- 举报跳网页端或外部打开。
- UP 信息行显示头像、昵称、粉丝/关注状态，关注/取消关注可用。
- 右侧 `更多` Tab 不再承载主要互动按钮，只保留低频辅助操作。
- 不影响 DASH 高清播放、兼容播放、清晰度切换、弹幕、评论和进度同步。

