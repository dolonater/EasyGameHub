/**
 * WebDAV 自动上传示例插件
 *
 * 事件订阅 backup:completed → 读取最新快照 → PUT 快照元数据 JSON 到配置的 WebDAV URL。
 * 设置区块：URL / 用户名 / 密码（storage 持久化）。
 *
 * 注意（v1 范围）：SDK 无文件系统读取权限，上传的是快照元数据 JSON
 * （文件名 = <timestamp>_<game_id>.json），不含快照 zip 文件本身。
 */
import React, { useEffect, useState } from "sdk";
import type { PluginSdk, SnapshotInfo } from "./types";

let sdk: PluginSdk;

export interface WebDavConfig {
  url: string;
  username: string;
  password: string;
}

export function setup(ctx: PluginSdk) {
  sdk = ctx;
  sdk.log("webdav-backup plugin loaded");

  sdk.ui.registerSettingsSection({
    id: "webdav-config",
    title: "WebDAV 自动上传",
    render: WebDavSettings,
  });

  sdk.events.on("backup:completed", (payload) => {
    const p = payload as { game_id?: string };
    if (p?.game_id) void uploadLatestSnapshot(p.game_id);
  });
}

async function uploadLatestSnapshot(gameId: string) {
  try {
    const cfg = (await sdk.storage.get()) as WebDavConfig | null;
    if (!cfg?.url) {
      sdk.log("webdav: 未配置 URL，跳过上传");
      return;
    }

    const snapshots = (await sdk.core.listSnapshots(gameId)) as SnapshotInfo[];
    if (!snapshots.length) {
      sdk.log(`webdav: 游戏 ${gameId} 无快照`);
      return;
    }

    // get_snapshots 已按 timestamp 降序，[0] 即最新
    const latest = snapshots[0];
    const fileName = `${latest.timestamp}_${gameId}.json`;

    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (cfg.username) {
      headers["Authorization"] = "Basic " + btoa(`${cfg.username}:${cfg.password}`);
    }

    const url = `${cfg.url.replace(/\/+$/, "")}/${encodeURIComponent(fileName)}`;
    const res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ game_id: gameId, ...latest }, null, 2),
    });

    if (!res.ok) {
      sdk.log(`webdav: PUT ${fileName} 失败 HTTP ${res.status}`);
      return;
    }
    sdk.log(`webdav: 已上传 ${fileName}`);
    sdk.ui.notify(`WebDAV 已上传 ${fileName}`);
  } catch (e) {
    sdk.log("webdav: 上传异常", e);
  }
}

function WebDavSettings() {
  const [cfg, setCfg] = useState<WebDavConfig>({ url: "", username: "", password: "" });
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    sdk.storage.get().then((stored) => {
      if (stored && typeof stored === "object") {
        const c = stored as Partial<WebDavConfig>;
        setCfg({ url: c.url ?? "", username: c.username ?? "", password: c.password ?? "" });
      }
    });
  }, []);

  const save = () => {
    sdk.storage.set(cfg).then(() => {
      setSaved(true);
      sdk.ui.notify("WebDAV 配置已保存");
    });
  };

  return React.createElement(
    "div",
    { style: { display: "flex", flexDirection: "column", gap: 8, maxWidth: 480 } },
    React.createElement("label", null, "WebDAV 目录 URL（如 http://127.0.0.1:8080/dav）"),
    React.createElement("input", {
      value: cfg.url,
      onChange: (e: { target: { value: string } }) => setCfg({ ...cfg, url: e.target.value }),
      placeholder: "http://127.0.0.1:8080/dav",
    }),
    React.createElement("label", null, "用户名（可选）"),
    React.createElement("input", {
      value: cfg.username,
      onChange: (e: { target: { value: string } }) => setCfg({ ...cfg, username: e.target.value }),
    }),
    React.createElement("label", null, "密码（可选）"),
    React.createElement("input", {
      type: "password",
      value: cfg.password,
      onChange: (e: { target: { value: string } }) => setCfg({ ...cfg, password: e.target.value }),
    }),
    React.createElement(
      "button",
      { onClick: save, style: { alignSelf: "flex-start", marginTop: 4 } },
      "保存"
    ),
    saved ? React.createElement("span", { style: { color: "green" } }, "已保存") : null
  );
}
