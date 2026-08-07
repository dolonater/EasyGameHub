# EasyGameHub 插件开发文档

> 对应实现：P1-P3（设计文档：`docs/superpowers/specs/2026-08-04-plugin-system-design.md`）

插件是以 **Webview 内 JS 模块**形式运行的第三方扩展：打包为 zip 手动安装，通过受限 SDK 读取游戏/快照数据、订阅备份事件、注册页面与设置区块。

## 1. 插件包结构

一个插件 zip 的**根目录**直接包含两个文件：

```
plugin.zip
├── manifest.json
└── bundle.js          # 单文件 ESM bundle（入口）
```

可选 `assets/` 目录放静态资源。安装后解压到 `<tool_dir>/plugins/<id>/`，同时写注册表 `plugins_registry.json`。

## 2. manifest.json 规范

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

| 字段 | 规则 |
|------|------|
| `id` | 反向域名，`^[a-z0-9.][a-z0-9.-]*$`；安装后目录名即 id；同 id 重新安装 = 覆盖更新 |
| `name` | 显示名，1-40 字符 |
| `version` | semver |
| `api_version` | 正整数；大于 SDK 当前 `apiVersion`（=1）拒绝加载 |
| `entry` | JS 入口，必须以 `bundle.js` 结尾 |
| `permissions` | 可空；SDK 命名空间授权白名单 |

## 3. 权限表

| 权限 | 开放 API |
|------|---------|
| `core.read` | `listGames` `listSnapshots` `getGame` |
| `core.backup` | `triggerBackup` |
| `events` | `on` `off` |
| `ui` | `registerPage` `registerSettingsSection` `notify` |
| `music` | 网易云音乐只读/播放 SDK：登录状态、搜索、歌单、歌曲 URL、歌词、本地代理 |
| （始终开放） | `storage` `log` `lifecycle.onDispose` |

未声明的权限调用即抛 `PermissionDenied`。

官方音乐插件 manifest 示例：

```json
{
  "id": "com.easygamehub.netease-music",
  "name": "网易云播放器",
  "version": "0.1.0",
  "api_version": 1,
  "entry": "bundle.js",
  "permissions": ["ui", "music"]
}
```

## 4. SDK API 参考

SDK 通过文档 import map 以裸说明符 `"sdk"` 解析，插件唯一依赖面。构建需 `--external:sdk`，**禁止直接 import `react`**。

### React 表面（JSX 经典转换）

```ts
import React from "sdk";            // 默认导出 = React 表面
import { useState, useEffect } from "sdk";   // 命名导出亦可
```

默认导出含：`createElement` `Fragment` `useState` `useEffect` `useRef` `useCallback` `useContext`。封装组件（命名导出）：`Button` `Dialog` `Icon` `TextField` `Toggle`。

### 入口

```ts
export function setup(sdk: PluginSdk) { ... }   // 加载器调用，传权限裁剪后的 SDK
```

`setup` 参数对模块其余代码不可见，请存到模块级变量。

### UI 注册

```ts
sdk.ui.registerPage({ path: "stats", title: "备份统计", icon: "chart", render: MyPage });
// 侧边栏出现「备份统计」，路由 /plugin/<pluginId>/stats，icon 取主应用图标名

sdk.ui.registerSettingsSection({ id: "cfg", title: "我的配置", render: MySection });
// 渲染在「设置 → 插件」对应插件卡片内

sdk.ui.notify("消息");   // 主应用 toast
```

### 数据只读

```ts
const games = await sdk.core.listGames();              // GameInfo[]
const snaps = await sdk.core.listSnapshots(gameId);    // SnapshotInfo[]，按时间降序，[0] 最新
const game  = await sdk.core.getGame(gameId);
```

### 触发备份

```ts
await sdk.core.triggerBackup(gameId);   // 需要 core.backup
```

### 事件

```ts
sdk.events.on("backup:started", (payload) => {});
sdk.events.on("backup:completed", (payload) => {});
sdk.events.on("backup:failed", (payload) => {});
sdk.events.off("backup:completed", handler);
```

- Tauri 事件：`backup:started` `backup:completed` `backup:failed`（载荷 `{ event, game_id, game_name, snapshot, error }`）
- 本地事件：`game:added` `game:removed`（前端 emit，载荷 `{ gameId, name, savePath? }`）
- 纯异步，不阻塞 Rust 备份管线；卸载时监听自动移除

### 私有存储

```ts
const cfg = await sdk.storage.get();    // plugins/<id>/config.json，可 null
await sdk.storage.set({ url: "..." });  // 按插件 id 作用域隔离
```

### 生命周期清理

```ts
sdk.lifecycle.onDispose(() => {
  // 停止播放器、释放计时器、移除插件自己的监听器等。
});
```

插件模块也可以导出 `teardown()`。卸载、禁用或重载插件时，加载器会先执行 `sdk.lifecycle.onDispose()` 注册的回调，再执行 `teardown()`，最后清理页面、设置区块和事件监听。

### 音乐 API

声明 `music` 权限后，插件可以调用宿主提供的网易云音乐只读和播放能力。该权限仅覆盖正常登录、读取账号可见内容、获取可播放 URL、歌词和本地媒体代理，不包含喜欢、收藏、评论、关注等账号写操作。

```ts
import type {
  Lyrics,
  LoginInfo,
  PlaybackQuality,
  Playlist,
  Song,
  SongUrlResult,
} from "sdk";

await sdk.music.openLoginWindow();
const login = await sdk.music.loginStatus();              // LoginInfo
await sdk.music.logout();

const songs = await sdk.music.search("song name", 30);    // Song[]
const playlists = await sdk.music.userPlaylists();        // Playlist[]
const [playlist, tracks] = await sdk.music.playlistTracks("123");
const moreTracks = await sdk.music.playlistTracksRange("123", 50, 50);

const result = await sdk.music.songUrl("456", "standard"); // SongUrlResult
const lyrics = await sdk.music.lyric("456");               // Lyrics
const audioUrl = await sdk.music.audioProxyUrl(result.url ?? "");
const coverUrl = await sdk.music.coverProxyUrl(songs[0]?.cover ?? "");
const port = await sdk.music.proxyPort();
```

`songUrl` 支持的 `PlaybackQuality` 为 `"hires"`、`"lossless"`、`"exhigh"`、`"standard"`。如果宿主返回 `trial: true`，表示该 URL 是试听片段；插件 UI 应明确标记。`audioProxyUrl(rawUrl)` 和 `coverProxyUrl(rawUrl)` 会通过 `127.0.0.1:<port>` 本地代理包装网易云媒体地址，插件应把返回值用于 `<audio>` 或封面图片。

音乐 API 不提供破解、VIP 绕过或替代音源搜索。不可播放歌曲会以结构化结果返回 `playable=false`、`reason`、`message`，由插件负责提示或跳过。

### 日志

```ts
sdk.log("anything");   // 控制台 [plugin:<id>] 前缀
```

## 5. 打包步骤（模板工程）

```sh
cd scripts/plugin-template
npm install
npm run build          # esbuild → dist/bundle.js（仅 import "sdk"）
mkdir -p dist && cp manifest.json dist/
cd dist && tar -a -cf ../my-plugin.zip manifest.json bundle.js
```

打开应用 → 设置 → 插件 → 安装 → 选择 zip。构建要求：`--bundle --format=esm --external:sdk --jsx=transform`。

## 6. 完整示例

| 示例 | 路径 | 演示能力 |
|------|------|---------|
| WebDAV 自动上传 | `scripts/examples/webdav-backup/` | `backup:completed` 订阅 → 读快照 → `fetch` PUT；设置区块 + storage |
| 备份统计页 | `scripts/examples/stats-page/` | `registerPage` 侧边栏页面 + `core.read` 汇总展示 |

## 7. 故障隔离

- 模块加载/setup/回调全部 try/catch，异常写入 `last_error`，不阻断其他插件
- `error_count` 连续 ≥ 3 → 自动禁用（`enabled: false`）
- 插件页面渲染包裹 ErrorBoundary，崩溃只影响该页
- 插件管理页展示 `last_error` 与错误次数

## 8. 限制（v1）

- **无破坏性 API**：不能恢复/删除快照、删除或修改游戏、改主配置
- **无同步阻塞钩子**：没有 before_backup 屏障等待（v2 再议）
- **无文件系统访问**：SDK 不含 fs API（WebDAV 示例因此上传元数据 JSON 而非文件本体）
- **无网络封装**：直接用浏览器 `fetch()`（受目标服务 CORS 约束）
- **无逻辑隔离**：插件与主应用同线程，死循环会冻结 UI（文档明示限制）
- **音乐 API 无账号写操作**：`music` 权限不开放喜欢、收藏、评论、关注等写接口
- **音乐 API 无破解能力**：不提供 VIP 绕过、版权绕过、灰色解锁或替代音源搜索
- **无签名/自动更新/在线市场**
