import assert from "node:assert/strict";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";

const result = await build({
  entryPoints: ["src/danmaku/layout.ts"],
  bundle: true,
  format: "esm",
  platform: "node",
  write: false,
});

const source = result.outputFiles[0].text;
const encoded = Buffer.from(source).toString("base64");
const layout = await import(`data:text/javascript;base64,${encoded}`);

const sameTime = layout.planDanmakuBatch(
  [
    { id: "1", time: 12 },
    { id: "2", time: 12 },
  ],
  {
    activeTracks: [],
    activeFixed: { top: [], bottom: [] },
    maxTracks: 2,
    maxOnScreen: 4,
    maxFixedPerSide: 3,
    durationSeconds: 8,
  },
);
assert.equal(sameTime.planned.length, 2);
assert.deepEqual(
  sameTime.planned.map((item) => item.track),
  [0, 1],
);

const overLimit = layout.planDanmakuBatch(
  [
    { id: "1", time: 12 },
    { id: "2", time: 12 },
  ],
  {
    activeTracks: [],
    activeFixed: { top: [], bottom: [] },
    maxTracks: 4,
    maxOnScreen: 1,
    maxFixedPerSide: 3,
    durationSeconds: 8,
  },
);
assert.equal(overLimit.planned.length, 1);
assert.equal(overLimit.dropped, 1);

// 固定弹幕（mode 2/3）走独立轨道区，不占用滚动轨道
const fixedBatch = layout.planDanmakuBatch(
  [
    { id: "t1", time: 12, mode: 2 },
    { id: "b1", time: 12, mode: 3 },
    { id: "r1", time: 12, mode: 1 },
    { id: "t2", time: 13, mode: 2 },
  ],
  {
    activeTracks: [{ track: 0, occupiedUntil: 999 }],
    activeFixed: { top: [], bottom: [] },
    maxTracks: 2,
    maxOnScreen: 10,
    maxFixedPerSide: 1,
    durationSeconds: 8,
  },
);
assert.equal(fixedBatch.planned.length, 3);
assert.equal(fixedBatch.dropped, 1);
assert.deepEqual(
  fixedBatch.planned.map((entry) => [entry.fixed, entry.fixedSlot, entry.track]),
  [
    ["top", 0, -1],
    ["bottom", 0, -1],
    [null, -1, 1],
  ],
);
// 顶部槽位满员后第二条顶部弹幕复用槽位 0（首条已超时释放），滚动轨道占用不受影响
assert.equal(fixedBatch.nextTracks.length, 2);
assert.equal(fixedBatch.nextFixed.top.length, 1);
assert.equal(fixedBatch.nextFixed.bottom.length, 1);

// 固定弹幕超过每侧槽位数丢弃（占用至 t+8，后续同侧全部丢弃）
const fixedOverflow = layout.planDanmakuBatch(
  [
    { id: "a", time: 12, mode: 2 },
    { id: "b", time: 12, mode: 2 },
    { id: "c", time: 12, mode: 2 },
    { id: "d", time: 13, mode: 2 },
    { id: "e", time: 14, mode: 2 },
  ],
  {
    activeTracks: [],
    activeFixed: { top: [], bottom: [] },
    maxTracks: 2,
    maxOnScreen: 10,
    maxFixedPerSide: 2,
    durationSeconds: 8,
  },
);
assert.equal(fixedOverflow.planned.length, 2);
assert.equal(fixedOverflow.dropped, 3);
assert.deepEqual(
  fixedOverflow.planned.filter((entry) => entry.fixed === "top").map((entry) => entry.fixedSlot),
  [0, 1],
);

// 顶部与底部固定弹幕独立计数：每侧 1 槽，同刻各 2 条 → 每侧各保留 1、丢弃 1
const fixedSplit = layout.planDanmakuBatch(
  [
    { id: "t1", time: 12, mode: 2 },
    { id: "t2", time: 12, mode: 2 },
    { id: "b1", time: 12, mode: 3 },
    { id: "b2", time: 12, mode: 3 },
  ],
  {
    activeTracks: [],
    activeFixed: { top: [], bottom: [] },
    maxTracks: 2,
    maxOnScreen: 10,
    maxFixedPerSide: 1,
    durationSeconds: 8,
  },
);
assert.equal(fixedSplit.planned.length, 2);
assert.equal(fixedSplit.dropped, 2);
assert.deepEqual(
  fixedSplit.planned.map((entry) => [entry.fixed, entry.fixedSlot]),
  [
    ["top", 0],
    ["bottom", 0],
  ],
);

// 固定占用修剪：过期槽位释放
const pruned = layout.pruneFixedOccupancy(
  {
    top: [
      { track: 0, occupiedUntil: 10 },
      { track: 1, occupiedUntil: 25 },
    ],
    bottom: [{ track: 0, occupiedUntil: 8 }],
  },
  12,
);
assert.equal(pruned.top.length, 1);
assert.equal(pruned.bottom.length, 0);

console.log("danmaku layout tests passed");
