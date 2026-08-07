import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";

const pluginDir = process.cwd();
const root = path.resolve(pluginDir, "../../..");
const manifest = path.join(pluginDir, "manifest.json");
const bundle = path.join(pluginDir, "dist", "bundle.js");

if (!existsSync(bundle)) {
  throw new Error("dist/bundle.js is missing; run npm run build first");
}

for (const target of [
  path.join(root, "plugins", "com.easygamehub.netease-music"),
  path.join(root, "resources", "defaults", "plugins", "com.easygamehub.netease-music"),
]) {
  mkdirSync(target, { recursive: true });
  copyFileSync(manifest, path.join(target, "manifest.json"));
  copyFileSync(bundle, path.join(target, "bundle.js"));
  console.log(`packed ${path.relative(root, target)}`);
}
