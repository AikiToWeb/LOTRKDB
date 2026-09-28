import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  addKoreanProducts,
  koreanProducts,
} from "../scripts/korean-products.mjs";
const catalog = JSON.parse(
  await readFile(
    new URL("../public/data/catalog.json", import.meta.url),
    "utf8",
  ),
);
test("four Korean products are distinct and the hero expansion has 209 physical cards", () => {
  assert.deepEqual(
    catalog.packs.filter((p) => p.koreanEdition).map((p) => p.code),
    koreanProducts.map((p) => p.code),
  );
  const cards = catalog.cards.filter((c) =>
    c.packs?.some((p) => p.pack_code === "EMHE"),
  );
  assert.equal(cards.length, 75);
  assert.equal(cards.filter((c) => c.type_code === "hero").length, 8);
  assert.equal(
    cards.reduce(
      (sum, c) => sum + c.packs.find((p) => p.pack_code === "EMHE").quantity,
      0,
    ),
    209,
  );
  assert.ok(
    cards.every((c) => !c.packs.some((p) => p.pack_code === "EMCE")),
    "Campaign ownership must not unlock hero expansion cards",
  );
});
test("reprint products keep scenario IDs and importing the aliases is idempotent", () => {
  assert.deepEqual(
    catalog.scenarios
      .filter((s) => s.koreanProducts?.some((p) => p.code === "TDoM"))
      .map((s) => s.pack),
    ["The Dark of Mirkwood", "The Dark of Mirkwood"],
  );
  for (const product of koreanProducts) {
    assert.deepEqual(
      catalog.scenarios
        .filter((s) => s.koreanProducts?.some((p) => p.code === product.code))
        .map((s) => s.id)
        .sort(),
      [...product.scenarioIds].sort(),
    );
  }
  assert.equal(
    JSON.stringify(addKoreanProducts(structuredClone(catalog))),
    JSON.stringify(catalog),
  );
});
