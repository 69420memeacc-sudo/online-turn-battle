export type Team = "humans" | "monsters";
export type RoomStatus = "lobby" | "battle" | "finished";
export type WeaponType = "sword" | "bow" | "staff" | "tome";

export type Weapon = {
  id: string;
  name: string;
  description: string;
  damage: number;
  type: WeaponType;
  icon: string;
  image: string;
  healingBonus?: number;
  maxStatMultiplier?: number;
  maxHpOverride?: number;
  forbidsPowerStrike?: boolean;
  ignoresDefense?: boolean;
  actionsPerTurn?: number;
  skipsEveryOtherTurn?: boolean;
  alwaysPowerStrike?: boolean;
  emeraldMultiplier?: number;
  skillSlots?: number;
  ignoresSkillRestrictions?: boolean;
  poisonMultiplier?: number;
  unlimitedAntidote?: boolean;
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
  image: string;
  kind: SkillKind;
  mpCost?: number;
  hpCost?: number;
  consumeAllMp?: boolean;
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
export const BASE_MAX_HP = 100;
export const BASE_MAX_MP = 100;
export const STAFF_MAX_MP = 200;
export const DEFAULT_EMERALD_MULTIPLIER = 1.2;

export const WEAPONS: Weapon[] = [
  {
    id: "longsword",
    name: "騎士の長剣",
    description: "癖がなく、安定して高い一撃を与える。",
    damage: 18,
    type: "sword",
    icon: "⚔",
    image: "/icons/weapon-longsword.png",
  },
  {
    id: "longbow",
    name: "灰木の長弓",
    description: "黄金の光矢と神の矢を放てる、狩人の長弓。",
    damage: 16,
    type: "bow",
    icon: "➳",
    image: "/icons/weapon-longbow.png",
  },
  {
    id: "oakstaff",
    name: "古樫の杖",
    description: "基礎最大MPが200になり、吸引を使用できる。",
    damage: 12,
    type: "staff",
    healingBonus: 8,
    icon: "✦",
    image: "/icons/weapon-oakstaff.png",
  },
  {
    id: "ancient_rapier",
    name: "古代のレイピア",
    description:
      "攻20。通常攻撃が防具とダイヤモンド結晶を無視するが、渾身撃は使えない。",
    damage: 20,
    type: "sword",
    icon: "†",
    image: "/icons/weapon-ancient-rapier.png",
    forbidsPowerStrike: true,
    ignoresDefense: true,
  },
  {
    id: "demon_twin_blades",
    name: "妖魔双刀",
    description:
      "攻13。同じ手番で2回行動できるが、最大HP・MPが20%低下し、渾身撃は使えない。",
    damage: 13,
    type: "sword",
    icon: "⚔⚔",
    image: "/icons/weapon-demon-twin-blades.png",
    maxStatMultiplier: 0.8,
    forbidsPowerStrike: true,
    actionsPerTurn: 2,
  },
  {
    id: "giant_sword",
    name: "巨人の剣",
    description:
      "攻35。最大HP200。基本攻撃が毎回渾身撃（攻45）になるが、行動後は次の自分の手番を休む。",
    damage: 35,
    type: "sword",
    icon: "▰",
    image: "/icons/weapon-giant-sword.png",
    maxHpOverride: 200,
    skipsEveryOtherTurn: true,
    alwaysPowerStrike: true,
  },
  {
    id: "elzarem_staff",
    name: "緑精霊エルザレムの杖",
    description:
      "攻8。基礎最大MPが200になり、エメラルド結晶1個の倍率が1.6倍になる。",
    damage: 8,
    type: "staff",
    icon: "♧",
    image: "/icons/weapon-elzarem-staff.png",
    emeraldMultiplier: 1.6,
  },
  {
    id: "wisdom_book",
    name: "叡智の書",
    description:
      "攻1・基礎最大MP200。スキルを4つ選択でき、弓・杖の制限を無視する。毒ポーションの毒ダメージが2倍になり、解毒ポーションを無制限に使える。",
    damage: 1,
    type: "tome",
    icon: "▣",
    image: "/icons/weapon-wisdom-book.png",
    skillSlots: 4,
    ignoresSkillRestrictions: true,
    poisonMultiplier: 2,
    unlimitedAntidote: true,
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
    description:
      "受けるダメージを2軽減する軽装備。残忍のHP・MP回復量が50%から66%になる。",
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
    image: "/icons/skill-power-strike.png",
    kind: "attack",
  },
  {
    id: "mend",
    name: "治癒の祈り",
    description: "MP15で自身のHPを22回復する。杖なら効果上昇。",
    cooldown: 2,
    icon: "✚",
    image: "/icons/skill-mend.png",
    kind: "heal",
    mpCost: 15,
  },
  {
    id: "guard",
    name: "堅守の構え",
    description: "次に受けるダメージを18まで防ぐ。",
    cooldown: 1,
    icon: "⬟",
    image: "/icons/skill-guard.png",
    kind: "guard",
  },
  {
    id: "golden_arrow",
    name: "黄金の光矢",
    description:
      "MP55で指定した敵に攻40。エメラルドの結晶の倍率が適用される。弓装備時のみ。",
    cooldown: 0,
    icon: "☀",
    image: "/icons/skill-golden-arrow.png",
    kind: "magic",
    mpCost: 55,
    requiredWeaponType: "bow",
  },
  {
    id: "divine_arrow",
    name: "神の矢",
    description:
      "残りMPをすべて消費し、その33%を攻撃力として敵軍全員に与える。弓装備時のみ。",
    cooldown: 0,
    icon: "✧",
    image: "/icons/skill-divine-arrow.png",
    kind: "magic",
    consumeAllMp: true,
    requiredWeaponType: "bow",
  },
  {
    id: "death_scythe",
    name: "死神の鎌",
    description: "MP250とHP80を捧げ、ランダムな敵に攻999。",
    cooldown: 0,
    icon: "☠",
    image: "/icons/skill-death-scythe.png",
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
    image: "/icons/skill-drain.png",
    kind: "drain",
    requiredWeaponType: "staff",
  },
  {
    id: "thief_life",
    name: "盗賊の生き方",
    description: "敵からアイテムをランダムに1つ奪う。",
    cooldown: 4,
    icon: "♠",
    image: "/icons/skill-thief-life.png",
    kind: "steal",
  },
  {
    id: "cruelty",
    name: "残忍",
    description:
      "敵を倒すと自動でHPとMPを最大値の50%回復。狩人の革鎧なら66%回復。",
    cooldown: 0,
    icon: "♰",
    image: "/icons/skill-cruelty.png",
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
    description:
      "指定した敵1人を2ターン眠らせる。各プレイヤーの最初の個人手番には使用できない。",
    kind: "consumable",
    maxCopies: 1,
    image: "/icons/item-snow-white-tear.png",
  },
  {
    id: "heavens_scale",
    name: "天国の天秤",
    description:
      "ランダムな敵とMPを比べ、低い方が自身の最大HPの50%ダメージを受ける。防具を無視する。",
    kind: "consumable",
    image: "/icons/item-heavens-scale.png",
  },
  {
    id: "poison_potion",
    name: "毒ポーション",
    description:
      "指定した敵1人を毒状態にする。毒は本人の手番開始時に6ダメージを与え、解毒まで続く。叡智の書なら12ダメージ。",
    kind: "consumable",
    image: "/icons/item-poison-potion.png",
  },
  {
    id: "antidote_potion",
    name: "解毒ポーション",
    description:
      "自身または味方1人の毒状態を解除する。叡智の書なら所持数に関係なく無制限に使える。",
    kind: "consumable",
    image: "/icons/item-antidote-potion.png",
  },
  {
    id: "emerald_crystal",
    name: "エメラルドの結晶",
    description:
      "所持中、通常攻撃・渾身撃・黄金の光矢が1個につき20%増加。緑精霊エルザレムの杖なら60%増加。重複可。",
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
export const maxHpForLoadout = (weaponId: string) => {
  const weapon = weaponById(weaponId);
  if (weapon?.maxHpOverride) return weapon.maxHpOverride;
  return Math.floor(BASE_MAX_HP * (weapon?.maxStatMultiplier ?? 1));
};
export const maxMpForLoadout = (weaponId: string, armorId: string) => {
  const weapon = weaponById(weaponId);
  const armor = armorById(armorId);
  const usesExpandedMp = weapon?.type === "staff" || weapon?.type === "tome";
  const baseMp = usesExpandedMp ? STAFF_MAX_MP : BASE_MAX_MP;
  return Math.floor(
    (baseMp + (armor?.mpBonus ?? 0)) * (weapon?.maxStatMultiplier ?? 1),
  );
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
  poisoned: boolean;
  turnsTaken: number;
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
