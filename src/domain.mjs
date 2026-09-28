export const emptyState = () => ({
  decks: [],
  plays: [],
  owned: [],
  campaigns: [],
});
export function deckStats(slots, cards) {
  const map = new Map(cards.map((c) => [c.code, c]));
  let heroes = 0,
    total = 0,
    threat = 0;
  const warnings = [];
  const heroNames = new Set();
  for (const [code, count] of Object.entries(slots)) {
    const c = map.get(code);
    if (!c) {
      warnings.push(`알 수 없는 카드: ${code}`);
      continue;
    }
    if (!Number.isInteger(count) || count < 1) {
      warnings.push(`${c.name_ko || c.name}: 잘못된 수량`);
      continue;
    }
    if (count > (c.deck_limit ?? 3))
      warnings.push(`${c.name_ko || c.name}: 카드 수량 제한 초과`);
    if (c.type_code === "hero") {
      heroes += count;
      threat += (c.threat ?? 0) * count;
      if (heroNames.has(c.name))
        warnings.push(`${c.name_ko || c.name}: 같은 이름의 영웅 중복`);
      heroNames.add(c.name);
    } else if (
      ["ally", "attachment", "event", "player-side-quest"].includes(c.type_code)
    )
      total += count;
    else
      warnings.push(
        `${c.name_ko || c.name}: 일반 플레이어 덱에 넣을 수 없는 카드`,
      );
  }
  if (heroes < 1 || heroes > 3)
    warnings.push("일반 덱은 영웅 1~3명으로 구성합니다.");
  if (total < 50)
    warnings.push(`일반 덱 최소 50장까지 ${50 - total}장 남았습니다.`);
  return { heroes, total, threat, warnings };
}
export function validateState(value) {
  if (!value || typeof value !== "object")
    throw new Error("백업 형식이 올바르지 않습니다.");
  const state = value.state ?? value;
  for (const key of ["decks", "plays", "owned", "campaigns"])
    if (!Array.isArray(state[key]))
      throw new Error(`백업에 ${key} 항목이 없습니다.`);
  if (state.owned.some((x) => typeof x !== "string"))
    throw new Error("보유 확장팩 형식이 올바르지 않습니다.");
  const ids = new Set();
  for (const d of state.decks) {
    if (
      typeof d.id !== "string" ||
      ids.has(d.id) ||
      typeof d.name !== "string" ||
      typeof d.notes !== "string" ||
      typeof d.updatedAt !== "string" ||
      !d.slots ||
      typeof d.slots !== "object" ||
      Array.isArray(d.slots)
    )
      throw new Error("덱 형식이 올바르지 않습니다.");
    ids.add(d.id);
    if (
      Object.entries(d.slots).some(
        ([code, n]) =>
          !/^\d+$/.test(code) || !Number.isInteger(n) || n < 1 || n > 99,
      )
    )
      throw new Error("덱 카드 수량이 올바르지 않습니다.");
  }
  for (const p of state.plays)
    if (
      typeof p.id !== "string" ||
      typeof p.scenarioId !== "string" ||
      typeof p.deckId !== "string" ||
      typeof p.deckName !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(p.date) ||
      !["win", "loss", "playing"].includes(p.result) ||
      typeof p.notes !== "string" ||
      typeof p.mode !== "string" ||
      !Number.isInteger(p.players) ||
      p.players < 1 ||
      p.players > 4 ||
      ["rounds", "threat", "damage", "deadThreat", "victory"].some(
        (k) => !Number.isInteger(p[k]) || p[k] < 0,
      )
    )
      throw new Error("플레이 기록 형식이 올바르지 않습니다.");
  for (const c of state.campaigns)
    if (
      typeof c.id !== "string" ||
      typeof c.name !== "string" ||
      typeof c.notes !== "string" ||
      typeof c.boons !== "string" ||
      typeof c.burdens !== "string" ||
      !Array.isArray(c.scenarioIds) ||
      c.scenarioIds.some((x) => typeof x !== "string")
    )
      throw new Error("캠페인 형식이 올바르지 않습니다.");
  return {
    decks: state.decks,
    plays: state.plays,
    owned: state.owned,
    campaigns: state.campaigns,
  };
}
export const score = (p) =>
  p.rounds * 10 + p.threat + p.damage + p.deadThreat - p.victory;
export const plainText = (text) =>
  (text ?? "")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"');
