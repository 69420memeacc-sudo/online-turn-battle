import { env } from "cloudflare:workers";
import {
  ARMORS,
  BASE_MAX_MP,
  ITEMS,
  ITEM_LIMIT,
  SKILL_LIMIT,
  STAFF_MAX_MP,
  WEAPONS,
  armorById,
  itemById,
  skillById,
  weaponById,
  type ActionLog,
  type PublicPlayer,
  type PublicRoom,
  type Team,
} from "@/lib/game";

type RoomRow = {
  id: string;
  code: string;
  status: "lobby" | "battle" | "finished";
  host_player_id: string;
  current_player_id: string | null;
  turn_number: number;
  winner_team: Team | null;
  human_cursor: number;
  monster_cursor: number;
};

type PlayerRow = {
  id: string;
  room_id: string;
  token_hash: string;
  name: string;
  team: Team;
  hp: number;
  max_hp: number;
  mp: number;
  max_mp: number;
  barrier: number;
  weapon_id: string;
  armor_id: string;
  skill_ids: string;
  item_ids: string;
  loadout_item_ids: string;
  cooldowns: string;
  sleep_turns: number;
  ready: number;
  last_seen_at: string;
  joined_at: string;
};

type BattlePlayer = PlayerRow & {
  cooldownMap: Record<string, number>;
  skillList: string[];
  itemList: string[];
};

type ActionRow = {
  id: string;
  turn_number: number;
  actor_id: string;
  target_id: string;
  action_id: string;
  amount: number;
  message: string;
  created_at: string;
};

function getD1() {
  const db = env.DB as D1Database | undefined;
  if (!db) throw new Error("対戦データベースへ接続できませんでした。");
  return db;
}

async function ensureSchema(db: D1Database) {
  await db.batch([
    db.prepare(`
      CREATE TABLE IF NOT EXISTS rooms (
        id TEXT PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        status TEXT NOT NULL DEFAULT 'lobby',
        host_player_id TEXT NOT NULL,
        current_player_id TEXT,
        turn_number INTEGER NOT NULL DEFAULT 1,
        winner_team TEXT,
        human_cursor INTEGER NOT NULL DEFAULT 0,
        monster_cursor INTEGER NOT NULL DEFAULT 0,
        version INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS players (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        token_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        team TEXT NOT NULL,
        hp INTEGER NOT NULL DEFAULT 100,
        max_hp INTEGER NOT NULL DEFAULT 100,
        mp INTEGER NOT NULL DEFAULT 100,
        max_mp INTEGER NOT NULL DEFAULT 100,
        barrier INTEGER NOT NULL DEFAULT 0,
        weapon_id TEXT NOT NULL DEFAULT 'longsword',
        armor_id TEXT NOT NULL DEFAULT 'chainmail',
        skill_ids TEXT NOT NULL DEFAULT '["guard","mend"]',
        item_ids TEXT NOT NULL DEFAULT '[]',
        loadout_item_ids TEXT NOT NULL DEFAULT '[]',
        cooldowns TEXT NOT NULL DEFAULT '{}',
        sleep_turns INTEGER NOT NULL DEFAULT 0,
        ready INTEGER NOT NULL DEFAULT 0,
        last_seen_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        joined_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id)
      )
    `),
    db.prepare(`
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        room_id TEXT NOT NULL,
        turn_number INTEGER NOT NULL,
        actor_id TEXT NOT NULL,
        target_id TEXT NOT NULL,
        action_id TEXT NOT NULL,
        amount INTEGER NOT NULL DEFAULT 0,
        message TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (room_id) REFERENCES rooms(id),
        UNIQUE(room_id, turn_number)
      )
    `),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS players_room_idx ON players (room_id, joined_at)",
    ),
    db.prepare(
      "CREATE INDEX IF NOT EXISTS actions_room_idx ON actions (room_id, turn_number)",
    ),
  ]);

  const info = await db.prepare("PRAGMA table_info(players)").all<{
    name: string;
  }>();
  const columns = new Set(info.results.map((column) => column.name));
  const additions = [
    ["mp", "INTEGER NOT NULL DEFAULT 100"],
    ["max_mp", "INTEGER NOT NULL DEFAULT 100"],
    ["item_ids", "TEXT NOT NULL DEFAULT '[]'"],
    ["loadout_item_ids", "TEXT NOT NULL DEFAULT '[]'"],
    ["sleep_turns", "INTEGER NOT NULL DEFAULT 0"],
    ["last_seen_at", "TEXT NOT NULL DEFAULT '1970-01-01 00:00:00'"],
  ] as const;
  for (const [name, definition] of additions) {
    if (!columns.has(name)) {
      await db.prepare(`ALTER TABLE players ADD COLUMN ${name} ${definition}`).run();
      if (name === "loadout_item_ids") {
        await db
          .prepare(
            "UPDATE players SET loadout_item_ids = item_ids WHERE item_ids != '[]'",
          )
          .run();
      }
      if (name === "last_seen_at") {
        await db
          .prepare("UPDATE players SET last_seen_at = CURRENT_TIMESTAMP")
          .run();
      }
    }
  }
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function publicPlayer(row: PlayerRow): PublicPlayer {
  return {
    id: row.id,
    name: row.name,
    team: row.team,
    hp: row.hp,
    maxHp: row.max_hp,
    mp: row.mp,
    maxMp: row.max_mp,
    barrier: row.barrier,
    weaponId: row.weapon_id,
    armorId: row.armor_id,
    skillIds: parseJson<string[]>(row.skill_ids, []),
    itemIds: parseJson<string[]>(row.item_ids, []),
    cooldowns: parseJson<Record<string, number>>(row.cooldowns, {}),
    sleepTurns: row.sleep_turns,
    ready: Boolean(row.ready),
  };
}

async function expireDisconnectedPlayers(
  db: D1Database,
  room: RoomRow,
): Promise<boolean> {
  if (room.status !== "battle") return false;
  const playersResult = await db
    .prepare(
      "SELECT * FROM players WHERE room_id = ? ORDER BY joined_at ASC, id ASC",
    )
    .bind(room.id)
    .all<PlayerRow>();
  const staleIdsResult = await db
    .prepare(
      "SELECT id FROM players WHERE room_id = ? AND hp > 0 AND datetime(last_seen_at) < datetime('now', '-15 seconds')",
    )
    .bind(room.id)
    .all<{ id: string }>();
  const staleIds = new Set(staleIdsResult.results.map((player) => player.id));
  if (!staleIds.size) return false;

  const living = playersResult.results.filter(
    (player) => player.hp > 0 && !staleIds.has(player.id),
  );
  const humansAlive = living.filter((player) => player.team === "humans");
  const monstersAlive = living.filter((player) => player.team === "monsters");
  const current = playersResult.results.find(
    (player) => player.id === room.current_player_id,
  );
  let status: RoomRow["status"] = "battle";
  let winner: Team | null = null;
  let nextPlayerId = room.current_player_id;
  let nextTurnNumber = room.turn_number;

  if (!humansAlive.length || !monstersAlive.length) {
    status = "finished";
    winner = humansAlive.length
      ? "humans"
      : monstersAlive.length
        ? "monsters"
        : current?.team === "humans"
          ? "monsters"
          : "humans";
    nextPlayerId = null;
  } else if (room.current_player_id && staleIds.has(room.current_player_id)) {
    const nextTeam: Team =
      current?.team === "humans" ? "monsters" : "humans";
    const candidates = nextTeam === "humans" ? humansAlive : monstersAlive;
    const cursor =
      nextTeam === "humans" ? room.human_cursor : room.monster_cursor;
    nextPlayerId = candidates[cursor % candidates.length].id;
    nextTurnNumber += 1;
  }

  const statements: D1PreparedStatement[] = [...staleIds].map((id) =>
    db.prepare("UPDATE players SET hp = 0 WHERE id = ?").bind(id),
  );
  statements.push(
    db
      .prepare(
        "UPDATE rooms SET status = ?, current_player_id = ?, turn_number = ?, winner_team = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND status = 'battle'",
      )
      .bind(
        status,
        nextPlayerId,
        nextTurnNumber,
        winner,
        room.id,
      ),
  );
  await db.batch(statements);
  return true;
}

async function getRoomState(db: D1Database, code: string): Promise<PublicRoom> {
  let room = await db
    .prepare("SELECT * FROM rooms WHERE code = ?")
    .bind(code)
    .first<RoomRow>();
  if (!room) throw new Response("部屋が見つかりません。", { status: 404 });
  if (await expireDisconnectedPlayers(db, room)) {
    room = (await db
      .prepare("SELECT * FROM rooms WHERE id = ?")
      .bind(room.id)
      .first<RoomRow>())!;
  }

  const [playersResult, actionsResult] = await Promise.all([
    db
      .prepare(
        "SELECT * FROM players WHERE room_id = ? ORDER BY joined_at ASC, id ASC",
      )
      .bind(room.id)
      .all<PlayerRow>(),
    db
      .prepare(
        "SELECT id, turn_number, actor_id, target_id, action_id, amount, message, created_at FROM actions WHERE room_id = ? ORDER BY turn_number DESC LIMIT 30",
      )
      .bind(room.id)
      .all<ActionRow>(),
  ]);

  const actions: ActionLog[] = actionsResult.results.reverse().map((action) => ({
    id: action.id,
    turnNumber: action.turn_number,
    actorId: action.actor_id,
    targetId: action.target_id,
    actionId: action.action_id,
    amount: action.amount,
    message: action.message,
    createdAt: action.created_at,
  }));

  return {
    code: room.code,
    status: room.status,
    hostPlayerId: room.host_player_id,
    currentPlayerId: room.current_player_id,
    turnNumber: room.turn_number,
    winnerTeam: room.winner_team,
    players: playersResult.results.map(publicPlayer),
    actions,
  };
}

function cleanCode(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
}

function cleanName(value: unknown) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 16);
}

function isTeam(value: unknown): value is Team {
  return value === "humans" || value === "monsters";
}

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  return Array.from(bytes, (byte) => chars[byte % chars.length]).join("");
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function randomIndex(length: number) {
  if (length <= 1) return 0;
  const maximum = Math.floor(256 / length) * length;
  const byte = new Uint8Array(1);
  do crypto.getRandomValues(byte);
  while (byte[0] >= maximum);
  return byte[0] % length;
}

async function hashToken(token: string) {
  const bytes = new TextEncoder().encode(token);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function roomRow(db: D1Database, code: string) {
  return db
    .prepare("SELECT * FROM rooms WHERE code = ?")
    .bind(code)
    .first<RoomRow>();
}

async function authenticate(
  db: D1Database,
  roomId: string,
  playerId: string,
  token: string,
) {
  const player = await db
    .prepare(
      "SELECT * FROM players WHERE id = ? AND room_id = ? AND token_hash = ?",
    )
    .bind(playerId, roomId, await hashToken(token))
    .first<PlayerRow>();
  if (!player) {
    throw new Response("プレイヤー認証に失敗しました。", { status: 401 });
  }
  return player;
}

function errorResponse(error: unknown) {
  if (error instanceof Response) {
    return error.text().then((message) =>
      Response.json({ error: message }, { status: error.status }),
    );
  }
  const message =
    error instanceof Error ? error.message : "予期しないエラーが発生しました。";
  const status =
    message.includes("UNIQUE constraint") ||
    message.includes("constraint failed")
      ? 409
      : 500;
  return Response.json(
    {
      error:
        status === 409
          ? "同じターンの操作が先に処理されました。画面を更新します。"
          : message,
    },
    { status },
  );
}

function countItem(itemIds: string[], id: string) {
  return itemIds.filter((itemId) => itemId === id).length;
}

function validateItems(itemIds: string[]) {
  if (itemIds.length > ITEM_LIMIT || itemIds.some((id) => !itemById(id))) {
    return false;
  }
  return ITEMS.every(
    (item) =>
      !item.maxCopies || countItem(itemIds, item.id) <= item.maxCopies,
  );
}

function damagePlayer(
  target: BattlePlayer,
  rawDamage: number,
): { dealt: number; absorbed: number } {
  const armor = armorById(target.armor_id) ?? ARMORS[0];
  let damage = Math.max(1, Math.floor(rawDamage) - armor.defense);
  if (target.itemList.includes("diamond_crystal")) {
    damage = Math.floor(damage * 0.8);
  }
  const absorbed = Math.min(target.barrier, damage);
  target.barrier -= absorbed;
  damage -= absorbed;
  if (target.itemList.includes("diamond_crystal")) {
    damage = Math.min(50, damage);
  }
  target.hp = Math.max(0, target.hp - damage);
  return { dealt: damage, absorbed };
}

function cooldownTick(player: BattlePlayer) {
  player.cooldownMap = Object.fromEntries(
    Object.entries(player.cooldownMap).map(([id, turns]) => [
      id,
      Math.max(0, turns - 1),
    ]),
  );
}

export async function GET(request: Request) {
  try {
    const db = getD1();
    await ensureSchema(db);
    const code = cleanCode(new URL(request.url).searchParams.get("code"));
    if (!code) {
      return Response.json({ error: "部屋コードが必要です。" }, { status: 400 });
    }
    return Response.json({ room: await getRoomState(db, code) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const db = getD1();
    await ensureSchema(db);
    const body = (await request.json()) as Record<string, unknown>;
    const operation = String(body.operation ?? "");

    if (operation === "create") {
      const name = cleanName(body.name);
      const team = body.team;
      if (!name || !isTeam(team)) {
        return Response.json(
          { error: "名前と陣営を選んでください。" },
          { status: 400 },
        );
      }

      let code = randomCode();
      for (let attempt = 0; attempt < 4; attempt += 1) {
        if (!(await roomRow(db, code))) break;
        code = randomCode();
      }

      const roomId = crypto.randomUUID();
      const playerId = crypto.randomUUID();
      const token = randomToken();
      await db.batch([
        db
          .prepare(
            "INSERT INTO rooms (id, code, host_player_id) VALUES (?, ?, ?)",
          )
          .bind(roomId, code, playerId),
        db
          .prepare(
            "INSERT INTO players (id, room_id, token_hash, name, team) VALUES (?, ?, ?, ?, ?)",
          )
          .bind(playerId, roomId, await hashToken(token), name, team),
      ]);

      return Response.json(
        {
          room: await getRoomState(db, code),
          session: { code, playerId, token },
        },
        { status: 201 },
      );
    }

    const code = cleanCode(body.code);
    const room = await roomRow(db, code);
    if (!room) {
      return Response.json({ error: "部屋が見つかりません。" }, { status: 404 });
    }

    if (operation === "join") {
      if (room.status !== "lobby") {
        return Response.json(
          { error: "この試合はすでに開始しています。" },
          { status: 409 },
        );
      }
      const name = cleanName(body.name);
      const team = body.team;
      if (!name || !isTeam(team)) {
        return Response.json(
          { error: "名前と陣営を選んでください。" },
          { status: 400 },
        );
      }
      const count = await db
        .prepare(
          "SELECT COUNT(*) AS count FROM players WHERE room_id = ? AND team = ?",
        )
        .bind(room.id, team)
        .first<{ count: number }>();
      if ((count?.count ?? 0) >= 4) {
        return Response.json(
          { error: "この陣営は満員です。" },
          { status: 409 },
        );
      }

      const playerId = crypto.randomUUID();
      const token = randomToken();
      await db
        .prepare(
          "INSERT INTO players (id, room_id, token_hash, name, team) VALUES (?, ?, ?, ?, ?)",
        )
        .bind(playerId, room.id, await hashToken(token), name, team)
        .run();

      return Response.json(
        {
          room: await getRoomState(db, code),
          session: { code, playerId, token },
        },
        { status: 201 },
      );
    }

    const playerId = String(body.playerId ?? "");
    const token = String(body.token ?? "");
    const actor = await authenticate(db, room.id, playerId, token);
    await db
      .prepare("UPDATE players SET last_seen_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(actor.id)
      .run();

    if (operation === "heartbeat") {
      return Response.json({ ok: true });
    }

    if (operation === "loadout") {
      if (room.status !== "lobby") {
        return Response.json(
          { error: "試合開始後は装備を変更できません。" },
          { status: 409 },
        );
      }
      const weaponId = String(body.weaponId ?? "");
      const armorId = String(body.armorId ?? "");
      const skillIds = Array.isArray(body.skillIds)
        ? [...new Set(body.skillIds.map(String))]
        : [];
      const itemIds = Array.isArray(body.itemIds)
        ? body.itemIds.map(String)
        : [];
      const weapon = weaponById(weaponId);
      const armor = armorById(armorId);
      if (
        !weapon ||
        !armor ||
        skillIds.length > SKILL_LIMIT ||
        skillIds.some((id) => !skillById(id)) ||
        skillIds.some((id) => {
          const requiredType = skillById(id)?.requiredWeaponType;
          return requiredType && requiredType !== weapon.type;
        }) ||
        !validateItems(itemIds)
      ) {
        return Response.json(
          {
            error: `武器1・防具1・スキル/魔法${SKILL_LIMIT}枠・アイテム${ITEM_LIMIT}枠で編成してください。`,
          },
          { status: 400 },
        );
      }
      const maxMp = weapon.type === "staff" ? STAFF_MAX_MP : BASE_MAX_MP;
      await db
        .prepare(
          "UPDATE players SET weapon_id = ?, armor_id = ?, skill_ids = ?, item_ids = ?, loadout_item_ids = ?, mp = ?, max_mp = ?, ready = 1 WHERE id = ?",
        )
        .bind(
          weaponId,
          armorId,
          JSON.stringify(skillIds),
          JSON.stringify(itemIds),
          JSON.stringify(itemIds),
          maxMp,
          maxMp,
          actor.id,
        )
        .run();
      return Response.json({ room: await getRoomState(db, code) });
    }

    if (operation === "start") {
      if (actor.id !== room.host_player_id) {
        return Response.json(
          { error: "試合を開始できるのは部屋主だけです。" },
          { status: 403 },
        );
      }
      if (room.status !== "lobby") {
        return Response.json(
          { error: "試合はすでに開始しています。" },
          { status: 409 },
        );
      }
      const result = await db
        .prepare(
          "SELECT * FROM players WHERE room_id = ? ORDER BY joined_at ASC, id ASC",
        )
        .bind(room.id)
        .all<PlayerRow>();
      const humans = result.results.filter((player) => player.team === "humans");
      const monsters = result.results.filter(
        (player) => player.team === "monsters",
      );
      if (!humans.length || !monsters.length) {
        return Response.json(
          { error: "両方の陣営に1人以上必要です。" },
          { status: 400 },
        );
      }
      if (result.results.some((player) => !player.ready)) {
        return Response.json(
          { error: "全員が装備を確定するまで待ってください。" },
          { status: 400 },
        );
      }
      const statements: D1PreparedStatement[] = result.results.map((player) => {
        const maxMp =
          weaponById(player.weapon_id)?.type === "staff"
            ? STAFF_MAX_MP
            : BASE_MAX_MP;
        return db
          .prepare(
            "UPDATE players SET hp = max_hp, mp = ?, max_mp = ?, barrier = 0, cooldowns = '{}', sleep_turns = 0 WHERE id = ?",
          )
          .bind(maxMp, maxMp, player.id);
      });
      statements.push(
        db
          .prepare(
            "UPDATE rooms SET status = 'battle', current_player_id = ?, turn_number = 1, winner_team = NULL, human_cursor = 0, monster_cursor = 0, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          )
          .bind(humans[0].id, room.id),
      );
      await db.batch(statements);
      return Response.json({ room: await getRoomState(db, code) });
    }

    if (operation === "rematch") {
      if (actor.id !== room.host_player_id) {
        return Response.json(
          { error: "再戦を開始できるのは部屋主だけです。" },
          { status: 403 },
        );
      }
      if (room.status !== "finished") {
        return Response.json(
          { error: "試合終了後に再戦できます。" },
          { status: 409 },
        );
      }
      const result = await db
        .prepare(
          "SELECT * FROM players WHERE room_id = ? ORDER BY joined_at ASC, id ASC",
        )
        .bind(room.id)
        .all<PlayerRow>();
      const humans = result.results.filter((player) => player.team === "humans");
      const monsters = result.results.filter(
        (player) => player.team === "monsters",
      );
      if (!humans.length || !monsters.length) {
        return Response.json(
          { error: "両方の陣営に1人以上必要です。" },
          { status: 400 },
        );
      }

      const statements: D1PreparedStatement[] = [
        db.prepare("DELETE FROM actions WHERE room_id = ?").bind(room.id),
      ];
      for (const player of result.results) {
        const maxMp =
          weaponById(player.weapon_id)?.type === "staff"
            ? STAFF_MAX_MP
            : BASE_MAX_MP;
        const savedItems = parseJson<string[]>(
          player.loadout_item_ids,
          parseJson<string[]>(player.item_ids, []),
        );
        statements.push(
          db
            .prepare(
              "UPDATE players SET hp = max_hp, mp = ?, max_mp = ?, barrier = 0, item_ids = ?, cooldowns = '{}', sleep_turns = 0, ready = 1 WHERE id = ?",
            )
            .bind(maxMp, maxMp, JSON.stringify(savedItems), player.id),
        );
      }
      statements.push(
        db
          .prepare(
            "UPDATE rooms SET status = 'battle', current_player_id = ?, turn_number = 1, winner_team = NULL, human_cursor = 0, monster_cursor = 0, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
          )
          .bind(humans[0].id, room.id),
      );
      await db.batch(statements);
      return Response.json({ room: await getRoomState(db, code) });
    }

    if (operation === "act") {
      if (room.status !== "battle" || room.current_player_id !== actor.id) {
        return Response.json(
          { error: "現在はあなたのターンではありません。" },
          { status: 409 },
        );
      }
      if (actor.hp <= 0) {
        return Response.json(
          { error: "戦闘不能のプレイヤーは行動できません。" },
          { status: 409 },
        );
      }

      const result = await db
        .prepare(
          "SELECT * FROM players WHERE room_id = ? ORDER BY joined_at ASC, id ASC",
        )
        .bind(room.id)
        .all<PlayerRow>();
      const players: BattlePlayer[] = result.results.map((player) => ({
        ...player,
        cooldownMap: parseJson<Record<string, number>>(player.cooldowns, {}),
        skillList: parseJson<string[]>(player.skill_ids, []),
        itemList: parseJson<string[]>(player.item_ids, []),
      }));
      const active = players.find((player) => player.id === actor.id)!;
      const actionId = String(body.actionId ?? "basic");
      const selectedSkill = skillById(actionId);
      const selectedItem = itemById(actionId);
      const isBasic = actionId === "basic";

      if (
        !isBasic &&
        !(
          (selectedSkill && active.skillList.includes(actionId)) ||
          (selectedItem &&
            selectedItem.kind === "consumable" &&
            active.itemList.includes(actionId))
        )
      ) {
        return Response.json(
          { error: "その技またはアイテムは持ち込んでいません。" },
          { status: 400 },
        );
      }
      if (selectedSkill?.kind === "passive") {
        return Response.json(
          { error: "残忍は敵を倒した時に自動発動します。" },
          { status: 400 },
        );
      }
      if (selectedSkill && (active.cooldownMap[actionId] ?? 0) > 0) {
        return Response.json(
          { error: "そのスキルはまだ再使用できません。" },
          { status: 409 },
        );
      }

      const weapon = weaponById(active.weapon_id) ?? WEAPONS[0];
      if (
        selectedSkill?.requiredWeaponType &&
        weapon.type !== selectedSkill.requiredWeaponType
      ) {
        return Response.json(
          { error: "現在の武器ではその技を使用できません。" },
          { status: 400 },
        );
      }
      if ((selectedSkill?.mpCost ?? 0) > active.mp) {
        return Response.json({ error: "MPが足りません。" }, { status: 400 });
      }
      if ((selectedSkill?.hpCost ?? 0) >= active.hp) {
        return Response.json(
          { error: "この技にはHPが81以上必要です。" },
          { status: 400 },
        );
      }

      const enemyTeam: Team =
        active.team === "humans" ? "monsters" : "humans";
      const enemyCandidates = players.filter(
        (player) => player.team === enemyTeam && player.hp > 0,
      );
      const allyCandidates = players.filter(
        (player) => player.team === active.team && player.hp > 0,
      );
      const requestedTargetId = String(body.targetId ?? "");
      let target =
        enemyCandidates.find((player) => player.id === requestedTargetId) ??
        enemyCandidates[0];
      let amount = 0;
      let message = "";
      const beforeEnemyHp = new Map(
        enemyCandidates.map((player) => [player.id, player.hp]),
      );

      if (selectedSkill?.mpCost) active.mp -= selectedSkill.mpCost;
      if (selectedSkill?.hpCost) active.hp -= selectedSkill.hpCost;

      if (actionId === "mend") {
        target = active;
        const previousHp = active.hp;
        active.hp = Math.min(
          active.max_hp,
          active.hp + 22 + (weapon.healingBonus ?? 0),
        );
        amount = active.hp - previousHp;
        message = `${active.name}は治癒の祈りでHPを${amount}回復した`;
      } else if (actionId === "guard") {
        target = active;
        const previousBarrier = active.barrier;
        active.barrier = Math.min(36, active.barrier + 18);
        amount = active.barrier - previousBarrier;
        message = `${active.name}は堅守の構えで${amount}の防壁を得た`;
      } else if (actionId === "death_scythe") {
        target = enemyCandidates[randomIndex(enemyCandidates.length)];
        const resultDamage = damagePlayer(target, 999);
        amount = resultDamage.dealt;
        message = `${active.name}はHP80とMP250を捧げ死神を召喚。${target.name}に${amount}ダメージ`;
        if (resultDamage.absorbed) {
          message += `（防壁が${resultDamage.absorbed}吸収）`;
        }
      } else if (actionId === "drain") {
        if (!target) {
          return Response.json(
            { error: "有効な敵を選んでください。" },
            { status: 400 },
          );
        }
        const stolenHp = Math.min(10, target.hp);
        const stolenMp = Math.min(15, target.mp);
        target.hp -= stolenHp;
        target.mp -= stolenMp;
        active.hp = Math.min(active.max_hp, active.hp + stolenHp);
        active.mp = Math.min(active.max_mp, active.mp + stolenMp);
        amount = stolenHp;
        message = `${active.name}は${target.name}からHP${stolenHp}・MP${stolenMp}を吸引した`;
      } else if (actionId === "thief_life") {
        const stealableItems = target?.itemList.filter((itemId) => {
          const item = itemById(itemId);
          return (
            item &&
            (!item.maxCopies ||
              countItem(active.itemList, itemId) < item.maxCopies)
          );
        });
        if (!target || !stealableItems?.length) {
          return Response.json(
            { error: "その敵は今の枠へ奪えるアイテムを持っていません。" },
            { status: 400 },
          );
        }
        if (active.itemList.length >= ITEM_LIMIT) {
          return Response.json(
            { error: "アイテム枠に空きがありません。" },
            { status: 400 },
          );
        }
        const stolenId = stealableItems[randomIndex(stealableItems.length)];
        target.itemList.splice(target.itemList.indexOf(stolenId), 1);
        active.itemList.push(stolenId);
        message = `${active.name}は${target.name}から「${itemById(stolenId)?.name ?? "アイテム"}」を奪った`;
      } else if (actionId === "ruby_crystal") {
        target =
          allyCandidates.find((player) => player.id === requestedTargetId) ??
          active;
        const previousHp = target.hp;
        target.hp = Math.min(target.max_hp, target.hp + 30);
        amount = target.hp - previousHp;
        message = `${active.name}はルビーの結晶を使い、${target.name}のHPを${amount}回復した`;
      } else if (actionId === "sapphire_crystal") {
        target =
          allyCandidates.find((player) => player.id === requestedTargetId) ??
          active;
        const previousMp = target.mp;
        const recovery = Math.floor(target.max_mp * 0.3);
        target.mp = Math.min(target.max_mp, target.mp + recovery);
        amount = target.mp - previousMp;
        message = `${active.name}はサファイアの結晶を使い、${target.name}のMPを${amount}回復した`;
      } else if (actionId === "snow_white_tear") {
        if (!target) {
          return Response.json(
            { error: "有効な敵を選んでください。" },
            { status: 400 },
          );
        }
        target.sleep_turns = Math.max(target.sleep_turns, 2);
        message = `${active.name}は白雪姫の涙を使い、${target.name}を2ターン眠らせた`;
      } else if (actionId === "heavens_scale") {
        target = enemyCandidates[randomIndex(enemyCandidates.length)];
        if (active.mp === target.mp) {
          message = `天国の天秤は${active.name}と${target.name}のMPが等しいと示した。ダメージはない`;
        } else {
          const loser = active.mp < target.mp ? active : target;
          const resultDamage = damagePlayer(loser, 50);
          amount = resultDamage.dealt;
          message = `天国の天秤が${target.name}を選んだ。MPの低い${loser.name}に${amount}ダメージ`;
        }
      } else {
        if (!target) {
          return Response.json(
            { error: "有効な敵を選んでください。" },
            { status: 400 },
          );
        }
        let rawDamage =
          actionId === "power_strike" ? weapon.damage + 10 : weapon.damage;
        if (actionId === "golden_arrow") rawDamage = 40;
        if (isBasic) {
          rawDamage = Math.floor(
            rawDamage *
              1.15 ** countItem(active.itemList, "emerald_crystal"),
          );
        }
        const resultDamage = damagePlayer(target, rawDamage);
        amount = resultDamage.dealt;
        const actionName =
          actionId === "power_strike"
            ? "渾身撃"
            : actionId === "golden_arrow"
              ? "黄金の光矢"
              : `${weapon.name}の攻撃`;
        message = `${active.name}の${actionName}。${target.name}に${amount}ダメージ`;
        if (resultDamage.absorbed) {
          message += `（防壁が${resultDamage.absorbed}吸収）`;
        }
      }

      if (selectedItem) {
        const itemIndex = active.itemList.indexOf(selectedItem.id);
        if (itemIndex >= 0) active.itemList.splice(itemIndex, 1);
      }
      if (selectedSkill && selectedSkill.cooldown > 0) {
        active.cooldownMap[actionId] = selectedSkill.cooldown;
      }

      const defeatedByAction = enemyCandidates.filter(
        (player) => (beforeEnemyHp.get(player.id) ?? 0) > 0 && player.hp <= 0,
      );
      if (defeatedByAction.length && active.skillList.includes("cruelty")) {
        const hpRecovery = Math.floor(active.max_hp * 0.5);
        const mpRecovery = Math.floor(active.max_mp * 0.5);
        active.hp = Math.min(active.max_hp, active.hp + hpRecovery);
        active.mp = Math.min(active.max_mp, active.mp + mpRecovery);
        message += `。残忍が発動し、HPとMPが50%回復`;
      }

      const humansAlive = players.filter(
        (player) => player.team === "humans" && player.hp > 0,
      );
      const monstersAlive = players.filter(
        (player) => player.team === "monsters" && player.hp > 0,
      );
      let status: RoomRow["status"] = "battle";
      let winner: Team | null = null;
      let nextPlayerId: string | null = null;
      let humanCursor = room.human_cursor;
      let monsterCursor = room.monster_cursor;
      let nextTurnNumber = room.turn_number + 1;
      const automaticLogs: {
        id: string;
        turn: number;
        player: BattlePlayer;
        message: string;
      }[] = [];

      if (!humansAlive.length || !monstersAlive.length) {
        status = "finished";
        winner = humansAlive.length ? "humans" : "monsters";
      } else {
        if (active.team === "humans") humanCursor += 1;
        else monsterCursor += 1;
        let nextTeam: Team = enemyTeam;

        for (let attempts = 0; attempts < players.length * 4; attempts += 1) {
          const living =
            nextTeam === "humans" ? humansAlive : monstersAlive;
          const cursor =
            nextTeam === "humans" ? humanCursor : monsterCursor;
          const candidate = living[cursor % living.length];
          if (candidate.sleep_turns <= 0) {
            nextPlayerId = candidate.id;
            cooldownTick(candidate);
            break;
          }
          candidate.sleep_turns -= 1;
          automaticLogs.push({
            id: crypto.randomUUID(),
            turn: nextTurnNumber,
            player: candidate,
            message: `${candidate.name}は眠っているためターンをスキップした（残り${candidate.sleep_turns}回）`,
          });
          nextTurnNumber += 1;
          if (nextTeam === "humans") humanCursor += 1;
          else monsterCursor += 1;
          nextTeam = nextTeam === "humans" ? "monsters" : "humans";
        }
      }

      const statements: D1PreparedStatement[] = [
        db
          .prepare(
            "INSERT INTO actions (id, room_id, turn_number, actor_id, target_id, action_id, amount, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            crypto.randomUUID(),
            room.id,
            room.turn_number,
            active.id,
            target?.id ?? active.id,
            actionId,
            amount,
            message,
          ),
      ];
      for (const log of automaticLogs) {
        statements.push(
          db
            .prepare(
              "INSERT INTO actions (id, room_id, turn_number, actor_id, target_id, action_id, amount, message) VALUES (?, ?, ?, ?, ?, 'sleep_skip', 0, ?)",
            )
            .bind(
              log.id,
              room.id,
              log.turn,
              log.player.id,
              log.player.id,
              log.message,
            ),
        );
      }
      for (const player of players) {
        statements.push(
          db
            .prepare(
              "UPDATE players SET hp = ?, mp = ?, barrier = ?, item_ids = ?, cooldowns = ?, sleep_turns = ? WHERE id = ?",
            )
            .bind(
              player.hp,
              player.mp,
              player.barrier,
              JSON.stringify(player.itemList),
              JSON.stringify(player.cooldownMap),
              player.sleep_turns,
              player.id,
            ),
        );
      }
      statements.push(
        db
          .prepare(
            "UPDATE rooms SET status = ?, current_player_id = ?, turn_number = ?, winner_team = ?, human_cursor = ?, monster_cursor = ?, version = version + 1, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND current_player_id = ? AND turn_number = ?",
          )
          .bind(
            status,
            nextPlayerId,
            nextTurnNumber,
            winner,
            humanCursor,
            monsterCursor,
            room.id,
            active.id,
            room.turn_number,
          ),
      );
      await db.batch(statements);
      return Response.json({ room: await getRoomState(db, code) });
    }

    return Response.json({ error: "不明な操作です。" }, { status: 400 });
  } catch (error) {
    return errorResponse(error);
  }
}
