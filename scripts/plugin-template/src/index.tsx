/**
 * 插件模板 — 经典 JSX 转换（--jsx=transform），React 从 "sdk" 导入。
 *
 * 构建：npm run build → dist/bundle.js（仅 import "sdk"）
 * 打包：manifest.json + dist/bundle.js → <id>.zip（zip 根目录直接包含两文件）
 * 安装：应用「设置 → 插件 → 安装」选择 zip
 */
import React, { useEffect, useState } from "sdk";
import type { PluginSdk, GameInfo } from "./types";

// setup(ctx) 收到的是加载器按 manifest.permissions 裁剪后的受限 SDK。
// 模块级变量（setup 参数对后续模块代码不可见）。
let sdk: PluginSdk;

export function setup(ctx: PluginSdk) {
  sdk = ctx;
  sdk.log("template plugin loaded");

  sdk.ui.registerPage({
    path: "template",
    title: "Template 示例页",
    icon: "home",
    render: TemplatePage,
  });

  sdk.ui.registerSettingsSection({
    id: "template-config",
    title: "Template 设置",
    render: TemplateSettings,
  });

  sdk.events.on("backup:started", (payload) => {
    sdk.log("backup:started", payload);
  });
  sdk.events.on("backup:completed", (payload) => {
    sdk.log("backup:completed", payload);
  });
  sdk.events.on("backup:failed", (payload) => {
    sdk.log("backup:failed", payload);
  });
}

// ── 示例页面：core 只读 + 事件订阅 ─────────────────────────────
function TemplatePage() {
  const [games, setGames] = useState<GameInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [events, setEvents] = useState<string[]>([]);

  useEffect(() => {
    sdk.core.listGames().then(setGames).catch((e) => setError(String(e)));
    const handler = (payload: unknown) => setEvents((prev) => [`${Date.now()} ${JSON.stringify(payload)}`, ...prev].slice(0, 8));
    sdk.events.on("backup:completed", handler);
    return () => sdk.events.off("backup:completed", handler);
  }, []);

  if (error) return React.createElement("p", { style: { color: "red" } }, `error: ${error}`);

  return React.createElement(
    "div",
    null,
    React.createElement("h3", null, "游戏列表（core.read）"),
    React.createElement(
      "ul",
      null,
      games.map((g) => React.createElement("li", { key: g.id }, `${g.name} — 快照 ${g.snapshot_count} 个`))
    ),
    React.createElement("h3", null, "最近 backup:completed 事件"),
    events.map((e, i) => React.createElement("div", { key: i, style: { fontSize: 12, opacity: 0.7 } }, e))
  );
}

// ── 示例设置区块：storage 读写 ─────────────────────────────────
function TemplateSettings() {
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    sdk.storage.get().then((cfg) => {
      if (cfg && typeof cfg === "object") setNote(String((cfg as { note?: string }).note ?? ""));
    });
  }, []);

  const save = () => {
    sdk.storage.set({ note }).then(() => {
      setSaved(true);
      sdk.ui.notify("模板配置已保存");
    });
  };

  return React.createElement(
    "div",
    null,
    React.createElement("label", null, "自定义备注："),
    React.createElement("input", {
      value: note,
      onChange: (e: { target: { value: string } }) => setNote(e.target.value),
      style: { margin: "0 8px" },
    }),
    React.createElement("button", { onClick: save }, "保存"),
    saved ? React.createElement("span", { style: { color: "green", marginLeft: 8 } }, "已保存") : null
  );
}
