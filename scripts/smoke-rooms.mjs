import assert from "node:assert/strict";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { emptyState } from "../src/domain.mjs";
const origin = new URL(process.argv[2] || "").origin;
if (!origin.startsWith("https://") && !origin.startsWith("http://127.0.0.1"))
  throw new Error("Use HTTPS or localhost");
const password = randomBytes(24).toString("base64url");
const actors = ["host", "player"].map((role) => ({
  role,
  username: `qa_${role}_${randomUUID().replaceAll("-", "").slice(0, 10)}`,
  id: "",
  cookie: "",
  state: emptyState(),
}));
async function call(
  actor,
  path,
  body,
  method = body ? "POST" : "GET",
  expected = 200,
) {
  const res = await fetch(`${origin}/api${path}`, {
    method,
    headers: {
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(actor?.cookie ? { Cookie: actor.cookie } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(90000),
  });
  const data = await res.json();
  assert.equal(res.status, expected, `${path}: ${data.error || res.status}`);
  if (actor && res.headers.get("set-cookie"))
    actor.cookie = res.headers.get("set-cookie").split(";")[0];
  return data;
}
let room;
try {
  await call(null, "/rooms", undefined, "GET", 401);
  for (const [index, actor] of actors.entries()) {
    actor.id = (
      await call(actor, "/auth/signup", {
        username: actor.username,
        name: actor.role === "host" ? "방장 테스트" : "참여자 테스트",
        password,
      })
    ).user.id;
    const deck = {
      id: randomUUID(),
      name: index ? "[검증] 레골라스 덱" : "[검증] 아라고른 덱",
      notes: "QA-only private notes",
      slots: { [index ? "01005" : "01001"]: 1 },
      updatedAt: new Date().toISOString(),
    };
    actor.state = { ...emptyState(), decks: [deck] };
    await call(
      actor,
      "/state",
      { userId: actor.id, next: actor.state, previous: emptyState() },
      "PUT",
    );
  }
  const [host, player] = actors;
  room = await call(host, "/rooms", {
    userId: host.id,
    name: "[검증] 두 계정 시나리오",
    nickname: "방장 테스트",
    scenarioId: "1",
    maxPlayers: 4,
  });
  await call(player, `/rooms/${room.id}`, undefined, "GET", 404);
  await call(player, "/rooms/join", {
    userId: player.id,
    code: room.code,
    nickname: "참여자 테스트",
  });
  await call(
    player,
    `/rooms/${room.id}/me`,
    { userId: player.id, deckId: host.state.decks[0].id },
    "PUT",
    404,
  );
  for (const actor of actors) {
    await call(
      actor,
      `/rooms/${room.id}/me`,
      { userId: actor.id, deckId: actor.state.decks[0].id },
      "PUT",
    );
    await call(
      actor,
      `/rooms/${room.id}/me`,
      { userId: actor.id, ready: true },
      "PUT",
    );
  }
  await call(
    player,
    `/rooms/${room.id}`,
    { userId: player.id, status: "playing" },
    "PATCH",
    403,
  );
  room = await call(
    host,
    `/rooms/${room.id}`,
    { userId: host.id, status: "playing" },
    "PATCH",
  );
  assert.equal(room.members.length, 2);
  assert.ok(room.members.every((m) => m.deck && m.ready));
  assert.ok(!JSON.stringify(room).includes("QA-only private notes"));
  assert.ok(!JSON.stringify(room).includes(host.username));
  await call(
    player,
    `/rooms/${room.id}/me`,
    { userId: player.id, ready: false },
    "PUT",
    409,
  );
  room = await call(
    host,
    `/rooms/${room.id}`,
    { userId: host.id, status: "finished" },
    "PATCH",
  );
  await mkdir("tmp", { recursive: true });
  // Temporary QA credentials for browser verification, never tracked or logged.
  await writeFile(
    "tmp/room-qa.json",
    JSON.stringify({
      username: host.username,
      password,
      roomId: room.id,
      origin,
    }),
  );
  console.log(
    JSON.stringify({
      result: "PASS",
      roomId: room.id,
      players: room.members.length,
      status: room.status,
      checks: [
        "Private room",
        "Own decks only",
        "Two accounts ready",
        "Host-only start",
        "Deck changes locked during play",
        "Host finishes",
        "No email or private notes shared",
      ],
    }),
  );
} finally {
  for (const actor of actors)
    if (actor.id) {
      try {
        await call(
          actor,
          "/state",
          { userId: actor.id, next: emptyState(), previous: actor.state },
          "PUT",
        );
      } catch {}
      try {
        await call(actor, "/auth/logout", {}, "POST");
      } catch {}
    }
}
