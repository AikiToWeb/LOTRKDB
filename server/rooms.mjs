import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import { deckStats } from "../src/domain.mjs";

function fail(status, message) {
  throw Object.assign(new Error(message), { status });
}
function text(value, limit, label) {
  if (typeof value !== "string" || !value.trim() || value.trim().length > limit)
    fail(400, `${label}을 확인하세요. (최대 ${limit}자)`);
  return value.trim();
}
const uuid = (value) =>
  typeof value === "string" &&
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
export function roomWarnings(members, cards) {
  const names = new Map();
  const warnings = [];
  for (const member of members) {
    for (const card of cards.filter(
      (c) => c.type_code === "hero" && member.deck?.slots[c.code],
    )) {
      if (names.has(card.name) && names.get(card.name) !== member.userId)
        warnings.push(`영웅 중복: ${card.name} (${member.nickname})`);
      names.set(card.name, member.userId);
    }
  }
  return [...new Set(warnings)];
}
export function roomRouter({ store, authenticate }) {
  const router = Router();
  router.use(authenticate);
  router.use((req, res, next) => {
    if (req.method !== "GET" && req.body?.userId !== req.user.id)
      return res
        .status(409)
        .json({ error: "로그인 계정이 변경되었습니다. 새로고침하세요." });
    next();
  });
  const limited = rateLimit({
    windowMs: 60000,
    limit: 20,
    message: { error: "방 요청이 많습니다. 잠시 후 다시 시도하세요." },
  });
  const route = (fn) => async (req, res, next) => {
    try {
      res.json(await fn(req));
    } catch (error) {
      next(error);
    }
  };
  async function transaction(fn) {
    const client = await store.pool.connect();
    try {
      await client.query("begin");
      const result = await fn(client);
      await client.query("commit");
      return result;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }
  async function locked(client, id, userId) {
    if (!uuid(id)) fail(404, "방을 찾을 수 없습니다.");
    const room = (
      await client.query("select * from lotr_rooms where id=$1 for update", [
        id,
      ])
    ).rows[0];
    if (!room) fail(404, "방을 찾을 수 없습니다.");
    const member = (
      await client.query(
        "select * from lotr_room_members where room_id=$1 and user_id=$2",
        [id, userId],
      )
    ).rows[0];
    if (!member) fail(403, "이 방의 참여자만 접근할 수 있습니다.");
    return { room, member };
  }
  async function view(id, userId, client = store.pool) {
    if (!uuid(id)) fail(404, "방을 찾을 수 없습니다.");
    const room = (
      await client.query(
        "select r.* from lotr_rooms r join lotr_room_members m on m.room_id=r.id where r.id=$1 and m.user_id=$2",
        [id, userId],
      )
    ).rows[0];
    if (!room) fail(404, "참여 중인 방을 찾을 수 없습니다.");
    const rows = (
      await client.query(
        "select user_id,nickname,deck,ready from lotr_room_members where room_id=$1 order by joined_at,user_id",
        [id],
      )
    ).rows;
    const catalog = await store.catalog();
    const members = rows.map((m) => ({
      userId: m.user_id,
      nickname: m.nickname,
      deck: m.deck,
      ready: m.ready,
      stats: m.deck ? deckStats(m.deck.slots, catalog.cards) : null,
    }));
    return {
      id: room.id,
      code: room.code,
      hostId: room.host_id,
      name: room.name,
      scenarioId: room.scenario_id,
      scenarioName:
        catalog.scenarios.find((s) => s.id === room.scenario_id)?.name ??
        room.scenario_id,
      maxPlayers: room.max_players,
      status: room.status,
      members,
      warnings: roomWarnings(members, catalog.cards),
    };
  }
  router.get(
    "/",
    route(
      async (req) =>
        (
          await store.pool.query(
            'select r.id,r.name,r.scenario_id as "scenarioId",r.status,r.max_players as "maxPlayers", (select count(*)::int from lotr_room_members where room_id=r.id) as players from lotr_rooms r join lotr_room_members m on m.room_id=r.id where m.user_id=$1 order by r.created_at desc limit 100',
            [req.user.id],
          )
        ).rows,
    ),
  );
  router.post(
    "/",
    limited,
    route(async (req) => {
      const name = text(req.body.name, 80, "방 이름"),
        nickname = text(req.body.nickname, 40, "플레이어 이름");
      const { scenarioId, maxPlayers } = req.body;
      if (!Number.isInteger(maxPlayers) || maxPlayers < 1 || maxPlayers > 4)
        fail(400, "인원은 1~4명으로 지정하세요.");
      if (!(await store.catalog()).scenarios.some((s) => s.id === scenarioId))
        fail(400, "시나리오를 선택하세요.");
      const id = randomUUID(),
        code = randomBytes(6).toString("hex").toUpperCase();
      await transaction(async (client) => {
        await client.query(
          "insert into lotr_rooms(id,code,host_id,name,scenario_id,max_players) values($1,$2,$3,$4,$5,$6)",
          [id, code, req.user.id, name, scenarioId, maxPlayers],
        );
        await client.query(
          "insert into lotr_room_members(room_id,user_id,nickname) values($1,$2,$3)",
          [id, req.user.id, nickname],
        );
      });
      return view(id, req.user.id);
    }),
  );
  router.post(
    "/join",
    limited,
    route(async (req) => {
      const code = text(req.body.code, 20, "초대 코드")
          .replace(/[\s-]/g, "")
          .toUpperCase(),
        nickname = text(req.body.nickname, 40, "플레이어 이름");
      const id = await transaction(async (client) => {
        const room = (
          await client.query(
            "select * from lotr_rooms where code=$1 for update",
            [code],
          )
        ).rows[0];
        if (!room) fail(404, "초대 코드를 확인하세요.");
        const members = (
          await client.query(
            "select user_id from lotr_room_members where room_id=$1",
            [room.id],
          )
        ).rows;
        if (members.some((m) => m.user_id === req.user.id)) return room.id;
        if (room.status !== "waiting")
          fail(409, "대기 중인 방에만 참여할 수 있습니다.");
        if (members.length >= room.max_players)
          fail(409, "방 인원이 가득 찼습니다.");
        await client.query(
          "insert into lotr_room_members(room_id,user_id,nickname) values($1,$2,$3)",
          [room.id, req.user.id, nickname],
        );
        return room.id;
      });
      return view(id, req.user.id);
    }),
  );
  router.get(
    "/:id",
    route((req) => view(req.params.id, req.user.id)),
  );
  router.put(
    "/:id/me",
    route(async (req) => {
      await transaction(async (client) => {
        const { room, member } = await locked(
          client,
          req.params.id,
          req.user.id,
        );
        if (room.status !== "waiting")
          fail(409, "대기 중에만 덱과 준비 상태를 변경할 수 있습니다.");
        if (Object.hasOwn(req.body, "deckId")) {
          const deck = (
            await client.query(
              "select data from lotr_documents where user_id=$1 and kind='decks' and id=$2",
              [req.user.id, text(req.body.deckId, 100, "덱")],
            )
          ).rows[0]?.data;
          if (!deck) fail(404, "서버에 저장된 본인의 덱을 선택하세요.");
          await client.query(
            "update lotr_room_members set deck=$3::jsonb,ready=false where room_id=$1 and user_id=$2",
            [
              room.id,
              req.user.id,
              JSON.stringify({
                id: deck.id,
                name: deck.name,
                slots: deck.slots,
              }),
            ],
          );
        } else if (typeof req.body.ready === "boolean") {
          if (req.body.ready && !member.deck)
            fail(409, "먼저 본인의 덱을 등록하세요.");
          await client.query(
            "update lotr_room_members set ready=$3 where room_id=$1 and user_id=$2",
            [room.id, req.user.id, req.body.ready],
          );
        } else fail(400, "변경할 덱이나 준비 상태를 지정하세요.");
      });
      return view(req.params.id, req.user.id);
    }),
  );
  router.patch(
    "/:id",
    route(async (req) => {
      await transaction(async (client) => {
        const { room } = await locked(client, req.params.id, req.user.id);
        if (room.host_id !== req.user.id)
          fail(403, "방장만 게임 상태를 변경할 수 있습니다.");
        const status = req.body.status;
        if (
          !(
            room.status === "waiting" && ["playing", "closed"].includes(status)
          ) &&
          !(
            room.status === "playing" && ["finished", "closed"].includes(status)
          )
        )
          fail(409, "현재 상태에서 변경할 수 없습니다.");
        if (status === "playing") {
          const data = await view(room.id, req.user.id, client);
          if (data.members.some((m) => !m.deck || !m.ready))
            fail(409, "모든 참여자가 덱을 등록하고 준비해야 합니다.");
          if (data.warnings.length) fail(409, data.warnings.join(" · "));
        }
        await client.query("update lotr_rooms set status=$2 where id=$1", [
          room.id,
          status,
        ]);
      });
      return view(req.params.id, req.user.id);
    }),
  );
  router.delete(
    "/:id/members/:userId",
    route(async (req) => {
      await transaction(async (client) => {
        const { room } = await locked(client, req.params.id, req.user.id);
        if (room.status !== "waiting")
          fail(409, "대기 중에만 나가거나 참여자를 제외할 수 있습니다.");
        if (req.params.userId === room.host_id)
          fail(409, "방장은 방 닫기를 사용하세요.");
        if (req.params.userId !== req.user.id && room.host_id !== req.user.id)
          fail(403, "다른 참여자는 방장만 제외할 수 있습니다.");
        if (!uuid(req.params.userId)) fail(400, "참여자를 확인하세요.");
        await client.query(
          "delete from lotr_room_members where room_id=$1 and user_id=$2",
          [room.id, req.params.userId],
        );
      });
      return { ok: true };
    }),
  );
  return router;
}
