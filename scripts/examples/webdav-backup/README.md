# WebDAV 自动上传示例插件

基于插件模板的完整示例：订阅 `backup:completed` 事件 → 读取最新快照 → 上传快照元数据 JSON 到配置的 WebDAV 服务。

**范围说明（v1）**：SDK 无文件系统读取权限，本示例上传的是快照**元数据** JSON（`<timestamp>_<game_id>.json`），不含快照 zip 本体。

## 构建

```sh
npm install
npm run build
```

## 打包 zip

```sh
cd dist && tar -a -cf ../webdav-backup.zip manifest.json bundle.js
```

（需先把 `manifest.json` 复制到 dist：`cp ../manifest.json .`；zip 根目录直接包含 `manifest.json` + `bundle.js`。）

zip 根目录直接包含 `manifest.json` + `bundle.js`。

## 安装与验收

1. 启动 mock WebDAV 服务（或任意真实 WebDAV）：

   ```sh
   npm run mock-dav   # http://127.0.0.1:8080/dav，上传目录 ./uploads/
   ```

2. 应用 → 设置 → 插件 → 安装 `webdav-backup.zip`，启用。

3. 在插件卡片「WebDAV 自动上传」区块填入 URL：`http://127.0.0.1:8080/dav`（用户名/密码可留空），保存。

4. 对任意游戏触发一次备份。

5. 验证：

   - 控制台出现 `[plugin:com.example.webdav] webdav: 已上传 <timestamp>_<game_id>.json`
   - 应用出现 toast「WebDAV 已上传 …」
   - mock 服务端输出 `[mock-dav] PUT ...`，`uploads/` 目录出现对应文件

## 权限

`manifest.json` 声明 `["core.read", "events", "ui"]`：`listSnapshots` 需 `core.read`，`backup:completed` 订阅需 `events`，设置区块与 notify 需 `ui`。
