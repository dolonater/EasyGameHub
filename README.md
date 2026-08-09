<div align="center">

# 🎮 EasyGameHub

**全能游戏管家 — 启动台 + 存档保护 + 时长统计 + 截图管理 + Steam 生态集成**

基于 **Tauri 2** 构建的 Windows 优先桌面应用，用 **Rust** 后端与 **React + TypeScript** 前端，把游戏启动、存档备份、游玩时长、截图管理与 Steam 账号生态整合进一个玻璃质感的现代界面。

</div>

---

## ✨ 功能特性

### 🚀 游戏启动台
- 封面网格浏览，单击进详情、双击直接启动
- Steam 安装游戏 exe 自动检测（`steamlocate`），失败时回退 `steam://rungameid` 协议或手动指定启动程序
- `CreateProcess` 启动 + PID 追踪，进程退出自动检测并上报
- 运行状态实时显示：绿色运行圆点、Hover 面板停止按钮、本次运行时长

### 💾 存档备份与恢复
- 手动备份 / 批量备份 / 批量恢复 / 批量删除快照
- 自动备份：
  - **文件监听**（`notify` 实时 watcher，防抖 + 最小间隔）
  - **游戏退出时备份**（可选，默认关闭）
  - **周期备份** 与 **每日定时备份**（调度器 Scheduler）
- 快照基于 zip 压缩，支持重命名备注、查看 zip 内容、单独读取文件
- 备份队列（并发 2），事件实时推送到前端（`backup:started/completed/failed`）

### ⏱️ 游玩时长统计
- 本地游玩会话累积：启动/退出时间、时长、会话次数
- **Steam 时长同步**：解析 `localconfig.vdf` 获取官方记录（含近两周）
- 时长详情页：统计卡片、柱状图、GitHub 风格热力图、游戏维度榜单

### 📸 截图管理
- Steam 截图目录自动扫描 + 自定义目录
- 按游戏分组的缩略图网格、大图预览、打开所在文件夹 / 复制 / 删除

### 🃏 游戏库管理
- Steam 竖版封面（600×900）自动获取，失败回退横条图或首字母占位
- 标签分类、收藏星标、置顶排序、自定义游戏路径
- 拖拽添加游戏文件夹、打开资源管理器

### 🛡️ Steam 账号生态（深度集成）
- **账号切换**：多账号管理、Steam Guard 令牌、userdata 目录管理、切换命令别名
- **登录**：二维码登录 / 账号密码 / 手机令牌确认
- **库存**：Steam 库存浏览（含本地离线解析）
- **云存档**：本地云存档文件浏览、配额查看、读写删除（Steam Cloud 目录）
- **成就**：成就概览、解锁进度、全成就达成率统计
- **Steam Guard 手机令牌（Authenticator）**：maFile 导入/导出、确认码、待确认交易列表
- **社交**：好友列表、在线状态、私聊（OAuth 网页聊天协议）、群组聊天、贴纸与图片消息、消息轮询
- **通知**：Steam 通知拉取与已读
- **新闻**：关注游戏的新闻流、手动关注列表
- **愿望单与价格**：愿望单管理、**多区价格对比**（8 区并发，折算 CNY）、降价阈值提醒
- **商店详情**：完整商店信息（截图、DLC、配置要求、支持语言、评分）+ 打开商店
- **下载管理**：Steam 下载任务管理、注册下载、开始安装
- **库统计**：拥有游戏数、总价值估算、时长分布、成就完成度

### 🎵 插件系统
- Webview 内 JS 模块形式的第三方扩展，zip 一键安装
- `manifest.json` + `bundle.js` 单文件 ESM，`sdk` 外部依赖
- **SDK 权限白名单**：`core.read` / `core.backup` / `events` / `ui` / `music` 等，未授权调用即拒绝
- 插件可注册页面、设置区块、订阅备份事件、使用宿主 UI 组件
- **官方插件：网易云播放器**（搜索、歌单、歌词、QR 登录、本地代理播放）

### 🎨 主题与外观
- 完整主题系统：HSL 变量 → CSS custom properties，内置多套主题 + 主题编辑器
- 明暗模式联动、圆角 / 背景模糊 / 透明度 / 背景图外观配置
- Liquid Glass 玻璃组件设计语言、动画开关、拖拽排序侧边栏

### 🪟 桌面体验
- 无边框窗口、自定义标题栏、F11 全屏、隐藏到托盘
- 系统托盘菜单（显示 / 退出）、开机自启（Autostart）
- 拖放游戏文件夹快速添加游戏
- 多语言：**简体中文 / English**（i18next）

---

## 🧱 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React 18 · TypeScript · Vite · Tailwind CSS · styled-components · react-router-dom · i18next · @dnd-kit |
| 桌面后端 | Tauri 2 · Rust 2021 · tokio · axum · serde/serde_json · zip · notify · sysinfo · winreg · steamlocate |
| 网络 | reqwest · ureq（native-certs）· futures-util |
| 加密 | aes · cbc · cipher · base64 · qrcode · rand |
| Steam 能力 | `steam-sdk` 工作区成员（认证、库存、云存档、成就、手机令牌、CM 聊天、proto 生成） |
| 构建产物 | MSI / NSIS 安装包 |

---

## 📁 项目结构

```
EasyGameHub/
├── src/                      # React 前端
│   ├── pages/                # 页面（启动台、游戏、Steam、设置、时长、截图…）
│   ├── components/           # 业务组件与 UI 原语（ui/、steam/…）
│   ├── hooks/                # 主题、外观、动画、Steam 会话等 hooks
│   ├── lib/                  # 类型、图标、Steam 路径与纯工具函数
│   ├── plugins/              # 插件类型、SDK、加载器、Provider、错误边界
│   └── i18n/                 # 多语言（zh / en）
├── src-tauri/                # Tauri / Rust 后端
│   └── src/
│       ├── commands/         # Tauri command 层（参数/返回值边界）
│       ├── core/             # 业务核心（备份、恢复、扫描、调度、监听、
│       │                     # 主题、插件、Steam 云、音乐代理、文件监听）
│       ├── traits/           # 平台与存储抽象
│       └── lib.rs            # 应用初始化、AppState、托盘、事件桥接、命令注册
├── steam-sdk/                # 独立 Steam 能力封装（认证/库存/云存档/令牌/聊天）
├── scripts/                  # 插件模板、官方插件（网易云）、示例插件
├── resources/defaults/       # 随应用分发的默认数据与内置插件
├── docs/                     # 设计文档（主题、插件、Steam 功能规格）
└── data/                     # 开发期默认/运行时数据
```

---

## 🚀 快速开始

### 环境要求

- **Node.js** ≥ 18
- **Rust** (stable) 与 Cargo
- [Tauri 2 前置依赖](https://tauri.app/start/prerequisites/)（Windows 上为 MSVC 构建工具链、WebView2）

### 安装与开发

```powershell
# 安装前端依赖
npm install

# 启动 Vite 开发服务器（固定端口 1420）
npm run dev

# 启动完整桌面应用（Tauri + 前端热更新）
npm run tauri dev
```

### 构建

```powershell
# 构建前端产物（tsc 类型检查 + Vite + 插件 SDK）
npm run build

# 构建桌面应用安装包（MSI / NSIS）
npm run tauri build
```

### 后端检查

```powershell
cargo check        # 类型检查（工作区：src-tauri + steam-sdk）
cargo test         # 运行测试
cargo fmt          # 代码格式化
```

---

## 📖 文档

| 文档 | 说明 |
|------|------|
| [插件开发指南](docs/plugin-development.md) | 插件包结构、manifest 规范、SDK API、权限表 |
| [主题系统设计](docs/theme-system-design.md) | HSL 变量 → CSS custom properties 机制 |
| [Liquid Glass 组件设计](docs/liquid-glass-components-design.md) | 玻璃质感 UI 组件规范 |
| [Steam 功能规格](docs/superpowers/specs/) | 社交缓存、Monica Steam 功能、网易云音乐、插件系统等设计文档 |
| [开发进度](docs/superpowers/progress.md) | 迭代历史与当前工作流 |

---

## 🔌 开发插件

插件是一个 zip 包，根目录直接包含 `manifest.json` 和 `bundle.js`：

```
plugin.zip
├── manifest.json
└── bundle.js          # 单文件 ESM bundle
```

```json
{
  "id": "com.example.webdav",
  "name": "WebDAV 备份",
  "version": "1.0.0",
  "api_version": 1,
  "entry": "bundle.js",
  "permissions": ["core.read", "core.backup", "events", "ui"]
}
```

使用 `scripts/plugin-template/` 作为模板开始开发，详细规范见 [插件开发指南](docs/plugin-development.md)。

---

## 🔒 安全说明

- 插件权限全部经过 SDK 白名单，不开放裸文件系统或破坏性宿主 API
- 备份、恢复、删除等操作优先保护用户数据与可恢复性
- 本应用不包含任何破解、绕过 VIP、灰歌解锁等功能

---

## 🤝 贡献

欢迎提交 Issue 与 Pull Request。开发前请阅读 [AGENTS.md](AGENTS.md) 了解目录边界、编码规范（UTF-8、中文注释）与验证清单。

---

## ⚖️ 许可

> 注意：本仓库当前未附带 LICENSE 文件。`steam-sdk/proto/steam-protobufs` 下的 protobuf 定义遵循其各自上游许可。Steam 相关功能仅作为协议参考实现，请遵守 Steam 服务条款与当地法律法规。
