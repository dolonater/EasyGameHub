// src/index.tsx
import React, { useEffect, useState } from "sdk";
var sdk;
function setup(ctx) {
  sdk = ctx;
  sdk.log("stats-page plugin loaded");
  sdk.ui.registerPage({
    path: "stats",
    title: "\u5907\u4EFD\u7EDF\u8BA1",
    icon: "chart",
    render: StatsPage
  });
}
function formatBytes(bytes) {
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
  const [games, setGames] = useState([]);
  const [error, setError] = useState(null);
  useEffect(() => {
    sdk.core.listGames().then(async (list) => {
      const rows = [];
      for (const game of list) {
        const snapshots = await sdk.core.listSnapshots(game.id);
        rows.push({ ...game, snapshots });
      }
      setGames(rows);
    }).catch((e) => setError(String(e)));
  }, []);
  if (error) return React.createElement("p", { style: { color: "red" } }, `\u52A0\u8F7D\u5931\u8D25: ${error}`);
  const totalSnapshots = games.reduce((acc, g) => acc + g.snapshots.length, 0);
  const totalSize = games.reduce((acc, g) => acc + g.snapshots.reduce((a, s) => a + s.size_bytes, 0), 0);
  const lastBackup = games.flatMap((g) => g.snapshots).map((s) => s.timestamp).sort().at(-1);
  return React.createElement(
    "div",
    { style: { padding: 8 } },
    React.createElement("h2", null, "\u5907\u4EFD\u7EDF\u8BA1"),
    React.createElement(
      "p",
      { style: { color: "var(--muted-foreground)", fontSize: 13 } },
      `\u6E38\u620F ${games.length} \u4E2A \xB7 \u5FEB\u7167 ${totalSnapshots} \u4E2A \xB7 \u603B\u5360\u7528 ${formatBytes(totalSize)} \xB7 \u6700\u8FD1\u5907\u4EFD ${lastBackup ?? "\u65E0"}`
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
          ["\u6E38\u620F", "\u5FEB\u7167\u6570", "\u5360\u7528", "\u6700\u8FD1\u5907\u4EFD"].map(
            (h) => React.createElement("th", { key: h, style: cellStyle(true) }, h)
          )
        )
      ),
      React.createElement(
        "tbody",
        null,
        games.map(
          (g) => React.createElement(
            "tr",
            { key: g.id },
            React.createElement("td", { style: cellStyle(false) }, g.name),
            React.createElement("td", { style: cellStyle(false) }, String(g.snapshots.length)),
            React.createElement(
              "td",
              { style: cellStyle(false) },
              formatBytes(g.snapshots.reduce((a, s) => a + s.size_bytes, 0))
            ),
            React.createElement("td", { style: cellStyle(false) }, g.snapshots.map((s) => s.timestamp).sort().at(-1) ?? "\u65E0")
          )
        )
      )
    )
  );
}
function cellStyle(header) {
  return {
    borderBottom: "1px solid var(--border)",
    textAlign: "left",
    padding: "6px 8px",
    fontWeight: header ? 600 : 400
  };
}
export {
  setup
};
