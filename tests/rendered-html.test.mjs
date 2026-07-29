import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("ships the Crown & Claw entrance and online game flow", async () => {
  const [page, layout, route, game] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/game/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/game.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /CROWN/);
  assert.match(page, /CLAW/);
  assert.match(page, /新しい戦場を作る/);
  assert.match(page, /持ち込み装備/);
  assert.match(page, /スキルと魔法を2つまで/);
  assert.match(page, /追加アイテムを3つまで/);
  assert.match(page, /試合を開始/);
  assert.match(layout, /オンライン・ターン制バトル/);
  assert.match(route, /operation === "create"/);
  assert.match(route, /operation === "join"/);
  assert.match(route, /operation === "act"/);
  assert.match(route, /operation === "rematch"/);
  assert.match(route, /operation === "heartbeat"/);
  assert.match(route, /operation === "forfeit"/);
  assert.doesNotMatch(route, /'-90 seconds'/);
  assert.match(route, /'-5 seconds'/);
  assert.doesNotMatch(page, /sendBeacon/);
  assert.match(route, /death_scythe/);
  assert.match(route, /snow_white_tear/);
  assert.match(route, /diamond_crystal/);
  assert.match(route, /randomIndex\(target\.itemList\.length\)/);
  assert.match(route, /target\.itemList\.splice\(stolenIndex, 1\)/);
  assert.match(game, /MP15で自身のHPを22回復/);
  assert.match(game, /STAFF_MAX_MP = 200/);
  assert.match(game, /最大MPを100増加/);
  assert.match(game, /MP55で指定した敵に攻40/);
  assert.match(game, /1個につき20%増加/);
  assert.match(route, /DEFAULT_EMERALD_MULTIPLIER/);
  assert.match(route, /actionId === "power_strike"/);
  assert.match(game, /渾身撃・黄金の光矢/);
  assert.match(route, /\[\.\.\.DEFAULT_ITEM_IDS, \.\.\.itemIds\]/);
  assert.match(page, /各1個を標準支給/);
  assert.match(page, /battle-message-popup/);
  assert.match(page, /BATTLE LOG/);
  assert.match(page, /同じ編成で再戦/);
  assert.match(page, /装備するには.*武器が必要/);

  assert.match(game, /神の矢/);
  assert.match(game, /古代のレイピア/);
  assert.match(game, /妖魔双刀/);
  assert.match(game, /巨人の剣/);
  assert.match(game, /緑精霊エルザレムの杖/);
  assert.match(game, /毒ポーション/);
  assert.match(game, /解毒ポーション/);
  assert.match(route, /poison_tick/);
  assert.match(route, /giant_sword_skip/);
  assert.match(route, /extra_action_pending/);
  assert.match(route, /crueltyRate/);
});

test("includes production assets and removes the starter preview", async () => {
  const assets = [
    "../public/og.png",
    "../public/icons/armor-chainmail.png",
    "../public/icons/armor-leather.png",
    "../public/icons/armor-rune-cloak.png",
    "../public/icons/item-ruby-crystal.png",
    "../public/icons/item-sapphire-crystal.png",
    "../public/icons/item-snow-white-tear.png",
    "../public/icons/item-heavens-scale.png",
    "../public/icons/item-emerald-crystal.png",
    "../public/icons/item-diamond-crystal.png",
    "../public/icons/item-poison-potion.svg",
    "../public/icons/item-antidote-potion.svg",
    "../drizzle/0000_lumpy_hammerhead.sql",
    "../drizzle/0001_familiar_susan_delgado.sql",
    "../public/icons/weapon-longsword.svg",
    "../public/icons/weapon-longbow.svg",
    "../public/icons/weapon-oakstaff.svg",
    "../public/icons/weapon-ancient-rapier.svg",
    "../public/icons/weapon-demon-twin-blades.svg",
    "../public/icons/weapon-giant-sword.svg",
    "../public/icons/weapon-elzarem-staff.svg",
    "../public/icons/skill-power-strike.svg",
    "../public/icons/skill-mend.svg",
    "../public/icons/skill-guard.svg",
    "../public/icons/skill-golden-arrow.svg",
    "../public/icons/skill-divine-arrow.svg",
    "../public/icons/skill-death-scythe.svg",
    "../public/icons/skill-drain.svg",
    "../public/icons/skill-thief-life.svg",
    "../public/icons/skill-cruelty.svg",
    "../public/icons/item-ruby-crystal.svg",
    "../public/icons/item-sapphire-crystal.svg",
    "../public/icons/item-snow-white-tear.svg",
    "../public/icons/item-heavens-scale.svg",
    "../public/icons/item-emerald-crystal.svg",
    "../public/icons/item-diamond-crystal.svg",
    "../public/offline.html",
  ];
  await Promise.all(assets.map((asset) => access(new URL(asset, import.meta.url))));

  const migrationNames = (await readdir(new URL("../drizzle/", import.meta.url)))
    .filter((name) => name.endsWith(".sql"));
  const migrationText = (
    await Promise.all(
      migrationNames.map((name) =>
        readFile(new URL(`../drizzle/${name}`, import.meta.url), "utf8"),
      ),
    )
  ).join("\n");
  assert.match(migrationText, /ADD `poisoned`/);
  assert.match(migrationText, /ADD `extra_action_pending`/);
  assert.match(migrationText, /ADD `giant_sword_wait`/);
  await assert.rejects(
    access(new URL("../app/_sites-preview/", templateRoot)),
  );
});
