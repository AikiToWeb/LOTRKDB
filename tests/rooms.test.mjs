import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import request from "supertest";
import { createApp } from "../server/app.mjs";
import {
  createPool,
  initializeDatabase,
  PostgresStore,
  stateChanges,
} from "../server/database.mjs";
import { emptyState } from "../src/domain.mjs";
import { roomWarnings } from "../server/rooms.mjs";

test("rooms detect a shared hero across different printings", () => {
  const cards = [
    { code: "1", name: "Aragorn", type_code: "hero" },
    { code: "2", name: "Aragorn", type_code: "hero" },
  ];
  assert.equal(
    roomWarnings(
      [
        { userId: "a", nickname: "A", deck: { slots: { 1: 1 } } },
        { userId: "b", nickname: "B", deck: { slots: { 2: 1 } } },
      ],
      cards,
    ).length,
    1,
  );
});
test("room API requires login and rejects foreign-origin participation", async () => {
  const app = createApp({
    store: {},
    origin: "http://test.local",
    serveStatic: false,
  });
  await request(app).get("/api/rooms").expect(401);
  await request(app)
    .post("/api/rooms/join")
    .set("Origin", "http://foreign.invalid")
    .send({})
    .expect(403);
});
test(
  "PostgreSQL rooms: private membership, own deck snapshots, capacity races and host transitions",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = createPool(process.env.TEST_DATABASE_URL);
    await initializeDatabase(pool);
    const store = new PostgresStore(pool),
      app = createApp({
        store,
        origin: "http://test.local",
        serveStatic: false,
      });
    const actors = [request.agent(app), request.agent(app), request.agent(app)];
    const usernames = actors.map(
        (_, i) => `room_${i}_${randomUUID().replaceAll("-", "").slice(0, 12)}`,
      ),
      ids = [];
    const send = (actor, method, path, body = {}) =>
      actor[method](`/api/rooms${path}`)
        .set("Origin", "http://test.local")
        .send({ ...body, userId: ids[actors.indexOf(actor)] });
    try {
      for (const [i, actor] of actors.entries()) {
        const result = await actor
          .post("/api/auth/signup")
          .set("Origin", "http://test.local")
          .send({
            username: usernames[i],
            name: `플레이어${i}`,
            password: "room-test-password",
          })
          .expect(200);
        ids.push(result.body.user.id);
      }
      const [host, player, outsider] = actors;
      const decks = ids.map((_, i) => ({
        id: randomUUID(),
        name: `Deck ${i}`,
        notes: "private notes must not be shared",
        slots: { "01001": 1 },
        updatedAt: new Date().toISOString(),
      }));
      for (const [i, id] of ids.entries())
        await store.saveState(
          id,
          stateChanges({ ...emptyState(), decks: [decks[i]] }, emptyState()),
        );
      const room = (
        await send(host, "post", "", {
          name: "Shared quest",
          nickname: "Host",
          scenarioId: "1",
          maxPlayers: 4,
        }).expect(200)
      ).body;
      const url = `/${room.id}`;
      await outsider.get(`/api/rooms${url}`).expect(404);
      assert.deepEqual((await outsider.get("/api/rooms").expect(200)).body, []);
      await send(player, "post", "/join", {
        code: room.code,
        nickname: "Player",
      }).expect(200);
      await send(player, "patch", url, { status: "playing" }).expect(403);
      await send(player, "put", `${url}/me`, { deckId: decks[0].id }).expect(
        404,
      );
      await send(player, "put", `${url}/me`, { ready: true }).expect(409);
      await send(host, "put", `${url}/me`, { deckId: decks[0].id }).expect(200);
      await send(player, "put", `${url}/me`, { deckId: decks[1].id }).expect(
        200,
      );
      await send(host, "put", `${url}/me`, { ready: true }).expect(200);
      await send(player, "put", `${url}/me`, { ready: true }).expect(200);
      await send(host, "patch", url, { status: "playing" }).expect(409);
      await store.saveState(
        ids[1],
        stateChanges(
          { ...emptyState(), decks: [{ ...decks[1], slots: { "01005": 1 } }] },
          { ...emptyState(), decks: [decks[1]] },
        ),
      );
      assert.equal(
        (await player.get(`/api/rooms${url}`).expect(200)).body.members.find(
          (m) => m.userId === ids[1],
        ).deck.slots["01001"],
        1,
      );
      const changed = (
        await send(player, "put", `${url}/me`, { deckId: decks[1].id }).expect(
          200,
        )
      ).body;
      assert.equal(
        changed.members.find((m) => m.userId === ids[1]).ready,
        false,
      );
      assert.ok(!JSON.stringify(changed).includes("private notes"));
      assert.ok(!JSON.stringify(changed).includes(usernames[0]));
      await send(player, "put", `${url}/me`, { ready: true }).expect(200);
      await player
        .put(`/api/rooms${url}/me`)
        .set("Origin", "http://test.local")
        .send({ userId: ids[0], ready: false })
        .expect(409);
      await send(host, "patch", url, { status: "playing" }).expect(200);
      await send(player, "put", `${url}/me`, { ready: false }).expect(409);
      await send(outsider, "post", "/join", {
        code: room.code,
        nickname: "Outsider",
      }).expect(409);
      await send(host, "patch", url, { status: "finished" }).expect(200);
      assert.equal(
        (await player.get(`/api/rooms${url}`).expect(200)).body.status,
        "finished",
      );
      const small = (
        await send(host, "post", "", {
          name: "Capacity test",
          nickname: "Host",
          scenarioId: "1",
          maxPlayers: 2,
        }).expect(200)
      ).body;
      const joined = await Promise.all(
        [player, outsider].map((a) =>
          send(a, "post", "/join", { code: small.code, nickname: "Seat" }),
        ),
      );
      assert.deepEqual(joined.map((r) => r.status).sort(), [200, 409]);
      assert.equal(
        (await host.get(`/api/rooms/${small.id}`).expect(200)).body.members
          .length,
        2,
      );
      const index = joined.findIndex((r) => r.status === 200),
        admitted = [player, outsider][index],
        admittedId = ids[index + 1];
      await send(admitted, "delete", `/${small.id}/members/${ids[0]}`).expect(
        409,
      );
      await send(host, "delete", `/${small.id}/members/${admittedId}`).expect(
        200,
      );
      await admitted.get(`/api/rooms/${small.id}`).expect(404);
      await send(host, "patch", `/${small.id}`, { status: "closed" }).expect(
        200,
      );
    } finally {
      await pool.query(
        "delete from lotr_users where username=any($1::text[])",
        [usernames],
      );
      await pool.end();
    }
  },
);
