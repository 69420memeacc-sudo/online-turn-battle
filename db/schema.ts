import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const rooms = sqliteTable(
  "rooms",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    status: text("status").notNull().default("lobby"),
    hostPlayerId: text("host_player_id").notNull(),
    currentPlayerId: text("current_player_id"),
    turnNumber: integer("turn_number").notNull().default(1),
    winnerTeam: text("winner_team"),
    humanCursor: integer("human_cursor").notNull().default(0),
    monsterCursor: integer("monster_cursor").notNull().default(0),
    version: integer("version").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [uniqueIndex("rooms_code_unique").on(table.code)],
);

export const players = sqliteTable(
  "players",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id),
    tokenHash: text("token_hash").notNull(),
    name: text("name").notNull(),
    team: text("team").notNull(),
    hp: integer("hp").notNull().default(100),
    maxHp: integer("max_hp").notNull().default(100),
    mp: integer("mp").notNull().default(100),
    maxMp: integer("max_mp").notNull().default(100),
    barrier: integer("barrier").notNull().default(0),
    weaponId: text("weapon_id").notNull().default("longsword"),
    armorId: text("armor_id").notNull().default("chainmail"),
    skillIds: text("skill_ids").notNull().default('["guard","mend"]'),
    itemIds: text("item_ids").notNull().default("[]"),
    loadoutItemIds: text("loadout_item_ids").notNull().default("[]"),
    cooldowns: text("cooldowns").notNull().default("{}"),
    sleepTurns: integer("sleep_turns").notNull().default(0),
    poisoned: integer("poisoned").notNull().default(0),
    extraActionPending: integer("extra_action_pending").notNull().default(0),
    giantSwordWait: integer("giant_sword_wait").notNull().default(0),
    ready: integer("ready").notNull().default(0),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    forfeitAt: text("forfeit_at"),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [index("players_room_idx").on(table.roomId, table.joinedAt)],
);

export const actions = sqliteTable(
  "actions",
  {
    id: text("id").primaryKey(),
    roomId: text("room_id")
      .notNull()
      .references(() => rooms.id),
    turnNumber: integer("turn_number").notNull(),
    actorId: text("actor_id").notNull(),
    targetId: text("target_id").notNull(),
    actionId: text("action_id").notNull(),
    amount: integer("amount").notNull().default(0),
    message: text("message").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("actions_room_turn_unique").on(
      table.roomId,
      table.turnNumber,
    ),
    index("actions_room_idx").on(table.roomId, table.turnNumber),
  ],
);
