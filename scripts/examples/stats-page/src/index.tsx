/**
 * 备份统计页示例插件
 *
 * 侧边栏注册「备份统计」页面：core.listGames() + core.listSnapshots(id)
 * 汇总展示：游戏数、快照总数、总占用空间、最近备份时间、逐游戏明细。
 */
import React, { useEffect, useState } from "sdk";
import type { PluginSdk, GameInfo, SnapshotInfo } from "./types";

let sdk: PluginSdk;

interface GameStats extends GameInfo {
  snapshots: SnapshotInfo[];
}

export function setup(ctx: PluginSdk) {
  sdk = ctx;
  sdk.log("stats-page plugin loaded");

  sdk.ui.registerPage({
    path: "stats",
    title: "备份统计",
    icon: "chart",
    render: StatsPage,
  });
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let i = 0;
  let v = bytes;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(1)} ${units[i]}`;
}

function StatsPage() {
  const [games, setGames] = useState<GameStats[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sdk.core
      .listGames()
      .then(async (list) => {
        const rows: GameStats[] = [];
        for (const game of list as GameInfo[]) {
          const snapshots = (await sdk.core.listSnapshots(game.id)) as SnapshotInfo[];
          rows.push({ ...game, snapshots });
        }
        setGames(rows);
      })
      .catch((e) => setError(String(e)));
  }, []);

  if (error) return React.createElement("p", { style: { color: "red" } }, `加载失败: ${error}`);

  const totalSnapshots = games.reduce((acc, g) => acc + g.snapshots.length, 0);
  const totalSize = games.reduce((acc, g) => acc + g.snapshots.reduce((a, s) => a + s.size_bytes, 0), 0);
  const lastBackup = games
    .flatMap((g) => g.snapshots)
    .map((s) => s.timestamp)
    .sort()
    .at(-1);

  return React.createElement(
    "div",
    { style: { padding: 8 } },
    React.createElement("h2", null, "备份统计"),
    React.createElement(
      "p",
      { style: { color: "var(--muted-foreground)", fontSize: 13 } },
      `游戏 ${games.length} 个 · 快照 ${totalSnapshots} 个 · 总占用 ${formatBytes(totalSize)} · 最近备份 ${lastBackup ?? "无"}`
    ),
    React.createElement(
      "table",
      { style: { width: "100%", borderCollapse: "collapse", marginTop: 12, fontSize: 13 } },
      React.createElement(
        "thead",
        null,
        React.createElement(
          "tr",
          null,
          ["游戏", "快照数", "占用", "最近备份"].map((h) =>
            React.createElement("th", { key: h, style: cellStyle(true) }, h)
          )
        )
      ),
      React.createElement(
        "tbody",
        null,
        games.map((g) =>
          React.createElement(
            "tr",
            { key: g.id },
            React.createElement("td", { style: cellStyle(false) }, g.name),
            React.createElement("td", { style: cellStyle(false) }, String(g.snapshots.length)),
            React.createElement(
              "td",
              { style: cellStyle(false) },
              formatBytes(g.snapshots.reduce((a, s) => a + s.size_bytes, 0))
            ),
            React.createElement("td", { style: cellStyle(false) }, g.snapshots.map((s) => s.timestamp).sort().at(-1) ?? "无")
          )
        )
      )
    )
  );
}

function cellStyle(header: boolean): React.CSSProperties {
  return {
    borderBottom: "1px solid var(--border)",
    textAlign: "left",
    padding: "6px 8px",
    fontWeight: header ? 600 : 400,
  };
}
