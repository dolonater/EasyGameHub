// src/index.tsx
import React, { useEffect, useState } from "sdk";
var sdk;
function setup(ctx) {
  sdk = ctx;
  sdk.log("template plugin loaded");
  sdk.ui.registerPage({
    path: "template",
    title: "Template \u793A\u4F8B\u9875",
    icon: "home",
    render: TemplatePage
  });
  sdk.ui.registerSettingsSection({
    id: "template-config",
    title: "Template \u8BBE\u7F6E",
    render: TemplateSettings
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
function TemplatePage() {
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);
  const [events, setEvents] = useState([]);
  useEffect(() => {
    sdk.core.listGames().then(setGames).catch((e) => setError(String(e)));
    const handler = (payload) => setEvents((prev) => [`${Date.now()} ${JSON.stringify(payload)}`, ...prev].slice(0, 8));
    sdk.events.on("backup:completed", handler);
    return () => sdk.events.off("backup:completed", handler);
  }, []);
  if (error) return React.createElement("p", { style: { color: "red" } }, `error: ${error}`);
  return React.createElement(
    "div",
    null,
    React.createElement("h3", null, "\u6E38\u620F\u5217\u8868\uFF08core.read\uFF09"),
    React.createElement(
      "ul",
      null,
      games.map((g) => React.createElement("li", { key: g.id }, `${g.name} \u2014 \u5FEB\u7167 ${g.snapshot_count} \u4E2A`))
    ),
    React.createElement("h3", null, "\u6700\u8FD1 backup:completed \u4E8B\u4EF6"),
    events.map((e, i) => React.createElement("div", { key: i, style: { fontSize: 12, opacity: 0.7 } }, e))
  );
}
function TemplateSettings() {
  const [note, setNote] = useState("");
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    sdk.storage.get().then((cfg) => {
      if (cfg && typeof cfg === "object") setNote(String(cfg.note ?? ""));
    });
  }, []);
  const save = () => {
    sdk.storage.set({ note }).then(() => {
      setSaved(true);
      sdk.ui.notify("\u6A21\u677F\u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  };
  return React.createElement(
    "div",
    null,
    React.createElement("label", null, "\u81EA\u5B9A\u4E49\u5907\u6CE8\uFF1A"),
    React.createElement("input", {
      value: note,
      onChange: (e) => setNote(e.target.value),
      style: { margin: "0 8px" }
    }),
    React.createElement("button", { onClick: save }, "\u4FDD\u5B58"),
    saved ? React.createElement("span", { style: { color: "green", marginLeft: 8 } }, "\u5DF2\u4FDD\u5B58") : null
  );
}
export {
  setup
};
