import { useEffect, useMemo, useState } from "react";
import { Search, ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import type { Card, Catalog } from "./types";
import { plainText } from "./domain.mjs";

export const sphereNames: Record<string, string> = {
  leadership: "통솔",
  tactics: "전술",
  spirit: "정신",
  lore: "지식",
  neutral: "중립",
  baggins: "배긴스",
  fellowship: "원정대",
};
const typeNames: Record<string, string> = {
  hero: "영웅",
  ally: "동료",
  attachment: "부착",
  event: "이벤트",
  contract: "계약",
  treasure: "보물",
  "player-side-quest": "부가 퀘스트",
  "player-objective": "플레이어 목적",
};
export const cardName = (c: Card) => c.name_ko || c.name;
export const cardSearchText = (c: Card) =>
  `${c.name} ${c.name_ko || ""} ${c.traits || ""} ${c.traits_ko || ""} ${plainText(c.text)} ${c.text_ko || ""} ${c.code}`.toLowerCase();
export function CardRules({ card }: { card: Card }) {
  return (
    <div className="card-rules">
      <h4>카드 효과 · 한국어</h4>
      <p className="rules-text" lang="ko">
        {card.text_ko ||
          (card.text
            ? "한국어 번역을 불러오지 못했습니다. 아래 원문을 확인하세요."
            : "별도 카드 효과가 없습니다.")}
      </p>
      <p className="translation-label">
        {card.translation_status === "reviewed"
          ? "프로젝트 검수 번역 · 비공식"
          : "자동 번역 · 비공식 — 규칙 판정은 영문 원문을 확인하세요."}
      </p>
      <details className="original-rules">
        <summary>영문 효과 원문 보기</summary>
        <p className="rules-text" lang="en">
          {plainText(card.text) || "No additional card effect."}
        </p>
      </details>
      {card.image_ko_source && (
        <a
          className="image-credit"
          href={card.image_ko_source}
          target="_blank"
          rel="noreferrer"
        >
          한글 이미지 · {card.image_ko_credit || "비공식 팬 번역"} ↗
        </a>
      )}
    </div>
  );
}
export function CardPreview({
  card,
  onDetail,
}: {
  card: Card;
  onDetail?: (c: Card) => void;
}) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [card.code]);
  return (
    <section className="inline-preview" aria-label="선택한 카드 미리보기">
      <div className="preview-image">
        {!failed && (card.image_ko || card.imagesrc) ? (
          <img
            loading="lazy"
            src={
              card.image_ko ||
              new URL(card.imagesrc!, "https://ringsdb.com").href
            }
            alt={`${cardName(card)} 카드 이미지`}
            onError={() => setFailed(true)}
          />
        ) : (
          <div className="image-fallback">이미지를 불러올 수 없습니다.</div>
        )}
        <span>
          {card.image_ko ? "한글 이미지" : "영문 이미지"} · {card.code}
        </span>
      </div>
      <div className="preview-copy">
        <h3>{cardName(card)}</h3>
        <p className="english-name">{card.name}</p>
        <div className="button-row">
          <span className={`sphere ${card.sphere_code}`}>
            {sphereNames[card.sphere_code]}
          </span>
          <span className="badge">
            {typeNames[card.type_code] || card.type_name}
          </span>
          {card.is_unique && <span className="badge">고유</span>}
        </div>
        <p className="traits">{card.traits_ko || card.traits}</p>
        <div className="compact-values">
          {(
            [
              ["비용", card.cost],
              ["위협", card.threat],
              ["의지", card.willpower],
              ["공격", card.attack],
              ["방어", card.defense],
              ["체력", card.health],
            ] as const
          )
            .filter(([, v]) => v !== undefined)
            .map(([k, v]) => (
              <span key={k}>
                {k} <b>{v}</b>
              </span>
            ))}
        </div>
        <CardRules card={card} />
        {onDetail && (
          <button
            type="button"
            className="btn small"
            onClick={() => onDetail(card)}
          >
            수록 제품 · 상세 보기
          </button>
        )}
      </div>
    </section>
  );
}

export function CardBrowser({
  catalog,
  owned,
  onDetail,
}: {
  catalog: Catalog;
  owned: string[];
  onDetail: (c: Card) => void;
}) {
  const [query, setQuery] = useState(""),
    [sphere, setSphere] = useState(""),
    [type, setType] = useState(""),
    [pack, setPack] = useState(""),
    [trait, setTrait] = useState(""),
    [ownedOnly, setOwnedOnly] = useState(false),
    [unique, setUnique] = useState(false),
    [errata, setErrata] = useState(false),
    [maxCost, setMaxCost] = useState(""),
    [sort, setSort] = useState("code"),
    [page, setPage] = useState(1),
    [display, setDisplay] = useState("table"),
    [selected, setSelected] = useState<Card | null>(null),
    [setsOpen, setSetsOpen] = useState(() => window.innerWidth > 800);
  const traits = useMemo(
    () =>
      [
        ...new Set(
          catalog.cards.flatMap((c) =>
            (c.traits || "")
              .split(".")
              .map((s) => s.trim())
              .filter(Boolean),
          ),
        ),
      ].sort(),
    [catalog],
  );
  const traitLabels = useMemo(
    () =>
      Object.fromEntries(
        catalog.cards.flatMap((c) => {
          const en = (c.traits || "")
              .split(".")
              .map((t) => t.trim())
              .filter(Boolean),
            ko = (c.traits_ko || "")
              .split(".")
              .map((t) => t.trim())
              .filter(Boolean);
          return en.map((t, i) => [t, ko[i] || t]);
        }),
      ),
    [catalog],
  );
  const filtered = useMemo(
    () =>
      catalog.cards
        .filter(
          (c) =>
            cardSearchText(c).includes(query.trim().toLowerCase()) &&
            (!sphere || c.sphere_code === sphere) &&
            (!type || c.type_code === type) &&
            (!pack ||
              c.pack_code === pack ||
              c.packs?.some((p) => p.pack_code === pack)) &&
            (!trait ||
              (c.traits || "")
                .split(".")
                .map((t) => t.trim())
                .includes(trait)) &&
            (!ownedOnly ||
              owned.includes(c.pack_code) ||
              c.packs?.some((p) => owned.includes(p.pack_code))) &&
            (!unique || c.is_unique) &&
            (!errata || c.has_errata) &&
            (!maxCost ||
              (c.cost !== undefined && Number(c.cost) <= Number(maxCost))),
        )
        .sort((a, b) =>
          sort === "name"
            ? cardName(a).localeCompare(cardName(b), "ko")
            : sort === "cost"
              ? Number(a.threat ?? a.cost ?? 0) -
                Number(b.threat ?? b.cost ?? 0)
              : sort === "sphere"
                ? a.sphere_code.localeCompare(b.sphere_code) ||
                  a.code.localeCompare(b.code)
                : a.code.localeCompare(b.code),
        ),
    [
      catalog,
      query,
      sphere,
      type,
      pack,
      trait,
      ownedOnly,
      owned,
      unique,
      errata,
      maxCost,
      sort,
    ],
  );
  useEffect(() => {
    setPage(1);
    setSelected(null);
  }, [
    query,
    sphere,
    type,
    pack,
    trait,
    ownedOnly,
    unique,
    errata,
    maxCost,
    sort,
  ]);
  const pages = Math.max(1, Math.ceil(filtered.length / 24)),
    actual = Math.min(page, pages),
    shown = filtered.slice((actual - 1) * 24, actual * 24),
    preview =
      selected && filtered.some((c) => c.code === selected.code)
        ? selected
        : shown[0];
  const reset = () => {
    setQuery("");
    setSphere("");
    setType("");
    setPack("");
    setTrait("");
    setOwnedOnly(false);
    setUnique(false);
    setErrata(false);
    setMaxCost("");
  };
  return (
    <div className="card-browser">
      <aside className="set-browser">
        <details
          open={setsOpen}
          onToggle={(e) => setSetsOpen(e.currentTarget.open)}
        >
          <summary>제품별 카드 찾기{pack && " · 필터 적용"}</summary>
          <button className={!pack ? "active" : ""} onClick={() => setPack("")}>
            모든 제품
          </button>
          {catalog.packs.map((p) => (
            <button
              key={p.code}
              className={pack === p.code ? "active" : ""}
              onClick={() => {
                setPack(p.code);
                if (window.innerWidth <= 800) setSetsOpen(false);
              }}
            >
              {p.name_ko || p.name}
              {p.koreanEdition && <span> · 한글판</span>}
              {owned.includes(p.code) && <span> · 보유</span>}
            </button>
          ))}
        </details>
      </aside>
      <div className="card-browser-main">
        <p className="muted">
          한글판 제품: 코어 · 어둠숲의 암흑 · 회색산맥 캠페인 · 회색산맥 영웅.
          카드 이미지와 효과 번역의 출처는 카드별로 표시합니다.
        </p>
        <section className="filter-panel" aria-label="카드 검색 필터">
          <label className="search-field">
            <Search size={18} />
            <input
              aria-label="카드 검색"
              placeholder="한국어 / 영어 이름, 효과, 특성, 카드 번호"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </label>
          <div className="sphere-tabs" aria-label="영역 선택">
            <button
              aria-pressed={!sphere}
              className={!sphere ? "active" : ""}
              onClick={() => setSphere("")}
            >
              전체
            </button>
            {Object.entries(sphereNames).map(([k, v]) => (
              <button
                key={k}
                aria-pressed={sphere === k}
                className={sphere === k ? `active ${k}` : k}
                onClick={() => setSphere(sphere === k ? "" : k)}
              >
                {v}
              </button>
            ))}
          </div>
          <div className="filter-row">
            <select
              aria-label="카드 유형 필터"
              value={type}
              onChange={(e) => setType(e.target.value)}
            >
              <option value="">모든 유형</option>
              {Object.entries(typeNames).map(([k, v]) => (
                <option key={k} value={k}>
                  {v}
                </option>
              ))}
            </select>
            <select
              aria-label="특성 필터"
              value={trait}
              onChange={(e) => setTrait(e.target.value)}
            >
              <option value="">모든 특성</option>
              {traits.map((t) => (
                <option key={t} value={t}>
                  {traitLabels[t]} ({t})
                </option>
              ))}
            </select>
            <label className="cost-filter">
              최대 비용{" "}
              <input
                aria-label="최대 카드 비용"
                type="number"
                min="0"
                max="99"
                value={maxCost}
                onChange={(e) => setMaxCost(e.target.value)}
              />
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={ownedOnly}
                onChange={(e) => setOwnedOnly(e.target.checked)}
              />
              보유만
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={unique}
                onChange={(e) => setUnique(e.target.checked)}
              />
              고유
            </label>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={errata}
                onChange={(e) => setErrata(e.target.checked)}
              />
              정오표
            </label>
            <button className="btn small" onClick={reset}>
              <RotateCcw size={14} />
              초기화
            </button>
          </div>
        </section>
        <div className="result-heading">
          <strong>{filtered.length.toLocaleString()}장</strong>
          <div className="button-row">
            <select
              aria-label="카드 정렬"
              value={sort}
              onChange={(e) => setSort(e.target.value)}
            >
              <option value="code">제품 / 카드 번호순</option>
              <option value="name">한국어 이름순</option>
              <option value="cost">비용 / 위협순</option>
              <option value="sphere">영역순</option>
            </select>
            <select
              aria-label="카드 표시 방식"
              value={display}
              onChange={(e) => setDisplay(e.target.value)}
            >
              <option value="table">목록</option>
              <option value="images">이미지</option>
            </select>
          </div>
        </div>
        {shown.length ? (
          <>
            {preview && <CardPreview card={preview} onDetail={onDetail} />}
            {display === "table" ? (
              <div className="card-table-wrap">
                <table className="card-table">
                  <thead>
                    <tr>
                      <th>카드 이름</th>
                      <th>영역 / 유형</th>
                      <th>비용·위협</th>
                      <th>의지 / 공격 / 방어 / 체력</th>
                      <th>제품</th>
                    </tr>
                  </thead>
                  <tbody>
                    {shown.map((c) => (
                      <tr
                        key={c.code}
                        className={preview?.code === c.code ? "selected" : ""}
                      >
                        <td>
                          <button
                            aria-pressed={preview?.code === c.code}
                            onClick={() => {
                              setSelected(c);
                              onDetail(c);
                            }}
                          >
                            <strong>
                              {c.is_unique ? "◆ " : ""}
                              {cardName(c)}
                            </strong>
                            <span>
                              {c.name} · {c.code}
                            </span>
                          </button>
                        </td>
                        <td>
                          <span className={`sphere ${c.sphere_code}`}>
                            {sphereNames[c.sphere_code]}
                          </span>
                          <small>{typeNames[c.type_code] || c.type_name}</small>
                        </td>
                        <td>{c.threat ?? c.cost ?? "—"}</td>
                        <td>
                          {[c.willpower, c.attack, c.defense, c.health]
                            .map((v) => v ?? "—")
                            .join(" / ")}
                        </td>
                        <td>{c.pack_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="scan-grid">
                {shown.map((c) => (
                  <button
                    key={c.code}
                    className={preview?.code === c.code ? "selected" : ""}
                    aria-label={`${cardName(c)} 효과 보기`}
                    onClick={() => {
                      setSelected(c);
                      onDetail(c);
                    }}
                  >
                    <img
                      loading="lazy"
                      src={
                        c.image_ko ||
                        new URL(c.imagesrc || "", "https://ringsdb.com").href
                      }
                      alt={`${cardName(c)} 카드`}
                    />
                    <strong>{cardName(c)}</strong>
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="empty">
            <h3>검색 결과가 없습니다.</h3>
            <p>검색어 또는 필터를 변경해 주세요.</p>
            <button className="btn" onClick={reset}>
              검색 초기화
            </button>
          </div>
        )}
        <div className="pagination">
          <button
            className="btn"
            disabled={actual <= 1}
            onClick={() => {
              setPage(actual - 1);
              setSelected(null);
            }}
          >
            <ChevronLeft size={16} />
            이전
          </button>
          <span>
            {actual} / {pages}
          </span>
          <button
            className="btn"
            disabled={actual >= pages}
            onClick={() => {
              setPage(actual + 1);
              setSelected(null);
            }}
          >
            다음
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
