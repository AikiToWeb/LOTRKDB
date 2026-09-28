import type { Card, Pack, Scenario } from "./types";
const names: Record<string, string> = {
  "Passage Through Mirkwood": "어둠숲 통과",
  "Journey Along the Anduin": "안두인 강을 따라서",
  "Escape from Dol Guldur": "돌 굴두르 탈출",
  "Core Set": "코어세트 (구판)",
  "Revised Core Set": "코어 (개정판)",
  "The Dark of Mirkwood": "어둠숲의 암흑 시나리오 확장",
  "Ered Mithrin Campaign Expansion": "회색산맥 캠페인 확장",
  "Ered Mithrin Hero Expansion": "회색산맥 영웅 확장",
};
export const localizedName = (name: string) => names[name] || name;
export const scenarioName = (s?: Scenario, fallback = "") =>
  s ? s.name_ko || localizedName(s.name) : localizedName(fallback);
export const scenarioProductName = (s: Scenario) =>
  s.koreanProducts?.map((p) => p.name).join(" · ") || localizedName(s.pack);
export const scenarioSearchText = (s?: Scenario) =>
  s
    ? [s.name, scenarioName(s), s.pack, scenarioProductName(s)]
        .join(" ")
        .toLowerCase()
    : "";
export const productName = (name: string, code?: string, packs: Pack[] = []) =>
  packs.find((p) => p.code === code)?.name_ko || localizedName(name);
export const cardProductName = (c: Card, packs: Pack[]) => {
  const korean = (c.packs || [])
    .map((p) => packs.find((pack) => pack.code === p.pack_code))
    .filter((p) => p?.koreanEdition);
  return korean.length
    ? korean.map((p) => p!.name_ko || p!.name).join(" · ")
    : productName(c.pack_name, c.pack_code, packs);
};
