import { useMemo, useState } from "react";
import type { Card, Deck } from "./types";
import {
  coreDeckPresets,
  CORE_MANUAL_URL,
  ORIGINAL_CORE_MANUAL_URL,
} from "./deck-presets.mjs";
import { deckStats } from "./domain.mjs";
import { cardName } from "./CardBrowser";

export function DeckPresets({
  cards,
  busy,
  onRegister,
  onBlank,
}: {
  cards: Card[];
  busy: boolean;
  onRegister: (deck: Deck) => Promise<void>;
  onBlank: () => void;
}) {
  const [edition, setEdition] = useState("RevCore");
  const [selected, setSelected] = useState("RevCore-leadership");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const presets = useMemo(
    () => coreDeckPresets(cards, edition),
    [cards, edition],
  );
  const preset = presets.find((p) => p.id === selected) ?? presets[0];
  const stats = deckStats(preset.slots, cards);
  const manualUrl =
    edition === "Core" ? ORIGINAL_CORE_MANUAL_URL : CORE_MANUAL_URL;
  const heroes = Object.keys(preset.slots)
    .map((code) => cards.find((c) => c.code === code))
    .filter((c) => c?.type_code === "hero");
  return (
    <div className="deck-presets">
      <p>
        프리셋을 골라 바로 등록하거나 빈 덱에서 시작하세요. 등록한 덱은 자유롭게
        편집하고 공동 방에 사용할 수 있습니다.
      </p>
      <label className="field">
        코어 세트 판본
        <select
          value={edition}
          disabled={busy}
          onChange={(e) => {
            setEdition(e.target.value);
            setSelected(`${e.target.value}-leadership`);
            setName("");
            setError("");
          }}
        >
          <option value="RevCore">
            코어 개정판 · 튜토리얼 4종 + 매뉴얼 추천 2종
          </option>
          <option value="Core">코어 구판 · 튜토리얼 4종</option>
        </select>
      </label>
      <div className="preset-grid" role="group" aria-label="코어 덱 프리셋">
        {presets.map((p) => (
          <button
            key={p.id}
            type="button"
            className={`preset-choice ${p.id === preset.id ? "selected" : ""}`}
            aria-pressed={p.id === preset.id}
            disabled={busy}
            onClick={() => {
              setSelected(p.id);
              setName("");
              setError("");
            }}
          >
            <strong>{p.name}</strong>
            <span>{p.description}</span>
            <small>
              {p.kind === "tutorial" ? "튜토리얼" : "매뉴얼 추천"} · 영웅 3명 ·
              덱 {deckStats(p.slots, cards).total}장
            </small>
          </button>
        ))}
      </div>
      <section className="preset-preview" aria-label="선택한 프리셋 구성">
        <h3>{preset.name}</h3>
        <p>{heroes.map((c) => cardName(c!)).join(" · ")}</p>
        <p>
          영웅 {stats.heroes}명 · 덱 {stats.total}장 · 시작 위협 {stats.threat}
        </p>
        <p className="notice">{preset.guidance}</p>
        <details>
          <summary>전체 카드 구성 보기</summary>
          <ul>
            {Object.entries(preset.slots).map(([code, count]) => {
              const card = cards.find((c) => c.code === code)!;
              return (
                <li key={code}>
                  {cardName(card)}{" "}
                  <span>
                    ×{count}
                    {card.type_code === "hero" ? " · 영웅" : ""}
                  </span>
                </li>
              );
            })}
          </ul>
        </details>
        <a
          href={`${manualUrl}#page=${preset.page}`}
          target="_blank"
          rel="noreferrer"
        >
          공식 {edition === "Core" ? "구판" : "개정판"} 매뉴얼 {preset.page}쪽
        </a>
        {edition === "Core" && (
          <p className="muted">
            구판은 같은 카드 범위에 구판 코어 1상자의 수량을 적용합니다.
          </p>
        )}
      </section>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          setError("");
          try {
            await onRegister({
              id: crypto.randomUUID(),
              name: name.trim() || preset.name,
              slots: { ...preset.slots },
              notes: `${preset.description}\n${preset.guidance}\n출처: FFG Learn to Play ${preset.page}쪽 (${edition === "Core" ? "코어 구판" : "코어 개정판"})\n${manualUrl}`,
              updatedAt: new Date().toISOString(),
            });
          } catch (e) {
            setError((e as Error).message);
          }
        }}
      >
        <label className="field">
          등록할 덱 이름
          <input
            maxLength={100}
            value={name}
            placeholder={preset.name}
            disabled={busy}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        <div className="button-row">
          <button className="btn primary" disabled={busy}>
            {busy ? "등록 중…" : "프리셋 덱 등록"}
          </button>
          <button
            className="btn"
            type="button"
            disabled={busy}
            onClick={onBlank}
          >
            빈 덱으로 시작
          </button>
        </div>
      </form>
    </div>
  );
}
