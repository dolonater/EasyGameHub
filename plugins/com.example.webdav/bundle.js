// src/index.tsx
import React, { useEffect, useState } from "sdk";
var sdk;
function setup(ctx) {
  sdk = ctx;
  sdk.log("webdav-backup plugin loaded");
  sdk.ui.registerSettingsSection({
    id: "webdav-config",
    title: "WebDAV \u81EA\u52A8\u4E0A\u4F20",
    render: WebDavSettings
  });
  sdk.events.on("backup:completed", (payload) => {
    const p = payload;
    if (p?.game_id) void uploadLatestSnapshot(p.game_id);
  });
}
async function uploadLatestSnapshot(gameId) {
  try {
    const cfg = await sdk.storage.get();
    if (!cfg?.url) {
      sdk.log("webdav: \u672A\u914D\u7F6E URL\uFF0C\u8DF3\u8FC7\u4E0A\u4F20");
      return;
    }
    const snapshots = await sdk.core.listSnapshots(gameId);
    if (!snapshots.length) {
      sdk.log(`webdav: \u6E38\u620F ${gameId} \u65E0\u5FEB\u7167`);
      return;
    }
    const latest = snapshots[0];
    const fileName = `${latest.timestamp}_${gameId}.json`;
    const headers = { "Content-Type": "application/json" };
    if (cfg.username) {
      headers["Authorization"] = "Basic " + btoa(`${cfg.username}:${cfg.password}`);
    }
    const url = `${cfg.url.replace(/\/+$/, "")}/${encodeURIComponent(fileName)}`;
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ game_id: gameId, ...latest }, null, 2)
    });
    if (!res.ok) {
      sdk.log(`webdav: PUT ${fileName} \u5931\u8D25 HTTP ${res.status}`);
      return;
    }
    sdk.log(`webdav: \u5DF2\u4E0A\u4F20 ${fileName}`);
    sdk.ui.notify(`WebDAV \u5DF2\u4E0A\u4F20 ${fileName}`);
  } catch (e) {
    sdk.log("webdav: \u4E0A\u4F20\u5F02\u5E38", e);
  }
}
function WebDavSettings() {
  const [cfg, setCfg] = useState({ url: "", username: "", password: "" });
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    sdk.storage.get().then((stored) => {
      if (stored && typeof stored === "object") {
        const c = stored;
        setCfg({ url: c.url ?? "", username: c.username ?? "", password: c.password ?? "" });
      }
    });
  }, []);
  const save = () => {
    sdk.storage.set(cfg).then(() => {
      setSaved(true);
      sdk.ui.notify("WebDAV \u914D\u7F6E\u5DF2\u4FDD\u5B58");
    });
  };
  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 } },
    React.createElement("label", null, "WebDAV \u76EE\u5F55 URL\uFF08\u5982 http://127.0.0.1:8080/dav\uFF09"),
    React.createElement("input", {
      value: cfg.url,
      onChange: (e) => setCfg({ ...cfg, url: e.target.value }),
      placeholder: "http://127.0.0.1:8080/dav"
    }),
    React.createElement("label", null, "\u7528\u6237\u540D\uFF08\u53EF\u9009\uFF09"),
    React.createElement("input", {
      value: cfg.username,
      onChange: (e) => setCfg({ ...cfg, username: e.target.value })
    }),
    React.createElement("label", null, "\u5BC6\u7801\uFF08\u53EF\u9009\uFF09"),
    React.createElement("input", {
      type: "password",
      value: cfg.password,
      onChange: (e) => setCfg({ ...cfg, password: e.target.value })
    }),
    React.createElement(
      "button",
      { onClick: save, style: { alignSelf: "flex-start", marginTop: 4 } },
      "\u4FDD\u5B58"
    ),
    saved ? React.createElement("span", { style: { color: "green" } }, "\u5DF2\u4FDD\u5B58") : null
  );
}
export {
  setup
};
