import pg from "pg";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { emptyState, validateState } from "../src/domain.mjs";
export const createPool = (connectionString) =>
  new pg.Pool({
    connectionString,
    max: 5,
    connectionTimeoutMillis: 10000,
    idleTimeoutMillis: 30000,
  });
export async function initializeDatabase(pool) {
  const schema = await readFile(
    new URL("./schema.sql", import.meta.url),
    "utf8",
  );
  const raw = await readFile(
    new URL("../public/data/catalog.json", import.meta.url),
    "utf8",
  );
  const hash = createHash("sha256").update(raw).digest("hex");
  const connection = await pool.connect();
  try {
    await connection.query("begin");
    // Serialize startup migrations across processes and CI workers.
    await connection.query("select pg_advisory_xact_lock(73190241)");
    await connection.query(schema);
    await connection.query(
      `insert into lotr_catalog (id,data,content_hash) values ('ringsdb',$1::jsonb,$2)
 on conflict (id) do update set data=excluded.data,content_hash=excluded.content_hash,updated_at=now()
 where lotr_catalog.content_hash<>excluded.content_hash`,
      [raw, hash],
    );
    await connection.query("commit");
  } catch (error) {
    await connection.query("rollback");
    throw error;
  } finally {
    connection.release();
  }
}
export function stateChanges(nextValue, previousValue) {
  const next = validateState(nextValue),
    previous = validateState(previousValue);
  const changed = [],
    removed = [];
  for (const kind of ["decks", "plays", "campaigns"]) {
    const old = new Map(previous[kind].map((v) => [v.id, v]));
    for (const value of next[kind])
      if (JSON.stringify(old.get(value.id)) !== JSON.stringify(value))
        changed.push({ kind, id: value.id, data: value });
    const ids = new Set(next[kind].map((v) => v.id));
    for (const value of previous[kind])
      if (!ids.has(value.id)) removed.push({ kind, id: value.id });
  }
  if (JSON.stringify(next.owned) !== JSON.stringify(previous.owned))
    changed.push({ kind: "owned", id: "collection", data: next.owned });
  return { changed, removed };
}
export class PostgresStore {
  constructor(pool) {
    this.pool = pool;
  }
  async userByUsername(username) {
    return (
      await this.pool.query(
        "select id,username,display_name as name,password_hash from lotr_users where lower(username)=$1",
        [username],
      )
    ).rows[0];
  }
  async createUser(user) {
    await this.pool.query(
      "insert into lotr_users(id,username,display_name,password_hash) values ($1,$2,$3,$4)",
      [user.id, user.username, user.name, user.passwordHash],
    );
  }
  async createSession(hash, userId) {
    await this.pool.query("delete from lotr_sessions where expires_at<now()");
    await this.pool.query(
      "insert into lotr_sessions(token_hash,user_id,expires_at) values ($1,$2,now()+interval '30 days')",
      [hash, userId],
    );
  }
  async session(hash) {
    return (
      await this.pool.query(
        "select u.id,u.username,u.display_name as name from lotr_sessions s join lotr_users u on u.id=s.user_id where s.token_hash=$1 and s.expires_at>now()",
        [hash],
      )
    ).rows[0];
  }
  async logout(hash) {
    await this.pool.query("delete from lotr_sessions where token_hash=$1", [
      hash,
    ]);
  }
  async readState(userId) {
    const rows = (
      await this.pool.query(
        "select kind,data from lotr_documents where user_id=$1 order by updated_at desc",
        [userId],
      )
    ).rows;
    const state = emptyState();
    for (const row of rows) {
      if (row.kind === "owned") state.owned = row.data;
      else state[row.kind].push(row.data);
    }
    return validateState(state);
  }
  async saveState(userId, changes) {
    const connection = await this.pool.connect();
    try {
      await connection.query("begin");
      for (const value of changes.changed)
        await connection.query(
          `insert into lotr_documents(user_id,kind,id,data) values ($1,$2,$3,$4::jsonb) on conflict(user_id,kind,id) do update set data=excluded.data,updated_at=now()`,
          [userId, value.kind, value.id, JSON.stringify(value.data)],
        );
      for (const value of changes.removed)
        await connection.query(
          "delete from lotr_documents where user_id=$1 and kind=$2 and id=$3",
          [userId, value.kind, value.id],
        );
      await connection.query("commit");
    } catch (error) {
      await connection.query("rollback");
      throw error;
    } finally {
      connection.release();
    }
  }
  async catalog() {
    return (
      await this.pool.query("select data from lotr_catalog where id='ringsdb'")
    ).rows[0]?.data;
  }
  async health() {
    await this.pool.query("select 1");
    return true;
  }
}
