export type Team = "humans" | "monsters";
export type RoomStatus = "lobby" | "battle" | "finished";
export type WeaponType = "sword" | "bow" | "staff";

export type Weapon = {
  id: string;
  name: string;
  description: string;
  damage: number;
  type: WeaponType;
  icon: string;
  healingBonus?: number;
};

export type Armor = {
  id: string;
  name: string;
  description: string;
  defense: number;
  icon: string;
  image: string;
  mpBonus?: number;
};

export type SkillKind =
  | "attack"
  | "heal"
  | "guard"
  | "magic"
  | "drain"
  | "steal"
  | "passive";

export type Skill = {
  id: string;
  name: string;
  description: string;
  cooldown: number;
  icon: string;
  kind: SkillKind;
  mpCost?: number;
  hpCost?: number;
  requiredWeaponType?: WeaponType;
};

export type ItemKind = "consumable" | "passive";

export type GameItem = {
  id: string;
  name: string;
  description: string;
  kind: ItemKind;
  maxCopies?: number;
  image: string;
};

export const SKILL_LIMIT = 2;
export const ITEM_LIMIT = 3;
export const DEFAULT_ITEM_IDS = ["ruby_crystal", "sapphire_crystal"] as const;
export const BATTLE_ITEM_LIMIT = ITEM_LIMIT + DEFAULT_ITEM_IDS.length;
export const BASE_MAX_MP = 100;
export const STAFF_MAX_MP = 200;

export const WEAPONS: Weapon[] = [
  {
    id: "longsword",
    name: "騎士の長剣",
    description: "癖がなく、安定して高い一撃を与える。",
    damage: 18,
    type: "sword",
    icon: "⚔",
  },
  {
    id: "longbow",
    name: "灰木の長弓",
    description: "黄金の光矢を放てる、狩人の長弓。",
    damage: 16,
    type: "bow",
    icon: "➳",
  },
  {
    id: "oakstaff",
    name: "古樫の杖",
    description: "基礎最大MPが200になり、吸引を使用できる。",
    damage: 12,
    type: "staff",
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
    icon: "♜",
    image: "/icons/armor-chainmail.png",
  },
  {
    id: "leather",
    name: "狩人の革鎧",
    description: "受けるダメージを2軽減する軽装備。",
    defense: 2,
    icon: "◈",
    image: "/icons/armor-leather.png",
  },
  {
    id: "runedcloak",
    name: "ルーンの外套",
    description: "最大MPを100増加し、受けるダメージを1軽減。",
    defense: 1,
    icon: "◇",
    image: "/icons/armor-rune-cloak.png",
    mpBonus: 100,
  },
];

export const SKILLS: Skill[] = [
  {
    id: "power_strike",
    name: "渾身撃",
    description:
      "武器攻撃力に10を加えた強力な一撃。エメラルドの結晶の倍率が適用される。",
    cooldown: 2,
    icon: "✹",
    kind: "attack",
  },
  {
    id: "mend",
    name: "治癒の祈り",
    description: "MP15で自身のHPを22回復する。杖なら効果上昇。",
    cooldown: 2,
    icon: "✚",
    kind: "heal",
    mpCost: 15,
  },
  {
    id: "guard",
    name: "堅守の構え",
    description: "次に受けるダメージを18まで防ぐ。",
    cooldown: 1,
    icon: "⬟",
    kind: "guard",
  },
  {
    id: "golden_arrow",
    name: "黄金の光矢",
    description:
      "MP35で指定した敵に攻45。エメラルドの結晶の倍率が適用される。弓装備時のみ。",
    cooldown: 0,
    icon: "☀",
    kind: "magic",
    mpCost: 35,
    requiredWeaponType: "bow",
  },
  {
    id: "death_scythe",
    name: "死神の鎌",
    description: "MP250とHP80を捧げ、ランダムな敵に攻999。",
    cooldown: 0,
    icon: "☠",
    kind: "magic",
    mpCost: 250,
    hpCost: 80,
  },
  {
    id: "drain",
    name: "吸引",
    description: "敵からHP10とMP15を奪う。杖装備時のみ。",
    cooldown: 3,
    icon: "◉",
    kind: "drain",
    requiredWeaponType: "staff",
  },
  {
    id: "thief_life",
    name: "盗賊の生き方",
    description: "敵からアイテムをランダムに1つ奪う。",
    cooldown: 4,
    icon: "♠",
    kind: "steal",
  },
  {
    id: "cruelty",
    name: "残忍",
    description: "敵を倒すと自動でHPとMPを最大値の50%回復。",
    cooldown: 0,
    icon: "♰",
    kind: "passive",
  },
];

export const ITEMS: GameItem[] = [
  {
    id: "ruby_crystal",
    name: "ルビーの結晶",
    description: "自身または味方1人のHPを30回復。使うとなくなる。",
    kind: "consumable",
    maxCopies: 2,
    image: "/icons/item-ruby-crystal.png",
  },
  {
    id: "sapphire_crystal",
    name: "サファイアの結晶",
    description: "自身または味方1人の最大MPの30%を回復。",
    kind: "consumable",
    maxCopies: 2,
    image: "/icons/item-sapphire-crystal.png",
  },
  {
    id: "snow_white_tear",
    name: "白雪姫の涙",
    description: "指定した敵1人を2ターン眠らせる。",
    kind: "consumable",
    maxCopies: 1,
    image: "/icons/item-snow-white-tear.png",
  },
  {
    id: "heavens_scale",
    name: "天国の天秤",
    description: "ランダムな敵とMPを比べ、低い方が50ダメージ。",
    kind: "consumable",
    image: "/icons/item-heavens-scale.png",
  },
  {
    id: "emerald_crystal",
    name: "エメラルドの結晶",
    description:
      "所持中、通常攻撃・渾身撃・黄金の光矢が1個につき25%増加。重複可。",
    kind: "passive",
    image: "/icons/item-emerald-crystal.png",
  },
  {
    id: "diamond_crystal",
    name: "ダイヤモンドの結晶",
    description: "所持中、被ダメージ20%減・1ターン最大50。",
    kind: "passive",
    maxCopies: 1,
    image: "/icons/item-diamond-crystal.png",
  },
];

export const weaponById = (id: string) =>
  WEAPONS.find((item) => item.id === id);
export const armorById = (id: string) =>
  ARMORS.find((item) => item.id === id);
export const maxMpForLoadout = (weaponId: string, armorId: string) => {
  const weapon = weaponById(weaponId);
  const armor = armorById(armorId);
  const baseMp = weapon?.type === "staff" ? STAFF_MAX_MP : BASE_MAX_MP;
  return baseMp + (armor?.mpBonus ?? 0);
};
export const skillById = (id: string) =>
  SKILLS.find((item) => item.id === id);
export const itemById = (id: string) =>
  ITEMS.find((item) => item.id === id);

export type PublicPlayer = {
  id: string;
  name: string;
  team: Team;
  hp: number;
  maxHp: number;
  mp: number;
  maxMp: number;
  barrier: number;
  weaponId: string;
  armorId: string;
  skillIds: string[];
  itemIds: string[];
  cooldowns: Record<string, number>;
  sleepTurns: number;
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
