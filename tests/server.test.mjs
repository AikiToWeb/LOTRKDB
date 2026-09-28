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
import {
  hashPassword,
  verifyPassword,
  credentials,
} from "../server/security.mjs";
import { emptyState } from "../src/domain.mjs";

test("password storage uses random salts, and rejects the wrong password", async () => {
  const a = await hashPassword("long-test-password"),
    b = await hashPassword("long-test-password");
  assert.notEqual(a, b);
  assert.ok(!a.includes("long-test-password"));
  assert.equal(await verifyPassword("long-test-password", a), true);
  assert.equal(await verifyPassword("incorrect-password", a), false);
  assert.throws(() => credentials({ email: "not-email", password: "123" }));
});
test("record updates preserve unrelated documents and identify deletions", () => {
  const one = {
    id: randomUUID(),
    name: "Deck",
    notes: "",
    slots: {},
    updatedAt: new Date().toISOString(),
  };
  const previous = { ...emptyState(), decks: [one] };
  const next = { ...emptyState(), owned: ["Core"] };
  assert.deepEqual(stateChanges(next, previous), {
    changed: [{ kind: "owned", id: "collection", data: ["Core"] }],
    removed: [{ kind: "decks", id: one.id }],
  });
  assert.throws(() => stateChanges({ decks: [] }, previous));
});
test("API rejects unauthenticated reads and foreign-origin writes before touching data", async () => {
  const app = createApp({
    store: {},
    origin: "http://test.local",
    serveStatic: false,
  });
  await request(app).get("/api/state").expect(401);
  await request(app)
    .put("/api/state")
    .set("Origin", "https://attacker.invalid")
    .send({})
    .expect(403);
  await request(app)
    .post("/api/auth/login")
    .set("Origin", "http://test.local")
    .send({ email: "invalid", password: "123" })
    .expect(400);
});
test(
  "PostgreSQL: accounts, sessions, catalogue, isolation, update, delete and logout",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const pool = createPool(process.env.TEST_DATABASE_URL);
    await initializeDatabase(pool);
    const store = new PostgresStore(pool);
    const app = createApp({
      store,
      origin: "http://test.local",
      serveStatic: false,
    });
    const owner = request.agent(app),
      other = request.agent(app);
    const suffix = randomUUID();
    const emails = [
      `owner-${suffix}@example.invalid`,
      `other-${suffix}@example.invalid`,
    ];
    try {
      const first = await owner
        .post("/api/auth/signup")
        .set("Origin", "http://test.local")
        .send({ email: emails[0], password: "long-test-password" })
        .expect(200);
      const userId = first.body.user.id;
      assert.match(first.headers["set-cookie"][0], /HttpOnly/);
      assert.match(first.headers["set-cookie"][0], /SameSite=Lax/);
      const second = await other
        .post("/api/auth/signup")
        .set("Origin", "http://test.local")
        .send({ email: emails[1], password: "long-test-password" })
        .expect(200);
      const otherId = second.body.user.id;
      const deck = {
        id: randomUUID(),
        name: "Integration deck",
        notes: "Isolated CI data",
        slots: { "01001": 1 },
        updatedAt: new Date().toISOString(),
      };
      const next = { ...emptyState(), decks: [deck], owned: ["Core"] };
      await owner
        .put("/api/state")
        .set("Origin", "http://test.local")
        .send({ userId, next, previous: emptyState() })
        .expect(200);
      assert.deepEqual(
        (await owner.get(`/api/state?user=${userId}`).expect(200)).body,
        next,
      );
      assert.deepEqual(
        (await other.get(`/api/state?user=${otherId}`).expect(200)).body,
        emptyState(),
      );
      await other.get(`/api/state?user=${userId}`).expect(409);
      await other
        .put("/api/state")
        .set("Origin", "http://test.local")
        .send({ userId, next: emptyState(), previous: next })
        .expect(409);
      await owner
        .put("/api/state")
        .set("Origin", "http://test.local")
        .send({
          userId,
          next: { ...next, plays: [{ id: "bad" }] },
          previous: next,
        })
        .expect(400);
      assert.deepEqual(
        (await owner.get(`/api/state?user=${userId}`)).body,
        next,
      );
      const another = { ...deck, id: randomUUID(), name: "Another device" };
      await store.saveState(
        userId,
        stateChanges({ ...emptyState(), decks: [another] }, emptyState()),
      );
      const edited = { ...next, decks: [{ ...deck, name: "Updated deck" }] };
      await owner
        .put("/api/state")
        .set("Origin", "http://test.local")
        .send({ userId, next: edited, previous: next })
        .expect(200);
      const actual = (await owner.get(`/api/state?user=${userId}`)).body;
      assert.equal(actual.decks.length, 2);
      assert.ok(actual.decks.some((d) => d.name === "Another device"));
      await owner
        .put("/api/state")
        .set("Origin", "http://test.local")
        .send({ userId, next: emptyState(), previous: edited })
        .expect(200);
      assert.equal(
        (await owner.get(`/api/state?user=${userId}`)).body.decks.length,
        1,
      );
      const catalogue = (await request(app).get("/api/catalog").expect(200))
        .body;
      assert.ok(catalogue.cards.length > 1000);
      await owner
        .post("/api/auth/logout")
        .set("Origin", "http://test.local")
        .send({})
        .expect(200);
      await owner.get(`/api/state?user=${userId}`).expect(401);
      await owner
        .post("/api/auth/login")
        .set("Origin", "http://test.local")
        .send({ email: emails[0], password: "wrong-password" })
        .expect(401);
      await owner
        .post("/api/auth/login")
        .set("Origin", "http://test.local")
        .send({ email: emails[0], password: "long-test-password" })
        .expect(200);
    } finally {
      await pool.query("delete from lotr_users where email=any($1::text[])", [
        emails,
      ]);
      await pool.end();
    }
  },
);
