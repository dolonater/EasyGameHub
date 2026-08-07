# 备份统计页示例插件

基于插件模板的完整示例：注册侧边栏页面「备份统计」，调用 `core.listGames()` + `core.listSnapshots(id)` 汇总展示真实备份数据。

## 构建

```sh
npm install
npm run build
```

## 打包 zip

```sh
cd dist && tar -a -cf ../stats-page.zip manifest.json bundle.js
```

（需先把 `manifest.json` 复制到 dist：`cp ../manifest.json .`；zip 根目录直接包含 `manifest.json` + `bundle.js`。）

## 安装与验收

1. 应用 → 设置 → 插件 → 安装 `stats-page.zip`，启用。
2. 侧边栏出现「备份统计」（图标 chart），路径 `/plugin/com.example.stats/stats`。
3. 页面显示：游戏数 / 快照总数 / 总占用 / 最近备份时间，以及逐游戏明细表 —— 数据与主界面快照一致。

## 权限

`manifest.json` 声明 `["core.read", "ui"]`：`listGames`/`listSnapshots` 需 `core.read`，`registerPage` 需 `ui`。
