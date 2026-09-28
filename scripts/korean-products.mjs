// Product aliases preserve RingsDB card codes and scenario IDs across reprints.
export const koreanProducts = [
  { code: "RevCore", name_ko: "코어 (개정판)", scenarioIds: ["1", "2", "3"] },
  {
    code: "TDoM",
    name_ko: "어둠숲의 암흑 시나리오 확장",
    scenarioIds: ["100", "101"],
  },
  {
    code: "EMCE",
    name_ko: "회색산맥 캠페인 확장",
    scenarioIds: ["95", "96", "99", "102", "103", "104", "105", "106", "107"],
  },
  { code: "EMHE", name_ko: "회색산맥 영웅 확장", scenarioIds: [] },
];
const heroSources = new Set([
  "TWoR",
  "TWH",
  "RAR",
  "FitN",
  "TGoF",
  "MG",
  "TFoW",
]);
export function addKoreanProducts(catalog) {
  if (!catalog.packs.some((p) => p.code === "EMHE")) {
    catalog.packs.push({
      code: "EMHE",
      name: "Ered Mithrin Hero Expansion",
      source:
        "https://www.fantasyflightgames.com/en/products/the-lord-of-the-rings-the-card-game/products/ered-mithrin-hero-expansion/",
      projectAlias: true,
    });
  }
  for (const [index, product] of koreanProducts.entries()) {
    const pack = catalog.packs.find((p) => p.code === product.code);
    if (!pack) throw new Error(`Missing Korean product ${product.code}`);
    Object.assign(pack, {
      name_ko: product.name_ko,
      koreanEdition: true,
      koreanOrder: index,
    });
  }
  for (const card of catalog.cards) {
    if (
      !heroSources.has(card.pack_code) ||
      !["hero", "ally", "attachment", "event"].includes(card.type_code)
    )
      continue;
    card.packs ??= [
      {
        pack_code: card.pack_code,
        pack_name: card.pack_name,
        quantity: card.quantity ?? (card.type_code === "hero" ? 1 : 3),
      },
    ];
    if (!card.packs.some((p) => p.pack_code === "EMHE"))
      card.packs.push({
        pack_code: "EMHE",
        pack_name: "회색산맥 영웅 확장",
        quantity: card.type_code === "hero" ? 1 : 3,
      });
  }
  for (const scenario of catalog.scenarios) {
    scenario.koreanProducts = koreanProducts
      .filter((p) => p.scenarioIds.includes(scenario.id))
      .map((p) => ({ code: p.code, name: p.name_ko }));
  }
  catalog.packs.sort((a, b) => (a.koreanOrder ?? 99) - (b.koreanOrder ?? 99));
  return catalog;
}
