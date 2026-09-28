import { readFile, writeFile } from "node:fs/promises";
const catalog = JSON.parse(await readFile("public/data/catalog.json", "utf8"));
const ko = JSON.parse(await readFile("public/data/ko.json", "utf8"));
const edits = JSON.parse(
  await readFile("public/data/ko-reviewed.json", "utf8"),
);
const images = JSON.parse(await readFile("public/data/ko-images.json", "utf8"));
// Project terminology; these are not asserted to be official Korean titles.
const traits = {
  Accolade: "훈장",
  Adaptation: "적응",
  Advice: "조언",
  Archer: "궁수",
  Armor: "방어구",
  Artifact: "유물",
  Balchoth: "발코스",
  Beorning: "베오른족",
  Boon: "은혜",
  Bree: "브리",
  Burglar: "도둑",
  Condition: "상태",
  Corruption: "타락",
  Corsair: "해적",
  Craftsman: "장인",
  Creature: "생물",
  Dale: "데일",
  Dark: "어둠",
  Despair: "절망",
  Doom: "파멸",
  Dragon: "용",
  Dunedain: "두네다인",
  Dúnedain: "두네다인",
  Dwarf: "드워프",
  Eagle: "독수리",
  Easterling: "동부인",
  Elite: "정예",
  Enchantment: "마법",
  Ent: "엔트",
  Erebor: "에레보르",
  Esgaroth: "에스가로스",
  Favor: "은총",
  Fear: "공포",
  Fellowship: "원정대",
  Gift: "선물",
  Goblin: "고블린",
  Gollum: "골룸",
  Gondor: "곤도르",
  Harad: "하라드",
  Hazard: "위험",
  Healer: "치유사",
  Hobbit: "호빗",
  Instrument: "악기",
  Isengard: "아이센가드",
  Istari: "이스타리",
  Item: "물품",
  Khand: "칸드",
  Legend: "전설",
  Master: "대가",
  Mathom: "마솜",
  Mearas: "메아라스",
  Menacing: "위협적",
  Minstrel: "음유시인",
  Modification: "개조",
  Mount: "탈것",
  Nazgûl: "나즈굴",
  Noble: "귀족",
  Noldor: "놀도르",
  Oathbreaker: "맹세 파기자",
  Orc: "오크",
  Outlands: "변방",
  Pipe: "파이프",
  Pipeweed: "파이프 담배",
  Pony: "조랑말",
  Providence: "섭리",
  Raider: "약탈자",
  Ranger: "순찰자",
  Record: "기록",
  Rhûn: "룬",
  Ring: "반지",
  "Ring-bearer": "반지 운반자",
  Rohan: "로한",
  Scout: "정찰병",
  Servant: "종복",
  Service: "봉사",
  Ship: "선박",
  Shirriff: "보안관",
  Signal: "신호",
  Silvan: "실반",
  Skill: "기술",
  Song: "노래",
  Spell: "주문",
  Spider: "거미",
  Spirit: "정신",
  Staff: "지팡이",
  Steward: "섭정",
  Tactic: "전술",
  Tale: "이야기",
  Thaurdir: "사우르디르",
  "Tier 1": "등급 1",
  "Tier 2": "등급 2",
  Title: "칭호",
  Trap: "함정",
  Treasure: "보물",
  Undead: "언데드",
  Underground: "지하",
  Wall: "성벽",
  Warrior: "전사",
  Weapon: "무기",
  Woodman: "숲사람",
  Woodsman: "숲사람",
  Wose: "워스",
  Wound: "상처",
};
for (const card of catalog.cards) {
  const t = ko.cards[card.code];
  if (!t || t.sourceText !== (card.text || ""))
    throw Error(`Missing or stale translation: ${card.code}`);
  t.traits = (card.traits || "")
    .split(".")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => traits[s] || s)
    .join(". ");
  t.text = t.text
    .replace(/활력|의지력/g, "의지")
    .replace(/공격력/g, "공격")
    .replace(/방어력/g, "방어")
    .replace(/동맹국/g, "동료")
    .replace(/보초\./g, "감시자.")
    .replace(/섀도우 카드/g, "그림자 카드")
    .replace(/섀도우 효과/g, "그림자 효과")
    .replace(/자원 풀/g, "자원 저장소");
  const edit =
    edits[card.code] ||
    Object.entries(edits).find(
      ([code]) =>
        catalog.cards.find((c) => c.code === code)?.text === card.text &&
        catalog.cards.find((c) => c.code === code)?.name === card.name,
    )?.[1];
  if (edit) {
    t.name = edit[0];
    t.text = edit[1];
    t.status = "reviewed";
  }
  if (images.codes.includes(card.code)) {
    t.image = `/images/ko/${card.code}.jpg`;
    t.imageSource = images.source;
    t.imageCredit = `${images.author} · 비공식 팬 번역`;
  }
  if (card.text && !/[가-힣]/.test(t.text))
    throw Error(`No Korean effect: ${card.code}`);
}
ko.terminology = "Project Korean terminology; unofficial translation";
await writeFile("public/data/ko.json", JSON.stringify(ko, null, 2) + "\n");
console.log(
  `${catalog.cards.length} localized cards; ${Object.values(ko.cards).filter((t) => t.status === "reviewed").length} reviewed versions`,
);
