import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import pg from "pg";
import request from "supertest";
import { credentials, hashPassword } from "../server/security.mjs";
import {
  createPool,
  initializeDatabase,
  PostgresStore,
  stateChanges,
} from "../server/database.mjs";
import { createApp } from "../server/app.mjs";
import { emptyState } from "../src/domain.mjs";
test("minimal signup validates and normalizes username, name and password", () => {
  assert.deepEqual(
    credentials(
      {
        username: " Aragorn_1 ",
        name: " 아라고른 ",
        password: "long-password",
      },
      true,
    ),
    { username: "aragorn_1", name: "아라고른", password: "long-password" },
  );
  for (const username of [
    "ab",
    "a b",
    "한글아이디",
    "_abc",
    "a@b.com",
    "a".repeat(25),
  ])
    assert.throws(() =>
      credentials({ username, name: "이름", password: "long-password" }, true),
    );
  for (const name of ["", "  ", "a".repeat(31), "test\nname"])
    assert.throws(() =>
      credentials(
        { username: "player", name, password: "long-password" },
        true,
      ),
    );
  assert.throws(() =>
    credentials({ username: "player", name: "이름", password: "short" }, true),
  );
  assert.equal(
    credentials({ username: "old@example.com", password: "long-password" })
      .username,
    "old@example.com",
  );
});
test(
  "PostgreSQL migration preserves a legacy account, password, session and deck",
  { skip: !process.env.TEST_DATABASE_URL },
  async () => {
    const admin = createPool(process.env.TEST_DATABASE_URL),
      schema = `auth_qa_${randomUUID().replaceAll("-", "")}`;
    let pool;
    try {
      await admin.query(`create schema ${schema}`);
      pool = new pg.Pool({
        connectionString: process.env.TEST_DATABASE_URL,
        max: 3,
        options: `-c search_path=${schema}`,
      });
      await pool.query(
        "create table lotr_users(id uuid primary key,email text not null unique,password_hash text not null,created_at timestamptz default now())",
      );
      const id = randomUUID(),
        hash = await hashPassword("legacy-password");
      await pool.query(
        "insert into lotr_users(id,email,password_hash) values($1,$2,$3)",
        [id, "old@example.com", hash],
      );
      await initializeDatabase(pool);
      const store = new PostgresStore(pool);
      const deck = {
        id: randomUUID(),
        name: "기존 덱",
        notes: "",
        slots: { "01001": 1 },
        updatedAt: new Date().toISOString(),
      };
      await store.saveState(
        id,
        stateChanges({ ...emptyState(), decks: [deck] }, emptyState()),
      );
      const app = createApp({
          store,
          origin: "http://test.local",
          serveStatic: false,
        }),
        actor = request.agent(app);
      const login = await actor
        .post("/api/auth/login")
        .set("Origin", "http://test.local")
        .send({ username: "old@example.com", password: "legacy-password" })
        .expect(200);
      assert.deepEqual(login.body.user, {
        id,
        username: "old@example.com",
        name: "old",
      });
      await initializeDatabase(pool);
      assert.equal(
        (await actor.get("/api/auth/session").expect(200)).body.user.id,
        id,
      );
      assert.deepEqual(
        (await actor.get(`/api/state?user=${id}`).expect(200)).body.decks,
        [deck],
      );
      assert.equal(
        (
          await pool.query("select password_hash from lotr_users where id=$1", [
            id,
          ])
        ).rows[0].password_hash,
        hash,
      );
    } finally {
      if (pool) await pool.end();
      await admin.query(`drop schema if exists ${schema} cascade`);
      await admin.end();
    }
  },
);
