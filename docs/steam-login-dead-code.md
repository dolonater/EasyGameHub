# Steam 登录残留代码

> 记录于 2026-08-03。以下代码均为无实际功能的残留，可在后续版本清理。

## 背景

Steam 登录（密码/二维码）原设计用于获取 `access_token` 以调用 Steam Web API。但实际上库存、云存档、成就三个功能全部走的是**本地文件读取**（`localconfig.vdf`、`appmanifest_*.acf`、`appinfo.vdf`、云缓存），不需要任何 Web API 认证。

需要登录的 Web API 命令（`get_steam_inventory`、`get_recently_played`、`get_steam_user_info`）在前端零调用，属于死代码。

---

## 一、可删除的前端页面/组件

### 页面

| 文件 | 说明 |
|------|------|
| `src/pages/steam/Login.tsx` | Steam 登录页（密码 + 二维码） |

### 路由

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/App.tsx` | ~37 | `<Route path="/steam/login" element={<Login />} />` |

### 侧边栏导航

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/components/ui/SidebarMenu.tsx` | ~12 | `steamLoginLabel: string` prop 类型 |
| `src/components/ui/SidebarMenu.tsx` | ~39 | `steamLoginLabel` 解构 |
| `src/components/ui/SidebarMenu.tsx` | ~75 | `{item("/steam/login", steamLoginLabel, "steamLogin")}` 导航项 |
| `src/components/Layout.tsx` | ~132 | `steamLoginLabel={t("steamLogin.title")}` 传参 |

### 图标映射

| 文件 | 行号 | 内容 |
|------|------|------|
| `src/lib/icons.ts` | ~69 | `steamLogin: lockKeyOpen` |

---

## 二、可删除/精简的 Rust 代码

### 命令模块（整文件删除）

| 文件 | 说明 |
|------|------|
| `src-tauri/src/commands/steam_auth.rs` | 全部 320 行都是登录相关命令 |

包含的命令：
- `login_step1` — 密码登录第一步
- `login_poll` — 轮询登录状态
- `login_submit_guard` — 提交 Steam Guard 验证码
- `login_begin_qr` — 开始二维码登录
- `get_active_session` — 获取当前登录会话
- `logout` — 登出

### lib.rs 注册清理

| 文件 | 行号 | 内容 |
|------|------|------|
| `src-tauri/src/lib.rs` | ~428-433 | 上述 6 个命令的 `.invoke_handler` 注册 |

### 命令模块声明

| 文件 | 行号 | 内容 |
|------|------|------|
| `src-tauri/src/commands/mod.rs` | ~12 | `pub mod steam_auth;` |

### 未使用的 Web API 命令（在 steam_api.rs 中）

| 文件 | 行号 | 函数 |
|------|------|------|
| `src-tauri/src/commands/steam_api.rs` | ~248 | `get_steam_inventory` — Web API 获取游戏库存 |
| `src-tauri/src/commands/steam_api.rs` | ~259 | `get_recently_played` — Web API 获取最近游玩 |
| `src-tauri/src/commands/steam_api.rs` | ~327 | `get_steam_user_info` — Web API 获取用户信息 |

### 辅助函数（steam_api.rs 中仅被上述死命令使用）

| 文件 | 行号 | 函数 |
|------|------|------|
| `src-tauri/src/commands/steam_api.rs` | ~100 | `get_steam_id()` — 从 config 读 `cached_steam_id` |
| `src-tauri/src/commands/steam_api.rs` | ~767 | `set_steam_api_key` — 设置 Web API key |

### lib.rs 中对应的注册

| 文件 | 行号 | 内容 |
|------|------|------|
| `src-tauri/src/lib.rs` | ~411-412 | `get_steam_inventory`、`get_recently_played` |
| `src-tauri/src/lib.rs` | ~413 | `get_steam_user_info` |
| `src-tauri/src/lib.rs` | ~437 | `set_steam_api_key` |

---

## 三、Config 中的废弃字段

### Rust 端

| 文件 | 行号 | 字段 |
|------|------|------|
| `src-tauri/src/core/config.rs` | ~100 | `pub steam_api_key: String` |
| `src-tauri/src/core/config.rs` | ~103 | `pub cached_steam_id: String` |
| `src-tauri/src/core/config.rs` | ~130-131 | 默认值 `String::new()` |

> 移除字段后需要做 config 迁移（或直接忽略未知字段，取决于 serde 配置）。

### 前端 TypeScript

| 文件 | 行号 | 字段 |
|------|------|------|
| `src/lib/types.ts` | ~87 | `steam_api_key: string` |
| `src/pages/Settings.tsx` | ~42 | 默认值 `steam_api_key: ""` |
| `src/pages/Wizard.tsx` | ~97 | 默认值 `steam_api_key: ""` |

---

## 四、i18n 翻译键

| 文件 | 行号 | 键 |
|------|------|------|
| `src/i18n/zh.ts` | ~480 | `steamLogin: { ... }` 整个对象 |
| `src/i18n/en.ts` | ~457 | `steamLogin: { ... }` 整个对象 |
| `src/i18n/zh.ts` | ~13/27 | `nav` 中的 `steamLogin` 引用（如有） |
| `src/i18n/en.ts` | ~13 | `nav` 中的 `steamLogin` 引用（如有） |

涉及的子键（需确认无其他引用后删除）：
- `steamLogin.title`
- `steamLogin.password`
- `steamLogin.qrCode`
- `steamLogin.qrHint`
- `steamLogin.generateQr`
- `steamLogin.scanQr`
- `steamLogin.username`
- `steamLogin.passwordPlaceholder`
- `steamLogin.rememberMe`
- `steamLogin.login`
- `steamLogin.guardNeeded`
- `steamLogin.guardSubmitted`
- `steamLogin.enterGuard`
- `steamLogin.submit`
- `steamLogin.polling`
- `steamLogin.success`
- `steamLogin.loggedIn`
- `steamLogin.loggedOut`
- `steamLogin.logout`
- `steamLogin.enterCredentials`
- `nav.steamLogin`（侧边栏标签）

---

## 五、steam-sdk 中可能不再需要的依赖

清理完上述代码后，检查以下 crate/feature 是否还有其他使用者：

- `steam_sdk::auth::login` — RSA 加密、密码登录
- `steam_sdk::auth::session` — `SessionManager`、`SteamSession`
- `steam_sdk::client::inventory` — `get_owned_games`、`get_recently_played_games`
- `steam_sdk::client::steamworks_web_api` — `get_user_info`

如果无其他调用方，可以从 `steam-sdk` 中移除或在 `Cargo.toml` 中 feature-gate。

---

## 六、清理顺序建议

1. **前端** — 删除 Login 页面、路由、侧边栏导航项、图标映射
2. **i18n** — 删除 `steamLogin` 翻译对象
3. **Rust commands** — 删除 `steam_auth.rs` 整个模块、`set_steam_api_key`、Web API 死命令
4. **Config** — 移除 `steam_api_key`、`cached_steam_id` 字段（注意 config 文件兼容）
5. **steam-sdk** — 移除不再使用的 auth/login/inventory Web API 模块
6. **Cargo.toml** — 移除不再需要的依赖（如有）
