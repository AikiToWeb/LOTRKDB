import { useEffect, useState } from "react";
import type { Card, Catalog, Deck } from "./types";
import { renderRequest } from "./render-client";
import { cardName } from "./CardBrowser";
import "./rooms.css";

type Member = {
  userId: string;
  nickname: string;
  ready: boolean;
  deck: Pick<Deck, "id" | "name" | "slots"> | null;
  stats: {
    heroes: number;
    total: number;
    threat: number;
    warnings: string[];
  } | null;
};
type Room = {
  id: string;
  code: string;
  name: string;
  hostId: string;
  scenarioId: string;
  scenarioName: string;
  maxPlayers: number;
  status: string;
  members: Member[];
  warnings: string[];
};
type Summary = Pick<
  Room,
  "id" | "name" | "scenarioId" | "status" | "maxPlayers"
> & { players: number };
const statusName: Record<string, string> = {
  waiting: "참여 대기",
  playing: "진행 중",
  finished: "완료",
  closed: "닫힘",
};

export function Rooms({
  catalog,
  decks,
  userId,
  playerName,
  enabled,
  saved,
  onLogin,
  onCard,
}: {
  catalog: Catalog;
  decks: Deck[];
  userId?: string;
  playerName?: string;
  enabled: boolean;
  saved: boolean;
  onLogin: () => void;
  onCard: (c: Card) => void;
}) {
  const [list, setList] = useState<Summary[]>([]),
    [room, setRoom] = useState<Room | null>(null),
    [selectedId, setSelectedId] = useState("");
  const [name, setName] = useState("우리 원정대"),
    [nickname, setNickname] = useState(playerName || ""),
    [scenarioId, setScenarioId] = useState("1"),
    [maxPlayers, setMaxPlayers] = useState(4);
  const [code, setCode] = useState(
    () =>
      new URLSearchParams(location.hash.split("?")[1] || "").get("join") || "",
  );
  const [deckId, setDeckId] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [message, setMessage] = useState(""),
    [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!enabled || !userId) return;
    let live = true,
      fetching = false;
    async function refresh() {
      if (fetching || document.visibilityState === "hidden") return;
      fetching = true;
      try {
        const data = selectedId
          ? await renderRequest<Room>(`/rooms/${selectedId}`)
          : await renderRequest<Summary[]>("/rooms");
        if (live) {
          if (selectedId) setRoom(data as Room);
          else setList(data as Summary[]);
          setError("");
        }
      } catch (e) {
        if (live) setError((e as Error).message);
      } finally {
        fetching = false;
      }
    }
    void refresh();
    const timer = setInterval(() => void refresh(), 10000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      live = false;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [selectedId, userId, enabled]);
  async function action(path: string, body: object, method = "POST") {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await renderRequest<Room | { ok: boolean }>(
        path,
        { ...body, userId },
        method,
      );
      if ("id" in data) {
        setRoom(data);
        setSelectedId(data.id);
      } else {
        setRoom(null);
        setSelectedId("");
        setList(await renderRequest<Summary[]>("/rooms"));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  if (!enabled)
    return (
      <div className="panel">공동 시나리오 방은 서버 배포에서 지원합니다.</div>
    );
  if (!userId)
    return (
      <div className="panel">
        <h2>친구와 함께 원정대를 준비하세요</h2>
        <p>
          각자 로그인한 뒤 초대 코드로 같은 방에 참여하고 본인의 덱을
          등록합니다.
        </p>
        <button className="btn primary" onClick={onLogin}>
          로그인 · 가입
        </button>
      </div>
    );
  const mine = room?.members.find((m) => m.userId === userId),
    host = room?.hostId === userId;
  const link = room ? `${location.origin}/#rooms?join=${room.code}` : "";
  return (
    <>
      <p className="muted">
        최대 4명이 같은 시나리오를 준비합니다. 참여 상태는 10초마다 갱신됩니다.
        카드 조작과 규칙 처리는 실제 게임에서 진행하세요.
      </p>
      {error && (
        <p className="room-alert" role="alert">
          {error}
          <button
            className="btn small"
            onClick={() => {
              setRoom(null);
              setSelectedId("");
            }}
          >
            방 목록으로
          </button>
        </p>
      )}
      {message && <p role="status">{message}</p>}
      {selectedId && !room && <p>방을 불러오는 중…</p>}
      {!selectedId && (
        <>
          <div className="room-forms">
            <form
              className="panel room-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action("/rooms", {
                  name,
                  nickname,
                  scenarioId,
                  maxPlayers,
                });
              }}
            >
              <h2>시나리오 방 만들기</h2>
              <label>
                방 이름
                <input
                  required
                  maxLength={80}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </label>
              <label>
                내 플레이어 이름
                <input
                  required
                  maxLength={40}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </label>
              <label>
                시나리오
                <select
                  value={scenarioId}
                  onChange={(e) => setScenarioId(e.target.value)}
                >
                  {catalog.scenarios.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.koreanProducts?.map((p) => p.name).join(" · ") ||
                        s.pack}{" "}
                      · {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                최대 인원
                <select
                  value={maxPlayers}
                  onChange={(e) => setMaxPlayers(Number(e.target.value))}
                >
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n}명
                    </option>
                  ))}
                </select>
              </label>
              <button className="btn primary" disabled={busy}>
                방 만들기
              </button>
            </form>
            <form
              className="panel room-form"
              onSubmit={(e) => {
                e.preventDefault();
                void action("/rooms/join", { code, nickname });
              }}
            >
              <h2>초대 코드로 참여</h2>
              <label>
                초대 코드
                <input
                  required
                  maxLength={20}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoCapitalize="characters"
                />
              </label>
              <label>
                참여할 플레이어 이름
                <input
                  required
                  maxLength={40}
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                />
              </label>
              <button className="btn primary" disabled={busy}>
                방 참여하기
              </button>
              <p>
                방장이 보낸 링크를 열면 초대 코드가 자동 입력됩니다. 덱을
                등록하면 방 참여자에게 카드 구성이 공유됩니다.
              </p>
            </form>
          </div>
          <h2>내가 참여한 방</h2>
          {!list.length && (
            <p>참여한 방이 없습니다. 방을 만들거나 초대 코드를 입력하세요.</p>
          )}
          <div className="room-list">
            {list.map((r) => (
              <button
                key={r.id}
                className="panel room-summary"
                onClick={() => {
                  setRoom(null);
                  setSelectedId(r.id);
                  setPreview(null);
                }}
              >
                <strong>{r.name}</strong>
                <span>
                  {catalog.scenarios.find((s) => s.id === r.scenarioId)?.name}
                </span>
                <span>
                  {statusName[r.status]} · {r.players}/{r.maxPlayers}명
                </span>
              </button>
            ))}
          </div>
        </>
      )}
      {room && selectedId && (
        <>
          <section className="panel room-head">
            <div>
              <h2>{room.name}</h2>
              <p>{room.scenarioName}</p>
              <span className="badge">
                {statusName[room.status]} · {room.members.length}/
                {room.maxPlayers}명
              </span>
            </div>
            <button
              className="btn"
              onClick={() => {
                setSelectedId("");
                setRoom(null);
                setPreview(null);
              }}
            >
              내 방 목록
            </button>
            <label>
              초대 코드
              <input readOnly value={room.code} />
            </label>
            <label className="room-link">
              초대 링크
              <input readOnly value={link} />
            </label>
            <button
              className="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(link);
                  setMessage("초대 링크를 복사했습니다.");
                } catch {
                  setMessage("초대 링크 입력란에서 링크를 직접 복사하세요.");
                }
              }}
            >
              초대 링크 복사
            </button>
          </section>
          {room.status === "waiting" && (
            <form
              className="panel room-deck"
              onSubmit={(e) => {
                e.preventDefault();
                void action(`/rooms/${room.id}/me`, { deckId }, "PUT");
              }}
            >
              <label>
                등록할 내 덱
                <select
                  required
                  value={deckId}
                  onChange={(e) => setDeckId(e.target.value)}
                >
                  <option value="">덱을 선택하세요</option>
                  {decks.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </label>
              <button
                className="btn primary"
                disabled={busy || !saved || !deckId}
              >
                내 덱 등록
              </button>
              <button
                type="button"
                className="btn"
                disabled={busy || !mine?.deck}
                onClick={() =>
                  void action(
                    `/rooms/${room.id}/me`,
                    { ready: !mine?.ready },
                    "PUT",
                  )
                }
              >
                {mine?.ready ? "준비 취소" : "준비 완료"}
              </button>
              {!saved && (
                <p className="muted">
                  계정에 덱 저장이 완료된 후 등록할 수 있습니다.
                </p>
              )}
              {!decks.length && (
                <p>
                  <a href="#decks">나의 덱</a>에서 먼저 덱을 만들어 계정에
                  저장하세요.
                </p>
              )}
              <p className="muted">
                덱 등록 당시의 구성을 공유합니다. 나의 덱을 수정했다면 이 방에서
                다시 등록하세요.
              </p>
            </form>
          )}
          {room.warnings.length > 0 && (
            <p className="room-alert">
              {room.warnings.join(" · ")} · 중복 영웅을 변경해야 시작할 수
              있습니다.
            </p>
          )}
          <div className="room-members">
            {room.members.map((m) => (
              <article className="panel" key={m.userId}>
                <h3>
                  {m.nickname}{" "}
                  {m.userId === room.hostId && (
                    <span className="badge">방장</span>
                  )}{" "}
                  {m.userId === userId && <span className="badge">나</span>}
                </h3>
                <p>{m.ready ? "준비 완료" : "준비 중"}</p>
                <strong>{m.deck?.name || "덱 미등록"}</strong>
                {m.stats && (
                  <p>
                    영웅 {m.stats.heroes}명 · 덱 {m.stats.total}장 · 시작 위협{" "}
                    {m.stats.threat}
                  </p>
                )}
                <div className="button-row">
                  {catalog.cards
                    .filter(
                      (c) => c.type_code === "hero" && m.deck?.slots[c.code],
                    )
                    .map((c) => (
                      <button
                        className="btn small"
                        key={c.code}
                        onClick={() => onCard(c)}
                      >
                        {cardName(c)}
                      </button>
                    ))}
                </div>
                {m.stats?.warnings.map((w) => (
                  <p className="muted" key={w}>
                    {w}
                  </p>
                ))}
                {m.deck && (
                  <button
                    className="btn small"
                    onClick={() =>
                      setPreview(preview === m.userId ? null : m.userId)
                    }
                  >
                    덱 구성 {preview === m.userId ? "접기" : "보기"}
                  </button>
                )}
                {preview === m.userId && m.deck && (
                  <ul className="room-deck-cards">
                    {Object.entries(m.deck.slots).map(([id, n]) => {
                      const c = catalog.cards.find((x) => x.code === id);
                      return (
                        <li key={id}>
                          {n} ×{" "}
                          {c ? (
                            <button onClick={() => onCard(c)}>
                              {cardName(c)}
                            </button>
                          ) : (
                            id
                          )}
                        </li>
                      );
                    })}
                  </ul>
                )}
                {host && m.userId !== userId && room.status === "waiting" && (
                  <button
                    className="btn small"
                    disabled={busy}
                    onClick={() =>
                      void action(
                        `/rooms/${room.id}/members/${m.userId}`,
                        {},
                        "DELETE",
                      )
                    }
                  >
                    참여 제외
                  </button>
                )}
              </article>
            ))}
          </div>
          <div className="button-row room-actions">
            {host && room.status === "waiting" && (
              <button
                className="btn primary"
                disabled={
                  busy ||
                  room.members.some((m) => !m.ready || !m.deck) ||
                  !!room.warnings.length
                }
                onClick={() =>
                  void action(
                    `/rooms/${room.id}`,
                    { status: "playing" },
                    "PATCH",
                  )
                }
              >
                시나리오 시작
              </button>
            )}
            {host && room.status === "playing" && (
              <button
                className="btn primary"
                disabled={busy}
                onClick={() =>
                  void action(
                    `/rooms/${room.id}`,
                    { status: "finished" },
                    "PATCH",
                  )
                }
              >
                시나리오 종료
              </button>
            )}
            {host && ["waiting", "playing"].includes(room.status) && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  void action(
                    `/rooms/${room.id}`,
                    { status: "closed" },
                    "PATCH",
                  )
                }
              >
                방 닫기
              </button>
            )}
            {!host && room.status === "waiting" && (
              <button
                className="btn"
                disabled={busy}
                onClick={() =>
                  void action(
                    `/rooms/${room.id}/members/${userId}`,
                    {},
                    "DELETE",
                  )
                }
              >
                방 나가기
              </button>
            )}
          </div>
          <p className="muted">
            완료한 게임의 점수와 승패는 플레이 기록에서 각자 기록하세요. 이
            방에는 공유한 덱과 참여 상태가 보관됩니다.
          </p>
        </>
      )}
    </>
  );
}
