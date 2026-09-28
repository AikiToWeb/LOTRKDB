import test from "node:test";
import assert from "node:assert/strict";
import { deckStats, emptyState, validateState, score } from "../src/domain.mjs";
import { parseRows } from "../scripts/sync-data.mjs";
test("deck checks duplicate hero names across printings, minimum size, limits", () => {
  const cards = [
    {
      code: "01001",
      name: "Aragorn",
      type_code: "hero",
      threat: 12,
      deck_limit: 1,
    },
    {
      code: "02001",
      name: "Aragorn",
      type_code: "hero",
      threat: 12,
      deck_limit: 1,
    },
    { code: "01020", name: "Test", type_code: "event", deck_limit: 3 },
  ];
  const result = deckStats({ "01001": 1, "02001": 1, "01020": 4 }, cards);
  assert.equal(result.threat, 24);
  assert.equal(result.total, 4);
  assert.ok(result.warnings.some((x) => x.includes("중복")));
  assert.ok(result.warnings.some((x) => x.includes("제한 초과")));
  assert.ok(result.warnings.some((x) => x.includes("46장")));
});
test("50-card valid base deck passes basic structural checks", () => {
  const cards = [
    {
      code: "01001",
      name: "Hero",
      type_code: "hero",
      threat: 9,
      deck_limit: 1,
    },
    ...Array.from({ length: 17 }, (_, n) => ({
      code: String(200 + n),
      name: String(n),
      type_code: "event",
      deck_limit: 3,
    })),
  ];
  const slots = { "01001": 1 };
  for (let i = 0; i < 17; i++) slots[String(200 + i)] = i === 16 ? 2 : 3;
  const result = deckStats(slots, cards);
  assert.equal(result.total, 50);
  assert.deepEqual(result.warnings, []);
});
test("backup validation rejects negative counts, malformed journal and invalid collection", () => {
  assert.deepEqual(
    validateState({ version: 1, state: emptyState() }),
    emptyState(),
  );
  assert.throws(() => validateState({ ...emptyState(), owned: [12] }));
  assert.throws(() =>
    validateState({
      ...emptyState(),
      decks: [
        {
          id: "x",
          name: "D",
          notes: "",
          updatedAt: "",
          slots: { "01001": -1 },
        },
      ],
    }),
  );
  assert.throws(() => validateState({ ...emptyState(), plays: [{ id: "x" }] }));
});
test("quest score uses completed rounds and all penalty totals", () =>
  assert.equal(
    score({ rounds: 5, threat: 31, damage: 4, deadThreat: 9, victory: 3 }),
    91,
  ));
test("SQL parser preserves punctuation, escaped apostrophes and unicode", () => {
  const rows = parseRows(
    "INSERT INTO `pack` VALUES (1,2,'Core','Sam\\'s (new), pack',3),(2,3,'X','Khazad-dûm',4);",
    "pack",
  );
  assert.equal(rows.length, 2);
  assert.equal(rows[0][3], "Sam's (new), pack");
  assert.equal(rows[1][3], "Khazad-dûm");
});
