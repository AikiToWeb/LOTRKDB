import { createPool, initializeDatabase, PostgresStore } from "./database.mjs";
import { createApp } from "./app.mjs";
const port = Number(process.env.PORT ?? 3001);
const production = process.env.NODE_ENV === "production";
const origin =
  process.env.APP_ORIGIN ??
  process.env.RENDER_EXTERNAL_URL ??
  "http://127.0.0.1:5173";
if (!process.env.DATABASE_URL) {
  console.error(
    "DATABASE_URL is required. Configure the Render PostgreSQL connection.",
  );
  process.exit(1);
}
const pool = createPool(process.env.DATABASE_URL);
try {
  await initializeDatabase(pool);
  const app = createApp({ store: new PostgresStore(pool), origin, production });
  const server = app.listen(port, "0.0.0.0", () =>
    console.log(`LOTRDB API listening on ${port}; PostgreSQL ready.`),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => {
      server.close(async () => {
        await pool.end();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    });
} catch (error) {
  console.error("Startup failed:", error.code ?? error.name);
  await pool.end();
  process.exit(1);
}
