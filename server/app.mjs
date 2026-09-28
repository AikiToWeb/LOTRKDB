import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomUUID, randomBytes } from "node:crypto";
import {
  hashPassword,
  verifyPassword,
  credentials,
  tokenHash,
} from "./security.mjs";
import { stateChanges } from "./database.mjs";
import { roomRouter } from "./rooms.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";
const cookieName = "lotr_session";
const dummyHash = "scrypt:00000000000000000000000000000000:" + "00".repeat(64);
function cookieToken(req) {
  const match = (req.headers.cookie ?? "")
    .split(";")
    .map((v) => v.trim())
    .find((v) => v.startsWith(`${cookieName}=`));
  const token = match?.slice(cookieName.length + 1);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}
export function createApp({
  store,
  origin,
  production = false,
  serveStatic = true,
}) {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: [
            "'self'",
            "'unsafe-inline'",
            "https://fonts.googleapis.com",
          ],
          fontSrc: ["'self'", "https://fonts.gstatic.com"],
          imgSrc: ["'self'", "data:", "https://ringsdb.com"],
          connectSrc: ["'self'", "https://ringsdb.com"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: production ? [] : null,
        },
      },
    }),
  );
  app.use("/api", express.json({ limit: "10mb" }));
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      req.headers.origin !== origin
    ) {
      res.status(403).json({ error: "이 사이트에서만 요청할 수 있습니다." });
      return;
    }
    next();
  });
  const authLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { error: "로그인 요청이 많습니다. 잠시 후 다시 시도하세요." },
  });
  const sessionCookie = {
    httpOnly: true,
    sameSite: "lax",
    secure: production,
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  };
  async function issueSession(res, user) {
    const token = randomBytes(32).toString("hex");
    await store.createSession(tokenHash(token), user.id);
    res.cookie(cookieName, token, sessionCookie);
    res.json({ user: { id: user.id, email: user.email } });
  }
  async function authenticate(req, res, next) {
    try {
      const token = cookieToken(req);
      const user = token ? await store.session(tokenHash(token)) : null;
      if (!user) {
        res.status(401).json({ error: "로그인이 필요합니다." });
        return;
      }
      req.user = user;
      next();
    } catch (e) {
      next(e);
    }
  }
  app.get("/api/health", async (req, res, next) => {
    try {
      await store.health();
      res.json({ status: "ok", database: "connected" });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/catalog", async (req, res, next) => {
    try {
      const catalog = await store.catalog();
      if (!catalog) throw new Error("Catalogue unavailable");
      res.json(catalog);
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/auth/session", async (req, res, next) => {
    try {
      const token = cookieToken(req);
      res.json({
        user: token ? ((await store.session(tokenHash(token))) ?? null) : null,
      });
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/signup", authLimit, async (req, res, next) => {
    try {
      const { email, password } = credentials(req.body);
      const user = {
        id: randomUUID(),
        email,
        passwordHash: await hashPassword(password),
      };
      await store.createUser(user);
      await issueSession(res, user);
    } catch (e) {
      if (e.code === "23505") {
        res.status(409).json({ error: "이미 사용 중인 이메일입니다." });
        return;
      }
      next(e);
    }
  });
  app.post("/api/auth/login", authLimit, async (req, res, next) => {
    try {
      const { email, password } = credentials(req.body);
      const user = await store.userByEmail(email);
      const valid = await verifyPassword(
        password,
        user?.password_hash ?? dummyHash,
      );
      if (!user || !valid) {
        res
          .status(401)
          .json({ error: "이메일 또는 비밀번호가 올바르지 않습니다." });
        return;
      }
      await issueSession(res, user);
    } catch (e) {
      next(e);
    }
  });
  app.post("/api/auth/logout", async (req, res, next) => {
    try {
      const token = cookieToken(req);
      if (token) await store.logout(tokenHash(token));
      res.clearCookie(cookieName, {
        httpOnly: true,
        sameSite: "lax",
        secure: production,
        path: "/",
      });
      res.json({ ok: true });
    } catch (e) {
      next(e);
    }
  });
  app.get("/api/state", authenticate, async (req, res, next) => {
    try {
      if (req.query.user !== req.user.id) {
        res.status(409).json({
          error: "로그인 계정이 변경되었습니다. 화면을 새로고침하세요.",
        });
        return;
      }
      res.json(await store.readState(req.user.id));
    } catch (e) {
      next(e);
    }
  });
  app.put("/api/state", authenticate, async (req, res, next) => {
    try {
      if (req.body?.userId !== req.user.id) {
        res.status(409).json({
          error: "로그인 계정이 변경되었습니다. 화면을 새로고침하세요.",
        });
        return;
      }
      let changes;
      try {
        changes = stateChanges(req.body?.next, req.body?.previous);
      } catch {
        res.status(400).json({ error: "기록 형식이 올바르지 않습니다." });
        return;
      }
      await store.saveState(req.user.id, changes);
      res.json({
        ok: true,
        changed: changes.changed.length,
        removed: changes.removed.length,
      });
    } catch (e) {
      next(e);
    }
  });
  app.use("/api/rooms", roomRouter({ store, authenticate }));
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "API를 찾을 수 없습니다." }),
  );
  if (serveStatic) {
    const directory = fileURLToPath(new URL("../dist", import.meta.url));
    app.use(express.static(directory, { index: false }));
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(directory, "index.html")),
    );
  }
  app.use((error, req, res, next) => {
    if (res.headersSent) return next(error);
    const status = error.status ?? 500;
    if (status >= 500)
      console.error("Request failed:", error.code ?? error.name);
    res.status(status).json({
      error:
        status === 413
          ? "백업 크기는 10MB 이하로 제한됩니다."
          : status < 500
            ? error.message
            : "서버 또는 DB 연결을 확인해 주세요.",
    });
  });
  return app;
}
