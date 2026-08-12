#!/usr/bin/env node
/**
 * 校验插件 sdk.d.ts 与宿主 sdk.ts 的 bilibili 命名空间方法签名同步。
 *
 * 提取两个文件中 bilibili 块内所有 `xxx(args` 形式的方法名集合做比对，
 * 不匹配（宿主新增/插件缺失或反之）即退出码 1，构建失败。
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pluginRoot = join(here, "..");
const hostSdk = join(pluginRoot, "..", "..", "..", "src", "plugins", "sdk.ts");
const pluginSdkDts = join(pluginRoot, "src", "sdk.d.ts");

function extractBilibiliBlock(source) {
  const start = source.indexOf("bilibili: {");
  if (start < 0) throw new Error("host sdk.ts: bilibili namespace not found");
  let depth = 0;
  for (let i = start; i < source.length; i++) {
    if (source[i] === "{") depth++;
    else if (source[i] === "}") {
      depth--;
      if (depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error("host sdk.ts: bilibili namespace block not closed");
}

/** 提取 `name(args` 或 `name(args:` 形式的方法名集合（含子命名空间方法） */
function methodNames(block) {
  const names = new Set();
  const re = /([A-Za-z][A-Za-z0-9]*)\s*\(\s*args\b/g;
  let match;
  while ((match = re.exec(block)) !== null) {
    names.add(match[1]);
  }
  return names;
}

const hostSource = readFileSync(hostSdk, "utf8");
const dtsSource = readFileSync(pluginSdkDts, "utf8");
const hostNames = methodNames(extractBilibiliBlock(hostSource));
const dtsNames = methodNames(extractBilibiliBlock(dtsSource));

const onlyHost = [...hostNames].filter((name) => !dtsNames.has(name)).sort();
const onlyDts = [...dtsNames].filter((name) => !hostNames.has(name)).sort();

if (onlyHost.length > 0 || onlyDts.length > 0) {
  console.error("[check-sdk-sync] bilibili 命名空间方法签名不同步：");
  if (onlyHost.length > 0) console.error("  宿主 sdk.ts 有、插件 sdk.d.ts 缺失：", onlyHost.join(", "));
  if (onlyDts.length > 0) console.error("  插件 sdk.d.ts 有、宿主 sdk.ts 缺失：", onlyDts.join(", "));
  process.exit(1);
}
console.log(`[check-sdk-sync] OK：${hostNames.size} 个 bilibili 方法签名一致`);
