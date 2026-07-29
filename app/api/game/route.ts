import { env } from "cloudflare:workers";
import {
  ARMORS,
  INVENTORY_LIMIT,
  SKILLS,
  WEAPONS,
  armorById,
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
  barrier: number;
  weapon_id: string;
  armor_id: string;
  skill_ids: string;
  cooldowns: string;
  ready: number;
  joined_at: string;
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
  if (!db) {
    throw new Error("対戦データベースへ接続できませんでした。");
  }
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
        barrier INTEGER NOT NULL DEFAULT 0,
        weapon_id TEXT NOT NULL DEFAULT 'longsword',
        armor_id TEXT NOT NULL DEFAULT 'chainmail',
        skill_ids TEXT NOT NULL DEFAULT '["guard","mend"]',
        cooldowns TEXT NOT NULL DEFAULT '{}',
        ready INTEGER NOT NULL DEFAULT 0,
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
    barrier: row.barrier,
    weaponId: row.weapon_id,
    armorId: row.armor_id,
    skillIds: parseJson<string[]>(row.skill_ids, []),
    cooldowns: parseJson<Record<string, number>>(row.cooldowns, {}),
    ready: Boolean(row.ready),
  };
}

async function getRoomState(db: D1Database, code: string): Promise<PublicRoom> {
  const room = await db
    .prepare("SELECT * FROM rooms WHERE code = ?")
    .bind(code)
    .first<RoomRow>();
  if (!room) {
    throw new Response("部屋が見つかりません。", { status: 404 });
  }

  const playersResult = await db
    .prepare(
      "SELECT * FROM players WHERE room_id = ? ORDER BY joined_at ASC, id ASC",
    )
    .bind(room.id)
    .all<PlayerRow>();
  const actionsResult = await db
    .prepare(
      "SELECT id, turn_number, actor_id, target_id, action_id, amount, message, created_at FROM actions WHERE room_id = ? ORDER BY turn_number DESC LIMIT 20",
    )
    .bind(room.id)
    .all<ActionRow>();

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
        const exists = await roomRow(db, code);
        if (!exists) break;
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
      const weapon = weaponById(weaponId);
      const armor = armorById(armorId);
      const skills = skillIds.map(skillById);
      if (
        !weapon ||
        !armor ||
        skills.some((skill) => !skill) ||
        skillIds.length > SKILLS.length
      ) {
        return Response.json({ error: "装備の選択が不正です。" }, { status: 400 });
      }
      const usedSlots =
        weapon.slots +
        armor.slots +
        skills.reduce((total, skill) => total + (skill?.slots ?? 0), 0);
      if (usedSlots > INVENTORY_LIMIT) {
        return Response.json(
          { error: `持ち込み枠は${INVENTORY_LIMIT}までです。` },
          { status: 400 },
        );
      }
      await db
        .prepare(
          "UPDATE players SET weapon_id = ?, armor_id = ?, skill_ids = ?, ready = 1 WHERE id = ?",
        )
        .bind(weaponId, armorId, JSON.stringify(skillIds), actor.id)
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
      await db
        .prepare(
          "UPDATE rooms SET status = 'battle', current_player_id = ?, turn_number = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(humans[0].id, room.id)
        .run();
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
      const players = result.results.map((player) => ({
        ...player,
        cooldownMap: parseJson<Record<string, number>>(player.cooldowns, {}),
      }));
      const active = players.find((player) => player.id === actor.id)!;
      const actionId = String(body.actionId ?? "basic");
      const selectedSkill = skillById(actionId);
      if (
        actionId !== "basic" &&
        (!selectedSkill ||
          !parseJson<string[]>(active.skill_ids, []).includes(actionId))
      ) {
        return Response.json(
          { error: "そのスキルは持ち込んでいません。" },
          { status: 400 },
        );
      }
      if (selectedSkill && (active.cooldownMap[actionId] ?? 0) > 0) {
        return Response.json(
          { error: "そのスキルはまだ再使用できません。" },
          { status: 409 },
        );
      }

      const enemyTeam: Team =
        active.team === "humans" ? "monsters" : "humans";
      const enemyCandidates = players.filter(
        (player) => player.team === enemyTeam && player.hp > 0,
      );
      let target = enemyCandidates.find(
        (player) => player.id === String(body.targetId ?? ""),
      );
      let amount = 0;
      let message = "";

      if (actionId === "mend" || actionId === "guard") {
        target = active;
      }
      if (!target) {
        return Response.json(
          { error: "有効な対象を選んでください。" },
          { status: 400 },
        );
      }

      if (actionId === "mend") {
        const weapon = weaponById(active.weapon_id) ?? WEAPONS[0];
        const heal = 22 + (weapon.healingBonus ?? 0);
        const previousHp = active.hp;
        active.hp = Math.min(active.max_hp, active.hp + heal);
        amount = active.hp - previousHp;
        message = `${active.name}は治癒の祈りでHPを${amount}回復した`;
      } else if (actionId === "guard") {
        const previousBarrier = active.barrier;
        active.barrier = Math.min(36, active.barrier + 18);
        amount = active.barrier - previousBarrier;
        message = `${active.name}は堅守の構えで${amount}の防壁を得た`;
      } else {
        const weapon = weaponById(active.weapon_id) ?? WEAPONS[0];
        const armor = armorById(target.armor_id) ?? ARMORS[0];
        const rawDamage =
          actionId === "power_strike" ? weapon.damage + 10 : weapon.damage;
        const afterArmor = Math.max(1, rawDamage - armor.defense);
        const absorbed = Math.min(target.barrier, afterArmor);
        target.barrier -= absorbed;
        amount = afterArmor - absorbed;
        target.hp = Math.max(0, target.hp - amount);
        const actionName =
          actionId === "power_strike" ? "渾身撃" : `${weapon.name}の攻撃`;
        message = `${active.name}の${actionName}。${target.name}に${amount}ダメージ`;
        if (absorbed > 0) message += `（防壁が${absorbed}吸収）`;
      }

      if (selectedSkill) {
        active.cooldownMap[actionId] = selectedSkill.cooldown;
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

      if (!humansAlive.length || !monstersAlive.length) {
        status = "finished";
        winner = humansAlive.length ? "humans" : "monsters";
      } else {
        if (active.team === "humans") humanCursor += 1;
        else monsterCursor += 1;
        const nextTeamPlayers =
          enemyTeam === "humans" ? humansAlive : monstersAlive;
        const cursor =
          enemyTeam === "humans" ? humanCursor : monsterCursor;
        const nextPlayer = nextTeamPlayers[cursor % nextTeamPlayers.length];
        nextPlayerId = nextPlayer.id;
        nextPlayer.cooldownMap = Object.fromEntries(
          Object.entries(nextPlayer.cooldownMap).map(([id, turns]) => [
            id,
            Math.max(0, turns - 1),
          ]),
        );
      }

      const actionLogId = crypto.randomUUID();
      const statements: D1PreparedStatement[] = [
        db
          .prepare(
            "INSERT INTO actions (id, room_id, turn_number, actor_id, target_id, action_id, amount, message) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
          )
          .bind(
            actionLogId,
            room.id,
            room.turn_number,
            active.id,
            target.id,
            actionId,
            amount,
            message,
          ),
      ];
      for (const player of players) {
        statements.push(
          db
            .prepare(
              "UPDATE players SET hp = ?, barrier = ?, cooldowns = ? WHERE id = ?",
            )
            .bind(
              player.hp,
              player.barrier,
              JSON.stringify(player.cooldownMap),
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
            room.turn_number + 1,
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

