// Operator-only full PostgreSQL backup; never served by the application.
import pg from "pg";
import { readFile, writeFile, mkdir, chmod, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import path from "node:path";

const [action, directory] = process.argv.slice(2);
if (
  !["backup", "verify", "restore-local", "restore-neon"].includes(action) ||
  !directory ||
  !path.isAbsolute(directory)
) {
  console.error(
    "Usage: node scripts/backup-database.mjs backup|verify|restore-local|restore-neon /absolute/private/directory",
  );
  process.exit(1);
}
process.umask(0o077);
const identify = (s) => '"' + s.replaceAll('"', '""') + '"';
const hash = (data) => createHash("sha256").update(data).digest("hex");
const binaries = process.env.PG_BIN_DIR || "";
async function hiddenUrl() {
  if (process.env.BACKUP_DATABASE_URL) return process.env.BACKUP_DATABASE_URL;
  if (!process.stdin.isTTY) throw new Error("TTY_REQUIRED");
  process.stdout.write("Database URL (hidden input; never stored): ");
  const muted = new Writable({
    write(_chunk, _encoding, callback) {
      callback();
    },
  });
  const reader = createInterface({
    input: process.stdin,
    output: muted,
    terminal: true,
  });
  try {
    return await reader.question("");
  } finally {
    reader.close();
    process.stdout.write("\n");
  }
}
async function command(name, args, env) {
  return new Promise((resolve, reject) => {
    const child = spawn(path.join(binaries, name), args, {
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    const chunks = [];
    child.stdout.on("data", (chunk) => chunks.push(chunk));
    // PostgreSQL errors can contain SQL or connection details. Never echo them.
    child.stderr.on("data", () => {});
    child.on("error", () => reject(new Error("CLIENT_UNAVAILABLE")));
    child.on("close", (code) =>
      code === 0
        ? resolve(Buffer.concat(chunks).toString())
        : reject(new Error("CLIENT_FAILED")),
    );
  });
}
async function fingerprints(client) {
  const tables = (
    await client.query(
      "select schemaname,tablename from pg_tables where schemaname not like 'pg_%' and schemaname <> 'information_schema' order by schemaname,tablename",
    )
  ).rows;
  const result = [];
  for (const { schemaname, tablename } of tables) {
    const relation = `${identify(schemaname)}.${identify(tablename)}`;
    // JSON keeps timestamp precision and JSONB values; ordering is deterministic.
    const { rows } = await client.query(
      `select coalesce(jsonb_agg(to_jsonb(t) order by to_jsonb(t)::text collate "C"),'[]'::jsonb) as records from ${relation} t`,
    );
    const records = rows[0].records;
    result.push({
      schema: schemaname,
      table: tablename,
      count: records.length,
      sha256: hash(JSON.stringify(records)),
    });
  }
  return result;
}
let client;
let stage = "INPUT";
try {
  const supplied = (await hiddenUrl()).trim();
  // Accept the vendor's psql snippet as text; never execute pasted shell code.
  const match = supplied.match(
    /^(?:psql\s+)?(['"]?)(postgres(?:ql)?:\/\/[^\s'"\x00-\x1f]+)\1$/,
  );
  if (!match) throw new Error("INVALID_URL_COPY_NEON_CONNECTION_STRING");
  const url = new URL(match[2]);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("INVALID_URL");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (action === "restore-local" && !local)
    throw new Error("LOCAL_RESTORE_ONLY");
  if (action === "restore-neon") {
    const directHost =
      "ep-curly-butterfly-azjoqo4g.c-3.ap-southeast-1.aws.neon.tech";
    const poolerHost =
      "ep-curly-butterfly-azjoqo4g-pooler.c-3.ap-southeast-1.aws.neon.tech";
    if (url.hostname === poolerHost) url.hostname = directHost;
    if (url.hostname !== directHost)
      throw new Error("WRONG_NEON_HOST_COPY_FROM_NEON_NOT_RENDER");
    if (decodeURIComponent(url.pathname.slice(1)) !== "lotrkdb")
      throw new Error("WRONG_NEON_DATABASE_SELECT_LOTRKDB");
    if (!url.password || decodeURIComponent(url.password).includes("****"))
      throw new Error("MASKED_OR_MISSING_PASSWORD_USE_COPY_SNIPPET");
  }
  const parameters = {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: decodeURIComponent(url.pathname.slice(1)),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    connectionTimeoutMillis: 15000,
    ssl: local
      ? false
      : {
          rejectUnauthorized: true,
          ca: await readFile(
            process.env.PGSSLROOTCERT || "/etc/ssl/cert.pem",
            "utf8",
          ),
        },
  };
  stage = "CONNECT";
  client = new pg.Client(parameters);
  await client.connect();
  stage = "SESSION";
  await client.query("set time zone 'UTC'");
  const env = Object.fromEntries(
    Object.entries(process.env).filter(
      ([key]) => !key.startsWith("PG") && key !== "BACKUP_DATABASE_URL",
    ),
  );
  Object.assign(env, {
    PGHOST: parameters.host,
    PGPORT: String(parameters.port),
    PGDATABASE: parameters.database,
    PGUSER: parameters.user,
    PGPASSWORD: parameters.password,
    PGSSLMODE: local ? "disable" : "verify-full",
    PGSSLROOTCERT: process.env.PGSSLROOTCERT || "/etc/ssl/cert.pem",
    PGCONNECT_TIMEOUT: "15",
    PGOPTIONS: "-c timezone=UTC",
  });
  const dump = path.join(directory, "database.dump");
  const manifestPath = path.join(directory, "manifest.json");
  if (action === "backup") {
    const version = await command("pg_dump", ["--version"], env);
    const major = Number(version.match(/PostgreSQL\) (\d+)/)?.[1]);
    const server = Number(
      (await client.query("show server_version_num")).rows[0]
        .server_version_num,
    );
    if (!major || major < Math.floor(server / 10000))
      throw new Error("CLIENT_TOO_OLD");
    await mkdir(directory, { mode: 0o700 }); // Refuse to overwrite an existing backup.
    await client.query("begin isolation level repeatable read read only");
    const snapshot = (await client.query("select pg_export_snapshot() as id"))
      .rows[0].id;
    const tables = await fingerprints(client);
    for (const table of [
      "lotr_users",
      "lotr_sessions",
      "lotr_documents",
      "lotr_catalog",
      "lotr_rooms",
      "lotr_room_members",
    ])
      if (
        !tables.some(
          (entry) => entry.schema === "public" && entry.table === table,
        )
      )
        throw new Error("MISSING_APPLICATION_TABLE");
    try {
      await command(
        "pg_dump",
        [
          "--format=custom",
          "--no-owner",
          "--no-acl",
          `--snapshot=${snapshot}`,
          `--file=${dump}`,
        ],
        env,
      );
      await chmod(dump, 0o600);
      const contents = await command("pg_restore", ["--list", dump], env);
      for (const { schema, table } of tables)
        if (!contents.includes(`TABLE DATA ${schema} ${table} `))
          throw new Error("INCOMPLETE_ARCHIVE");
      await client.query("commit");
      await writeFile(path.join(directory, "contents.txt"), contents, {
        mode: 0o600,
      });
      await writeFile(
        manifestPath,
        JSON.stringify(
          {
            format: "lotrkdb-pgdump-v1",
            createdAt: new Date().toISOString(),
            serverVersion: server,
            dumpSha256: hash(await readFile(dump)),
            tables,
            restoreVerified: false,
          },
          null,
          2,
        ) + "\n",
        { mode: 0o600 },
      );
      console.log(
        "Full backup completed. Restore verification is still required.",
      );
      console.log(
        JSON.stringify(
          tables.map(({ schema, table, count }) => ({ schema, table, count })),
        ),
      );
    } catch (error) {
      await unlink(dump).catch(() => {});
      throw error;
    }
  } else {
    stage = "READ_ARCHIVE";
    const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
    if (
      manifest.format !== "lotrkdb-pgdump-v1" ||
      manifest.dumpSha256 !== hash(await readFile(dump))
    )
      throw new Error("ARCHIVE_CHECKSUM_MISMATCH");
    if (["restore-local", "restore-neon"].includes(action)) {
      if (action === "restore-neon") {
        const proof = JSON.parse(
          await readFile(
            path.join(directory, "local-restore-verification.json"),
            "utf8",
          ),
        );
        if (!proof.tablesMatch || proof.dumpSha256 !== manifest.dumpSha256)
          throw new Error("LOCAL_VERIFICATION_REQUIRED");
      }
      stage = "CHECK_EMPTY_TARGET";
      const existing = await fingerprints(client);
      if (existing.length) throw new Error("TARGET_NOT_EMPTY");
      stage = "RESTORE";
      await command(
        "pg_restore",
        [
          "--exit-on-error",
          "--single-transaction",
          "--no-owner",
          "--no-acl",
          `--dbname=${parameters.database}`,
          dump,
        ],
        env,
      );
    }
    await client.query("begin isolation level repeatable read read only");
    stage = "VERIFY_DATA";
    const restored = await fingerprints(client);
    await client.query("commit");
    if (JSON.stringify(restored) !== JSON.stringify(manifest.tables))
      throw new Error("RESTORE_DATA_MISMATCH");
    await writeFile(
      path.join(
        directory,
        action === "restore-local"
          ? "local-restore-verification.json"
          : action === "restore-neon"
            ? "neon-restore-verification.json"
            : "verification.json",
      ),
      JSON.stringify(
        {
          verifiedAt: new Date().toISOString(),
          dumpSha256: manifest.dumpSha256,
          tablesMatch: true,
          tables: restored.map(({ schema, table, count }) => ({
            schema,
            table,
            count,
          })),
        },
        null,
        2,
      ) + "\n",
      { mode: 0o600 },
    );
    console.log(
      "PASS: all table counts and data fingerprints match the backup snapshot.",
    );
  }
} catch (error) {
  // Do not log exception messages/stacks supplied by the database or URL parser.
  const safeCode =
    /^(?:[0-9A-Z]{5}|E[A-Z_]+|CERT_[A-Z_]+|DEPTH_ZERO_SELF_SIGNED_CERT|UNABLE_TO_[A-Z_]+)$/.test(
      error.code || "",
    )
      ? error.code
      : "UNCLASSIFIED";
  console.error("Failure stage:", stage, "code:", safeCode);
  console.error(
    "Backup operation failed:",
    [
      "TTY_REQUIRED",
      "INVALID_URL",
      "INVALID_URL_COPY_NEON_CONNECTION_STRING",
      "LOCAL_RESTORE_ONLY",
      "WRONG_NEON_TARGET",
      "WRONG_NEON_HOST_COPY_FROM_NEON_NOT_RENDER",
      "WRONG_NEON_DATABASE_SELECT_LOTRKDB",
      "MASKED_OR_MISSING_PASSWORD_USE_COPY_SNIPPET",
      "LOCAL_VERIFICATION_REQUIRED",
      "CLIENT_UNAVAILABLE",
      "CLIENT_FAILED",
      "CLIENT_TOO_OLD",
      "MISSING_APPLICATION_TABLE",
      "INCOMPLETE_ARCHIVE",
      "ARCHIVE_CHECKSUM_MISMATCH",
      "TARGET_NOT_EMPTY",
      "RESTORE_DATA_MISMATCH",
    ].includes(error.message)
      ? error.message
      : "CHECK_CONNECTION_OR_LOCAL_FILES",
  );
  process.exitCode = 1;
} finally {
  if (client) await client.end().catch(() => {});
}
