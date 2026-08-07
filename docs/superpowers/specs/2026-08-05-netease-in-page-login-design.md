# 网易云音乐插件内登录设计

## 结论

可以实现。登录入口从“打开外部登录窗口”改为插件页面内 Dialog，支持二维码登录和手机号短信验证码登录。后端参考 go-musicfox 的登录接口选择与状态语义，但不直接引入 go-musicfox，也不实现破解、绕过会员、保存明文密码或 Cookie 手动导入。

## 现状

当前插件登录链路为：

- 插件 UI 调用 `runtime.openLoginWindow()`。
- 插件 SDK 只暴露 `music.openLoginWindow()`、`music.loginStatus()`、`music.logout()`。
- Tauri 命令 `music_open_login_window` 创建 `https://music.163.com/#/login` 外部 WebView，并轮询 WebView Cookie。
- Cookie 保存到 `music-cookies.json`，后续所有音乐 API 读取 `netease` Cookie。

这个链路无法在插件页面内展示二维码或手机号验证码表单，因为 SDK 没有二维码 key、二维码状态轮询、验证码发送、手机号登录这些能力。

## go-musicfox 参考点

go-musicfox 的可复用参考是接口语义，不是代码复制：

- 二维码 key：`LoginQRService.GetKey()` 调用 `https://music.163.com/weapi/login/qrcode/unikey`。
- 二维码检查：`LoginQRService.CheckQR()` 调用 `https://music.163.com/weapi/login/qrcode/client/login`。
- 二维码 URL：`http://music.163.com/login?codekey=<unikey>&chainId=<chainId>`。
- 手机验证码发送：`CaptchaSentService` 调用 `https://music.163.com/api/sms/captcha/sent`，参数包含 `ctcode`、`cellphone`、`secrete=music_middleuser_pclogin`。
- 手机号登录：`LoginCellphoneService` 调用 `https://music.163.com/weapi/login/cellphone`，可携带 `phone`、`countrycode`、`captcha`、`rememberLogin` 等参数。

其中二维码 key/check 和手机号登录使用 `weapi` 加密请求。现有 Rust 后端只有普通 `/api/*` 请求封装，因此需要新增最小 `weapi` 请求能力。

## 目标体验

插件页面中所有登录都在播放器页面内完成：

- 未登录账号面板和登录空状态显示“登录”按钮。
- 点击后打开 `Dialog`，内部提供“二维码登录”和“手机号登录”两个 Tab。
- 二维码登录：
  - 打开 Dialog 后生成二维码。
  - 展示二维码图片、等待扫码、已扫码待确认、登录成功、二维码过期等状态。
  - 过期后可刷新二维码。
  - 登录成功后关闭 Dialog，刷新账号信息、歌单、喜欢列表、每日推荐等已有数据。
- 手机号登录：
  - 输入区号和手机号，默认中国大陆区号 `86`。
  - 点击发送验证码后进入倒计时，避免频繁触发。
  - 输入短信验证码后登录。
  - 登录成功后关闭 Dialog 并复用现有登录后刷新逻辑。

## 后端设计

新增或扩展 `src-tauri/src/core/music/login.rs`，保留旧 `open_login_window` 作为兼容 fallback，但插件默认不再使用。

新增后端数据模型，放在 `src-tauri/src/core/music/models.rs`：

- `LoginQrKeyResult`
  - `unikey: String`
  - `qr_url: String`
  - `qr_image: String`
- `LoginQrCheckResult`
  - `code: u32`
  - `message: String`
  - `logged_in: bool`
  - `login_info: Option<LoginInfo>`
- `CaptchaSentResult`
  - `code: u32`
  - `message: String`

新增 Tauri commands，放在 `src-tauri/src/commands/music.rs` 并注册到 `src-tauri/src/lib.rs`：

- `music_login_qr_key() -> Result<LoginQrKeyResult, String>`
- `music_login_qr_check(key: String) -> Result<LoginQrCheckResult, String>`
- `music_login_send_captcha(phone: String, countrycode: Option<String>) -> Result<CaptchaSentResult, String>`
- `music_login_cellphone(phone: String, countrycode: Option<String>, captcha: String) -> Result<LoginInfo, String>`

登录成功时统一调用现有 `cookie::save_cookie(&app, "netease", ...)`，并用 `netease::login_status()` 验证 Cookie。这样不会分裂当前播放、歌单、喜欢、每日推荐等接口的鉴权来源。

## weapi 最小实现

新增一个后端内部模块，例如 `src-tauri/src/core/music/weapi.rs`：

- AES-CBC-PKCS7 双层加密生成 `params`。
- RSA 无 padding 生成 `encSecKey`。
- 只服务登录接口，不重写现有音乐 API。
- 请求头沿用 `User-Agent`、`Referer=https://music.163.com/`、`Content-Type=application/x-www-form-urlencoded`。
- 从响应 `Set-Cookie` 中提取 `MUSIC_U`、`__csrf`、`NMTID` 等 Cookie 并归一化保存。

依赖选择应保持最小：

- 优先使用 RustCrypto 小依赖实现 AES-CBC/PKCS7 和 RSA 大整数运算。
- 若现有依赖已经能覆盖，则复用，不额外引入重型运行时。
- 不引入 go-musicfox 二进制、不启动外部进程。

## SDK 与插件设计

宿主 SDK 扩展 `music` 能力：

- `loginQrKey(): Promise<LoginQrKeyResult>`
- `loginQrCheck(key: string): Promise<LoginQrCheckResult>`
- `sendLoginCaptcha(phone: string, countrycode?: string): Promise<CaptchaSentResult>`
- `loginCellphone(phone: string, captcha: string, countrycode?: string): Promise<LoginInfo>`

同步更新：

- `src/plugins/music-types.ts`
- `src/plugins/sdk.ts`
- `scripts/official-plugins/netease-music/src/sdk.d.ts`
- `scripts/official-plugins/netease-music/src/types.ts`

插件 runtime 新增：

- `createQrLogin()`
- `checkQrLogin(key)`
- `sendLoginCaptcha(phone, countrycode)`
- `loginWithCellphone(phone, captcha, countrycode)`

UI 新增 `LoginDialog`，使用当前 SDK 暴露的 `Dialog`、`Button`、`TextField`、`Icon`，样式放在 `styles.ts`，并延续现有播放器卡片、主题色和动画风格。

## 错误与状态

二维码常见状态映射：

- `800`：二维码过期。
- `801`：等待扫码。
- `802`：已扫码，等待手机确认。
- `803`：授权成功。

手机号验证码常见错误：

- 手机号为空或格式明显异常：前端拦截。
- 验证码为空：前端拦截。
- 请求频繁：显示友好提示，并保留倒计时。
- 登录失败：显示后端返回的 `message`，无法解析时显示通用提示。

所有失败只提示，不清空当前播放队列和本地缓存。只有明确登录成功或用户登出时才刷新账号相关状态。

## 安全与边界

- 不实现破解、不绕过会员、不处理付费歌曲解锁。
- 不保存明文密码；手机号登录只做短信验证码。
- Cookie 仍由后端统一持久化，插件 JS 不直接读取或持久化 Cookie。
- 登录命令继续受 `music` 权限控制。
- 保留旧外部登录命令作为兼容能力，但官方插件默认改用 Dialog。

## 阶段划分

P1 后端登录能力：

- 新增登录模型。
- 新增最小 `weapi` helper。
- 新增二维码 key/check、短信验证码发送、手机号验证码登录后端函数和 Tauri command。
- 注册命令并做 Rust 编译验证。

P2 SDK 与类型：

- 扩展宿主 `PluginSdk.music`。
- 同步插件官方类型声明和音乐类型。
- 验证主前端 TypeScript 构建。

P3 插件 UI 与 runtime：

- 替换登录按钮逻辑为 `LoginDialog`。
- 实现二维码轮询、过期刷新、手机号验证码倒计时。
- 登录成功后复用 `refreshLoginStatus()`。
- 增加样式和交互状态。

P4 验证与打包：

- `cargo fmt`
- `cargo check`
- `cd scripts/official-plugins/netease-music && npm run build`
- `cd scripts/official-plugins/netease-music && npm run pack`
- `npm run build`
- 如环境允许，启动应用验证登录 Dialog 基本交互。

## 设计自检

- 没有把“手机号登录”解释为密码登录，避免引入明文密码和额外敏感状态。
- 没有让插件直接接触 Cookie，继续由后端统一保存。
- 没有改动现有播放、缓存、分页、封面代理逻辑。
- 没有把 go-musicfox 作为运行时依赖，只参考接口与状态语义。
- 新增接口都在 `music` 权限下，不扩大插件系统通用权限。
- 旧外部登录窗口可保留，不影响已有 SDK 兼容性。
