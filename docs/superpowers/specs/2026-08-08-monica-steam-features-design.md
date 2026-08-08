# Monica Steam 参考功能增强设计文档（A–E）

> 创建日期：2026-08-08
> 状态：Stage 1 草案（待用户批准）
> 参考来源：[Monica Steam](D:\apps\appss\ws\ets2\Monica-Steam)（GPL-3.0 Android 客户端）——**仅参考功能概念与 Steam 协议，不复制其代码**，协议层用 Rust 独立实现

---

## 1. 背景与目标

EasyGameHub（Tauri v2 桌面端）已具备 Steam 基础能力：QR/账号密码+守卫码登录、会话管理、Steam Guard TOTP（含 maFile 导入与验证器 enroll）、多账号切换、新闻、愿望单、价格曲线/阈值/降价事件、库存、云存档、下载管理器。

本设计参考 Monica Steam 的能力清单，为 EasyGameHub 补齐五大块：

| 编号 | 功能 | 一句话 |
|------|------|--------|
| A | 移动确认 | Steam 交易/登录/守卫确认：列出 + 确认/拒绝 |
| B | Steam Guard 强化 | maFile 导出、登录会话↔令牌绑定、Guard 状态一览 |
| C | 游戏库统计 | 完成度、拥有价值、游玩时长分布热力图 |
| D | 商城增强 | 商店详情页 + 多区价格对比 |
| E | 好友/聊天/通知 | 好友、单聊、群聊、贴纸/图片、语音（探索）、通知页 |

### 关键约束

- **技术栈不可复用**：Monica 是 Android Kotlin/Compose，本工程是 Rust + React。移植的是**协议与交互**，代码全部新写。
- **许可证**：Monica 为 GPL-3.0。参考其协议思路、请求格式没问题（协议本身不受版权保护）；**不逐字拷贝其源码**。移动确认的确认密钥算法与 steamguard-cli 一致（公开协议），按已知规范实现并配 KAT 测试。

---

## 2. 现状盘点（已具备）

| 能力 | 位置 | 备注 |
|------|------|------|
| Steam 登录（QR/密码/守卫码） | `steam-sdk/src/auth/login.rs`、`commands/steam_auth.rs` | access/refresh token 已存会话 |
| 活动会话 | `get_active_session` → `SessionDto{steam_id, access_token, refresh_token}` | 确认功能依赖 |
| Steam Guard TOTP | `steam-sdk/src/crypto/authenticator.rs` | `AuthEntry` 存 `shared_secret`/`serial_number`/`device_id` |
| maFile 导入 | `commands/authenticator.rs::import_mafile` | 已解析 shared_secret |
| 验证器 enroll | `steam-sdk/src/crypto/authenticator_enroll.rs` | — |
| 新闻/愿望单/价格/阈值/降价 | `commands/steam_community.rs` | 价格历史 + `steam_price_drop_events.json` |
| 成就/全球百分比 | `steam-sdk/src/client/achievements.rs`、`get_game_achievements_summary` | — |
| 库存/最近游玩/本地库 | `commands/steam_api.rs` | GetOwnedGames、GetRecentlyPlayedGames |
| 商店查询 | `steam-sdk/src/client/store.rs`（`cc=cn` 固定） | 需扩展多区 |
| 托盘 | `lib.rs` 基础菜单（Show/Quit） | 无系统通知，E3 需加插件 |
| 网络栈 | `ureq`（同步）+ `reqwest`（异步） | 沿用 |

### 关键缺口（本设计要补的）

1. `AuthEntry` **缺 `identity_secret` 与 `steam_id`**——移动确认（A）必须。
2. **无任何移动确认接口**——`mobileconf` 的列表/确认/拒绝全缺。
3. 托盘**无通知能力**——E3 需要 `tauri-plugin-notification` 或应用内通知中心。
4. **无社交接口**——好友/聊天/群聊全缺（E）。
5. 商店**固定单区** `cc=cn`，无详情页（D）。
6. 库统计只有原始时长，无完成度/价值/分布视图（C）。

---

## 3. A 移动确认（Mobile Confirmations）

### 3.1 协议（公开规范，参考 steamguard-cli 语义）

Steam 移动确认走 `steamcommunity.com/mobileconf/`，用会话 access_token + `identity_secret` 派生签名参数：

```
确认密钥：k = base64( HMAC_SHA1( identity_secret_bytes,
                                    "conf" + \0 + time_le8 ) ) + hex( time_le8 )
其中 time 为 unix 秒，time_le8 为 8 字节小端；identity_secret 需 base64 解码
```

- **列表**：`GET /mobileconf/getlist?p=<device_id>&a=<steamid64>&k=<conf_key>&t=<time>&m=android&tag=conf&access_token=<token>`
  另需 cookie `sessionid`。**sessionid 取每账号稳定值**：由 `device_id` 的 SHA-256 派生（确定性、无需新增存储字段），getlist 与 allow/deny 用同一值。
- **确认/拒绝**：`GET /mobileconf/allow|deny?…&cid=<confirmation_id>&ck=<confirmation.key>`；
  `ck` **直接取 getlist 响应里该条确认的 `key` 字段**（不重新派生），主密钥 `k` 仍用 tag `conf` 派生，`t` 同列表请求。
- **时间校正**：用 `AuthEntry.time_offset`（已存在）修正时钟偏移；必要时 `ITwoFactorService/QueryTime` 校准。

### 3.2 数据与存储

- `AuthEntry` 扩展：
  - `steam_id: Option<String>`（maFile 的 `steam_id`）
  - `identity_secret_encrypted: Vec<u8>`（`#[serde(skip)]`，随 `shared_secret` 一并入 `SecureStore`）
  - `revocation_code: Option<String>`（maFile 可选字段，B 的导出用）
- `import_mafile` 解析补 `identity_secret` / `steam_id` / `revocation_code`。
- 老条目（无 identity_secret）在确认界面提示「重新导入该账号 maFile」。

### 3.3 后端模块

- `steam-sdk/src/crypto/mobile_conf.rs`（纯函数）：`generate_confirmation_key`、URL 构造、响应解析。**KAT 测试**：已知 `identity_secret`/`time` → 期望密钥串（对照 steamguard-cli 测试向量）。
- `steam-sdk/src/client/mobile_conf.rs`（同步 ureq）：`get_pending` / `allow` / `deny`，带 access_token + sessionid cookie。
- `commands/steam_guard.rs`（新增）：
  - `get_pending_confirmations() -> Vec<ConfirmationDto>`
  - `respond_confirmation(confirmation_id, key, action: "allow"|"deny") -> Result<()>`
  - 用**活动会话**（`get_active_session`）匹配 `AuthEntry`（`steam_id == session.steam_id`）；无匹配则返回明确错误「该账号未绑定验证器，请导入 maFile」。

### 3.4 DTO 与 UI

```ts
interface PendingConfirmation {
  id: string;             // 确认 ID（cid）
  key: string;            // 确认密钥（ck，取自 getlist 响应的该条 key）
  kind: "trade" | "login" | "guard" | "market" | "other"; // 由 Steam type 数值映射
  description: string;    // Steam 返回的 details 文本（如 "交易报价 #12345" / "来自 xxx 的新登录"）
}
```

> 说明：mobileconf 协议仅返回 `id/key/type/creator_id/creator/details`，**无风险等级与剩余时间字段**。风险色由 `kind` 在前端派生（交易→琥珀、守卫/登录→蓝、市场→紫），不做剩余时间倒计时。

- UI：Authenticator 页新增「待确认」Tab（复用现有 TabButtons），轮询 15s。每条显示类型徽标 + 描述 + 风险色 + 剩余时间 + 「确认 / 拒绝」按钮。空态引导导入 maFile。
- 仅当存在活动会话且匹配 AuthEntry 时启用该 Tab，否则显示绑定引导。

---

## 4. B Steam Guard 强化

| 能力 | 实现 |
|------|------|
| **maFile 导出** | 新命令 `export_mafile(entry_id) -> String`：由 `AuthEntry` 重组 maFile JSON（shared_secret/identity_secret/serial_number/revocation_code/device_id/steam_id/account_name）；前端 `save` 对话框落盘。仅 Steam 类型条目可导出 |
| **会话↔令牌绑定** | 概览页（ProfilePanel）在存在活动会话且匹配 AuthEntry 时，展示当前账号的 5 位 Steam 码 + 倒计时 + 点击复制 |
| **Guard 状态一览** | Authenticator 页 Steam 条目显示状态徽标：已绑定会话 / 设备序列号 / 无 identity_secret 提示 |

- 纯增量：复用 A 的 `AuthEntry` 扩展与 `steam_auth` 会话；无新协议。
- 安全：导出 maFile 内容仅返回到前端内存，不写日志；落盘路径由用户选择。

---

## 5. C 游戏库统计

### 5.1 数据来源与限制

| 指标 | 来源 | 说明 |
|------|------|------|
| 拥有游戏数 / 总时长 / 平均 | `GetOwnedGames`（已用） | — |
| **完成度**（单用户） | `ISteamUserStats/GetPlayerAchievements`（需 API key） | 逐游戏请求，**限速**；无 key 或无数据时回退本机 Steam 客户端完成度（`get_game_achievements_summary` → `achievements_local`，无需 key 但需本机运行 Steam）；两者均不可用 → 标「无数据」。**注意**：项目已无 `GetGlobalAchievementPercentagesForApp`（全球百分比）调用，不设该回退 |
| **拥有价值** | 商店 appdetails 现价（复用现有价格基础） | 汇总为现价总值 |
| **游玩时长分布热力图** | `playtime_forever` | **公开 API 无「按天日历」数据**（仅有累计总时长），热力图改为「游戏×时长」分布网格 + 最近游玩两周条带，诚实标注 |

### 5.2 命令与 UI

- `steam_api.rs` 新增：
  - `get_library_stats() -> LibraryStatsDto{ owned_count, total_minutes, avg_minutes, total_value_cents, value_currency, distribution: [{bucket, minutes}] }`
  - `get_library_completion(limit: Option<u32>) -> Vec<GameCompletionDto{ app_id, name, achieved, total, percent }>`
- Playtime 页顶部统计卡（拥有/总时长/平均/总价值）+ 完成度列表（进度条）+ 时长分布热力图（颜色按小时分级，GitHub 风格网格）。
- 无 API key 时完成度区显示「需配置 Steam Web API Key」引导（设置页已有该项）。

---

## 6. D 商城增强（商店详情 + 多区价格）

### 6.1 商店详情

- `steam-sdk/src/client/store.rs` 扩展 `AppDetail`：
  - 截图数组（`screenshots`）、PC 配置要求（`pc_requirements`）、支持语言、`metacritic`、评价摘要（`recommendations`）
  - DLC 列表（appdetails `dlc: [appid]` → 逐个取详情，限 8 个）
- `commands/steam_community.rs` 新增 `get_store_detail(app_id) -> StoreDetailDto`。

### 6.2 多区价格对比

- 新命令 `get_multi_region_price(app_id) -> Vec<RegionPriceDto{ cc, currency, final_cents, final_formatted, cny_cents }>`：
  - 用 `cc` 参数查 `appdetails`（`cc=cn,us,jp,kr,de,gb,au` 等），一次性并发（复用 steam-sdk 并行模式）。
  - **汇率**：本地静态表（`steam-sdk/src/crypto/fx.rs`，`currency → CNY 系数`，基准 USD，标注为近似值），换算到 CNY 便于同表对比；同时展示各区原始价。
- **已知限制**：部分区（AR/TR/RU 等）价格受 IP 风控，返回缺失/异常则跳过并标注「该区不可用」（与 Monica 同法）。

### 6.3 UI

- 愿望单/搜索结果条目点击 → 商店详情 Dialog：头图、简介、截图、价格对比表（各区行：区徽 + 现价 + 折后价 + ≈CNY）、DLC 列表、配置要求、评价。

---

## 7. E 好友 / 聊天 / 通知（用户确认做完整：含群聊、语音、贴纸/图片）

### 7.1 总体路径：Steam 网页聊天协议（轮询）

不引入 CM（连接管理器）/protobuf 长连接——桌面 WebView 里用 Steam 网页聊天所用的 **`ISteamWebUserPresenceOAuth`** 接口 + 轮询，匹配用户选定的「单聊轮询」方式：

- 会话前置：活动会话 access_token + 持久化 `sessionid` cookie。
- **好友**：`GetFriendList`（列表/关系/状态）+ `ISteamUser/GetPlayerSummaries`（昵称/头像，需 API key，已有）。
- **在线状态**：`PollStatus`（长轮询，返回在线变化与未读）。
- **私聊**：`SendMessage`（发送）+ `PollStatus`（增量拉取新消息）。
- **群聊**：网页群聊接口（`GetChatRoomGroupSummary` / `JoinChatRoom` / `SendChatMessage` 等）。
- **贴纸/图片**：贴纸走消息 JSON 的 `sticker` 字段；图片经社区聊天上传接口（multipart）→ CDN URL → 作为消息发出。
- **语音**：Steam 语音需 CM + WebRTC 中继（V2 语音服务器），WebView 有 WebRTC 但需 CM 信令——**列为探索性 spike**，单独 go/no-go。

> 风险声明：以上均为 Steam 网页/移动**非公开接口**，Steam 调整即可能失效（Monica README 亦如此声明）。全部走轮询 + 前端 `setInterval`，与现有 Steam Hub 轮询模式一致。

### 7.2 后端模块与命令（`steam-sdk/src/client/social.rs` + `commands/steam_social.rs`）

| 命令 | 说明 |
|------|------|
| `get_friends() -> Vec<FriendDto>` | 好友列表 + 在线状态 + 昵称/头像 |
| `get_friend_profile(steam_id)` | 单好友详情（头像大图/昵称/状态） |
| `open_chat(steam_id)` / `poll_chat()` | 拉取单聊增量消息 |
| `send_chat_message(steam_id, text)` | 发送私聊文本 |
| `get_chat_groups()` / `join_chat_group(id)` / `send_group_message(id, text)` | 群聊 |
| `upload_chat_image(path) -> url` | 图片上传（multipart） |
| `send_sticker(...)` | 贴纸消息（后置） |
| `get_notifications() / mark_notifications_read()` | 通知页数据源 |

### 7.3 通知页（E3）

- 数据源聚合（复用既有设施）：
  - 降价事件 → `steam_price_drop_events.json`（已存在）
  - 关注游戏新闻 → Steam Hub news 数据（已存在）
  - 待确认 → A 的确认列表
  - 好友状态 → E1
- 后端：`commands/steam_notifications.rs` 提供 `get_notifications()`（合并 + 排序 + 未读标记），持久化 `steam_notifications.json`（读/未读）。
- 系统通知：新增 `tauri-plugin-notification`（Rust + JS 依赖）→ 托盘/桌面通知（降价、待确认）。**可选**，首版先应用内通知页，系统通知后置。
- 前端：Steam Hub 新「通知」Tab，时间线式列表 + 未读计数徽标（侧边栏/页签）。

### 7.4 E 分阶段

| 子项 | 内容 | 备注 |
|------|------|------|
| E1 | 好友列表/详情/在线状态 + 私聊文本（轮询） | 最优先 |
| E2 | 群聊基础（文字） | 依赖 E1 会话基础 |
| E3 | 通知页（聚合 + 未读） | 依赖 A + 既有 news/drops |
| E4 | 贴纸 / 图片发送 | 后置 |
| E5 | 语音（spike） | **探索性**：评估 CM+WebRTC 可行性后 go/no-go；大概率砍 |

---

## 8. 安全与数据边界

| 项 | 处理 |
|----|------|
| `identity_secret` / `shared_secret` | `SecureStore` 加密存储，不落明文 JSON，不写日志 |
| access/refresh token | 沿用 `steam_auth` 会话存储；确认/聊天请求仅带必要 cookie |
| maFile 导出 | 内容只在内存返回，由用户选路径落盘 |
| 聊天/好友数据 | 仅本地展示，不缓存明文到文件；通知文件只存标题/时间/类型，不存消息正文 |
| 风控提示 | A/E 均属 Steam 非公开能力，有红信/失效风险；UI 与 README 明示 |

---

## 9. 阶段划分与依赖

```
P0  基础：AuthEntry 扩展（identity_secret/steam_id/revocation_code）+ SecureStore + maFile 导入补字段
      ↓（A/B 前置）
P1  A  移动确认（crypto/mobile_conf + client/mobile_conf + steam_guard 命令 + Authenticator「待确认」Tab）
P2  B  Guard 强化（export_mafile + 会话绑定概览展示 + 状态徽标）
P3  C  库统计（library_stats / library_completion + Playtime 统计卡/热力图/完成度）
P4  D  商店详情 + 多区价格（store.rs 扩展 + fx.rs + steam_community 命令 + 商店详情 Dialog）
P5  E1 好友 + 私聊轮询（social.rs + steam_social 命令 + Steam Hub 社交 Tab）
P6  E2 群聊（文字）
P7  E3 通知页（steam_notifications + 通知 Tab + 可选系统通知）
P8  E4 贴纸/图片
P9  E5 语音 spike（go/no-go，大概率砍）
```

依赖：P0→P1→P2；P3/P4 独立可并行；E 依赖 P0（会话）但独立于 A/B 其余部分；E3 依赖 A 的确认列表与既有 news/drops。**每阶段一个门禁，独立验收。**

---

## 10. 验证方式

- **Rust**：纯函数 KAT（确认密钥、maFile roundtrip、FX 表）、`cargo test`、`cargo check`。
- **前端**：`npm run build`（tsc + vite + sdk）。
- **集成**：`npm run tauri dev` 真实 Steam 账号手测——每阶段冒烟清单：A（真实待确认列表/确认/拒绝）、C（统计卡数据）、D（详情/多区价格）、E（好友/收发消息/群聊/通知）。
- 网络接口不可控部分（mobileconf、聊天）以「手动验收 + 接口异常兜底文案」为准。

---

## 11. 风险与回退

| 风险 | 应对 |
|------|------|
| GPL-3.0 传染 | 参考协议、不复制代码；确认密钥 KAT 向量来自公开规范（steamguard-cli 测试向量属协议验证） |
| Steam 非公开接口变动（mobileconf/聊天） | 接口层隔离在 `client/`，失效只影响对应功能；UI 兜底文案 + 事件日志 |
| 语音需 CM+WebRTC | E5 单独 spike，评估后 go/no-go |
| 多区价格部分区 IP 风控 | 该区标注「不可用」并跳过，不禁用整功能 |
| Web API 限速（完成度逐游戏） | 默认限前 50 个游戏 + 节流；无 key 回退全球百分比 |
| 通知文件明文 | 只存非敏感元数据（标题/时间/类型） |
