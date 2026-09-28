import {
  localizedName,
  scenarioName,
  scenarioProductName,
  scenarioSearchText,
  productName,
} from "./localization";
import { registerCardSearch } from "./webmcp";
import { Rooms } from "./Rooms";
import { DeckPresets } from "./DeckPresets";
import { renderCloud } from "./render-client";
import {
  CardBrowser,
  CardRules,
  cardName,
  cardSearchText,
} from "./CardBrowser";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  BookOpen,
  Layers,
  Compass,
  ScrollText,
  Library,
  Settings,
  Search,
  Plus,
  ArrowRight,
  Download,
  Upload,
  X,
  Check,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  LogOut,
  Shield,
  Swords,
  Heart,
  Flag,
  Menu,
  Trash2,
  Cloud,
  Monitor,
} from "lucide-react";
import type {
  Catalog,
  Card,
  Deck,
  Play,
  Campaign,
  State,
  Scenario,
} from "./types";
import {
  deckStats,
  emptyState,
  plainText,
  score,
  validateState,
} from "./domain.mjs";
import {
  cloud,
  supabase,
  useRender,
  readCloud,
  readLocal,
  saveCloud,
  readPending,
  clearPending,
} from "./storage";

const spheres: Record<string, string> = {
  leadership: "통솔",
  tactics: "전술",
  spirit: "정신",
  lore: "지식",
  neutral: "중립",
  baggins: "배긴스",
  fellowship: "원정대",
};
const types: Record<string, string> = {
  hero: "영웅",
  ally: "동료",
  attachment: "부착",
  event: "이벤트",
  "player-side-quest": "플레이어 부가 퀘스트",
  contract: "계약",
  treasure: "보물",
  "player-objective": "플레이어 목적",
};
const nav = [
  { id: "home", name: "나의 모험", icon: Compass },
  { id: "cards", name: "카드 도서관", icon: Library },
  { id: "decks", name: "나의 덱", icon: Layers },
  { id: "scenarios", name: "시나리오", icon: BookOpen },
  { id: "rooms", name: "공동 시나리오 방", icon: Shield },
  { id: "journal", name: "플레이 기록", icon: ScrollText },
  { id: "collection", name: "보유 확장팩", icon: Shield },
  { id: "settings", name: "설정 · 백업", icon: Settings },
];
const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const uid = () => crypto.randomUUID();
const playable = (c: Card) =>
  ["hero", "ally", "attachment", "event", "player-side-quest"].includes(
    c.type_code,
  );
const ownedCard = (c: Card, owned: string[]) =>
  owned.includes(c.pack_code) ||
  c.packs?.some((p) => owned.includes(p.pack_code));
const korean: Record<string, string> = {
  Aragorn: "아라고른",
  Éowyn: "에오윈",
  Legolas: "레골라스",
  Gimli: "김리",
  Gandalf: "간달프",
  Théodred: "테오드레드",
  Glóin: "글로인",
  Denethor: "데네소르",
  Eleanor: "엘레아노르",
  Dúnhere: "둔헤레",
  Beravor: "베라보르",
  "Bilbo Baggins": "빌보 배긴스",
  "Frodo Baggins": "프로도 배긴스",
  "Sam Gamgee": "샘 갬지",
};
function download(name: string, value: unknown) {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    ref.current?.showModal();
  }, []);
  return (
    <dialog
      ref={ref}
      className={wide ? "modal wide" : "modal"}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal-head">
        <h2>{title}</h2>
        <button className="icon-btn" aria-label="닫기" onClick={onClose}>
          <X />
        </button>
      </div>
      {children}
    </dialog>
  );
}
function Empty({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Compass size={36} />
      <h3>{title}</h3>
      <p>{description}</p>
      {action}
    </div>
  );
}
function CardImage({ card }: { card: Card }) {
  const [failed, setFailed] = useState(false);
  return (card.image_ko || card.imagesrc) && !failed ? (
    <img
      loading="lazy"
      src={card.image_ko || new URL(card.imagesrc!, "https://ringsdb.com").href}
      alt={`${cardName(card)} 카드`}
      onError={() => setFailed(true)}
    />
  ) : (
    <div className="image-fallback">
      <Layers />
      <span>{cardName(card)}</span>
    </div>
  );
}
function Sphere({ code }: { code: string }) {
  return <span className={`sphere ${code}`}>{spheres[code] ?? code}</span>;
}
type Commit = (value: State) => Promise<void>;

export default function App() {
  const [view, setView] = useState(
    location.hash.slice(1).split("?")[0] || "cards",
  );
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [loadError, setLoadError] = useState("");
  const [state, setState] = useState<State>(emptyState());
  const [user, setUser] = useState<{
    id: string;
    email?: string;
    username?: string;
    name?: string;
  } | null>(null);
  const [status, setStatus] = useState("로그인 확인 중");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [detail, setDetail] = useState<Card | null>(null);
  const [editor, setEditor] = useState<Deck | null>(null);
  const [choosingDeck, setChoosingDeck] = useState(false);
  const [play, setPlay] = useState<Play | null>(null);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [auth, setAuth] = useState(false);
  const [deleteItem, setDeleteItem] = useState<{
    kind: "decks" | "plays" | "campaigns";
    id: string;
    name: string;
  } | null>(null);
  const baseline = useRef<State>(emptyState());
  const sessionIdentity = useRef<string | null | undefined>(undefined);
  const active = useRef(0);
  const lock = useRef(false);
  function notify(message: string) {
    setToast(message);
  }
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 5500);
    return () => clearTimeout(t);
  }, [toast]);
  useEffect(() => {
    const change = () =>
      setView(location.hash.slice(1).split("?")[0] || "cards");
    window.addEventListener("hashchange", change);
    return () => window.removeEventListener("hashchange", change);
  }, []);
  const go = (v: string) => {
    location.hash = v;
    setView(v);
    setMenu(false);
  };
  async function loadCatalog() {
    setLoadError("");
    try {
      const r = await fetch(useRender ? "/api/catalog" : "/data/catalog.json");
      if (!r.ok) throw new Error();
      const data = await r.json();
      if (!Array.isArray(data.cards) || !Array.isArray(data.scenarios))
        throw new Error();
      const translations = await fetch("/data/ko.json");
      if (!translations.ok) throw new Error();
      const ko = await translations.json();
      data.cards = data.cards.map((c: Card) => {
        const t = ko.cards[c.code];
        return t && t.sourceText === (c.text || "")
          ? {
              ...c,
              name_ko: korean[c.name] || t.name,
              traits_ko: t.traits,
              text_ko: t.text,
              translation_status: t.status,
              image_ko: t.image,
              image_ko_source: t.imageSource,
              image_ko_credit: t.imageCredit,
            }
          : c;
      });
      setCatalog(data);
    } catch {
      setLoadError(
        "카드 DB를 불러오지 못했습니다. 연결을 확인하고 다시 시도해 주세요.",
      );
    }
  }
  useEffect(() => {
    void loadCatalog();
  }, []);
  useEffect(() => {
    if (catalog) return registerCardSearch(catalog.cards);
  }, [catalog]);
  useEffect(() => {
    let live = true;
    async function change(
      next: {
        id: string;
        email?: string;
        username?: string;
        name?: string;
      } | null,
    ) {
      const identity = next?.id ?? null;
      // Repeated session notifications should preserve open editors.
      if (sessionIdentity.current === identity) return;
      sessionIdentity.current = identity;
      const token = ++active.current;
      setReady(false);
      setUser(next);
      setAuthChecked(true);
      setEditor(null);
      setChoosingDeck(false);
      setPlay(null);
      setCampaign(null);
      setDeleteItem(null);
      if (!live) return;
      setState(emptyState());
      baseline.current = emptyState();
      if (next) {
        setStatus("계정 기록 불러오는 중");
        try {
          const queued = readPending(next.id);
          if (queued) {
            await saveCloud(queued.next, queued.previous, next.id);
            clearPending(next.id);
          }
          const remote = await readCloud(next.id);
          if (!live || token !== active.current) return;
          setState(remote);
          baseline.current = remote;
          setStatus("저장하였습니다");
          setReady(true);
        } catch {
          if (!live || token !== active.current) return;
          setStatus("계정 연결 실패");
          notify(
            "계정 저장소를 읽지 못했습니다. 새로고침 후 다시 연결해 주세요. 저장소 연결 전에는 계정 기록을 변경할 수 없습니다.",
          );
        }
      } else {
        setStatus("로그인이 필요합니다");
        setReady(true);
      }
    }
    if (!cloud) {
      void change(null);
      return () => {
        live = false;
      };
    }
    void cloud.auth.getSession().then(({ data, error }) => {
      if (error) notify(error.message);
      if (live) void change(data.session?.user ?? null);
    });
    const { data } = cloud.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") setRecovery(true);
      if (["SIGNED_IN", "SIGNED_OUT"].includes(event))
        setTimeout(() => {
          if (live) void change(session?.user ?? null);
        }, 0);
    });
    return () => {
      live = false;
      active.current++;
      data.subscription.unsubscribe();
    };
  }, []);
  const commit: Commit = async (next) => {
    if (!user) {
      setAuth(true);
      throw new Error("로그인 후 저장할 수 있습니다.");
    }
    if (lock.current || !ready) {
      notify("저장소 연결을 기다려 주세요.");
      throw new Error("busy");
    }
    lock.current = true;
    setBusy(true);
    const token = active.current;
    try {
      setStatus("저장 중");
      await saveCloud(next, baseline.current, user.id);
      if (token !== active.current)
        throw new Error("계정이 변경되었습니다. 다시 로그인해 주세요.");
      baseline.current = next;
      setState(next);
      setStatus("저장하였습니다");
    } catch (e) {
      if (token === active.current) {
        setStatus("저장 실패");
        notify(
          `저장하지 못했습니다. 연결을 확인하고 다시 저장해 주세요. ${(e as Error).message}`,
        );
      }
      throw e;
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  async function refresh() {
    if (!user) return;
    setBusy(true);
    try {
      const queued = readPending(user.id);
      if (queued) {
        await saveCloud(queued.next, queued.previous, user.id);
        clearPending(user.id);
      }
      const next = await readCloud(user.id);
      setState(next);
      baseline.current = next;
      setReady(true);
      setStatus("저장하였습니다");
      notify("최신 계정 기록을 불러왔습니다.");
    } catch (e) {
      notify((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  function newDeck() {
    if (!user) {
      setAuth(true);
      return;
    }
    setChoosingDeck(true);
  }
  function blankDeck() {
    setChoosingDeck(false);
    setEditor({
      id: uid(),
      name: "새로운 원정대",
      notes: "",
      slots: {},
      updatedAt: new Date().toISOString(),
    });
  }
  function newPlay(scenarioId = catalog?.scenarios[0]?.id ?? "") {
    if (!user) {
      setAuth(true);
      return;
    }
    setPlay({
      id: uid(),
      scenarioId,
      deckId: "",
      deckName: "",
      date: today(),
      result: "playing",
      mode: "normal",
      players: 1,
      rounds: 0,
      threat: 0,
      damage: 0,
      deadThreat: 0,
      victory: 0,
      notes: "",
    });
  }
  const cards = catalog?.cards ?? [];
  const scenarios = catalog?.scenarios ?? [];
  const wins = state.plays.filter((p) => p.result === "win");
  const finished = state.plays.filter((p) => p.result !== "playing");
  const completed = new Set(wins.map((p) => p.scenarioId));
  const heroPicks = ["01001", "01007", "01005"]
    .map((code) => cards.find((c) => c.code === code))
    .filter(Boolean) as Card[];
  return (
    <div className="app-shell">
      <aside className={menu ? "sidebar open" : "sidebar"}>
        <a
          className="brand"
          href={user ? "#home" : "#cards"}
          onClick={() => go(user ? "home" : "cards")}
        >
          <span className="ring-mark" />
          <span>
            LOTRKDB<small>THE LORD OF THE RINGS · LCG</small>
          </span>
        </a>
        <div className="nav-label">원정대의 여정</div>
        <nav>
          {(user ? nav : nav.filter((n) => n.id === "cards")).map((n) => (
            <a
              key={n.id}
              href={`#${n.id}`}
              className={view === n.id ? "active" : ""}
              onClick={() => go(n.id)}
            >
              <n.icon size={20} />
              {n.name}
              {n.id === "decks" && state.decks.length > 0 && (
                <span className="nav-count">{state.decks.length}</span>
              )}
            </a>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="edition">LIVING CARD GAME</div>
          <p>
            작은 선택을 기록하고,
            <br />
            다음 모험을 준비하세요.
          </p>
          <a href="https://ringsdb.com" target="_blank" rel="noreferrer">
            RingsDB 방문 <ArrowRight size={15} />
          </a>
          <small>비공식 팬 프로젝트 · LOTRDB</small>
        </div>
      </aside>
      {menu && (
        <button
          className="menu-backdrop"
          aria-label="메뉴 닫기"
          onClick={() => setMenu(false)}
        />
      )}
      <div className="main-shell">
        <header className="topbar">
          <div className="top-left">
            <button
              className="icon-btn mobile-menu"
              aria-label="메뉴 열기"
              onClick={() => setMenu(!menu)}
            >
              <Menu />
            </button>
            <span>서부의 기록</span>
            <span className="breadcrumb">/</span>
            <strong>
              {nav.find((n) => n.id === view)?.name ?? "나의 모험"}
            </strong>
          </div>
          <div className="account-area">
            <span className="storage-status">
              {user ? <Cloud size={15} /> : <Monitor size={15} />} {status}
            </span>
            {user ? (
              <button
                className="avatar"
                onClick={() => go("settings")}
                aria-label="계정 설정"
              >
                {(user.name ?? user.email ?? "U")[0].toUpperCase()}
              </button>
            ) : (
              <button className="btn small" onClick={() => setAuth(true)}>
                로그인
              </button>
            )}
          </div>
        </header>
        <main>
          {loadError ? (
            <div className="notice error">
              {loadError}
              <button className="btn" onClick={() => void loadCatalog()}>
                <RefreshCw size={16} />
                다시 시도
              </button>
            </div>
          ) : !authChecked ? (
            <div className="loading">로그인 상태를 확인하고 있습니다…</div>
          ) : !user && view !== "cards" ? (
            <section
              className="panel settings-panel"
              aria-label="로그인이 필요한 메뉴"
            >
              <h1>로그인이 필요합니다</h1>
              <p>
                카드 도서관은 로그인 없이 조회할 수 있습니다. 덱 생성, 시나리오,
                공동 방 참여와 기록 관리는 로그인 후 이용해 주세요.
              </p>
              <div className="button-row">
                <button className="btn primary" onClick={() => setAuth(true)}>
                  로그인 / 회원가입
                </button>
                <button className="btn" onClick={() => go("cards")}>
                  카드 도서관으로 이동
                </button>
              </div>
            </section>
          ) : !catalog ? (
            <div className="loading">
              <span className="ring-mark" />
              카드 도서관을 여는 중…
            </div>
          ) : (
            <>
              {view === "home" && (
                <>
                  <div className="page-heading">
                    <div>
                      <div className="eyebrow">YOUR ADVENTURE</div>
                      <h1>다음 여정을 준비하세요.</h1>
                      <p>
                        카드를 살펴보고, 원정대를 꾸리고, 모험을 기록하세요.
                      </p>
                    </div>
                    <button
                      className="btn primary"
                      disabled={!ready || busy}
                      onClick={() => newPlay()}
                    >
                      <Plus size={18} />
                      플레이 기록
                    </button>
                  </div>
                  <div className="stats-grid">
                    <Stat
                      label="나의 덱"
                      value={state.decks.length}
                      unit="개"
                      icon={<Layers />}
                    />
                    <Stat
                      label="플레이 기록"
                      value={state.plays.length}
                      unit="회"
                      icon={<ScrollText />}
                    />
                    <Stat
                      label="완료한 시나리오"
                      value={completed.size}
                      unit={` / ${scenarios.length}`}
                      icon={<Flag />}
                    />
                    <Stat
                      label="승률"
                      value={
                        finished.length
                          ? Math.round((wins.length / finished.length) * 100)
                          : "—"
                      }
                      unit={finished.length ? "%" : ""}
                      icon={<Shield />}
                    />
                  </div>
                  <div className="dashboard-grid">
                    <section className="panel journey-panel">
                      <div className="panel-head">
                        <h2>이어서 모험하기</h2>
                        <button
                          className="text-btn"
                          onClick={() => go("scenarios")}
                        >
                          모든 시나리오 <ArrowRight size={16} />
                        </button>
                      </div>
                      {state.plays.some((p) => p.result === "playing") ? (
                        state.plays
                          .filter((p) => p.result === "playing")
                          .slice(0, 2)
                          .map((p) => (
                            <div className="journey-row" key={p.id}>
                              <div className="quest-number">
                                <Compass />
                              </div>
                              <div>
                                <span className="badge gold">
                                  진행 중 · {p.rounds}라운드
                                </span>
                                <h3>
                                  {scenarioName(
                                    scenarios.find(
                                      (s) => s.id === p.scenarioId,
                                    ),
                                    p.scenarioId,
                                  )}
                                </h3>
                                <p>{p.deckName || "덱 미지정"}</p>
                              </div>
                              <button
                                className="btn"
                                disabled={!ready || busy}
                                onClick={() => setPlay(p)}
                              >
                                이어서 기록
                              </button>
                            </div>
                          ))
                      ) : (
                        <>
                          <div className="journey-row">
                            <div className="quest-number">01</div>
                            <div>
                              <span className="badge gold">코어 (개정판)</span>
                              <h3>어둠숲 통과</h3>
                              <p>첫 번째 시나리오</p>
                            </div>
                            <button
                              className="icon-btn"
                              aria-label="어둠숲 플레이 기록"
                              disabled={!ready || busy}
                              onClick={() => newPlay("1")}
                            >
                              <ArrowRight />
                            </button>
                          </div>
                          <div className="journey-note">
                            <BookOpen size={18} />
                            <span>
                              첫 모험을 시작하고 원정대의 여정을 남겨보세요.
                            </span>
                          </div>
                        </>
                      )}
                    </section>
                    <section className="panel deck-panel">
                      <div className="panel-head">
                        <h2>나의 원정대</h2>
                        <button
                          className="text-btn"
                          onClick={() => go("decks")}
                        >
                          덱 보기 <ArrowRight size={16} />
                        </button>
                      </div>
                      {state.decks.length ? (
                        <div className="compact-decks">
                          {state.decks.slice(0, 3).map((d) => (
                            <button
                              key={d.id}
                              onClick={() => setEditor(d)}
                              disabled={!ready || busy}
                            >
                              <Layers size={20} />
                              <span>
                                <strong>{d.name}</strong>
                                <small>
                                  영웅 {deckStats(d.slots, cards).heroes} · 덱{" "}
                                  {deckStats(d.slots, cards).total}장
                                </small>
                              </span>
                              <ChevronRight size={17} />
                            </button>
                          ))}
                        </div>
                      ) : (
                        <div className="create-deck">
                          <Layers size={30} />
                          <div>
                            <h3>나만의 원정대를 꾸려보세요.</h3>
                            <p>영웅을 선택하고 50장의 덱을 준비하세요.</p>
                          </div>
                          <button
                            className="btn"
                            disabled={!ready || busy}
                            onClick={newDeck}
                          >
                            <Plus size={16} />첫 덱 만들기
                          </button>
                        </div>
                      )}
                    </section>
                  </div>
                  <section className="hero-library">
                    <div className="section-head">
                      <div>
                        <div className="eyebrow">MEET YOUR FELLOWSHIP</div>
                        <h2>여정의 시작은 영웅으로부터</h2>
                      </div>
                      <button className="text-btn" onClick={() => go("cards")}>
                        카드 도서관 <ArrowRight size={17} />
                      </button>
                    </div>
                    <div className="hero-grid">
                      {heroPicks.map((c) => (
                        <button
                          className="hero-feature"
                          key={c.code}
                          onClick={() => setDetail(c)}
                        >
                          <div className="hero-art">
                            <CardImage card={c} />
                          </div>
                          <div className="hero-info">
                            <Sphere code={c.sphere_code} />
                            <h3>{cardName(c)}</h3>
                            <p>{types[c.type_code]}</p>
                            <div className="hero-stats">
                              <span>
                                <Flag size={15} />
                                {c.threat}
                              </span>
                              <span>
                                <Swords size={15} />
                                {c.attack}
                              </span>
                              <span>
                                <Shield size={15} />
                                {c.defense}
                              </span>
                              <span>
                                <Heart size={15} />
                                {c.health}
                              </span>
                            </div>
                          </div>
                          <ArrowRight className="hero-arrow" size={20} />
                        </button>
                      ))}
                    </div>
                  </section>
                  <section className="panel">
                    <div className="panel-head">
                      <h2>최근 플레이 기록</h2>
                      <button
                        className="text-btn"
                        onClick={() => go("journal")}
                      >
                        전체 보기 <ArrowRight size={16} />
                      </button>
                    </div>
                    {state.plays.length ? (
                      <JournalList
                        plays={state.plays
                          .slice()
                          .sort((a, b) => b.date.localeCompare(a.date))
                          .slice(0, 3)}
                        scenarios={scenarios}
                        onEdit={setPlay}
                      />
                    ) : (
                      <div className="journal-empty">
                        <ScrollText size={22} />
                        <span>
                          아직 남겨진 여정이 없습니다. 첫 플레이를 기록해
                          보세요.
                        </span>
                        <button
                          className="text-btn"
                          disabled={!ready || busy}
                          onClick={() => newPlay()}
                        >
                          기록하기 <Plus size={16} />
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
              {view === "cards" && (
                <>
                  <PageHeading
                    eyebrow="CARD LIBRARY"
                    title="카드 도서관"
                    description={`${cards.length.toLocaleString()}장의 카드 · 한국어 이름과 효과로 검색하고, 이미지와 효과를 함께 확인하세요.`}
                  />
                  <CardBrowser
                    catalog={catalog}
                    owned={state.owned}
                    onDetail={setDetail}
                  />
                </>
              )}
              {view === "decks" && (
                <>
                  <PageHeading
                    eyebrow="YOUR FELLOWSHIPS"
                    title="나의 덱"
                    description="영웅과 카드를 조합해 다음 시나리오를 준비하세요."
                    action={
                      <button
                        className="btn primary"
                        disabled={!ready || busy}
                        onClick={newDeck}
                      >
                        <Plus size={18} />새 덱 만들기
                      </button>
                    }
                  />
                  <RingsImport
                    cards={cards}
                    onImport={(d) => (user ? setEditor(d) : setAuth(true))}
                    disabled={!ready || busy}
                    notify={notify}
                  />
                  {state.decks.length ? (
                    <div className="deck-grid">
                      {state.decks.map((d) => {
                        const stats = deckStats(d.slots, cards);
                        return (
                          <article className="panel saved-deck" key={d.id}>
                            <div className="panel-head">
                              <span className="badge">
                                {stats.warnings.length
                                  ? "작성 중"
                                  : "기본 구성 충족"}
                              </span>
                              <button
                                className="icon-btn"
                                aria-label={`${d.name} 삭제`}
                                disabled={!ready || busy}
                                onClick={() =>
                                  setDeleteItem({
                                    kind: "decks",
                                    id: d.id,
                                    name: d.name,
                                  })
                                }
                              >
                                <Trash2 size={17} />
                              </button>
                            </div>
                            <h2>{d.name}</h2>
                            <div className="deck-heroes">
                              {Object.keys(d.slots)
                                .map((code) =>
                                  cards.find((c) => c.code === code),
                                )
                                .filter((c) => c?.type_code === "hero")
                                .map((c) => (
                                  <div key={c!.code}>
                                    <CardImage card={c!} />
                                    <span>{cardName(c!)}</span>
                                  </div>
                                ))}
                            </div>
                            <p>
                              영웅 {stats.heroes} · 덱 {stats.total}장 · 시작
                              위협 {stats.threat}
                            </p>
                            <p className="notes-preview">
                              {d.notes || "덱 메모가 없습니다."}
                            </p>
                            <div className="button-row">
                              <button
                                className="btn primary"
                                disabled={!ready || busy}
                                onClick={() => setEditor(d)}
                              >
                                덱 편집
                              </button>
                              <button
                                className="btn"
                                onClick={() =>
                                  download(`${d.name}.json`, {
                                    name: d.name,
                                    slots: d.slots,
                                    notes: d.notes,
                                  })
                                }
                              >
                                <Download size={16} />
                                내보내기
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  ) : (
                    <Empty
                      title="첫 번째 덱을 만들어보세요."
                      description="카드 검색에서 영웅과 동료를 골라 나만의 원정대를 구성하세요."
                      action={
                        <button
                          className="btn primary"
                          disabled={!ready || busy}
                          onClick={newDeck}
                        >
                          <Plus size={18} />새 덱 만들기
                        </button>
                      }
                    />
                  )}
                </>
              )}
              {view === "rooms" && (
                <>
                  <PageHeading
                    eyebrow="PLAY TOGETHER"
                    title="공동 시나리오 방"
                    description="방장이 만든 시나리오에 참여하고 각자의 덱을 등록하세요."
                  />
                  <Rooms
                    key={user?.id || "guest"}
                    catalog={catalog}
                    decks={state.decks}
                    userId={user?.id}
                    playerName={user?.name}
                    enabled={useRender}
                    saved={ready && !busy && status !== "저장 실패"}
                    onLogin={() => setAuth(true)}
                    onCard={setDetail}
                  />
                </>
              )}
              {view === "scenarios" && (
                <>
                  <PageHeading
                    eyebrow="QUESTS & CAMPAIGNS"
                    title="시나리오"
                    description="도전할 시나리오를 고르고 캠페인의 은혜와 부담을 관리하세요."
                  />
                  <ScenarioLibrary
                    scenarios={scenarios}
                    plays={state.plays}
                    onPlay={newPlay}
                    disabled={!ready || busy}
                  />
                  <div className="section-head">
                    <h2>나의 캠페인</h2>
                    <button
                      className="btn"
                      disabled={!ready || busy}
                      onClick={() =>
                        user
                          ? setCampaign({
                              id: uid(),
                              name: "새 캠페인",
                              notes: "",
                              scenarioIds: [],
                              boons: "",
                              burdens: "",
                            })
                          : setAuth(true)
                      }
                    >
                      <Plus size={17} />
                      캠페인 만들기
                    </button>
                  </div>
                  {state.campaigns.length ? (
                    <div className="deck-grid">
                      {state.campaigns.map((c) => (
                        <article className="panel saved-deck" key={c.id}>
                          <div className="panel-head">
                            <h2>{c.name}</h2>
                            <button
                              className="icon-btn"
                              aria-label={`${c.name} 삭제`}
                              disabled={!ready || busy}
                              onClick={() =>
                                setDeleteItem({
                                  kind: "campaigns",
                                  id: c.id,
                                  name: c.name,
                                })
                              }
                            >
                              <Trash2 size={17} />
                            </button>
                          </div>
                          <p>
                            {
                              c.scenarioIds.filter((id) =>
                                state.plays.some(
                                  (p) =>
                                    p.scenarioId === id &&
                                    p.campaignId === c.id &&
                                    p.result === "win",
                                ),
                              ).length
                            }{" "}
                            / {c.scenarioIds.length} 시나리오 승리
                          </p>
                          <progress
                            value={
                              c.scenarioIds.filter((id) =>
                                state.plays.some(
                                  (p) =>
                                    p.scenarioId === id &&
                                    p.campaignId === c.id &&
                                    p.result === "win",
                                ),
                              ).length
                            }
                            max={c.scenarioIds.length || 1}
                          />
                          <p className="notes-preview">
                            {c.notes || "캠페인 메모를 남겨보세요."}
                          </p>
                          <button
                            className="btn"
                            disabled={!ready || busy}
                            onClick={() => setCampaign(c)}
                          >
                            캠페인 관리
                          </button>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <p className="muted">등록한 캠페인이 없습니다.</p>
                  )}
                </>
              )}
              {view === "journal" && (
                <>
                  <PageHeading
                    eyebrow="QUEST JOURNAL"
                    title="플레이 기록"
                    description="승리와 패배, 진행 중인 모험을 모두 기록하세요."
                    action={
                      <button
                        className="btn primary"
                        disabled={!ready || busy}
                        onClick={() => newPlay()}
                      >
                        <Plus size={18} />
                        플레이 기록
                      </button>
                    }
                  />
                  <Journal
                    plays={state.plays}
                    scenarios={scenarios}
                    onEdit={setPlay}
                    onDelete={(p) =>
                      setDeleteItem({
                        kind: "plays",
                        id: p.id,
                        name: scenarioName(
                          scenarios.find((s) => s.id === p.scenarioId),
                          "플레이 기록",
                        ),
                      })
                    }
                    disabled={!ready || busy}
                  />
                </>
              )}
              {view === "collection" && (
                <>
                  <PageHeading
                    eyebrow="YOUR COLLECTION"
                    title="보유 확장팩"
                    description="가지고 있는 제품을 선택하세요. 재수록 카드를 포함해 카드 도서관과 덱 빌더에서 사용할 수 있습니다."
                  />
                  <Collection
                    packs={catalog.packs}
                    owned={state.owned}
                    disabled={!ready || busy}
                    onChange={(owned) =>
                      void commit({ ...state, owned }).catch(() => {})
                    }
                  />
                </>
              )}
              {view === "settings" && (
                <>
                  <PageHeading
                    eyebrow="SETTINGS"
                    title="설정 · 백업"
                    description="저장 위치를 확인하고 덱과 모험 기록을 안전하게 보관하세요."
                  />
                  <div className="settings-grid">
                    <section className="panel settings-panel">
                      <h2>계정과 저장</h2>
                      <p>
                        {user
                          ? user.name
                            ? `${user.name} · ${user.username}`
                            : user.email
                          : "로그인 후 이용해 주세요."}
                      </p>
                      <div className="notice">
                        {user
                          ? status
                          : "덱과 기록은 로그인한 계정으로 저장됩니다. 회원가입하거나 로그인해 주세요."}
                      </div>
                      {!cloud && (
                        <p className="muted">
                          온라인 계정 저장소가 아직 연결되지 않았습니다. 배포
                          설정에 계정 DB 연결 정보를 추가한 후 사용할 수
                          있습니다.
                        </p>
                      )}
                      <div className="button-row">
                        {user ? (
                          <>
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() => void refresh()}
                            >
                              <RefreshCw size={16} />
                              계정 기록 새로고침
                            </button>
                            <button
                              className="btn"
                              disabled={busy}
                              onClick={() =>
                                void cloud?.auth
                                  .signOut()
                                  .then(
                                    ({ error }) =>
                                      error && notify(error.message),
                                  )
                              }
                            >
                              <LogOut size={16} />
                              로그아웃
                            </button>
                          </>
                        ) : (
                          <button
                            className="btn primary"
                            onClick={() => setAuth(true)}
                          >
                            로그인 / 회원가입
                          </button>
                        )}
                      </div>
                      {user && (
                        <button
                          className="btn migrate"
                          disabled={!ready || busy}
                          onClick={async () => {
                            try {
                              const guest = readLocal();
                              const merge = <T extends { id: string }>(
                                a: T[],
                                b: T[],
                              ) => [
                                ...a,
                                ...b.filter(
                                  (x) => !a.some((y) => x.id === y.id),
                                ),
                              ];
                              await commit({
                                decks: merge(state.decks, guest.decks),
                                plays: merge(state.plays, guest.plays),
                                campaigns: merge(
                                  state.campaigns,
                                  guest.campaigns,
                                ),
                                owned: [
                                  ...new Set([...state.owned, ...guest.owned]),
                                ],
                              });
                              notify("이전 기록을 저장하였습니다.");
                            } catch (e) {
                              notify((e as Error).message);
                            }
                          }}
                        >
                          이전 기록 가져오기
                        </button>
                      )}
                    </section>
                    <section className="panel settings-panel">
                      <h2>기록 백업</h2>
                      <p>
                        덱, 플레이 기록, 캠페인, 보유 확장팩을 JSON 파일로
                        보관합니다.
                      </p>
                      <button
                        className="btn"
                        onClick={() =>
                          download(`lotrdb-backup-${today()}.json`, {
                            version: 1,
                            exportedAt: new Date().toISOString(),
                            state,
                          })
                        }
                      >
                        <Download size={17} />
                        전체 백업 다운로드
                      </button>
                      <BackupImport
                        state={state}
                        commit={commit}
                        disabled={!ready || busy}
                        notify={notify}
                      />
                      <p className="muted">
                        복원은 기존 기록에 추가합니다. 같은 ID의 기록은 현재
                        기록을 유지합니다.
                      </p>
                    </section>
                    <section className="panel settings-panel">
                      <h2>데이터 출처</h2>
                      <p>
                        카드 {cards.length.toLocaleString()}장 · 확장팩{" "}
                        {catalog.packs.length}개 · 시나리오 {scenarios.length}개
                      </p>
                      <p>
                        동기화:{" "}
                        {new Date(catalog.syncedAt).toLocaleDateString("ko-KR")}
                      </p>
                      <a
                        href="https://ringsdb.com/api/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        RingsDB 공개 API <ArrowRight size={15} />
                      </a>
                      <p className="muted">
                        시나리오 목록은 RingsDB 공개 데이터베이스에서
                        가져왔습니다. 조우 세트는 시나리오 상세 화면에서 API로
                        확인할 수 있습니다.
                      </p>
                    </section>
                    <section className="panel settings-panel">
                      <h2>이 프로젝트에 대하여</h2>
                      <p>
                        Fantasy Flight Games의 The Lord of the Rings: The Card
                        Game (LCG) 전용 팬 앱입니다.
                      </p>
                      <p className="muted">
                        카드 원문·이미지는 Fantasy Flight Games 및 각 권리자에게
                        속합니다. 이 사이트는 공식 제품이 아니며 Fantasy Flight
                        Games의 지원이나 보증을 받지 않습니다. 카드 데이터와
                        이미지는 RingsDB / Hall of Beorn을 참조합니다.
                      </p>
                      <a
                        href="https://github.com/AikiToWeb/LOTRKDB"
                        target="_blank"
                        rel="noreferrer"
                      >
                        프로젝트 저장소 <ArrowRight size={15} />
                      </a>
                    </section>
                  </div>
                </>
              )}
              {!nav.some((n) => n.id === view) && (
                <Empty
                  title="페이지를 찾을 수 없습니다."
                  description="나의 모험에서 다시 시작하세요."
                  action={
                    <button className="btn" onClick={() => go("home")}>
                      나의 모험
                    </button>
                  }
                />
              )}
            </>
          )}
        </main>
        <footer>
          <span>
            서부의 기록 <b>·</b> THE LORD OF THE RINGS: THE CARD GAME
          </span>
          <span>
            카드 데이터 ·{" "}
            <a href="https://ringsdb.com/api/" target="_blank" rel="noreferrer">
              RingsDB
            </a>{" "}
            / Hall of Beorn
          </span>
        </footer>
      </div>
      {toast && (
        <div role="status" className="toast">
          {toast}
          <button aria-label="알림 닫기" onClick={() => setToast("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {detail && (
        <Modal title={cardName(detail)} onClose={() => setDetail(null)} wide>
          <div className="card-detail">
            <CardImage card={detail} />
            <div>
              <div className="button-row">
                <Sphere code={detail.sphere_code} />
                <span className="badge">
                  {types[detail.type_code] ?? detail.type_name}
                </span>
                {detail.is_unique && <span className="badge gold">고유</span>}
              </div>
              <h3>{cardName(detail)}</h3>
              {detail.name_ko && (
                <details>
                  <summary>영문 명칭 보기</summary>
                  <p lang="en">{detail.name}</p>
                </details>
              )}
              <p>{detail.traits_ko || detail.traits}</p>
              <div className="card-values">
                {[
                  ["비용", detail.cost],
                  ["위협", detail.threat],
                  ["의지", detail.willpower],
                  ["공격", detail.attack],
                  ["방어", detail.defense],
                  ["체력", detail.health],
                ]
                  .filter(([, v]) => v !== undefined)
                  .map(([k, v]) => (
                    <span key={k}>
                      {k}
                      <strong>{v}</strong>
                    </span>
                  ))}
              </div>
              <CardRules card={detail} />
              {detail.has_errata && (
                <div className="notice">
                  정오표가 반영된 카드입니다. 원문에서 최신 내용을 확인하세요.
                </div>
              )}
              <h4>수록 제품</h4>
              <ul>
                {(
                  detail.packs ?? [
                    {
                      pack_code: detail.pack_code,
                      pack_name: detail.pack_name,
                      quantity: 0,
                    },
                  ]
                ).map((p) => (
                  <li key={p.pack_code}>
                    {productName(p.pack_name, p.pack_code, catalog?.packs)}
                    {state.owned.includes(p.pack_code) && (
                      <span className="badge">보유</span>
                    )}
                  </li>
                ))}
              </ul>
              <a
                className="btn"
                href={`https://ringsdb.com/card/${detail.code}`}
                target="_blank"
                rel="noreferrer"
              >
                RingsDB 원문 <ArrowRight size={16} />
              </a>
            </div>
          </div>
        </Modal>
      )}
      {user && choosingDeck && catalog && (
        <Modal
          title="새 덱 만들기 · 코어 프리셋"
          onClose={() => setChoosingDeck(false)}
          wide
        >
          <DeckPresets
            cards={cards}
            busy={busy || !ready}
            onBlank={blankDeck}
            onRegister={async (d) => {
              await commit({ ...state, decks: [d, ...state.decks] });
              setChoosingDeck(false);
              go("decks");
              notify("프리셋 덱을 저장하였습니다.");
            }}
          />
        </Modal>
      )}
      {user && editor && catalog && (
        <DeckEditor
          initial={editor}
          cards={cards}
          owned={state.owned}
          busy={busy || !ready}
          onClose={() => setEditor(null)}
          onSave={async (d) => {
            await commit({
              ...state,
              decks: [d, ...state.decks.filter((x) => x.id !== d.id)],
            });
            setEditor(null);
            notify("덱을 저장하였습니다.");
          }}
          onDetail={setDetail}
        />
      )}
      {user && play && catalog && (
        <PlayEditor
          initial={play}
          scenarios={scenarios}
          decks={state.decks}
          campaigns={state.campaigns}
          busy={busy || !ready}
          onClose={() => setPlay(null)}
          onSave={async (p) => {
            await commit({
              ...state,
              plays: [p, ...state.plays.filter((x) => x.id !== p.id)],
            });
            setPlay(null);
            notify("플레이 기록을 저장하였습니다.");
          }}
        />
      )}
      {user && campaign && (
        <CampaignEditor
          initial={campaign}
          scenarios={scenarios}
          busy={busy || !ready}
          onClose={() => setCampaign(null)}
          onSave={async (c) => {
            await commit({
              ...state,
              campaigns: [c, ...state.campaigns.filter((x) => x.id !== c.id)],
            });
            setCampaign(null);
            notify("캠페인을 저장하였습니다.");
          }}
        />
      )}
      {recovery && (
        <PasswordRecovery onClose={() => setRecovery(false)} notify={notify} />
      )}
      {auth && <Auth onClose={() => setAuth(false)} notify={notify} />}
      {user && deleteItem && (
        <Modal title="기록 삭제" onClose={() => setDeleteItem(null)}>
          <p>
            “{deleteItem.name}” 기록을 삭제하시겠습니까? 이 작업은 되돌릴 수
            없습니다.
          </p>
          <div className="modal-actions">
            <button className="btn" onClick={() => setDeleteItem(null)}>
              취소
            </button>
            <button
              className="btn danger"
              disabled={busy || !ready}
              onClick={async () => {
                try {
                  await commit({
                    ...state,
                    [deleteItem.kind]: state[deleteItem.kind].filter(
                      (x) => x.id !== deleteItem.id,
                    ),
                  });
                  setDeleteItem(null);
                } catch {}
              }}
            >
              삭제
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function PageHeading({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <div className="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {action}
    </div>
  );
}
function Stat({
  label,
  value,
  unit,
  icon,
}: {
  label: string;
  value: number | string;
  unit: string;
  icon: ReactNode;
}) {
  return (
    <div className="stat">
      <div>
        <span>{label}</span>
        <div className="stat-value">
          {value}
          <small>{unit}</small>
        </div>
      </div>
      <div className="stat-icon">{icon}</div>
    </div>
  );
}

function Pagination({
  page,
  pages,
  onPage,
}: {
  page: number;
  pages: number;
  onPage: (p: number) => void;
}) {
  return (
    <div className="pagination">
      <button
        className="btn"
        aria-label="이전 페이지"
        disabled={page <= 1}
        onClick={() => onPage(page - 1)}
      >
        <ChevronLeft size={17} />
        이전
      </button>
      <span>
        {page} / {pages}
      </span>
      <button
        className="btn"
        aria-label="다음 페이지"
        disabled={page >= pages}
        onClick={() => onPage(page + 1)}
      >
        다음
        <ChevronRight size={17} />
      </button>
    </div>
  );
}

function DeckEditor({
  initial,
  cards,
  owned,
  busy,
  onClose,
  onSave,
  onDetail,
}: {
  initial: Deck;
  cards: Card[];
  owned: string[];
  busy: boolean;
  onClose: () => void;
  onSave: (d: Deck) => Promise<void>;
  onDetail: (c: Card) => void;
}) {
  const [deck, setDeck] = useState<Deck>({
      ...initial,
      slots: { ...initial.slots },
    }),
    [q, setQ] = useState(""),
    [type, setType] = useState("hero"),
    [sphere, setSphere] = useState(""),
    [only, setOnly] = useState(false),
    [builderPage, setBuilderPage] = useState(1),
    [error, setError] = useState("");
  useEffect(() => setBuilderPage(1), [q, type, sphere, only]);
  const stats = deckStats(deck.slots, cards);
  const filtered = cards.filter(
    (c) =>
      playable(c) &&
      (!type || c.type_code === type) &&
      (!sphere || c.sphere_code === sphere) &&
      cardSearchText(c).includes(q.toLowerCase()) &&
      (!only || ownedCard(c, owned)),
  );
  function quantity(c: Card, delta: number) {
    setError("");
    const n = (deck.slots[c.code] ?? 0) + delta;
    if (n > (c.deck_limit ?? 3)) {
      setError(
        `${cardName(c)} 카드의 최대 수량은 ${c.deck_limit ?? 3}장입니다.`,
      );
      return;
    }
    if (
      delta > 0 &&
      c.type_code === "hero" &&
      (stats.heroes >= 3 ||
        Object.keys(deck.slots).some(
          (code) =>
            cards.find((x) => x.code === code)?.name === c.name &&
            cards.find((x) => x.code === code)?.type_code === "hero",
        ))
    ) {
      setError(
        "영웅은 최대 3명이며, 같은 이름의 영웅을 중복 선택할 수 없습니다.",
      );
      return;
    }
    const slots = { ...deck.slots };
    if (n <= 0) delete slots[c.code];
    else slots[c.code] = n;
    setDeck({ ...deck, slots });
  }
  return (
    <Modal title="덱 빌더" onClose={onClose} wide>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!deck.name.trim()) return;
          try {
            await onSave({
              ...deck,
              name: deck.name.trim(),
              updatedAt: new Date().toISOString(),
            });
          } catch {}
        }}
      >
        <label className="field">
          덱 이름
          <input
            required
            maxLength={100}
            value={deck.name}
            onChange={(e) => setDeck({ ...deck, name: e.target.value })}
          />
        </label>
        <div className="deck-summary">
          <span>
            영웅 <strong>{stats.heroes}/3</strong>
          </span>
          <span>
            덱 <strong>{stats.total}/50장</strong>
          </span>
          <span>
            시작 위협 <strong>{stats.threat}</strong>
          </span>
        </div>
        <div className="builder-layout">
          <section>
            <h3>카드 추가</h3>
            <label className="search-field">
              <Search size={17} />
              <input
                aria-label="덱에 추가할 카드 검색"
                placeholder="한국어 / 영어 이름, 특성, 효과 검색"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
            </label>
            <div className="filter-row">
              <select
                aria-label="추가할 카드 유형"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="">모든 유형</option>
                {Object.entries(types)
                  .filter(([k]) =>
                    [
                      "hero",
                      "ally",
                      "attachment",
                      "event",
                      "player-side-quest",
                    ].includes(k),
                  )
                  .map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
              </select>
              <select
                aria-label="추가할 카드 영역"
                value={sphere}
                onChange={(e) => setSphere(e.target.value)}
              >
                <option value="">모든 영역</option>
                {Object.entries(spheres).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
              <label className="checkbox">
                <input
                  type="checkbox"
                  checked={only}
                  onChange={(e) => setOnly(e.target.checked)}
                />
                보유만
              </label>
            </div>
            <small className="muted">
              {filtered.length}장 검색됨 · 카드 이미지나 이름을 눌러 크게 보기 ·
              한국어 효과 확인
            </small>
            <div className="builder-results">
              {filtered
                .slice((builderPage - 1) * 40, builderPage * 40)
                .map((c) => (
                  <div className="card-row builder-card-row" key={c.code}>
                    <button
                      type="button"
                      className="builder-card-image"
                      aria-label={`${cardName(c)} 이미지 크게 보기 · ${c.code}`}
                      onClick={() => onDetail(c)}
                    >
                      <CardImage card={c} />
                    </button>
                    <div className="builder-card-info">
                      <button
                        type="button"
                        className="card-name"
                        onClick={() => onDetail(c)}
                      >
                        <strong>{cardName(c)}</strong>
                        <small>
                          {types[c.type_code]} · {spheres[c.sphere_code]} ·{" "}
                          {c.type_code === "hero"
                            ? `위협 ${c.threat}`
                            : `비용 ${c.cost ?? "—"}`}
                        </small>
                      </button>
                      <div className="builder-card-controls">
                        <span className="quantity">
                          등록 {deck.slots[c.code] ?? 0}장
                        </span>
                        <button
                          type="button"
                          className="icon-btn"
                          aria-label={`${cardName(c)} 추가`}
                          disabled={busy}
                          onClick={() => quantity(c, 1)}
                        >
                          <Plus size={17} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              {!filtered.length && (
                <p className="muted">조건에 맞는 카드가 없습니다.</p>
              )}
            </div>
            <Pagination
              page={Math.min(
                builderPage,
                Math.max(1, Math.ceil(filtered.length / 40)),
              )}
              pages={Math.max(1, Math.ceil(filtered.length / 40))}
              onPage={setBuilderPage}
            />
          </section>
          <section className="deck-selection">
            <h3>선택한 카드</h3>
            {Object.entries(deck.slots).length ? (
              Object.entries(deck.slots)
                .sort(([a], [b]) => {
                  const order = [
                    "hero",
                    "ally",
                    "attachment",
                    "event",
                    "player-side-quest",
                  ];
                  return (
                    order.indexOf(
                      cards.find((c) => c.code === a)?.type_code || "",
                    ) -
                      order.indexOf(
                        cards.find((c) => c.code === b)?.type_code || "",
                      ) || a.localeCompare(b)
                  );
                })
                .map(([code, n]) => {
                  const c = cards.find((c) => c.code === code);
                  return (
                    <div className="card-row builder-card-row" key={code}>
                      {c ? (
                        <button
                          type="button"
                          className="builder-card-image"
                          aria-label={`선택한 ${cardName(c)} 이미지 크게 보기 · ${code}`}
                          onClick={() => onDetail(c)}
                        >
                          <CardImage card={c} />
                        </button>
                      ) : (
                        <div className="builder-card-missing">이미지 없음</div>
                      )}
                      <div className="builder-card-info">
                        <button
                          type="button"
                          className="card-name"
                          onClick={() => c && onDetail(c)}
                        >
                          <strong>{c ? cardName(c) : code}</strong>
                          <small>
                            {c ? types[c.type_code] : "알 수 없는 카드"}
                          </small>
                        </button>
                        <div className="builder-card-controls">
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`${c ? cardName(c) : code} 수량 줄이기`}
                            disabled={busy}
                            onClick={() => {
                              if (c) quantity(c, -1);
                              else {
                                const slots = { ...deck.slots };
                                delete slots[code];
                                setDeck({ ...deck, slots });
                              }
                            }}
                          >
                            −
                          </button>
                          <span>{n}</span>
                          <button
                            type="button"
                            className="icon-btn"
                            aria-label={`${c ? cardName(c) : code} 수량 늘리기`}
                            disabled={busy || !c}
                            onClick={() => c && quantity(c, 1)}
                          >
                            <Plus size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="muted">왼쪽 목록에서 카드를 추가하세요.</p>
            )}
          </section>
        </div>
        {error && (
          <p role="alert" className="form-error">
            {error}
          </p>
        )}
        {stats.warnings.length > 0 && (
          <div className="notice">
            <strong>작성 중인 덱</strong>
            <ul>
              {stats.warnings.map((w: string) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
        <p className="muted">
          일반 덱의 영웅 수·최소 장수·카드별 수량을 확인합니다. 계약, 보물, 특수
          시나리오의 예외 및 카드 조합 규칙은 원문에서 확인하세요. 작성 중인
          덱도 저장할 수 있습니다.
        </p>
        <label className="field">
          덱 메모
          <textarea
            rows={3}
            maxLength={10000}
            value={deck.notes}
            onChange={(e) => setDeck({ ...deck, notes: e.target.value })}
            placeholder="핵심 조합, 자원 운용, 시나리오별 교체 카드…"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" disabled={busy || !deck.name.trim()}>
            <Check size={17} />
            {busy ? "저장 중…" : "덱 저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function RingsImport({
  cards,
  onImport,
  disabled,
  notify,
}: {
  cards: Card[];
  onImport: (d: Deck) => void;
  disabled: boolean;
  notify: (m: string) => void;
}) {
  const [id, setId] = useState(""),
    [loading, setLoading] = useState(false);
  function importValue(value: unknown) {
    const v = value as {
      name?: string;
      slots?: Record<string, number>;
      notes?: string;
    };
    if (
      !v ||
      typeof v.name !== "string" ||
      !v.slots ||
      typeof v.slots !== "object"
    )
      throw new Error("name과 slots가 포함된 덱 JSON이 필요합니다.");
    const d = {
      id: uid(),
      name: v.name,
      notes: typeof v.notes === "string" ? v.notes : "",
      slots: v.slots,
      updatedAt: new Date().toISOString(),
    };
    validateState({ ...emptyState(), decks: [d] });
    if (
      Object.keys(d.slots).some((code) => !cards.some((c) => c.code === code))
    )
      throw new Error("현재 DB에 없는 카드가 포함되어 있습니다.");
    onImport(d);
  }
  return (
    <div className="panel import-panel">
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          const match = id
            .trim()
            .match(
              /^(?:https:\/\/ringsdb\.com\/decklist\/view\/)?(\d+)(?:\/[^?#]*)?(?:[?#].*)?$/,
            );
          if (!match) {
            notify(
              "공개 덱 번호 또는 https://ringsdb.com/decklist/view/… 주소를 입력하세요.",
            );
            return;
          }
          setLoading(true);
          try {
            const r = await fetch(
              `https://ringsdb.com/api/public/decklist/${match[1]}.json`,
              { signal: AbortSignal.timeout(20000) },
            );
            if (!r.ok) throw new Error("공개 덱을 찾지 못했습니다.");
            importValue(await r.json());
          } catch (e) {
            notify((e as Error).message);
          } finally {
            setLoading(false);
          }
        }}
      >
        <label className="field">
          RingsDB 공개 덱 가져오기
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="공개 덱 번호 또는 덱 주소"
            aria-label="RingsDB 공개 덱 주소"
          />
        </label>
        <button className="btn" disabled={disabled || loading || !id.trim()}>
          <Download size={16} />
          {loading ? "가져오는 중…" : "가져오기"}
        </button>
      </form>
      <label className={`btn file-button ${disabled ? "disabled" : ""}`}>
        <Upload size={16} />덱 JSON 불러오기
        <input
          type="file"
          accept=".json,application/json"
          disabled={disabled}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              if (file.size > 5e6)
                throw new Error("5MB 이하 파일만 가능합니다.");
              importValue(JSON.parse(await file.text()));
            } catch (err) {
              notify((err as Error).message);
            }
          }}
        />
      </label>
    </div>
  );
}

function ScenarioLibrary({
  scenarios,
  plays,
  onPlay,
  disabled,
}: {
  scenarios: Scenario[];
  plays: Play[];
  onPlay: (id: string) => void;
  disabled: boolean;
}) {
  const [q, setQ] = useState(""),
    [pack, setPack] = useState(""),
    [filter, setFilter] = useState(""),
    [page, setPage] = useState(1),
    [detail, setDetail] = useState<Scenario | null>(null);
  const packs = [...new Set(scenarios.map((s) => s.pack))];
  const filtered = scenarios.filter(
    (s) =>
      scenarioSearchText(s).includes(q.toLowerCase()) &&
      (!pack ||
        s.pack === pack ||
        s.koreanProducts?.some((p) => `ko:${p.code}` === pack)) &&
      (!filter ||
        (filter === "done"
          ? plays.some((p) => p.scenarioId === s.id && p.result === "win")
          : !plays.some((p) => p.scenarioId === s.id && p.result === "win"))),
  );
  useEffect(() => setPage(1), [q, pack, filter]);
  const pages = Math.max(1, Math.ceil(filtered.length / 12));
  const actual = Math.min(page, pages);
  return (
    <>
      <div className="filter-panel">
        <label className="search-field">
          <Search size={19} />
          <input
            aria-label="시나리오 검색"
            placeholder="시나리오 이름 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <div className="filter-row">
          <select
            aria-label="시나리오 확장팩"
            value={pack}
            onChange={(e) => setPack(e.target.value)}
          >
            <option value="">모든 확장팩</option>
            <optgroup label="한글판 제품">
              <option value="ko:RevCore">코어 (개정판)</option>
              <option value="ko:TDoM">어둠숲의 암흑 시나리오 확장</option>
              <option value="ko:EMCE">회색산맥 캠페인 확장</option>
            </optgroup>
            {packs.map((p) => (
              <option key={p} value={p}>
                {localizedName(p)}
              </option>
            ))}
          </select>
          <select
            aria-label="시나리오 완료 여부"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
          >
            <option value="">모든 시나리오</option>
            <option value="done">승리한 시나리오</option>
            <option value="new">아직 승리하지 않은 시나리오</option>
          </select>
          <span className="muted">{filtered.length}개 시나리오</span>
        </div>
      </div>
      <div className="scenario-grid">
        {filtered.slice((actual - 1) * 12, actual * 12).map((s) => {
          const logs = plays.filter((p) => p.scenarioId === s.id),
            wins = logs.filter((p) => p.result === "win").length;
          return (
            <article className="panel scenario-card" key={s.id}>
              <div className="scenario-top">
                <span className="quest-number">{s.id.padStart(2, "0")}</span>
                <span className={`badge ${wins ? "green" : ""}`}>
                  {wins ? "승리" : logs.length ? "도전 중" : "미도전"}
                </span>
              </div>
              <p className="eyebrow">{scenarioProductName(s)}</p>
              <h3>{scenarioName(s)}</h3>

              <div className="scenario-bottom">
                <span>
                  {logs.length}회 플레이 · {wins}회 승리
                </span>
                <div className="button-row">
                  <button className="btn small" onClick={() => setDetail(s)}>
                    상세
                  </button>
                  <button
                    className="btn small"
                    disabled={disabled}
                    onClick={() => onPlay(s.id)}
                  >
                    기록 <Plus size={14} />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      {!filtered.length && (
        <Empty
          title="시나리오가 없습니다."
          description="검색 조건을 변경해 주세요."
        />
      )}
      <Pagination page={actual} pages={pages} onPage={setPage} />
      {detail && (
        <ScenarioDetail scenario={detail} onClose={() => setDetail(null)} />
      )}
    </>
  );
}
function ScenarioDetail({
  scenario,
  onClose,
}: {
  scenario: Scenario;
  onClose: () => void;
}) {
  const [data, setData] = useState<{
      encounters?: { id: number; name: string }[];
      has_easy?: boolean;
      has_nightmare?: boolean;
      normal_cards?: number;
      normal_enemies?: number;
      normal_locations?: number;
      normal_treacheries?: number;
    } | null>(null),
    [error, setError] = useState("");
  useEffect(() => {
    const abort = new AbortController();
    fetch(`https://ringsdb.com/api/public/scenario/${scenario.id}.json`, {
      signal: abort.signal,
    })
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d) => {
        if (!d.id) throw new Error();
        setData(d);
      })
      .catch(() => {
        if (!abort.signal.aborted)
          setError(
            "세부 정보를 가져오지 못했습니다. RingsDB 원문에서 확인해 주세요.",
          );
      });
    return () => abort.abort();
  }, [scenario.id]);
  return (
    <Modal title={scenarioName(scenario)} onClose={onClose}>
      <p>{scenarioProductName(scenario)}</p>
      {error ? (
        <div className="notice error">{error}</div>
      ) : !data ? (
        <p>조우 세트 불러오는 중…</p>
      ) : (
        <>
          <h3>필요한 조우 세트</h3>
          <ul>
            {data.encounters?.map((e) => (
              <li key={e.id}>{localizedName(e.name)}</li>
            ))}
          </ul>
          <h3>일반 모드 조우 덱</h3>
          <p>
            총 {data.normal_cards}장 · 적 {data.normal_enemies} · 장소{" "}
            {data.normal_locations} · 음모 {data.normal_treacheries}
          </p>
          <p>
            지원 모드: 일반{data.has_easy ? " · 쉬움" : ""}
            {data.has_nightmare ? " · 악몽" : ""}
          </p>
        </>
      )}
      <a
        className="btn"
        href={`https://ringsdb.com/api/public/scenario/${scenario.id}.json`}
        target="_blank"
        rel="noreferrer"
      >
        RingsDB 시나리오 데이터 <ArrowRight size={16} />
      </a>
    </Modal>
  );
}

function JournalList({
  plays,
  scenarios,
  onEdit,
  onDelete,
  disabled,
}: {
  plays: Play[];
  scenarios: Scenario[];
  onEdit: (p: Play) => void;
  onDelete?: (p: Play) => void;
  disabled?: boolean;
}) {
  return (
    <div className="journal-list">
      {plays.map((p) => (
        <div className="journal-row" key={p.id}>
          <span className={`result-icon ${p.result}`}>
            {p.result === "win" ? (
              <Check size={18} />
            ) : p.result === "loss" ? (
              <X size={18} />
            ) : (
              <Compass size={18} />
            )}
          </span>
          <button
            className="journal-title"
            disabled={disabled}
            onClick={() => onEdit(p)}
          >
            <strong>
              {scenarioName(
                scenarios.find((s) => s.id === p.scenarioId),
                p.scenarioId,
              )}
            </strong>
            <small>
              {p.deckName || "덱 미지정"} · {p.players}인 ·{" "}
              {{ easy: "쉬움", normal: "일반", nightmare: "악몽" }[p.mode] ??
                p.mode}
            </small>
          </button>
          <span
            className={`badge ${p.result === "win" ? "green" : p.result === "loss" ? "red" : "gold"}`}
          >
            {{ win: "승리", loss: "패배", playing: "진행 중" }[p.result]}
          </span>
          <span className="journal-score">
            {p.result === "win" ? `${score(p)}점` : `${p.rounds}라운드`}
          </span>
          <time>{p.date}</time>
          {onDelete && (
            <button
              className="icon-btn"
              aria-label="플레이 기록 삭제"
              disabled={disabled}
              onClick={() => onDelete(p)}
            >
              <Trash2 size={16} />
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
function Journal({
  plays,
  scenarios,
  onEdit,
  onDelete,
  disabled,
}: {
  plays: Play[];
  scenarios: Scenario[];
  onEdit: (p: Play) => void;
  onDelete: (p: Play) => void;
  disabled: boolean;
}) {
  const [result, setResult] = useState(""),
    [q, setQ] = useState("");
  const filtered = plays
    .filter(
      (p) =>
        (!result || p.result === result) &&
        `${scenarioSearchText(scenarios.find((s) => s.id === p.scenarioId))} ${p.deckName} ${p.notes}`
          .toLowerCase()
          .includes(q.toLowerCase()),
    )
    .sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <div className="filter-panel">
        <label className="search-field">
          <Search size={18} />
          <input
            aria-label="플레이 기록 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="시나리오, 덱, 메모 검색"
          />
        </label>
        <select
          aria-label="플레이 결과 필터"
          value={result}
          onChange={(e) => setResult(e.target.value)}
        >
          <option value="">모든 결과</option>
          <option value="win">승리</option>
          <option value="loss">패배</option>
          <option value="playing">진행 중</option>
        </select>
      </div>
      <section className="panel">
        {filtered.length ? (
          <JournalList
            plays={filtered}
            scenarios={scenarios}
            onEdit={onEdit}
            onDelete={onDelete}
            disabled={disabled}
          />
        ) : (
          <Empty
            title="플레이 기록이 없습니다."
            description="새 기록을 남기거나 검색 조건을 변경해 보세요."
          />
        )}
      </section>
    </>
  );
}
function PlayEditor({
  initial,
  scenarios,
  decks,
  campaigns,
  busy,
  onClose,
  onSave,
}: {
  initial: Play;
  scenarios: Scenario[];
  decks: Deck[];
  campaigns: Campaign[];
  busy: boolean;
  onClose: () => void;
  onSave: (p: Play) => Promise<void>;
}) {
  const [play, setPlay] = useState(initial);
  const update = (key: string, value: string | number) =>
    setPlay({ ...play, [key]: value });
  return (
    <Modal title="플레이 기록" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave(play);
          } catch {}
        }}
      >
        <label className="field">
          시나리오
          <select
            required
            value={play.scenarioId}
            onChange={(e) => update("scenarioId", e.target.value)}
          >
            {scenarios.map((s) => (
              <option key={s.id} value={s.id}>
                {scenarioName(s)} · {scenarioProductName(s)}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          사용한 덱
          <select
            value={play.deckId}
            onChange={(e) => {
              const deck = decks.find((d) => d.id === e.target.value);
              setPlay({
                ...play,
                deckId: e.target.value,
                deckName: deck?.name ?? "",
                threat: play.threat,
              });
            }}
          >
            <option value="">덱 미지정</option>
            {play.deckId && !decks.some((d) => d.id === play.deckId) && (
              <option value={play.deckId}>{play.deckName} (삭제된 덱)</option>
            )}
            {decks.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          캠페인
          <select
            value={play.campaignId ?? ""}
            onChange={(e) => update("campaignId", e.target.value)}
          >
            <option value="">단독 플레이</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
        <div className="form-grid">
          <label className="field">
            날짜
            <input
              type="date"
              required
              value={play.date}
              onChange={(e) => update("date", e.target.value)}
            />
          </label>
          <label className="field">
            결과
            <select
              value={play.result}
              onChange={(e) => update("result", e.target.value)}
            >
              <option value="playing">진행 중</option>
              <option value="win">승리</option>
              <option value="loss">패배</option>
            </select>
          </label>
          <label className="field">
            모드
            <select
              value={play.mode}
              onChange={(e) => update("mode", e.target.value)}
            >
              <option value="normal">일반</option>
              <option value="easy">쉬움</option>
              <option value="nightmare">악몽</option>
            </select>
          </label>
          <label className="field">
            플레이어 수
            <select
              value={play.players}
              onChange={(e) => update("players", Number(e.target.value))}
            >
              {[1, 2, 3, 4].map((n) => (
                <option key={n} value={n}>
                  {n}인
                </option>
              ))}
            </select>
          </label>
          {[
            ["rounds", "완료한 라운드"],
            ["threat", "최종 위협 합계"],
            ["damage", "영웅 피해 합계"],
            ["deadThreat", "사망한 영웅 위협 합계"],
            ["victory", "승점 합계"],
          ].map(([key, label]) => (
            <label className="field" key={key}>
              {label}
              <input
                type="number"
                min={0}
                max={9999}
                required
                value={play[key as keyof Play] as number}
                onChange={(e) =>
                  update(key, Math.max(0, Number(e.target.value)))
                }
              />
            </label>
          ))}
        </div>
        {play.result === "win" && (
          <div className="score-box">
            최종 점수 <strong>{score(play)}점</strong>
            <small>
              라운드 × 10 + 위협 + 영웅 피해 + 사망 영웅 위협 − 승점
              <br />
              다인 플레이는 모든 플레이어의 값을 합산해 입력하세요.
            </small>
          </div>
        )}
        <label className="field">
          여정 메모
          <textarea
            rows={4}
            maxLength={10000}
            value={play.notes}
            onChange={(e) => update("notes", e.target.value)}
            placeholder="결정적인 순간, 교체할 카드, 다음 플레이를 위한 메모…"
          />
        </label>
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" disabled={busy || !play.scenarioId}>
            <Check size={16} />
            {busy ? "저장 중…" : "기록 저장"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
function CampaignEditor({
  initial,
  scenarios,
  busy,
  onClose,
  onSave,
}: {
  initial: Campaign;
  scenarios: Scenario[];
  busy: boolean;
  onClose: () => void;
  onSave: (c: Campaign) => Promise<void>;
}) {
  const [c, setC] = useState(initial),
    [q, setQ] = useState("");
  return (
    <Modal title="캠페인 관리" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          try {
            await onSave({ ...c, name: c.name.trim() });
          } catch {}
        }}
      >
        <label className="field">
          캠페인 이름
          <input
            required
            maxLength={100}
            value={c.name}
            onChange={(e) => setC({ ...c, name: e.target.value })}
          />
        </label>
        <h3>시나리오 선택 · {c.scenarioIds.length}개</h3>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="캠페인 시나리오 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="시나리오 이름 검색"
          />
        </label>
        <div className="campaign-pick">
          {scenarios
            .filter((s) => scenarioSearchText(s).includes(q.toLowerCase()))
            .map((s) => (
              <label className="checkbox" key={s.id}>
                <input
                  type="checkbox"
                  checked={c.scenarioIds.includes(s.id)}
                  onChange={(e) =>
                    setC({
                      ...c,
                      scenarioIds: e.target.checked
                        ? [...c.scenarioIds, s.id]
                        : c.scenarioIds.filter((id) => id !== s.id),
                    })
                  }
                />
                {scenarioName(s)}
              </label>
            ))}
        </div>
        {[
          ["boons", "은혜 (Boons)"],
          ["burdens", "부담 (Burdens)"],
          ["notes", "캠페인 메모"],
        ].map(([key, label]) => (
          <label className="field" key={key}>
            {label}
            <textarea
              maxLength={10000}
              rows={3}
              value={c[key as keyof Campaign] as string}
              onChange={(e) => setC({ ...c, [key]: e.target.value })}
            />
          </label>
        ))}
        <div className="modal-actions">
          <button type="button" className="btn" onClick={onClose}>
            취소
          </button>
          <button className="btn primary" disabled={busy || !c.name.trim()}>
            캠페인 저장
          </button>
        </div>
      </form>
    </Modal>
  );
}
function Collection({
  packs,
  owned,
  disabled,
  onChange,
}: {
  packs: Catalog["packs"];
  owned: string[];
  disabled: boolean;
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState("");
  return (
    <>
      <div className="filter-panel">
        <label className="search-field">
          <Search size={19} />
          <input
            aria-label="보유 확장팩 검색"
            placeholder="제품 이름 검색"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </label>
        <span>
          <strong>{owned.length}</strong>개 제품 보유
        </span>
      </div>
      <div className="collection-grid">
        {packs
          .filter((p) =>
            `${p.name} ${productName(p.name, p.code, packs)}`
              .toLowerCase()
              .includes(q.toLowerCase()),
          )
          .map((p) => (
            <label
              className={`collection-item ${owned.includes(p.code) ? "selected" : ""}`}
              key={p.code}
            >
              <input
                type="checkbox"
                disabled={disabled}
                checked={owned.includes(p.code)}
                onChange={(e) =>
                  onChange(
                    e.target.checked
                      ? [...owned, p.code]
                      : owned.filter((x) => x !== p.code),
                  )
                }
              />
              <div>
                <strong>{productName(p.name, p.code, packs)}</strong>
                <small>{p.koreanEdition ? `한글판 · ${p.code}` : p.code}</small>
              </div>
              {owned.includes(p.code) && <Check size={18} />}
            </label>
          ))}
      </div>
    </>
  );
}
function BackupImport({
  state,
  commit,
  disabled,
  notify,
}: {
  state: State;
  commit: Commit;
  disabled: boolean;
  notify: (m: string) => void;
}) {
  return (
    <label className={`btn file-button ${disabled ? "disabled" : ""}`}>
      <Upload size={17} />
      백업 파일 복원
      <input
        type="file"
        accept=".json,application/json"
        disabled={disabled}
        onChange={async (e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          try {
            if (file.size > 10e6)
              throw new Error("10MB 이하 백업 파일만 지원합니다.");
            const imported = validateState(
              JSON.parse(await file.text()),
            ) as State;
            const merge = <T extends { id: string }>(a: T[], b: T[]) => [
              ...a,
              ...b.filter((x) => !a.some((y) => x.id === y.id)),
            ];
            await commit({
              decks: merge(state.decks, imported.decks),
              plays: merge(state.plays, imported.plays),
              campaigns: merge(state.campaigns, imported.campaigns),
              owned: [...new Set([...state.owned, ...imported.owned])],
            });
            notify("백업 기록을 복원했습니다.");
          } catch (err) {
            notify((err as Error).message);
          }
        }}
      />
    </label>
  );
}
function PasswordRecovery({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (m: string) => void;
}) {
  const [password, setPassword] = useState(""),
    [repeat, setRepeat] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal title="새 비밀번호 설정" onClose={onClose}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (password !== repeat) {
            setError("비밀번호가 일치하지 않습니다.");
            return;
          }
          setBusy(true);
          const { error } = await cloud!.auth.updateUser({ password });
          setBusy(false);
          if (error) {
            setError(error.message);
            return;
          }
          notify("비밀번호를 변경했습니다.");
          onClose();
        }}
      >
        <label className="field">
          새 비밀번호
          <input
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <label className="field">
          비밀번호 확인
          <input
            type="password"
            minLength={8}
            required
            autoComplete="new-password"
            value={repeat}
            onChange={(e) => setRepeat(e.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary full" disabled={busy}>
          {busy ? "저장 중…" : "비밀번호 변경"}
        </button>
      </form>
    </Modal>
  );
}
function Auth({
  onClose,
  notify,
}: {
  onClose: () => void;
  notify: (s: string) => void;
}) {
  const [mode, setMode] = useState<"login" | "signup" | "reset">("login"),
    [email, setEmail] = useState(""),
    [username, setUsername] = useState(""),
    [name, setName] = useState(""),
    [password, setPassword] = useState(""),
    [loading, setLoading] = useState(false),
    [error, setError] = useState("");
  return (
    <Modal
      title={
        mode === "login"
          ? "계정 로그인"
          : mode === "signup"
            ? "회원가입"
            : "비밀번호 재설정"
      }
      onClose={onClose}
    >
      {!cloud ? (
        <>
          <div className="notice">
            온라인 계정 저장소가 연결되지 않았습니다.
          </div>
          <p>
            배포 관리자가 계정 DB를 연결하면 모바일과 PC에서 같은 덱과 기록을
            사용할 수 있습니다. 저장소 연결 후 로그인하여 이용해 주세요.
          </p>
          <button className="btn primary" onClick={onClose}>
            닫기
          </button>
        </>
      ) : (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setLoading(true);
            setError("");
            try {
              if (useRender) {
                const result =
                  mode === "signup"
                    ? await renderCloud.auth.signUp({
                        username,
                        name,
                        password,
                      })
                    : await renderCloud.auth.signInWithPassword({
                        username,
                        password,
                      });
                if (result.error) throw result.error;
                notify(
                  mode === "signup"
                    ? "회원가입을 완료했습니다."
                    : "로그인했습니다.",
                );
                onClose();
                return;
              }
              if (mode === "reset") {
                const { error } = await cloud!.auth.resetPasswordForEmail(
                  email,
                  { redirectTo: location.origin + "/#settings" },
                );
                if (error) throw error;
                notify("비밀번호 재설정 메일을 보냈습니다.");
                onClose();
              } else {
                const { data, error } =
                  mode === "login"
                    ? await supabase!.auth.signInWithPassword({
                        email,
                        password,
                      })
                    : await supabase!.auth.signUp({
                        email,
                        password,
                        options: {
                          emailRedirectTo: location.origin + "/#settings",
                        },
                      });
                if (error) throw error;
                if (mode === "signup" && !data.session)
                  notify("이메일의 가입 확인 링크를 눌러주세요.");
                onClose();
              }
            } catch (err) {
              setError((err as Error).message);
            } finally {
              setLoading(false);
            }
          }}
        >
          <p>로그인하면 계정에 덱과 모험 기록을 저장합니다.</p>
          {useRender && mode === "signup" && (
            <label className="field">
              이름
              <input
                required
                maxLength={30}
                autoComplete="nickname"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="함께 플레이할 때 사용할 이름"
              />
            </label>
          )}
          {useRender ? (
            <label className="field">
              아이디
              <input
                aria-label="아이디"
                required
                minLength={mode === "signup" ? 3 : 1}
                maxLength={mode === "signup" ? 24 : 254}
                pattern={
                  mode === "signup"
                    ? "[A-Za-z0-9][A-Za-z0-9_]{2,23}"
                    : undefined
                }
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              {mode === "signup" && (
                <small className="muted">
                  영문·숫자·밑줄 3~24자 · 대소문자는 구분하지 않습니다.
                </small>
              )}
            </label>
          ) : (
            <label className="field">
              이메일
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
          )}
          {mode !== "reset" && (
            <label className="field">
              비밀번호
              <input
                type="password"
                required
                minLength={8}
                maxLength={128}
                placeholder="8자 이상"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {error && (
            <p role="alert" className="form-error">
              {error}
            </p>
          )}
          <button className="btn primary full" disabled={loading}>
            {loading
              ? "처리 중…"
              : mode === "login"
                ? "로그인"
                : mode === "signup"
                  ? "가입하기"
                  : "재설정 메일 보내기"}
          </button>
          <div className="auth-links">
            <button
              type="button"
              className="text-btn"
              onClick={() => {
                setMode(mode === "signup" ? "login" : "signup");
                setError("");
              }}
            >
              {mode === "signup" ? "이미 계정이 있어요" : "회원가입"}
            </button>
            {!useRender && (
              <button
                type="button"
                className="text-btn"
                onClick={() => {
                  setMode(mode === "reset" ? "login" : "reset");
                  setError("");
                }}
              >
                {mode === "reset"
                  ? "로그인으로 돌아가기"
                  : "비밀번호를 잊었어요"}
              </button>
            )}
          </div>
          {useRender && (
            <p className="muted">
              이메일·전화번호·SNS 연동 없이 가입합니다. 기존 이메일 계정은
              아이디 칸에 기존 이메일을 입력해 로그인하세요.
            </p>
          )}
        </form>
      )}
    </Modal>
  );
}
