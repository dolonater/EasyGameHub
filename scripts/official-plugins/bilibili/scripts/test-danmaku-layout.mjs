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
    maxTracks: 2,
    maxOnScreen: 4,
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
    maxTracks: 4,
    maxOnScreen: 1,
    durationSeconds: 8,
  },
);
assert.equal(overLimit.planned.length, 1);
assert.equal(overLimit.dropped, 1);

console.log("danmaku layout tests passed");
