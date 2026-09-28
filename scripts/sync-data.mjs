import { mkdir, writeFile, rename } from "node:fs/promises";
import { addKoreanProducts } from "./korean-products.mjs";
const base = "https://ringsdb.com";
async function get(url, json = true) {
  const r = await fetch(url, { signal: AbortSignal.timeout(60000) });
  if (!r.ok) throw new Error(`${url}: ${r.status}`);
  return json ? r.json() : r.text();
}
// Parse the upstream MySQL VALUES export as data; never execute upstream SQL.
export function parseRows(sql, table) {
  const line = sql.match(
    new RegExp("INSERT INTO `" + table + "` VALUES ([^\\n]+)"),
  )?.[1];
  if (!line) throw new Error(`No ${table} rows in upstream export`);
  const rows = [];
  let row = [],
    value = "",
    quoted = false,
    inRow = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === "\\") {
        value += line[++i] ?? "";
      } else if (ch === "'") quoted = false;
      else value += ch;
      continue;
    }
    if (ch === "'") {
      quoted = true;
      continue;
    }
    if (ch === "(") {
      row = [];
      value = "";
      inRow = true;
      continue;
    }
    if (inRow && (ch === "," || ch === ")")) {
      row.push(value);
      value = "";
      if (ch === ")") {
        rows.push(row);
        inRow = false;
      }
      continue;
    }
    if (inRow) value += ch;
  }
  return rows;
}
async function main() {
  const [cards, packs, sql] = await Promise.all([
    get(`${base}/api/public/cards/`),
    get(`${base}/api/public/packs/`),
    get(
      "https://raw.githubusercontent.com/seastan/ringsdb/master/ringsdb_bootstrap.sql",
      false,
    ),
  ]);
  if (!Array.isArray(cards) || cards.length < 100 || !Array.isArray(packs))
    throw new Error("Unexpected RingsDB response");
  const packMap = new Map(parseRows(sql, "pack").map((r) => [r[0], r[3]]));
  const scenarios = parseRows(sql, "scenario").map((r) => ({
    id: r[0],
    name: r[4],
    pack: packMap.get(r[1]) ?? "Unknown",
    source: `${base}/api/public/scenario/${r[0]}.json`,
  }));
  if (scenarios.length < 3) throw new Error("Incomplete scenario catalogue");
  const catalog = {
    cards,
    packs,
    scenarios,
    syncedAt: new Date().toISOString(),
    sources: [`${base}/api/`, "https://github.com/seastan/ringsdb"],
  };
  addKoreanProducts(catalog);
  await mkdir("public/data", { recursive: true });
  await writeFile("public/data/catalog.tmp.json", JSON.stringify(catalog));
  await rename("public/data/catalog.tmp.json", "public/data/catalog.json");
  console.log(
    `Saved ${cards.length} cards, ${packs.length} packs, ${scenarios.length} scenarios.`,
  );
}
if (process.argv[1]?.endsWith("sync-data.mjs"))
  main().catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
