import { readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";

// 공개할 이미지를 public/stickers/에 넣은 뒤 실행합니다. 원격 사이트를 수집하지 않습니다.
const directory = join(process.cwd(), "public", "stickers");
const files = (await readdir(directory)).filter(name => /\.(png|jpe?g|webp|avif|gif)$/i.test(name)).sort();
const catalog = files.map(name => ({ id: `catalog:${name}`, name: name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "), src: `/stickers/${encodeURIComponent(name)}` }));
await writeFile(join(directory, "catalog.json"), JSON.stringify(catalog, null, 2) + "\n", "utf8");
console.log(`공용 이미지 스티커 ${catalog.length}개를 등록했습니다.`);
