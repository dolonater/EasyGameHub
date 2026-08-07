# 插件模板工程

EasyGameHub 插件系统（v1）的最小工程模板。构建产物为单文件 ESM bundle，仅 `import ... from "sdk"`，经应用内 import map 解析到主应用 SDK。

## 三步流程

### 1. 构建

```sh
npm install
npm run build
```

产出 `dist/bundle.js`（esbuild：`--bundle --format=esm --external:sdk --jsx=transform`，经典 JSX 转换，`React` 从 `sdk` 默认导出）。

### 2. 打包 zip

zip **根目录**必须直接包含 `manifest.json` 与 `bundle.js`（入口相对路径）：

```sh
mkdir -p dist && cp manifest.json dist/  # dist 已含 bundle.js
cd dist && tar -a -cf ../template-plugin.zip manifest.json bundle.js
```

（Windows 10+ 自带 bsdtar，`-a` 按扩展名压缩为 zip；产物条目为 `manifest.json` + `bundle.js`，均在 zip 根。）

`manifest.json` 关键字段：`id`（反向域名，`^[a-z0-9.][a-z0-9.-]*$`，安装后目录名即 id）、`api_version`（≤ 1）、`entry`（必须以 `bundle.js` 结尾）、`permissions`（权限白名单，见主文档）。

### 3. 安装

打开应用 → 设置 → 插件 → 安装 → 选择 zip。启用后：

- 侧边栏出现「Template 示例页」（路径 `/plugin/com.example.template/template`）
- 设置 → 插件 → 该插件卡片下出现「Template 设置」区块

## 目录结构

```
scripts/plugin-template/
├── package.json        # build = esbuild 单文件打包
├── tsconfig.json       # 仅编辑器类型检查（构建不经 tsc）
├── manifest.json       # 示例 manifest（打包时放入 zip 根）
├── README.md
└── src/
    ├── index.tsx       # setup(sdk) 入口 + 页面/设置区块/事件示例
    ├── types.ts        # PluginSdk / GameInfo / SnapshotInfo 类型镜像
    └── sdk.d.ts        # "sdk" 裸说明符的最小类型声明
```

## 编写要点

- **React 从 "sdk" 导入**：`import React from "sdk"`（经典转换，`React.createElement`）。禁止直接 `import from "react"`。
- `setup(ctx)` 收到权限裁剪后的 SDK；用模块级变量保存（setup 参数对后续模块代码不可见）。
- 权限：`core.read` → `listGames/listSnapshots/getGame`；`core.backup` → `triggerBackup`；`events` → `on/off`；`ui` → `registerPage/registerSettingsSection/notify`；`storage`/`log` 始终开放。
- 限制：无阻塞钩子、无破坏性 API（恢复/删除快照等）、无文件系统读取、无插件内 Rust。
