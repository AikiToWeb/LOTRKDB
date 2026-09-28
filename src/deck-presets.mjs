export const CORE_MANUAL_URL =
  "https://images-cdn.fantasyflightgames.com/filer_public/e9/2f/e92f2465-8a1e-4bfa-8293-ad0edd5e55c0/mec101_learn_to_play_eng_v11-compressed.pdf";
export const ORIGINAL_CORE_MANUAL_URL =
  "https://images-cdn.fantasyflightgames.com/filer_public/ed/c7/edc7c539-c4d4-461c-b998-17fa2451a303/learn_to_play.pdf";
const code = (n) => `01${String(n).padStart(3, "0")}`;
const slotsFrom = (entries) =>
  Object.fromEntries(entries.map(([n, count]) => [code(n), count]));

// FFG Revised Core Learn to Play, printed pages 5 and 27.
// Heroes are separate from the player deck. A starter contains two Gandalfs.
export function coreDeckPresets(cards, edition = "RevCore") {
  const revised = edition === "RevCore";
  const editionName = revised ? "코어 개정판" : "코어 구판";
  const tutorials = [
    [
      "leadership",
      "통솔",
      1,
      13,
      "자원과 동료를 활용하며 다른 플레이어를 지원합니다.",
    ],
    ["tactics", "전술", 4, 28, "공격·방어와 무기·방어구 사용을 익힙니다."],
    ["spirit", "정신", 7, 43, "퀘스트 진행과 조우 카드 대응을 익힙니다."],
    ["lore", "지식", 10, 58, "치유와 카드 뽑기로 원정대를 지원합니다."],
  ].map(([id, label, heroStart, start, description]) => {
    const entries = Array.from({ length: 3 }, (_, i) => [heroStart + i, 1]);
    for (let n = start; n < start + 15; n++) {
      const card = cards.find((c) => c.code === code(n));
      if (!card) throw new Error(`프리셋에 필요한 카드가 없습니다: ${code(n)}`);
      const quantity = revised
        ? 3
        : card.packs?.find((p) => p.pack_code === "Core")?.quantity;
      if (!quantity)
        throw new Error(`코어 수량을 확인할 수 없습니다: ${code(n)}`);
      entries.push([n, quantity]);
    }
    entries.push([73, revised ? 2 : 1]);
    return {
      id: `${edition}-${id}`,
      name: `${editionName} · ${label} 튜토리얼`,
      kind: "tutorial",
      description,
      guidance: `해당 영역의 코어 카드 전체와 간달프 ${revised ? 2 : 1}장을 사용합니다. 영웅을 제외한 ${revised ? 47 : 30}장 학습용 덱이며, 일반 50장 덱 규칙의 예외입니다.`,
      page: revised ? 5 : 6,
      slots: slotsFrom(entries),
    };
  });
  if (!revised) return tutorials;
  return [
    ...tutorials,
    {
      id: "RevCore-leadership-spirit",
      name: "매뉴얼 추천 · 통솔·정신",
      kind: "recommended",
      description: "1인 플레이 추천. 동료 전개와 퀘스트 진행에 집중합니다.",
      guidance:
        "코어 개정판 매뉴얼 27쪽의 50장 덱입니다. 지식·전술 덱과 함께 2인 플레이에도 사용할 수 있습니다.",
      page: 27,
      slots: slotsFrom([
        [1, 1],
        [2, 1],
        [7, 1],
        [73, 3],
        [14, 2],
        [13, 3],
        [18, 2],
        [17, 2],
        [16, 3],
        [15, 2],
        [44, 2],
        [45, 2],
        [43, 3],
        [25, 2],
        [23, 3],
        [24, 3],
        [50, 3],
        [53, 2],
        [51, 2],
        [46, 2],
        [27, 3],
        [26, 3],
        [57, 3],
      ]),
    },
    {
      id: "RevCore-lore-tactics",
      name: "매뉴얼 추천 · 지식·전술",
      kind: "recommended",
      description: "2인 플레이 지원. 카드 뽑기와 전투를 맡습니다.",
      guidance:
        "코어 개정판 매뉴얼 27쪽의 50장 덱입니다. 통솔·정신 덱과 함께 사용하도록 추천된 구성입니다.",
      page: 27,
      slots: slotsFrom([
        [12, 1],
        [10, 1],
        [5, 1],
        [73, 3],
        [62, 3],
        [60, 3],
        [58, 3],
        [59, 3],
        [61, 3],
        [29, 3],
        [28, 3],
        [65, 3],
        [66, 3],
        [32, 3],
        [34, 3],
        [35, 3],
        [69, 2],
        [70, 3],
        [42, 3],
        [39, 3],
      ]),
    },
  ];
}
