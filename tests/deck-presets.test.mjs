import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { coreDeckPresets } from "../src/deck-presets.mjs";
import { deckStats, emptyState, validateState } from "../src/domain.mjs";
const cards = JSON.parse(
  readFileSync(new URL("../public/data/catalog.json", import.meta.url)),
).cards;

test("core tutorials use each sphere's full printed range, heroes and two Gandalfs", () => {
  for (const edition of ["RevCore", "Core"]) {
    const tutorials = coreDeckPresets(cards, edition).filter(
      (p) => p.kind === "tutorial",
    );
    assert.equal(tutorials.length, 4);
    tutorials.forEach((p, index) => {
      const stats = deckStats(p.slots, cards);
      assert.equal(stats.heroes, 3);
      assert.equal(stats.total, edition === "RevCore" ? 47 : 30);
      assert.equal(stats.warnings.length, 1); // Only the intentionally smaller learning deck.
      assert.equal(p.slots["01073"], edition === "RevCore" ? 2 : 1);
      const sphere = ["leadership", "tactics", "spirit", "lore"][index];
      const expected = cards.filter(
        (c) => c.pack_code === "Core" && c.sphere_code === sphere,
      );
      assert.equal(Object.keys(p.slots).length, expected.length + 1);
      for (const c of expected)
        assert.equal(
          p.slots[c.code],
          c.type_code === "hero"
            ? 1
            : edition === "RevCore"
              ? 3
              : c.packs.find((pack) => pack.pack_code === "Core").quantity,
        );
    });
  }
});

test("manual recommended decks contain 50 playable cards, correct heroes and distinct saved identities", () => {
  const recommended = coreDeckPresets(cards).filter(
    (p) => p.kind === "recommended",
  );
  assert.equal(recommended.length, 2);
  assert.deepEqual(
    recommended.map((p) =>
      Object.keys(p.slots).filter(
        (code) => cards.find((c) => c.code === code).type_code === "hero",
      ),
    ),
    [
      ["01001", "01002", "01007"],
      ["01012", "01010", "01005"],
    ],
  );
  const decks = recommended.map((p, i) => ({
    id: `preset-${i}`,
    name: p.name,
    notes: p.guidance,
    slots: { ...p.slots },
    updatedAt: new Date().toISOString(),
  }));
  for (const deck of decks) {
    assert.equal(deckStats(deck.slots, cards).total, 50);
    assert.deepEqual(deckStats(deck.slots, cards).warnings, []);
    for (const code of Object.keys(deck.slots))
      assert.equal(cards.find((c) => c.code === code).pack_code, "Core");
  }
  assert.equal(recommended[0].slots["01057"], 3); // Revised quantity, not the original core's singleton.
  assert.equal(recommended[1].slots["01069"], 2);
  assert.equal(validateState({ ...emptyState(), decks }).decks.length, 2);
  decks[0].slots["01073"] = 1;
  assert.equal(recommended[0].slots["01073"], 3); // Editing an instance cannot alter the preset.
});
