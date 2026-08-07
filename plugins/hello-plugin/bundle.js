import { createElement, useEffect, useState } from "sdk";

let sdk;

function StatsPage() {
  const [games, setGames] = useState([]);
  useEffect(() => {
    sdk.core
      .listGames()
      .then((list) => setGames(list))
      .catch((e) => setGames([{ name: "error: " + e.message }]));
  }, []);
  return createElement(
    "div",
    { className: "p-4" },
    createElement("h2", { className: "text-lg font-bold mb-2" }, "Hello 测试页"),
    createElement("p", { className: "text-sm mb-2" }, `检测到游戏: ${games.length} 个`),
    createElement(
      "ul",
      { className: "text-sm list-disc pl-5" },
      games.slice(0, 10).map((g) => createElement("li", { key: g.id || g.name }, g.name))
    )
  );
}

function SettingsSection() {
  const [lastEvent, setLastEvent] = useState("(无)");
  useEffect(() => {
    const onEvent = (payload) => setLastEvent(JSON.stringify(payload));
    sdk.events.on("backup:started", onEvent);
    sdk.events.on("backup:completed", onEvent);
    sdk.events.on("backup:failed", onEvent);
    return () => {
      sdk.events.off("backup:started", onEvent);
      sdk.events.off("backup:completed", onEvent);
      sdk.events.off("backup:failed", onEvent);
    };
  }, []);
  return createElement(
    "div",
    { className: "space-y-2 text-sm" },
    createElement("div", null, "最近备份事件: ", lastEvent),
    createElement(
      "button",
      {
        className: "px-3 py-1 bg-primary text-primary-foreground rounded text-xs",
        onClick: () => sdk.ui.notify("来自插件的通知"),
      },
      "发送通知"
    )
  );
}

export function setup(_sdk) {
  sdk = _sdk;
  sdk.log("hello plugin loaded");
  sdk.ui.registerSettingsSection({
    id: "hello",
    title: "Hello 测试插件",
    render: () => createElement(SettingsSection, null),
  });
  sdk.ui.registerPage({
    path: "hello",
    title: "Hello 测试页",
    icon: "game",
    render: () => createElement(StatsPage, null),
  });
}
