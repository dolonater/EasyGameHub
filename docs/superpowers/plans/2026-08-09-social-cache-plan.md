# 社交缓存实现计划（好友 / 私聊 / 群聊）

> 创建日期：2026-08-09
> 状态：Stage 2 草案（待用户批准）
> 设计文档：docs/superpowers/specs/2026-08-09-social-cache-design.md（已批准）
> 阶段：S1 缓存内核 → S2 好友+私聊 → S3 群聊 → S4 会话+未读

---

## 计划总览

| 阶段 | 内容 | 验证命令 |
|------|------|----------|
| S1 | `core/social_cache.rs` 纯 Rust 缓存内核（类型/裁剪/恢复/合并/SecureStore 封装 + 单测） | `cargo test social_cache`、`cargo check` |
| S2 | 好友+私聊命令与前端接入（load/refresh、open/refresh_chat、发送写穿+回显关联） | `cargo check`、`cargo test social_cache`、`npm run build` |
| S3 | 群聊命令与前端接入 | `cargo check`、`npm run build` |
| S4 | 线程级未读 + 会话快照 + 前端未读徽标 | `cargo check`、`npm run build` |

**每个任务的落点**都在设计文档 §4/§5/§6 有对应条目。**替换不新增**：现有 `get_friends`/`get_chat_history`/`get_chat_groups`/`get_group_history` 分别被 load+refresh 双命令取代（前端 `SocialPanel.tsx` 是唯一调用方，已确认），不回滚旧命令。

---

## S1 缓存内核

### T1 类型定义 —— `src-tauri/src/core/social_cache.rs`（新文件）

- `DeliveryState` 枚举（`Sent`/`Pending`/`FailedRetryable`）+ `to_dto_str`（→ `"sent"/"pending"/"failedRetryable"`）。
- `CachedMessage`：`local_id: Option<String>`、`timestamp: u64`、`ordinal: u32`、`sender_steam_id: String`、`body: String`、`delivery_state: DeliveryState`。
- 快照：`FriendThreadSnapshot{account,partner,messages,more_available,fetched_at}`、`GroupThreadSnapshot{account,group,chat,messages,more_available,fetched_at,unread_count}`、`FriendsSnapshot{account,friends,fetched_at}`、`GroupsSnapshot{account,groups,fetched_at}`、`ChatSessionsSnapshot{account,sessions,fetched_at}`（S4）。
- `Thread` 提供 `is_sorted()` 断言辅助；全部 `Serialize/Deserialize`，`serde(rename_all="camelCase")`。
- `core/mod.rs` 追加 `pub mod social_cache;`。
- 验证：`cargo check`（工作区）通过，无未用告警。

### T2 裁剪 `bound_thread`（设计 §5.1）

- `fn bound_thread(messages: Vec<CachedMessage>) -> (Vec<CachedMessage>, bool /*more_available*/)`：
  保留最近 500 条 `Sent` + 最近 64 条非 `Sent`（`Sent` 窗口内则都保留）；裁剪发生时 `more_available=true`。
- 对齐 Monica `boundedSteamMessageCache` 语义（先切窗口，再把窗口外非 Sent 追加回来，限 64）。
- 验证：`cargo test social_cache` 新增 3 条用例——501 Sent → 裁到 500 + more；66 非 Sent → 留 64 且 Sent 全裁；≤500 不裁、more=false。

### T3 投递状态恢复 `recover_states`（设计 §5.3）

- `fn recover_friend_states(thread) -> Vec<CachedMessage>`：存储 `Pending` → 返回态 `"verifying"`（内存映射，不落盘）。
- `fn recover_group_states(thread) -> Vec<CachedMessage>`：存储非 `Sent` → `"failedRetryable"`。
- 验证：`cargo test social_cache` 2 条用例——私聊 Pending→verifying、群聊 Pending/Failed→failedRetryable、Sent 原样。

### T4 合并去重 `merge_thread`（设计 §5.2）

- 核心 `fn merge_friend_thread(cached, server_msgs: &[(ts, sender, body)], self_id) -> Vec<CachedMessage>`：
  - 身份键 `(ts, sender, body)`；服务器消息逐条并入（命中跳过），新增为 `Sent`。
  - **自消息对账**：缓存中 `sender==self` 且未获服务器身份（`Pending` 或 `local_id` 仍存的 `Sent`）的消息，在服务器历史中找 `sender==self && body 相同 && |server_ts - local_ts| ≤ 60` 的条目 → 采纳服务器 `(ts,ordinal)`、清 `local_id`、置 `Sent`；未匹配 → 置 `FailedRetryable`。
  - 按 `(timestamp, ordinal)` 升序重排。
- `fn merge_group_thread(...)`：身份键 `(ts, ordinal, sender)`，对账窗口同 60s，其余逻辑共用。
- 验证：`cargo test social_cache` 4 条用例——同身份键去重；乐观 Pending 被历史对账→Sent+清 local_id；60s 外未匹配→FailedRetryable；群聊同秒同 sender 不同 body 靠 ordinal 区分。

### T5 `SocialCache` SecureStore 封装（设计 §3.3）

- `pub fn open(tool_dir: &Path, account_steam_id: u64) -> Result<SocialCache>`：路径 `social_cache_<steamid>.enc.json`（沿用 `auth_store.enc.json` 约定）。
- 方法（同步，可单测）：`load_friends/save_friends`、`load_groups/save_groups`、`load_chat_sessions/save_chat_sessions`、`load_friend_thread/save_friend_thread`、`load_group_thread/save_group_thread`。
  - 缓存键：`friends`/`groups`/`sessions`/`thread|<partner>`/`thread_g|<group>|<chat>`。
  - **归属守卫**：load 校验快照内 account/partner/group/chat 与查询参数一致，不一致或解析失败返回 `None`（视作无缓存，不 panic）。
  - 内部把快照 JSON 序列化后经 `SecureStore::set` 加密落盘；`save` 静默忽略错误（保留旧缓存）。
- 验证：`cargo test social_cache` 4 条用例——roundtrip（写后读一致）；错账号/错 partner 的键返回 None；损坏 JSON → None 不 panic；空快照正常 roundtrip。

### T6 S1 全量验证
- 验证：`cargo test social_cache`（src-tauri）全部通过；`cargo check`（工作区）通过。

---

## S2 好友 + 私聊接入

### T7 命令 `load_friends` / `refresh_friends`（设计 §6.1）

- `commands/steam_social.rs`：
  - `load_friends(state) -> Vec<FriendDto>`：`resolve_session` → 缓存读 `friends` 快照 → `FriendDto` 列表（`friend_dto` 复用）；无缓存返回空。
  - `refresh_friends(state) -> Vec<FriendDto>`：**原 `get_friends` 网络逻辑整体迁入**（GetFriendList + GetUserSummaries）→ 结果写缓存（`FriendsSnapshot{account, friends, fetched_at=now}`）→ 返回。网络失败 `Err`，**不覆盖**缓存。
  - 删除旧 `get_friends`，`lib.rs` 注册表中 `get_friends` → `load_friends` + `refresh_friends`。
- 验证：`cargo check` 通过；`lib.rs` 无悬空引用。

### T8 命令 `open_chat` / `refresh_chat`（设计 §6.1）

- `ChatThreadDto { messages: Vec<ChatMessageDto>, moreAvailable: bool }`（`messages` 带 `deliveryState`）。
- `open_chat(state, partner) -> ChatThreadDto`：缓存读 `thread|<partner>` → `recover_friend_states` 映射（Pending→verifying）→ 返回；无缓存返回空线程。
- `refresh_chat(state, partner) -> ChatThreadDto`：网络 `get_recent_messages` → `merge_friend_thread`（缓存 + 服务器）→ `bound_thread` → 保存 → `recover_friend_states` → 返回。
- 删除旧 `get_chat_history`；`lib.rs` 注册替换。
- 验证：`cargo check` 通过。

### T9 发送写穿 + 回显关联（设计 §5.4）

- `core/social_cache.rs` 新增 `fn correlate_friend_echo(cache, partner, body, server_ts, ordinal) -> bool`：按 FIFO 找该伙伴首个 `body` 相同的 `Pending` → 采纳服务器身份 + `Sent`，返回 true。
- `send_chat_message` 改返回 `ChatMessageDto`：发送成功 → 缓存写 `Pending`（`local_id` 用新 UUID，`timestamp=now`）→ 返回该消息 DTO（state=pending）；失败 → 缓存写 `FailedRetryable` → 返回 `Err`。
- `poll_chat(state, active_partner: Option<String>)`：取 `take_messages()` 后**先写穿再过滤**——`local_echo=true` → `correlate_friend_echo`；否则 append 缓存（Sent，服务器身份）+ `bound_thread` + 保存（`active_partner` 参数为 S4 预留，S2 内暂用 `None`）。返回值仍过滤 echo（前端展示契约不变）。
- 验证：`cargo test social_cache` 增 1 条 `correlate_friend_echo` 用例（FIFO + 匹配转 Sent）；`cargo check` 通过。

### T10 前端封装 —— `src/lib/steamSocial.ts`

- `ChatMessageDto` 增 `deliveryState?: "sent" | "pending" | "verifying" | "failedRetryable"`。
- 新类型 `ChatThreadDto { messages: ChatMessageDto[]; moreAvailable: boolean }`。
- 新封装：`loadFriends()`、`refreshFriends()`、`openChat(steamId)`、`refreshChat(steamId)`、`loadGroups()`、`refreshGroups()`（S3 用）、`openGroupChat(g,c)`、`refreshGroupChat(g,c)`（S3 用）；`pollChat(activePartner?: string)`；`sendChatMessage` 返回 `ChatMessageDto`。
- **注意命名冲突**：S4 会话快照 DTO 用 `ChatSessionDto`，不占用 steamCommunity.ts 已有的 `SessionDto`（登录会话）。
- 验证：`npm run build` 通过（tsc）。

### T11 前端 `SocialPanel.tsx` 好友+私聊缓存先行（设计 §6.2）

- 好友列表：挂载 → `loadFriends()` 立即渲染（空则显示 loading）→ `refreshFriends()` 静默替换；refresh 失败保留缓存 + 顶部"离线缓存"陈旧提示（新 i18n 键）。
- 切私聊：`openChat(partner)` 立即渲染缓存 → `refreshChat(partner)` 静默合并替换 → 3s 轮询照旧追加。
- 乐观发送：气泡加 `localId` 与 `deliveryState`；`sendChatMessage` resolve → 气泡转 sent；reject → 转 failedRetryable + 显示重试按钮（点击重发同一 `message`）。
- `dedupKey` 升级为 `timestamp:sender:body`（替换现有弱键）。
- 消息数组 key 改用 `localId ?? dedupKey`。
- 验证：`npm run build` 通过；手测（见 §验证）离线/重试两场景。

### T12 i18n —— `src/i18n/zh.ts` / `en.ts`

- 键：`socialCacheStale`（离线缓存提示）、`socialRetry`（重试）、`socialSending`（发送中）、`socialSent`/`socialFailed`（气泡状态，可空）。
- 验证：`npm run build` 通过（tsc 无缺键）。

### T13 S2 验证
- 验证：`cargo test social_cache`、`cargo check`（工作区）、`npm run build` 全绿。

---

## S3 群聊接入

### T14 命令 `load_groups` / `refresh_groups`

- `load_groups(state) -> Vec<ChatGroupDto>`：缓存读 `groups` 快照。
- `refresh_groups(state) -> Vec<ChatGroupDto>`：原 `get_chat_groups` 网络逻辑（`parse_chat_groups`）+ 写缓存。
- 删除旧 `get_chat_groups`，`lib.rs` 注册替换。
- 验证：`cargo check` 通过。

### T15 命令 `open_group_chat` / `refresh_group_chat`

- `GroupThreadDto { messages: Vec<GroupMessageDto>, moreAvailable: bool }`。
- `open_group_chat(state, group_id, chat_id)`：缓存读 `thread_g|<group>|<chat>` → `recover_group_states`（非 Sent→failedRetryable）→ 返回。
- `refresh_group_chat(...)`：CM `GetMessageHistory` → `merge_group_thread` → `bound_thread` → 保存 → `recover_group_states` → 返回。
- 删除旧 `get_group_history`，`lib.rs` 注册替换。
- 验证：`cargo check` 通过。

### T16 群发送写穿

- `send_group_message` 改返回 `GroupMessageDto`：成功 → 缓存写 `Sent`（本地 `(ts, ordinal=0)`；对账由 `refresh_group_chat` 收敛为服务器身份）→ 返回；失败 → 写 `FailedRetryable` → `Err`。
- `poll_group_messages(state, active_group: Option<(String,String)>)`：`take_group_messages()` 后写穿 append（Sent）+ `bound_thread` + 保存（`active_group` 为 S4 预留）；返回值仍过滤自己（前端展示契约不变）。
- 验证：`cargo check` 通过。

### T17 前端群聊缓存先行 + dedupKey

- `SocialPanel.tsx`：群列表挂载 `loadGroups` → `refreshGroups`；切群 `openGroupChat` → `refreshGroupChat`；群气泡状态/重试同私聊；`groupDedupKey` 升级为 `timestamp:ordinal:sender`。
- `steamSocial.ts`：`GroupMessageDto` 增 `deliveryState`，`GroupThreadDto`、`openGroupChat`/`refreshGroupChat`/`pollGroupMessages(activeGroup?)` 封装。
- 验证：`npm run build` 通过。

### T18 S3 验证
- 验证：`cargo check`（工作区）、`npm run build` 全绿。

---

## S4 会话快照 + 未读

### T19 线程级未读（设计 §5.5 / §6.2）

- `FriendThreadSnapshot`/`GroupThreadSnapshot` 增 `unread_count: u32`（`#[serde(default)]` 兼容旧缓存）。
- `poll_chat(state, active_partner: Option<String>)`：写穿时，若 `Some(partner) == 该消息 partner` → 不增；否则该线程 `unread_count += 1`。`open_chat(partner)` 返回前清零该线程未读。
- `poll_group_messages(state, active_group: Option<(String,String)>)` 同；`open_group_chat` 清零。
- `core` 增 `fn bump_unread(thread) -> thread` 纯函数，可单测。
- 验证：`cargo test social_cache` 1 条用例（bump 与清零）；`cargo check` 通过。

### T20 命令 `load_sessions` / `refresh_sessions`

- `ChatSessionDto { partnerSteamId: string, lastMessage: string, lastTimestamp: number, unreadCount: number }`。
- `load_sessions(state) -> Vec<ChatSessionDto>`：读 `sessions` 快照。
- `refresh_sessions(state) -> Vec<ChatSessionDto>`：由 `friends` 快照 + 各 `thread|<partner>` 派生（末条消息预览 + 该线程 `unread_count` + 末条时间）→ 写缓存 → 返回。
- `lib.rs` 注册 2 命令。
- 验证：`cargo check` 通过。

### T21 前端会话列表增强（未读徽标 + 预览）

- `SocialPanel.tsx` 好友行：加载 `loadSessions` → `refreshSessions`，显示未读徽标（红点/数字，沿用现有样式）+ 末条消息预览（替换/并列现有"游戏中"行，取 `lastMessage`）。
- 群列表行同样叠加群未读（来自群线程快照）。
- `steamSocial.ts` 封装 `loadSessions`/`refreshSessions` + `ChatSessionDto`。
- 验证：`npm run build` 通过；手测未读随"进入会话清零"。

### T22 S4 验证 + 手测清单（设计 §8）
- 验证：`cargo test social_cache`、`cargo check`（工作区）、`npm run build` 全绿。
- 手测（`npm run tauri dev` 真实账号）：
  1. 离线（断网）打开面板/切会话 → 缓存秒开 + 陈旧提示。
  2. 关闭 app 后收到消息 → 重开 → 打开该会话，离线消息合并补回（≤50 条窗口）。
  3. 发送成功 → 气泡转 sent；断网发送 → failedRetryable → 恢复后重试成功。
  4. 多账号切换 → 各账号缓存文件隔离，无串号。
  5. 收到非当前会话消息 → 好友/群行未读徽标 +1 → 进入会话清零。

---

## 风险与回退（同设计 §9）

| 风险 | 应对 |
|------|------|
| 并发命令读写同一缓存文件 | 命令层静态 `SOCIAL_CACHE_LOCK: OnceLock<tokio::sync::Mutex<()>>`（对齐 `connect_lock` 模式）串行缓存读-改-写 |
| 回显/历史对账误判 | FIFO + 60s 窗口；以服务器历史为准，对账后缓存被覆盖 |
| SecureStore 全量重写 | 账号级文件 < 1MB 可接受；S4 后若量大再拆键 |
| 未读依赖 poll 在线到达 | 关闭期间离线消息不计未读（历史拉取补齐），文档标注局限 |

---

## 不做的事（设计 §10）

- 不做后台发送队列/多 worker；缓存即 outbox。
- 不做 `more_available` 的"更早历史"分页拉取 UI。
- 不改 CM 连接模型；不改图片上传/贴纸路径。
