/**
 * 构建时生成应用元信息文件
 * 从 package.json 读取信息，写入 source/constants/meta.ts
 */

import { readFileSync, writeFileSync } from "fs";

const pkg = JSON.parse(readFileSync("package.json", "utf-8"));

const content = `// 此文件由 scripts/gen-meta.ts 自动生成，请勿手动修改
export const VERSION = "${pkg.version}";
export const APP_NAME = "${pkg.name}";
`;

writeFileSync("source/constants/meta.ts", content);
console.log(`Generated meta.ts: ${pkg.name} v${pkg.version}`);
