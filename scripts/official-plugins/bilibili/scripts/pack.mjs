import { copyFileSync, cpSync, existsSync, mkdirSync, rmSync } from "node:fs";
import path from "node:path";

const pluginDir = process.cwd();
const root = path.resolve(pluginDir, "../../..");
const manifest = path.join(pluginDir, "manifest.json");
const bundle = path.join(pluginDir, "dist", "bundle.js");
const assets = path.join(pluginDir, "assets");

if (!existsSync(bundle)) {
  throw new Error("dist/bundle.js is missing; run npm run build first");
}

for (const target of [
  path.join(root, "plugins", "com.easygamehub.bilibili"),
  path.join(root, "resources", "defaults", "plugins", "com.easygamehub.bilibili"),
]) {
  mkdirSync(target, { recursive: true });
  copyFileSync(manifest, path.join(target, "manifest.json"));
  copyFileSync(bundle, path.join(target, "bundle.js"));
  const targetAssets = path.join(target, "assets");
  rmSync(targetAssets, { recursive: true, force: true });
  if (existsSync(assets)) {
    cpSync(assets, targetAssets, { recursive: true });
  }
  console.log(`packed ${path.relative(root, target)}`);
}
