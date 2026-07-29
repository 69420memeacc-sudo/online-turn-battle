export type Team = "humans" | "monsters";
export type RoomStatus = "lobby" | "battle" | "finished";

export type Weapon = {
  id: string;
  name: string;
  description: string;
  damage: number;
  slots: number;
  icon: string;
  healingBonus?: number;
};

export type Armor = {
  id: string;
  name: string;
  description: string;
  defense: number;
  slots: number;
  icon: string;
};

export type Skill = {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  slots: number;
  icon: string;
  kind: "attack" | "heal" | "guard";
};

export const INVENTORY_LIMIT = 6;

export const WEAPONS: Weapon[] = [
  {
    id: "longsword",
    name: "騎士の長剣",
    description: "癖がなく、安定して高い一撃を与える。",
    damage: 18,
    slots: 2,
    icon: "⚔",
  },
  {
    id: "longbow",
    name: "灰木の長弓",
    description: "軽く扱いやすい、狩人のための長弓。",
    damage: 16,
    slots: 2,
    icon: "➳",
  },
  {
    id: "oakstaff",
    name: "古樫の杖",
    description: "攻撃は控えめだが、回復量が増加する。",
    damage: 12,
    slots: 2,
    healingBonus: 8,
    icon: "✦",
  },
];

export const ARMORS: Armor[] = [
  {
    id: "chainmail",
    name: "王国の鎖帷子",
    description: "受けるダメージを4軽減する重装備。",
    defense: 4,
    slots: 2,
    icon: "♜",
  },
  {
    id: "leather",
    name: "狩人の革鎧",
    description: "受けるダメージを2軽減する軽装備。",
    defense: 2,
    slots: 1,
    icon: "◈",
  },
  {
    id: "runedcloak",
    name: "ルーンの外套",
    description: "防御は低いが、装備枠を圧迫しない。",
    defense: 1,
    slots: 1,
    icon: "◇",
  },
];

export const SKILLS: Skill[] = [
  {
    id: "power_strike",
    name: "渾身撃",
    description: "武器攻撃力に10を加えた強力な一撃。",
    cooldown: 2,
    slots: 1,
    icon: "✹",
    kind: "attack",
  },
  {
    id: "mend",
    name: "治癒の祈り",
    description: "自身のHPを22回復する。杖なら効果上昇。",
    cooldown: 2,
    slots: 1,
    icon: "✚",
    kind: "heal",
  },
  {
    id: "guard",
    name: "堅守の構え",
    description: "次に受けるダメージを18まで防ぐ。",
    cooldown: 1,
    slots: 1,
    icon: "⬟",
    kind: "guard",
  },
];

export const weaponById = (id: string) =>
  WEAPONS.find((item) => item.id === id);
export const armorById = (id: string) =>
  ARMORS.find((item) => item.id === id);
export const skillById = (id: string) =>
  SKILLS.find((item) => item.id === id);

export type PublicPlayer = {
  id: string;
  name: string;
  team: Team;
  hp: number;
  maxHp: number;
  barrier: number;
  weaponId: string;
  armorId: string;
  skillIds: string[];
  cooldowns: Record<string, number>;
  ready: boolean;
};

export type ActionLog = {
  id: string;
  turnNumber: number;
  actorId: string;
  targetId: string;
  actionId: string;
  amount: number;
  message: string;
  createdAt: string;
};

export type PublicRoom = {
  code: string;
  status: RoomStatus;
  hostPlayerId: string;
  currentPlayerId: string | null;
  turnNumber: number;
  winnerTeam: Team | null;
  players: PublicPlayer[];
  actions: ActionLog[];
};

