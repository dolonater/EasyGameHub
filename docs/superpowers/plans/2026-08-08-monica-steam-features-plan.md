# Monica Steam 参考功能增强实施计划（A–E）

> 创建日期：2026-08-08
> 依赖设计：`docs/superpowers/specs/2026-08-08-monica-steam-features-design.md`
> 阶段门禁：每阶段结束需用户批准后再进入下一阶段；每任务后跑对应验证命令。

验证命令速查（均在 `doona-gamesave-backup/` 根或 `src-tauri/`）：
- Rust 纯函数单测：`cd src-tauri && cargo test <module>`
- Rust 全量检查：`cd src-tauri && cargo check`
- 前端：`npm run build`（tsc + vite + sdk）

---

## P0 基础（AuthEntry 扩展）

**T1** `steam-sdk/src/crypto/authenticator.rs`：`AuthEntry` 增字段 `steam_id: Option<String>`、`identity_secret_encrypted: Vec<u8>`（`#[serde(skip)]`）、`revocation_code: Option<String>`；`import_mafile` 解析补 `identity_secret`/`steam_id`/`revocation_code`（base64 解码 identity_secret，缺字段仍可用——identity_secret 缺失时确认功能提示重导）。
- `commands/authenticator.rs` 的 maFile 导入 DTO 同步新增字段（可选返回）。
- 测试：新增 maFile 解析用例（含 identity_secret/steam_id）、老 JSON 反序列化兼容用例。
- verify：`cargo test authenticator`

**T2** `steam-sdk/src/crypto/mobile_conf.rs`（新）：`generate_confirmation_key(identity_secret: &[u8], tag: &str, time: u64) -> String`（HMAC-SHA1，tag+`\0`+time_le8，base64(hash)+hex(time_le8)）；`build_getlist_url` / `build_action_url(allow|deny)` 纯函数。
- **KAT 测试**：固定 identity_secret/time/tag → 期望密钥串（对照 steamguard-cli 已知向量）；URL 参数含 p/a/k/t/m/tag。
- 依赖：steam-sdk 已有 HMAC-SHA1（totp 模块复用或引 `hmac`+`sha1` crate，以现有 totp 实现为准）。
- verify：`cargo test mobile_conf`

**T3** `steam-sdk/src/client/mobile_conf.rs`（新，同步 ureq）：`get_pending(access_token, session_id, identity_secret, device_id, steam_id, time_offset) -> Vec<RawConfirmation>`；`respond(access_token, session_id, identity_secret, device_id, steam_id, time_offset, confirmation_id, key, action) -> Result<()>`。错误含 403/会话失效映射。
- verify：`cargo check`（网络层无单测，靠 T4 命令层 + 手测）

---

## P1 A 移动确认

**T4** `src-tauri/src/commands/steam_guard.rs`（新）：`get_pending_confirmations()` 用 `get_active_session` 匹配 AuthEntry（`steam_id == session.steam_id`），无匹配返回明确错误；`respond_confirmation(confirmation_id, key, action)`。`lib.rs` 注册两个命令。
- verify：`cargo check`

**T5** `src/lib/steamCommunity.ts` 增 `PendingConfirmation` 类型；新增 `src/lib/steamGuard.ts` 封装 `get_pending_confirmations` / `respond_confirmation`。
- verify：`npm run build`

**T6** `src/pages/steam/Authenticator.tsx`：新增「待确认」Tab（复用 TabButtons）。逻辑：存在活动会话且匹配 AuthEntry 时启用，轮询 15s；列表项含类型徽标（交易/登录/守卫/市场，`kind` 由 Steam type 映射）、描述（details）、按类型派生的风险色、确认/拒绝按钮；无匹配显示绑定引导（去导入 maFile）；空态文案。**不做**剩余时间倒计时（协议无该字段）。
- verify：`npm run build`

**T7** `src/i18n/zh.ts`/`en.ts`：确认 Tab 全部文案键（待确认/确认/拒绝/交易/登录/守卫/风险/剩余时间/未绑定引导/会话失效）。
- verify：`npm run build`

**T8** 手测冒烟（真实账号）：登录 → 导入该账号 maFile → 产生一笔待确认 → 列表/确认/拒绝；会话失效提示。
- 验收：用户 `npm run tauri dev` 确认

---

## P2 B Guard 强化

**T9** `commands/steam_guard.rs` 增 `export_mafile(entry_id) -> String`：由 AuthEntry 重组 maFile JSON（仅 Steam 类型）；前端 Authenticator 条目加「导出 maFile」按钮（`save` 对话框落盘）。
- verify：`cargo check` + `npm run build`

**T10** `src/components/steam/ProfilePanel.tsx`：存在活动会话且匹配 AuthEntry 时，概览显示当前账号 5 位码 + 倒计时 + 点击复制（复用 totp 计时逻辑）。
- verify：`npm run build`

**T11** Authenticator Steam 条目状态徽标（已绑定会话/序列号/缺 identity_secret 提示）+ i18n 键。
- verify：`npm run build`；手测一次会话绑定展示

---

## P3 C 游戏库统计

**T12** `commands/steam_api.rs` 增 `get_library_stats()`：`GetOwnedGames` → 拥有数/总时长/平均；复用现有价格基础算拥有价值（`get_steam_prices` 或 store appdetails，限前 100 游戏）；分布：把 playtime 映射到小时分桶。返回 `LibraryStatsDto`。
- verify：`cargo check`；`npm run build`（类型）

**T13** `commands/steam_api.rs` 增 `get_library_completion(limit: Option<u32>)`：优先 `GetPlayerAchievements`（需 `steam_api_key`，限前 50、串行节流）；无 key 或无成就数据 → 回退 `get_game_achievements_summary`（**本机 Steam 客户端完成度**，经 `achievements_local`，无需 key 但需本机运行 Steam）；两者均不可用 → 该游戏标「无数据」。**不做**全球百分比回退（项目无 `GetGlobalAchievementPercentagesForApp` 调用）。返回 `Vec<GameCompletionDto>`。
- verify：`cargo check`

**T14** `src/pages/Playtime.tsx`：顶部统计卡（拥有/总时长/平均/总价值）+ 时长分布热力图（GitHub 风格网格，颜色按小时分级）+ 完成度列表（进度条）。无 API key 显示引导。i18n 键。
- verify：`npm run build`；手测

---

## P4 D 商店详情 + 多区价格

**T15** `steam-sdk/src/client/store.rs`：`AppDetail` 扩展 `screenshots` / `pc_requirements` / `supported_languages` / `metacritic` / `recommendations`；新增 `get_app_details_full`（含全字段）。补解析测试（含缺字段默认）。
- verify：`cargo test store`

**T16** `steam-sdk/src/crypto/fx.rs`（新）：静态汇率表 `currency → CNY 系数`（基准 USD，标注近似）+ `to_cny(cents, currency) -> Option<u64>`。测试：表内币种换算、未知币种返回 None。
- verify：`cargo test fx`

**T17** `commands/steam_community.rs` 增 `get_store_detail(app_id)`（含 DLC 详情限 8 个）与 `get_multi_region_price(app_id)`（cc 列表并发查 appdetails，换算 CNY，IP 风控区跳过）；`lib.rs` 注册。
- verify：`cargo check`

**T18** 商店详情 Dialog：`src/components/steam/StoreDetailDialog.tsx`（新），愿望单与搜索结果点击打开——头图/简介/截图/价格对比表（区徽+现价+折后+≈CNY）/DLC/配置/评价；`src/lib/steamCommunity.ts` 增 DTO；i18n 键。
- verify：`npm run build`；手测（找一个多区在售游戏）

---

## P5 E1 好友 + 私聊（轮询）

**T19** `steam-sdk/src/client/social.rs`（新，同步 ureq）：`get_friends(access_token, session_id)`（GetFriendList）、`poll_status(...)`（PollStatus 长轮询参数化 timeout）、`send_message(steam_id, text, ...)`（SendMessage）、`get_player_summaries(api_key, steam_ids)`（GetPlayerSummaries）；sessionid 持久化 helper。
- verify：`cargo check`

**T20** `src-tauri/src/commands/steam_social.rs`（新）：`get_friends()`、`get_friend_profile(steam_id)`、`poll_chat(timeout_ms)`、`send_chat_message(steam_id, text)`；`lib.rs` 注册。
- verify：`cargo check`

**T21** `src/lib/steamSocial.ts`（新）：DTO（FriendDto/ChatMessageDto）+ 命令封装。
- verify：`npm run build`

**T22** `src/components/steam/SocialPanel.tsx`（新）：Steam Hub 新「社交」Tab——好友列表（头像/昵称/在线状态）+ 选中好友聊天面板（消息列表 + 输入框，轮询 5–10s + 发送后即时刷新）；未登录/无会话引导登录。
- verify：`npm run build`

**T23** i18n 键 + 手测（好友收发一条真实消息）。

---

## P6 E2 群聊（文字）

**T24** `client/social.rs` 扩展群聊：`get_chat_groups` / `join_chat_group` / `send_group_message` / `poll_group_messages`。
- verify：`cargo check`

**T25** SocialPanel 增群聊区（群列表 + 会话消息 + 发送）。
- verify：`npm run build`

**T26** i18n + 手测（加入一个真实群并收发）。

---

## P7 E3 通知页

**T27** `src-tauri/src/commands/steam_notifications.rs`（新）：`get_notifications()` 聚合（降价事件 `steam_price_drop_events.json` + 关注游戏新闻 + A 待确认 + 好友状态），时间线降序 + 未读；持久化 `steam_notifications.json`（仅标题/时间/类型，不存正文）；`mark_notifications_read()`；`lib.rs` 注册。
- verify：`cargo check`

**T28** （可选）系统通知：`src-tauri/Cargo.toml` + `package.json` 加 `tauri-plugin-notification`；lib.rs 注册；降价/待确认触发桌面通知。若依赖安装受阻，标记为后置项不阻塞 P7。
- verify：`cargo check` + `npm run build`

**T29** `src/components/steam/NotificationsPanel.tsx`（新）：Steam Hub「通知」Tab——时间线列表 + 未读高亮 + 标记已读；侧边栏/页签未读计数徽标。
- verify：`npm run build`

**T30** i18n + 手测（制造一条降价/新闻 → 通知页出现 + 未读计数）。

---

## P8 E4 贴纸 / 图片

**T31** `client/social.rs` + `commands/steam_social.rs`：`upload_chat_image(path)`（multipart 上传 → CDN URL）、`send_sticker(...)`。
- verify：`cargo check`

**T32** 聊天面板：图片发送按钮（文件选择 → 上传 → 发送 URL 消息）、贴纸选择器（基础）。
- verify：`npm run build`；手测发图

---

## P9 E5 语音 spike

**T33** 语音可行性 spike：调研 Steam 语音（CM 信令 + V2 语音中继 + WebRTC）在 Rust/Tauri WebView 的落地路径，产出 go/no-go 结论与工作量评估，更新设计文档 §7.4。
- 默认结论预期为 **砍（no-go）**：需 CM 长连接 + 语音令牌 + WebRTC 信令，远超备份工具定位；若 go，另立独立设计/计划。
- verify：文档更新 + 向用户汇报结论，等待批准

---

## 验证汇总（每阶段门禁）

| 阶段 | 验证 | 验收人 |
|------|------|--------|
| P0 | `cargo test authenticator mobile_conf` | — |
| P1 | `cargo check` + `npm run build` + A 手测 | 用户 |
| P2 | `npm run build` + B 手测 | 用户 |
| P3 | `cargo check` + `npm run build` + C 手测 | 用户 |
| P4 | `cargo test store fx` + `npm run build` + D 手测 | 用户 |
| P5 | `cargo check` + `npm run build` + E1 手测 | 用户 |
| P6 | `cargo check` + `npm run build` + E2 手测 | 用户 |
| P7 | `cargo check` + `npm run build` + E3 手测 | 用户 |
| P8 | `cargo check` + `npm run build` + E4 手测 | 用户 |
| P9 | 结论文档 | 用户 |

## 执行中发现的偏差处理

- 阶段内任务若因依赖/环境缺失或验证反复失败而停止，按 Stage 3 规则暂停并汇报，不擅自扩范围。
- 非公开接口（mobileconf、聊天）若实测与设计假设不符（字段/端点变化），以实测为准修订本计划与设计，并记录偏差。
