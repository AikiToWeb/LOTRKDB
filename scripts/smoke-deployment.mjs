import { randomUUID, randomBytes } from "node:crypto";
import assert from "node:assert/strict";
import { emptyState } from "../src/domain.mjs";
const origin = new URL(process.argv[2] ?? "").origin;
if (!origin.startsWith("https://") && !origin.startsWith("http://127.0.0.1"))
  throw new Error("Use an HTTPS deployment URL.");
const suffix = randomUUID();
const password = randomBytes(24).toString("base64url");
const actors = [
  {
    username: `qa_owner_${suffix.replaceAll("-", "").slice(0, 12)}`,
    cookie: "",
    id: "",
  },
  {
    username: `qa_other_${suffix.replaceAll("-", "").slice(0, 12)}`,
    cookie: "",
    id: "",
  },
];
const checks = [];
async function call(
  route,
  { actor, body, method = "GET", expected = 200 } = {},
) {
  const response = await fetch(origin + route, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(actor?.cookie ? { Cookie: actor.cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120000),
  });
  const data = await response.json();
  assert.equal(
    response.status,
    expected,
    `${method} ${route}: ${data.error ?? response.status}`,
  );
  const cookie = response.headers.get("set-cookie");
  if (cookie && actor) actor.cookie = cookie.split(";")[0];
  return data;
}
try {
  const health = await call("/api/health");
  assert.equal(health.database, "connected");
  checks.push("PostgreSQL health");
  const catalog = await call("/api/catalog");
  assert.ok(catalog.cards.length > 1000);
  assert.ok(catalog.scenarios.length > 100);
  checks.push(
    `DB catalogue: ${catalog.cards.length} cards / ${catalog.scenarios.length} scenarios`,
  );
  await call("/api/state", { expected: 401 });
  checks.push("Unauthenticated read rejected");
  for (const actor of actors) {
    const signup = await call("/api/auth/signup", {
      method: "POST",
      actor,
      body: { username: actor.username, name: "배포 검증", password },
    });
    actor.id = signup.user.id;
    assert.ok(actor.cookie);
  }
  const [owner, other] = actors;
  const deck = {
    id: randomUUID(),
    name: "[배포 검증] 원정대",
    notes: "자동 검증용 임시 기록",
    slots: { "01001": 1, "01005": 1, "01007": 1 },
    updatedAt: new Date().toISOString(),
  };
  const campaign = {
    id: randomUUID(),
    name: "[배포 검증] 캠페인",
    notes: "",
    scenarioIds: ["1"],
    boons: "테스트 은혜",
    burdens: "테스트 부담",
  };
  const play = {
    id: randomUUID(),
    scenarioId: "1",
    campaignId: campaign.id,
    deckId: deck.id,
    deckName: deck.name,
    date: new Date().toISOString().slice(0, 10),
    result: "playing",
    mode: "normal",
    players: 1,
    rounds: 1,
    threat: 30,
    damage: 0,
    deadThreat: 0,
    victory: 0,
    notes: "자동 검증용 임시 기록",
  };
  const state = {
    decks: [deck],
    plays: [play],
    campaigns: [campaign],
    owned: ["Core", "RevCore"],
  };
  await call("/api/state", {
    actor: owner,
    method: "PUT",
    body: { userId: owner.id, next: state, previous: emptyState() },
  });
  assert.deepEqual(
    await call(`/api/state?user=${owner.id}`, { actor: owner }),
    state,
  );
  checks.push("Deck, play, campaign and collection persisted");
  await call("/api/auth/logout", { actor: owner, method: "POST", body: {} });
  await call(`/api/state?user=${owner.id}`, { actor: owner, expected: 401 });
  await call("/api/auth/login", {
    actor: owner,
    method: "POST",
    body: { email: owner.email, password },
  });
  assert.deepEqual(
    await call(`/api/state?user=${owner.id}`, { actor: owner }),
    state,
  );
  checks.push("Logout and fresh login retain records");
  assert.deepEqual(
    await call(`/api/state?user=${other.id}`, { actor: other }),
    emptyState(),
  );
  await call(`/api/state?user=${owner.id}`, { actor: other, expected: 409 });
  await call("/api/state", {
    actor: other,
    method: "PUT",
    expected: 409,
    body: { userId: owner.id, next: emptyState(), previous: state },
  });
  checks.push("Cross-account read/write rejected");
  await call("/api/state", {
    actor: owner,
    method: "PUT",
    expected: 400,
    body: {
      userId: owner.id,
      next: { ...state, plays: [{ id: "invalid" }] },
      previous: state,
    },
  });
  assert.deepEqual(
    await call(`/api/state?user=${owner.id}`, { actor: owner }),
    state,
  );
  checks.push("Invalid payload rejected without changing data");
  const foreign = await fetch(origin + "/api/state", {
    method: "PUT",
    headers: {
      Origin: "https://attacker.invalid",
      "Content-Type": "application/json",
      Cookie: owner.cookie,
    },
    body: "{}",
  });
  assert.equal(foreign.status, 403);
  checks.push("Foreign-origin write rejected");
  await call("/api/state", {
    actor: owner,
    method: "PUT",
    body: { userId: owner.id, next: emptyState(), previous: state },
  });
  assert.deepEqual(
    await call(`/api/state?user=${owner.id}`, { actor: owner }),
    emptyState(),
  );
  checks.push("Temporary test records cleaned up");
  console.log(JSON.stringify({ url: origin, result: "PASS", checks }, null, 2));
} finally {
  for (const actor of actors)
    if (actor.cookie)
      try {
        await call("/api/auth/logout", { actor, method: "POST", body: {} });
      } catch {}
}
