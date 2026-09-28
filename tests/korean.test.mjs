import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
const catalog = JSON.parse(
  await readFile(
    new URL("../public/data/catalog.json", import.meta.url),
    "utf8",
  ),
);
const ko = JSON.parse(
  await readFile(new URL("../public/data/ko.json", import.meta.url), "utf8"),
);
const images = JSON.parse(
  await readFile(
    new URL("../public/data/ko-images.json", import.meta.url),
    "utf8",
  ),
);
test("every card has a Korean effect matching the current English revision", () => {
  for (const card of catalog.cards) {
    const t = ko.cards[card.code];
    assert.ok(t, card.code);
    assert.equal(
      t.sourceText,
      card.text || "",
      `Stale translation ${card.code}`,
    );
    assert.match(t.text, /[가-힣]/, `No Korean effect ${card.code}`);
    assert.ok(["machine", "reviewed"].includes(t.status));
    assert.ok(!t.text.includes("ZXQ"), "Translation delimiter leaked");
  }
});
test("core cards are reviewed, including timing, costs, errata, and limits", () => {
  for (const c of catalog.cards.filter((c) => c.pack_code === "Core"))
    assert.equal(ko.cards[c.code].status, "reviewed", c.code);
  assert.match(ko.cards["01001"].text, /퀘스트에 참여한 후/);
  assert.match(ko.cards["01007"].text, /각 플레이어.*라운드.*1번/);
  assert.match(ko.cards["01042"].text, /파괴된 후/);
  assert.match(ko.cards["04061"].text, /두린의 유산을 소진/);
  assert.notEqual(
    ko.cards["01003"].text,
    ko.cards["132006"].text,
    "Hero and ally Glóin must not share an effect",
  );
});
test("Korean image manifest maps to real cards and local JPEGs with attribution", async () => {
  assert.equal(images.codes.length, 31);
  assert.equal(new Set(images.codes).size, images.codes.length);
  for (const code of images.codes) {
    assert.ok(
      catalog.cards.some((c) => c.code === code),
      code,
    );
    const t = ko.cards[code];
    assert.equal(t.image, `/images/ko/${code}.jpg`);
    assert.equal(t.imageSource, images.source);
    assert.match(t.imageCredit, /비공식 팬 번역/);
    const data = await readFile(
      new URL(`../public/images/ko/${code}.jpg`, import.meta.url),
    );
    assert.equal(data[0], 0xff);
    assert.equal(data[1], 0xd8);
  }
});
