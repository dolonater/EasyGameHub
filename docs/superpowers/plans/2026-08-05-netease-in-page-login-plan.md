# 网易云音乐插件内登录实施计划

> 创建日期：2026-08-05  
> 状态：Stage 2 计划草案，待批准  
> 设计文档：`docs/superpowers/specs/2026-08-05-netease-in-page-login-design.md`  
> 基线验证：`cd src-tauri && cargo test music && cargo check`；`npm run build`；`cd scripts/official-plugins/netease-music && npm run build && npm run pack`

## 执行原则

- 严格按设计文档实现插件内二维码和手机号短信验证码登录。
- 不实现密码登录、Cookie 手动导入、会员绕过、解锁、替代音源或破解能力。
- 保留 `music_open_login_window` 兼容命令，但官方插件默认不再调用它。
- Cookie 只在 Rust 后端保存，插件 JS 不读取、不持久化 Cookie。
- 修改中文源码和文档时遵守 `AGENTS.md` 的 UTF-8 规则，不整文件重写。
- 每个任务完成后运行对应验证命令；若验证失败原因不明确，停止执行并回到计划修订。

## P1 后端登录能力

### T1 增加登录模型

文件：

- `src-tauri/src/core/music/models.rs`

编辑：

- 新增 `LoginQrKeyResult`：
  - `unikey: String`
  - `qr_url: String`
  - `qr_image: String`
- 新增 `LoginQrCheckResult`：
  - `code: u32`
  - `message: String`
  - `logged_in: bool`
  - `login_info: Option<LoginInfo>`
- 新增 `CaptchaSentResult`：
  - `code: u32`
  - `message: String`
- 三个模型都添加 `Debug`、`Clone`、`Serialize`、`Deserialize`、`Default`。

验证：

```powershell
cd src-tauri
cargo check
```

预期：新增模型可被后续 command 和 SDK 序列化使用。

### T2 增加最小 weapi 依赖

文件：

- `src-tauri/Cargo.toml`

编辑：

- 增加 AES-CBC、PKCS7、随机数、大整数和二维码生成所需依赖：

```toml
aes = "0.8"
cbc = "0.1"
cipher = "0.4"
num-bigint = "0.4"
rand = "0.8"
qrcode = "0.14"
```

- 复用已有 `base64`、`image`、`reqwest`、`serde_json`、`urlencoding`。

验证：

```powershell
cd src-tauri
cargo check
```

预期：依赖解析成功，不影响现有后端构建。

### T3 新增 weapi 纯函数模块和单元测试

文件：

- `src-tauri/src/core/music/weapi.rs`
- `src-tauri/src/core/music/mod.rs`

编辑：

- 在 `mod.rs` 增加 `pub mod weapi;`。
- 在 `weapi.rs` 实现：
  - `encode_params(data: &serde_json::Value) -> Result<HashMap<String, String>, anyhow::Error>`
  - 内部可测试版本 `encode_params_with_secret(data, secret)`。
  - AES-CBC-PKCS7 双层加密生成 `params`。
  - RSA 无 padding 生成 `encSecKey`，逻辑对齐 go-musicfox：16 字节 secret 左侧补零到 128 字节后做模幂。
  - `generate_chain_id() -> String`，格式为 `v1_<52位16进制sDeviceId>_web_login_<毫秒时间戳>`。
  - `qr_data_url(qr_url: &str) -> Result<String, anyhow::Error>`，返回 `data:image/png;base64,...`。
- 新增单元测试：
  - `encode_params_with_secret` 返回 `params` 和 `encSecKey`。
  - `encSecKey` 长度为 256 个十六进制字符。
  - `generate_chain_id` 包含 `web_login`。
  - `qr_data_url` 以 `data:image/png;base64,` 开头。

验证：

```powershell
cd src-tauri
cargo test music::weapi
```

预期：weapi 纯函数测试通过，不依赖网络。

### T4 新增 weapi 网络请求 helper

文件：

- `src-tauri/src/core/music/weapi.rs`

编辑：

- 增加 `WeapiResponse` 内部结构：
  - `status: reqwest::StatusCode`
  - `json: serde_json::Value`
  - `cookie_header: String`
- 实现 `post_weapi(url: &str, data: serde_json::Value, cookie: Option<&str>) -> Result<WeapiResponse, anyhow::Error>`。
- 请求头设置：
  - `User-Agent: Mozilla/5.0 EasyGameHub/0.1`
  - `Referer: https://music.163.com/`
  - `Content-Type: application/x-www-form-urlencoded`
  - 可选 `Cookie`
- 从 `Set-Cookie` 响应头收集 Cookie，并使用现有 `cookie::normalize_cookie_header` 归一化。
- HTTP 非成功状态使用 `error_for_status` 语义返回错误。

验证：

```powershell
cd src-tauri
cargo check
```

预期：weapi 网络 helper 编译通过，未接入 command 前不发真实请求。

### T5 实现二维码 key 生成

文件：

- `src-tauri/src/core/music/login.rs`

编辑：

- 新增 `create_qr_key() -> Result<LoginQrKeyResult, anyhow::Error>`。
- 调用 `weapi::post_weapi("https://music.163.com/weapi/login/qrcode/unikey", json!({"type":1,"noCheckToken":true}), None)`。
- 从响应读取 `unikey`，兼容 `unikey` 和 `/data/unikey` 两种路径。
- 生成 `qr_url = "http://music.163.com/login?codekey=<unikey>&chainId=<chainId>"`。
- 调用 `weapi::qr_data_url(&qr_url)` 生成 `qr_image`。
- 响应缺少 `unikey` 时返回清晰错误信息。

验证：

```powershell
cd src-tauri
cargo check
```

预期：二维码 key 逻辑编译通过。

### T6 实现二维码状态检查和 Cookie 保存

文件：

- `src-tauri/src/core/music/login.rs`

编辑：

- 新增 `check_qr_login(app: &AppHandle, key: &str) -> Result<LoginQrCheckResult, anyhow::Error>`。
- 调用 `https://music.163.com/weapi/login/qrcode/client/login`，参数：
  - `type=1`
  - `noCheckToken=true`
  - `key=<unikey>`
- 状态映射：
  - `800`：`logged_in=false`，消息“二维码已过期”
  - `801`：`logged_in=false`，消息“等待扫码”
  - `802`：`logged_in=false`，消息“已扫码，请在手机上确认”
  - `803`：保存 Cookie，调用 `netease::login_status()` 验证，返回 `logged_in=true` 和 `login_info`
- `803` 时优先使用响应 Cookie；响应体内若带 `cookie` 字段，也纳入归一化。
- 登录成功后 emit `music:login-success`；Cookie 保存或验证失败 emit `music:login-failed`。

验证：

```powershell
cd src-tauri
cargo check
```

预期：二维码轮询命令所需后端逻辑编译通过。

### T7 实现短信验证码发送

文件：

- `src-tauri/src/core/music/login.rs`

编辑：

- 新增 `send_captcha(phone: &str, countrycode: Option<&str>) -> Result<CaptchaSentResult, anyhow::Error>`。
- 手机号 trim 后为空时返回错误。
- 默认区号为 `86`。
- 调用 `https://music.163.com/api/sms/captcha/sent`，表单参数：
  - `ctcode`
  - `cellphone`
  - `secrete=music_middleuser_pclogin`
- 返回 `code` 和 `message`；没有 message 时按 code 映射通用文案。

验证：

```powershell
cd src-tauri
cargo check
```

预期：验证码发送逻辑编译通过。

### T8 实现手机号验证码登录

文件：

- `src-tauri/src/core/music/login.rs`

编辑：

- 新增 `login_cellphone(app: &AppHandle, phone: &str, countrycode: Option<&str>, captcha: &str) -> Result<LoginInfo, anyhow::Error>`。
- 手机号和验证码 trim 后为空时返回错误。
- 默认区号为 `86`。
- 调用 `https://music.163.com/weapi/login/cellphone`，参数：
  - `phone`
  - `countrycode`
  - `captcha`
  - `rememberLogin=true`
  - `type=1`
  - `https=true`
  - `remember=true`
  - `csrf_token=""`
- 成功后保存响应 Cookie，调用 `netease::login_status()` 验证。
- 验证成功 emit `music:login-success`；失败 emit `music:login-failed`。

验证：

```powershell
cd src-tauri
cargo check
```

预期：手机号验证码登录逻辑编译通过。

### T9 增加 Tauri 登录 commands 并注册

文件：

- `src-tauri/src/commands/music.rs`
- `src-tauri/src/lib.rs`

编辑：

- 在 `commands/music.rs` 新增：
  - `music_login_qr_key(app: AppHandle) -> Result<LoginQrKeyResult, String>`
  - `music_login_qr_check(app: AppHandle, key: String) -> Result<LoginQrCheckResult, String>`
  - `music_login_send_captcha(phone: String, countrycode: Option<String>) -> Result<CaptchaSentResult, String>`
  - `music_login_cellphone(app: AppHandle, phone: String, countrycode: Option<String>, captcha: String) -> Result<LoginInfo, String>`
- 在 `lib.rs` 的 `tauri::generate_handler!` 注册四个新 command。
- 保持 `music_open_login_window` 不删除。

验证：

```powershell
cd src-tauri
cargo test music
cargo check
```

预期：后端音乐测试和 command 注册编译通过。

## P2 SDK 与类型

### T10 扩展主插件音乐类型

文件：

- `src/plugins/music-types.ts`

编辑：

- 新增并导出：
  - `LoginQrKeyResult`
  - `LoginQrCheckResult`
  - `CaptchaSentResult`
- 字段名与 Rust serde 默认 camel/snake 转换后的前端实际字段保持一致：`unikey`、`qr_url`、`qr_image`、`logged_in`、`login_info`。

验证：

```powershell
npm run build
```

预期：主前端类型构建通过。

### T11 扩展宿主 SDK music 方法

文件：

- `src/plugins/sdk.ts`

编辑：

- `PluginSdk.music` 增加：
  - `loginQrKey(): Promise<LoginQrKeyResult>`
  - `loginQrCheck(key: string): Promise<LoginQrCheckResult>`
  - `sendLoginCaptcha(phone: string, countrycode?: string): Promise<CaptchaSentResult>`
  - `loginCellphone(phone: string, captcha: string, countrycode?: string): Promise<LoginInfo>`
- 每个方法调用前执行 `requirePerm("music", "...")`。
- invoke 参数使用 camelCase：
  - `music_login_qr_check` 传 `{ key }`
  - `music_login_send_captcha` 传 `{ phone, countrycode }`
  - `music_login_cellphone` 传 `{ phone, captcha, countrycode }`

验证：

```powershell
npm run build
```

预期：SDK 类型和实现构建通过。

### T12 同步官方插件类型声明

文件：

- `scripts/official-plugins/netease-music/src/sdk.d.ts`
- `scripts/official-plugins/netease-music/src/types.ts`

编辑：

- 在 `sdk.d.ts` 的 `music` namespace 增加四个登录方法声明。
- 在 `types.ts` 增加与 `src/plugins/music-types.ts` 对齐的登录结果类型。
- 保持已有播放、缓存、分页类型不变。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：官方插件类型构建通过。

## P3 插件 runtime 与 Dialog UI

### T13 替换 runtime 登录入口

文件：

- `scripts/official-plugins/netease-music/src/runtime.ts`

编辑：

- 保留 `openLoginWindow()` 兼容方法，但不再作为 UI 默认入口。
- 新增：
  - `createQrLogin(): Promise<LoginQrKeyResult>`
  - `checkQrLogin(key: string): Promise<LoginQrCheckResult>`
  - `sendLoginCaptcha(phone: string, countrycode?: string): Promise<CaptchaSentResult>`
  - `loginWithCellphone(phone: string, captcha: string, countrycode?: string): Promise<LoginInfo>`
- 二维码或手机号登录成功后统一调用 `refreshLoginStatus()`。
- 登录失败只设置错误和通知，不清空当前播放队列、缓存、最近播放和当前歌曲。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：runtime 登录能力构建通过，旧方法仍可用。

### T14 新增 LoginDialog 组件

文件：

- `scripts/official-plugins/netease-music/src/index.tsx`

编辑：

- 新增 `LoginDialog` 组件，使用 `Dialog`、`Button`、`TextField`、`Icon`。
- 组件 props：
  - `open: boolean`
  - `onClose: () => void`
  - `onLoggedIn: () => void`
- 内部状态：
  - tab：`qr` 或 `phone`
  - QR：`qrKey`、`qrImage`、`qrStatus`、`qrMessage`、`qrLoading`
  - 手机号：`countrycode`、`phone`、`captcha`、`captchaCooldown`、`phoneLoading`
- Dialog 打开且 tab 为二维码时自动调用 `runtime.createQrLogin()`。
- QR 轮询间隔 2 秒；Dialog 关闭、tab 切换、登录成功时清理 interval。
- QR 状态 `803` 后关闭 Dialog 并调用 `onLoggedIn()`。
- 手机号登录成功后关闭 Dialog 并调用 `onLoggedIn()`。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：LoginDialog 构建通过，轮询清理没有类型错误。

### T15 接入页面登录按钮

文件：

- `scripts/official-plugins/netease-music/src/index.tsx`

编辑：

- 在 `MusicPage` 增加 `loginOpen` 状态。
- `AccountPanel` 增加 `onLogin` prop，未登录按钮点击打开 `LoginDialog`。
- `LoginPanel` 增加 `onLogin` prop，未登录空态按钮点击打开 `LoginDialog`。
- 移除官方插件 UI 中默认调用 `runtime.openLoginWindow()` 的入口。
- 登录成功后调用 `runtime.refreshLoginStatus()`。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：插件页面登录入口全部改为内置 Dialog。

### T16 增加登录 Dialog 样式

文件：

- `scripts/official-plugins/netease-music/src/styles.ts`

编辑：

- 新增样式类：
  - `.nm-login-dialog`
  - `.nm-login-tabs`
  - `.nm-login-tab`
  - `.nm-qr-panel`
  - `.nm-qr-image`
  - `.nm-login-status`
  - `.nm-phone-panel`
  - `.nm-phone-row`
  - `.nm-login-actions`
- 样式延续现有 `--nm-accent`、玻璃卡片、轻动画、深浅色适配。
- QR 图片容器固定尺寸，过期/加载状态不引发布局跳动。
- 手机号区号输入宽度固定，验证码按钮有 disabled/loading 状态。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：样式字符串构建通过，无中文乱码。

### T17 优化登录错误提示

文件：

- `scripts/official-plugins/netease-music/src/runtime.ts`
- `scripts/official-plugins/netease-music/src/index.tsx`

编辑：

- 在 `friendlyErrorMessage` 增加登录相关映射：
  - 二维码过期
  - 等待扫码
  - 已扫码待确认
  - 验证码错误
  - 请求太频繁
- Dialog 内的可恢复状态显示在 Dialog 内，不重复弹出顶部提示。
- 真正失败才调用右下角通知。

验证：

```powershell
cd scripts/official-plugins/netease-music
npm run build
```

预期：登录失败分支提示友好，构建通过。

## P4 打包与全量验证

### T18 格式化和 Rust 验证

命令：

```powershell
cd src-tauri
cargo fmt
cargo test music
cargo check
```

预期：

- Rust 格式化完成。
- music 单元测试通过。
- 后端编译通过。

### T19 插件构建和打包

命令：

```powershell
cd scripts/official-plugins/netease-music
npm run build
npm run pack
```

预期：

- `dist/bundle.js` 生成成功。
- `plugins/com.easygamehub.netease-music/bundle.js` 更新。
- `resources/defaults/plugins/com.easygamehub.netease-music/bundle.js` 更新。
- bundle 仍只 external `"sdk"`。

### T20 主应用构建验证

命令：

```powershell
npm run build
```

预期：

- TypeScript、Vite 主应用、SDK 构建全部通过。
- 新增 SDK 方法不破坏插件加载器和现有官方插件。

### T21 手动交互验证

命令：

```powershell
npm run tauri dev
```

操作：

1. 打开插件页“网易云音乐”。
2. 未登录状态点击账号区域登录按钮，确认出现页面内 Dialog。
3. 在二维码 Tab 确认二维码图片显示、等待扫码状态显示。
4. 切到手机号 Tab，输入手机号，点击发送验证码，确认倒计时生效。
5. 输入验证码登录后，确认 Dialog 关闭、账号头像昵称刷新、我的歌单加载。
6. 登出后再次打开 Dialog，确认旧账号状态被清理，当前播放和本地缓存不因登录失败被清空。

预期：

- 登录 Dialog 在插件页面内完成，不弹出旧外部登录窗口。
- 二维码和手机号登录状态清晰。
- 登录成功复用现有账号刷新流程。

### T22 更新进度文档

文件：

- `docs/superpowers/progress.md`

编辑：

- 记录 Stage 2 完成。
- 执行 Stage 3 后记录各任务完成情况和验证命令结果。

验证：

```powershell
npm run build
```

预期：进度文档与实施状态一致。

## 回退规则

| 触发条件 | 回退处理 |
| --- | --- |
| weapi 依赖无法解析 | 换用同生态可解析版本，先保持 T3 纯函数测试通过 |
| weapi 加密测试失败 | 暂停网络接口接入，先修正 T3 |
| 网易云二维码接口返回结构变化 | 只修改 `login.rs` 响应解析，不改 SDK 契约 |
| 手机号验证码接口要求额外风控参数 | 暂停手机号登录，保留二维码登录，回到设计补充风控处理 |
| QR 轮询成功但 Cookie 无法验证 | 停止插件 UI 改动，先修复后端 Cookie 收集和 `login_status` |
| 插件 Dialog 关闭后仍轮询 | 回到 T14 修 interval 清理，再继续后续任务 |
| 打包后内置插件未更新 | 回到 T19 检查 pack 脚本和 defaults 同步路径 |

## 完成定义

- 设计文档中的插件内二维码登录和手机号短信验证码登录全部实现。
- Cookie 仍由 Rust 后端统一保存，插件不直接接触 Cookie。
- 旧外部登录窗口保留兼容，但官方插件登录入口改为 Dialog。
- `cd src-tauri && cargo test music && cargo check` 通过。
- `cd scripts/official-plugins/netease-music && npm run build && npm run pack` 通过。
- `npm run build` 通过。
- 手动验证确认登录 Dialog、二维码状态、验证码倒计时、登录成功刷新账号信息可用。
