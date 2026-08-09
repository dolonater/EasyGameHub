# 社交缓存设计文档（好友 / 私聊 / 群聊）

> 创建日期：2026-08-09
> 状态：Stage 1 草案（待用户批准）
> 参考来源：[Monica Steam](D:\apps\appss\ws\ets2\Monica-Steam)（GPL-3.0 Android 客户端）——**仅参考缓存架构概念，不复制其代码**，在 Rust + React 架构下独立实现
> 前置：已完成 A–E 的 E1（好友+私聊）、E2（群聊）、E4（贴纸/图片）；本设计为 E1/E2 的缓存增强

---

## 1. 背景与目标

当前 EasyGameHub 的社交模块（`steam_social.rs` + `SocialPanel.tsx`）能收发消息、看历史，但**无任何缓存**：

| 现状 | 问题 |
|------|------|
| 好友列表：面板挂载时全量拉 `GetFriendList` + `GetUserSummaries` | 每次进面板空转网络 ~0.5–1s；离线/接口波动时列表空白 |
| 私聊历史：每次选中好友拉最近 50 条（Web API） | 反复切换会话重复请求；app 关闭期间的离线消息拉不回来（CM 不重放历史） |
| 群聊历史：每次选中群拉 `GetMessageHistory`（CM） | 同上 |
| 实时消息：CM 缓冲每 3s 轮询，仅追加内存 | app 重启即丢；轮询间隙的离线消息无从补拉 |
| 发送：`SendMessage` fire-and-forget | 失败只弹 toast，无重试；重启后"以为发了但没到"的消息无法恢复 |
| 无会话列表 / 未读计数 | 好友列表即导航，无"最近会话 + 未读徽标" |

本设计参考 Monica 的缓存分层（`SteamFriendsCache` / `SteamChatCache` / `SteamGroupChatCache` + `SteamMessageCachePolicy`），为 EasyGameHub 补齐社交缓存，达成：

1. **秒开**：进面板 / 切换会话立即渲染本地缓存，网络刷新在后台静默进行
2. **离线可读**：无网络时历史照常展示，接口失败回退缓存 + 陈旧标记
3. **消息不丢**：CM 实时消息落盘；app 关闭期间到达的消息在下次打开时与服务器历史合并补回
4. **发送可靠**：消息带投递状态（pending/sent/failed），失败可重试，重启后状态恢复
5. **体积有界**：线程缓存裁剪（保留最近 N 条已确认 + 未确认必留），`moreAvailable` 指示可加载更早历史
6. **加密存储**：聊天内容属敏感数据，复用已加固的 `SecureStore`（DPAPI 保护的 AES-256-GCM），不回退到明文 JSON

> 与 2026-08-08 A–E 设计文档 §8 的关系：原设计写"聊天/好友数据仅本地展示，不缓存明文到文件"。本设计**升级该决策**——新增缓存，但改为**加密**落盘（SecureStore），而非明文。安全姿态不变（不落明文），功能上允许持久化。

---

## 2. 现状盘点（已具备）

| 能力 | 位置 | 说明 |
|------|------|------|
| CM 实时连接（单账号单 socket） | `steam-sdk/src/cm/client.rs` | `ensure_cm` 复用 + 断线缓冲迁移（`connect_with_seed`）|
| 私聊实时消息 | `cm/client.rs::IncomingChat` | 含 `timestamp(u32)` / `ordinal(u32)` / `local_echo`；缓冲在 Rust，3s 轮询取走 |
| 群聊实时消息 | `cm/client.rs::GroupIncoming` | 含 `group_id` / `chat_id` / `sender_steamid64` / `timestamp` / `ordinal` |
| 私聊历史 | `social.rs::get_recent_messages`（Web API，50 条） | 无 ordinal，身份键 = `(timestamp, sender, body)` |
| 群聊历史 | CM `ChatRoom.GetMessageHistory`（50 条） | 含 `(timestamp, ordinal, sender)` |
| 好友列表 | `social.rs::get_friend_list` + `get_user_summaries`（OAuth Web API） | 有关系过滤 + persona 摘要 |
| 群列表 | CM `ChatRoom.GetMyChatRoomGroups` | 解析在 `parse_chat_groups` |
| 加密存储 | `steam-sdk/src/crypto/secure_store.rs` | **已加固**：DPAPI 主密钥 + AES-256-GCM，`auth_store.enc.json` 已用同款 |
| 发送 | `client.send_message` / `send_group_message`（CM service method） | 同步 fire-and-forget |

### 关键缺口（本设计要补的）

1. **无任何持久化**——好友/线程/群快照、未确认消息全部只在内存。
2. **无投递状态模型**——消息只有"服务器来的"和"我乐观追加的"两种，失败无状态可重试。
3. **合并身份键弱**——前端 `dedupKey = timestamp:steamId:message`，同秒同人同文本会误判；无 ordinal/本地 id 关联乐观消息与回显。
4. **无会话快照/未读**——没有"最近会话 + 未读徽标"数据。
5. **无裁剪策略**——一旦缓存存在，需防止无限增长。

---

## 3. 总体设计

### 3.1 缓存位置：Rust 侧 `core/social_cache.rs`（决策）

**决策：缓存落在 Rust `src-tauri/src/core/`（纯逻辑，无 Tauri 依赖），持久化用 per-account `SecureStore`。**

理由：
- 本工程持久化全部由 Rust 拥有（config/games_index/sessions/auth_store），前端不直接落盘——保持一致。
- CM 实时消息天然流经 Rust，缓存写入与消息接收同处一地，无需把事件重新转发给前端再写回。
- 聊天内容敏感 → 加密必须；`SecureStore` 已加固（DPAPI），现成可复用。
- `core/` 无 Tauri 依赖 → 边界/合并/状态恢复算法可 `cargo test` 独立验证（沿用现有 core 分层约定）。

> 备选（前端 localStorage）被否：无法加密（或需 WebCrypto 引入新依赖）、CM 事件要转发、离线补拉逻辑仍归 Rust，只是把持久化从 Rust 挪到 webview，徒增两套真相。

### 3.2 缓存-先行（cache-first）双阶段模型（决策）

**决策：每个实体暴露"快读（cache）+ 慢刷新（network→merge→save）"两个命令，前端先渲染快读结果、再静默应用刷新结果。** 对应 Monica 的 `load*` / `fetch*` 拆分。

```
打开面板/切会话：
  load_*()   → 读加密缓存，立即渲染（含 fromCache 标记）
  refresh_*()→ 网络拉取 → 与缓存合并去重 → 写回缓存 → 返回合并结果
               前端用合并结果替换内存态；失败则保留缓存 + 陈旧标记
```

网络失败时缓存兜底（离线可读）；成功时缓存被刷新。

### 3.3 存储布局（决策）

每账号一个 `SecureStore` 文件：`tool_dir/social_cache_<steamid>.enc.json`（沿用 `auth_store.enc.json` 约定）。

| 缓存键（SecureStore 内部 key，经 SHA-256） | 内容 | 刷新频率 |
|------|------|------|
| `friends` | 好友快照（列表 + persona + fetchedAt） | 面板打开 / 30s 陈旧 |
| `sessions` | 会话快照（最近会话 + 末条消息 + 未读数）[P2] | 随线程/好友更新 |
| `thread|<partner>` | 私聊线程（消息 + deliveryState + moreAvailable） | 打开时 / 实时 |
| `groups` | 群列表快照 + fetchedAt | 面板打开 / 30s 陈旧 |
| `thread_g|<group>|<chat>` | 群线程（消息 + deliveryState + moreAvailable） | 打开时 / 实时 |

键统一 SHA-256 哈希（沿用 `SecureStore::set` 内部已对 key 哈希，此处仅逻辑分组前缀）。**归属校验**：快照携带 `accountSteamId`/`partnerSteamId`/`groupId`+`chatId`，load 时校验一致，防多账号/错配串号（对齐 Monica）。

### 3.4 安全边界

- 所有快照内容经 `SecureStore` AES-256-GCM 加密，DPAPI 主密钥绑定 Windows 用户。
- 空密钥（未知货币/首次初始化）不落盘；写失败静默保留旧缓存。
- 缓存文件损坏/解密失败 → 返回 `None` 视作无缓存，不 panic、不阻塞网络刷新。

---

## 4. 数据模型（`core/social_cache.rs`）

```rust
// 投递状态：一条消息在本地的生命周期
enum DeliveryState {
    Sent,            // 服务器已确认（来自历史 或 收到 local_echo）
    Pending,         // 乐观追加 / 在途，尚未确认
    FailedRetryable, // 发送失败，可重试
}

// 线程内一条消息的规范身份：
//  私聊服务器消息：(timestamp, sender, body)   —— Web API 历史无 ordinal
//  群聊服务器消息：(timestamp, ordinal, sender) —— CM 历史/实时有 ordinal
//  本地乐观消息：  localId（uuid）直到被回显/历史关联
struct CachedMessage {
    local_id: Option<String>,   // 仅本地乐观消息有；被关联后置空
    timestamp: u64,             // 秒；乐观消息为发送时本地秒
    ordinal: u32,               // 群聊用；私聊恒 0
    sender_steam_id: String,    // 自己=本地账号
    body: String,
    delivery_state: DeliveryState,
}

struct FriendThreadSnapshot {
    account_steam_id: String,
    partner_steam_id: String,
    messages: Vec<CachedMessage>,   // 已按 (timestamp, ordinal) 升序
    more_available: bool,           // 裁剪过 或 服务器还有更早历史
    fetched_at: u64,
}
// GroupThreadSnapshot 同构：groupId + chatId 替换 partner。
struct FriendsSnapshot {
    account_steam_id: String,
    friends: Vec<FriendCacheEntry>, // steam_id + persona 摘要 + online_state + last_logoff
    fetched_at: u64,
}
struct GroupsSnapshot {
    account_steam_id: String,
    groups: Vec<GroupCacheEntry>,   // 对齐 ChatGroupDto + rooms
    fetched_at: u64,
}
struct SessionsSnapshot {           // [P2]
    account_steam_id: String,
    sessions: Vec<SessionEntry>,    // partner + last_message + last_ts + unread_count
    fetched_at: u64,
}
```

**所有权守卫**：所有 `load_*` 校验快照内账号/对方 ID 与查询参数一致，不一致视为损坏返回 `None`。

---

## 5. 核心算法

### 5.1 裁剪策略 `bound_thread`（对齐 Monica `boundedSteamMessageCache`）

```text
保留：最近 500 条 Sent
  + 最近 64 条非 Sent（Pending / FailedRetryable —— 未确认消息一条不能丢）
裁剪后 若 原条数 > 保留条数 → more_available = true
```

保存与加载**两端都套**：防旧版本/异常写入的无界缓存；加载时裁剪恢复的线程，保证文件体积有上界。

### 5.2 合并去重 `merge_thread(cached, server)`

- **身份键**：私聊 `(timestamp, sender, body)`；群聊 `(timestamp, ordinal, sender)`。
- 服务器消息逐条并入缓存（按身份键去重，`timestamp+ordinal` 升序重排）。
- **乐观消息对账**（重启恢复核心）：
  - 缓存中 `Pending` 消息若在服务器历史里找到同 `(sender=self, body)` 且 `|server_ts - local_ts| ≤ 60s` 的条目 → 关联：采纳服务器 `(timestamp, ordinal)`，置 `Sent`，清 `local_id`。
  - 未找到 → 私聊置 `FailedRetryable`（用户可重试），群聊同（对齐 Monica：过期未确认→FAILED_RETRYABLE）。
- 合并结果写回缓存。

### 5.3 加载时的投递状态恢复（对齐 Monica）

| 快照类型 | 加载时对非 `Sent` 的处理 |
|------|------|
| 私聊线程 | `Pending` → `Verifying`（重启后无法确知是否已送达，待对账；5.2 会裁决） |
| 群聊线程 | `Pending/Verifying/Failed` → `FailedRetryable` |

`Sent` 是可信终态，原样保留。

### 5.4 发送与回显关联

- `send_chat_message` 成功 → 以 `(本地秒, body, self)` 写入缓存 `Pending`；CM 回显（`local_echo=true`）到达后，在 `poll_chat` 路径扫描缓存里匹配的 `Pending`（FIFO：同 body 取最早）→ 采纳服务器 `(timestamp, ordinal)` + `Sent` + 持久化。
- 发送失败 → 命令返回 Err；前端将该乐观气泡标 `FailedRetryable` 并可点重试（重发 = 再调 `send_chat_message`）。
- **无后台 worker**：缓存即 outbox（Monica 同思路——outbox 复用线程快照的非 Sent 消息），对账在 `refresh_chat` 与 `poll_chat` 路径内联完成，契合现有轮询模型。

### 5.5 实时写穿

`poll_chat` / `poll_group_messages` 取走 CM 缓冲后，**同时**把消息 append 进对应线程缓存（Sent，服务器身份）并保存——确保轮询间隙到达、随后 app 被关闭的消息不丢。前端仍照旧追加展示（保留 delta 模型，不重建）。

---

## 6. 命令与前端流程（`commands/steam_social.rs`）

### 6.1 命令清单

| 命令 | 快读 | 慢刷新 | 备注 |
|------|------|--------|------|
| `load_friends` / `refresh_friends` | 读缓存 | 网络 + 保存 | 30s 陈旧才刷新可作前端节流 |
| `load_groups` / `refresh_groups` | 读缓存 | CM + 保存 | 同 |
| `open_chat(partner)` | 读私聊线程缓存 + 清零未读 | — | 切会话时的秒开入口 |
| `refresh_chat(partner)` | — | 历史 + `merge_thread` + 保存 | 返回合并结果 |
| `open_group_chat(g,c)` / `refresh_group_chat(g,c)` | 同上 | 同上（群） | — |
| `send_chat_message(partner,text)` / `send_group_message` | — | 发送 + 写 `Pending`/`FailedRetryable` | 返回本地消息（含 deliveryState）|
| `load_sessions` / `refresh_sessions` | 读会话快照 | 派生 + 保存 | [P2] |

> DTO 沿用现有 `ChatMessageDto`/`GroupMessageDto`/`FriendDto`，扩展 `deliveryState: "sent"|"pending"|"failedRetryable"` 与 `moreAvailable` 字段（camelCase）。

### 6.2 前端（`SocialPanel.tsx`）流程

- **好友列表**：挂载 → `load_friends()` 立即渲染（缓存/空态）→ `refresh_friends()` 静默替换 + 失败保留缓存标陈旧。
- **切私聊**：`open_chat(partner)` 立即渲染缓存 → `refresh_chat(partner)` 静默合并替换 → 3s 轮询照旧追加。
- **切群聊**：同私聊（`open_group_chat` / `refresh_group_chat`）。
- **发送**：乐观气泡带状态（pending/sent/failedRetryable + 重试按钮）；失败不丢，可点重试。
- **dedupKey 升级**：私聊 `timestamp:sender:body`，群聊 `timestamp:ordinal:sender`（替换现有弱键）。
- **离线场景**：网络失败 → 缓存历史照常展示 + 顶部"离线缓存"陈旧提示。

---

## 7. 阶段划分（每阶段一闸，独立验收）

| 阶段 | 内容 | 依赖 |
|------|------|------|
| **S1 缓存内核** | `core/social_cache.rs`：快照类型、`bound_thread`、`merge_thread`、投递状态恢复、SecureStore 封装 + Rust 单测 | 无（仅复用 SecureStore）|
| **S2 好友+私聊接入** | `load/refresh_friends`、`open/refresh_chat`、发送写穿与回显关联；前端好友列表/私聊缓存先行 + 气泡状态/重试 | S1 |
| **S3 群聊接入** | `load/refresh_groups`、`open/refresh_group_chat`；前端群聊缓存先行 | S1 |
| **S4 会话快照 + 未读** | `load/refresh_sessions`、未读计数与清零、会话列表 UI（最近会话 + 未读徽标） | S2/S3 |

> S1 纯 Rust 可独立测试；S2/S3 可并行或顺序；S4 为增强（现有好友列表即导航，未读属可选体验提升），可砍。

---

## 8. 验证方式

- **Rust**（`cargo test -p src-tauri` / `cargo test`）：
  - `bound_thread`：501 条 Sent → 裁到 500 + moreAvailable；66 条非 Sent → 留 64 且 Sent 全部裁剪；≤500 不裁。
  - `merge_thread`：同身份键去重；乐观 Pending 被历史对账 → Sent；60s 外不匹配 → FailedRetryable；`(timestamp,ordinal)` 重排。
  - 投递状态恢复：私聊 Pending→Verifying，群聊 Pending→FailedRetryable。
  - 归属守卫：错账号/错对方 ID 的缓存返回 None。
  - SecureStore roundtrip + 损坏文件 → None 不 panic。
- **前端**：`npm run build`（tsc + vite）。
- **集成手测**（`npm run tauri dev` 真实账号）：
  - 离线（断网）打开面板/切会话 → 缓存历史秒开 + 陈旧提示。
  - 关闭 app 后收到消息 → 重开 → 打开该会话，离线消息合并补回。
  - 发送成功 → 气泡转 sent；断网发送 → failedRetryable → 恢复后点重试成功。
  - 多账号切换 → 各账号缓存隔离，无串号。

---

## 9. 风险与回退

| 风险 | 应对 |
|------|------|
| 回显/历史关联误判（同秒同人同文本） | FIFO 取最早匹配 + 60s 窗口；极端情况以服务器历史为准（对账后缓存被覆盖）|
| SecureStore 每次写全量重写文件 | 线程级缓存单条 ≤ 100KB 级，账号级文件 < 1MB，桌面端可接受；极端量大可后置拆键优化（不进本期）|
| 缓存与前端内存态发散 | 对账点（refresh_*）前端以合并结果替换内存态，发散有界 |
| 原设计"不缓存明文"被升级为"加密缓存" | 文档明确记录决策变更；加密仍经 DPAPI，安全姿态不降 |
| Steam 接口/CM 变动 | 缓存层与网络层隔离（`core/` 纯算法 + `commands/` 网络），失效只影响刷新，缓存仍可读 |
| 未读数/会话列表属增强 | S4 独立闸，可砍不影响 S1–S3 |

---

## 10. 不做的事（本期范围外）

- 不做消息发送后台队列/多 worker 重试（缓存即 outbox，对账内联）。
- 不做服务器端"更早历史"分页拉取 UI（`more_available` 只做标记，分页拉取为后续）。
- 不改 CM 连接模型（`ensure_cm`/轮询保持不变，仅补写穿）。
- 不迁移历史遗留旧缓存格式（首次版本，无兼容包袱）。
