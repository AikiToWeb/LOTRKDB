// Build-time translation only: no player's data is sent to the translator.
// Public card text is cached, and edited translations are never overwritten.
import { readFile, writeFile } from "node:fs/promises";
import { plainText } from "../src/domain.mjs";
const path = "public/data/ko.json";
const catalog = JSON.parse(await readFile("public/data/catalog.json", "utf8"));
let output;
try {
  output = JSON.parse(await readFile(path, "utf8"));
} catch {
  output = { source: "Google Translate / project edits", cards: {} };
}
const terms = {
  willpower: "의지",
  attack: "공격",
  defense: "방어",
  leadership: "통솔",
  tactics: "전술",
  spirit: "정신",
  lore: "지식",
  baggins: "배긴스",
  fellowship: "원정대",
  unique: "고유",
};
function prepare(text) {
  return plainText(text)
    .replace(/\[([^\]]+)\]/g, (_, key) => terms[key] ?? key)
    .replace(/\bResponse:/g, "반응:")
    .replace(/\bForced:/g, "강제:")
    .replace(/\bAction:/g, "행동:")
    .replace(/\bRestricted\./g, "제한.");
}
const missing = catalog.cards.filter(
  (c) =>
    !output.cards[c.code] || output.cards[c.code].sourceText !== (c.text || ""),
);
const batches = [];
let batch = [],
  length = 0;
for (const c of missing) {
  const text = `${c.name}\n${c.traits || "—"}\n${prepare(c.text) || "별도 카드 효과 없음."}`;
  if (length + text.length > 2800 && batch.length) {
    batches.push(batch);
    batch = [];
    length = 0;
  }
  batch.push({ card: c, text });
  length += text.length + 30;
}
if (batch.length) batches.push(batch);
for (let i = 0; i < batches.length; i++) {
  const current = batches[i];
  const q = current
    .map(({ card, text }) => `ZXQ${card.code}QXZ\n${text}`)
    .join("\n\n");
  let translated;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const url =
        "https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=ko&dt=t&q=" +
        encodeURIComponent(q);
      const r = await fetch(url, { signal: AbortSignal.timeout(45000) });
      if (!r.ok) throw new Error(`Translation HTTP ${r.status}`);
      const data = await r.json();
      translated = data[0].map((row) => row[0]).join("");
      if (
        current.some(({ card }) => !translated.includes(`ZXQ${card.code}QXZ`))
      )
        throw new Error("Missing card delimiter");
      break;
    } catch (error) {
      if (attempt === 4) throw error;
      await new Promise((resolve) => setTimeout(resolve, 3000 * (attempt + 1)));
    }
  }
  for (let j = 0; j < current.length; j++) {
    const { card } = current[j];
    const start =
      translated.indexOf(`ZXQ${card.code}QXZ`) + `ZXQ${card.code}QXZ`.length;
    const end =
      j + 1 < current.length
        ? translated.indexOf(`ZXQ${current[j + 1].card.code}QXZ`)
        : translated.length;
    const lines = translated
      .slice(start, end)
      .trim()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    output.cards[card.code] = {
      name: lines[0],
      traits: lines[1],
      text: lines.slice(2).join("\n"),
      status: "machine",
      sourceText: card.text || "",
    };
  }
  output.updatedAt = new Date().toISOString();
  await writeFile(path, JSON.stringify(output, null, 2) + "\n");
  console.log(
    `Translated ${Object.keys(output.cards).length}/${catalog.cards.length}`,
  );
  await new Promise((resolve) => setTimeout(resolve, 400));
}
await import("./apply-korean-edits.mjs");
