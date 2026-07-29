import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("ships the Crown & Claw entrance and updated online game flow", async () => {
  const [page, layout, route, game, schema, offline] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/game/route.ts", import.meta.url), "utf8"),
    readFile(new URL("../lib/game.ts", import.meta.url), "utf8"),
    readFile(new URL("../db/schema.ts", import.meta.url), "utf8"),
    readFile(new URL("../public/offline.html", import.meta.url), "utf8"),
  ]);

  assert.match(page, /CROWN/);
  assert.match(page, /CLAW/);
  assert.match(page, /新しい戦場を作る/);
  assert.match(page, /持ち込み装備/);
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
  assert.match(page, /BATTLE LOG/);
  assert.match(page, /同じ編成で再戦/);

  assert.match(game, /叡智の書/);
  assert.match(game, /skillSlots: 4/);
  assert.match(game, /maxHpOverride: 200/);
  assert.match(game, /poisonMultiplier: 2/);
  assert.match(game, /unlimitedAntidote: true/);
  assert.match(game, /最大HPの50%ダメージ/);
  assert.match(game, /id: "heavens_scale"[\s\S]{0,300}maxCopies: 1/);
  assert.match(offline, /id:"heavens_scale"[^\n]*maxCopies:1/);
  assert.match(game, /最初の個人手番には使用できない/);
  assert.match(game, /緑精霊エルザレムの杖なら60%増加/);
  assert.match(route, /turns_taken/);
  assert.match(route, /poison_damage/);
  assert.match(route, /ignoreArmor/);
  assert.match(route, /weapon\.unlimitedAntidote/);
  assert.match(route, /weapon\.poisonMultiplier/);
  assert.match(route, /active\.turns_taken === 0/);
  assert.match(page, /selectedSkillLimit/);
  assert.match(page, /turnsTaken/);
  assert.match(schema, /poisonDamage/);
  assert.match(schema, /turnsTaken/);
  assert.match(offline, /wisdom_book/);
  assert.match(offline, /maxHpOverride:200/);
  assert.match(offline, /unlimitedAntidote:true/);
  assert.match(offline, /turnsTaken/);
  assert.match(game, /maxHpOverride: 120/);
  assert.match(game, /powerStrikeBonus: 15/);
  assert.match(game, /barrierAfterAttack: 6/);
  assert.match(game, /sleepTurnsReceived: 1/);
  assert.match(game, /turnStartMpRecovery: 10/);
  assert.match(game, /overhealBarrierCap: 18/);
  assert.match(game, /drainHp: 15/);
  assert.match(game, /drainMp: 25/);
  assert.match(game, /drainCooldown: 2/);
  assert.match(game, /ignoresBarrier: true/);
  assert.match(route, /weapon\.ignoresBarrier/);
  assert.match(offline, /ignoresBarrier:true/);
  assert.match(route, /options\.ignoreBarrier/);
  assert.match(route, /weapon\.barrierAfterAttack/);
  assert.match(route, /targetWeapon\.sleepTurnsReceived/);
  assert.match(route, /candidateWeapon\.turnStartMpRecovery/);
  assert.match(offline, /barrierAfterAttack:6/);
  assert.match(offline, /turnStartMpRecovery:10/);
});

test("includes production assets and generated migrations", async () => {
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
    "../public/icons/item-poison-potion.png",
    "../public/icons/item-antidote-potion.png",
    "../public/icons/enemy-gaiser.png",
    "../public/icons/weapon-longsword.png",
    "../public/icons/weapon-longbow.png",
    "../public/icons/weapon-oakstaff.png",
    "../public/icons/weapon-ancient-rapier.png",
    "../public/icons/weapon-demon-twin-blades.png",
    "../public/icons/weapon-giant-sword.png",
    "../public/icons/weapon-elzarem-staff.png",
    "../public/icons/weapon-wisdom-book.png",
    "../public/icons/skill-power-strike.png",
    "../public/icons/skill-mend.png",
    "../public/icons/skill-guard.png",
    "../public/icons/skill-golden-arrow.png",
    "../public/icons/skill-divine-arrow.png",
    "../public/icons/skill-death-scythe.png",
    "../public/icons/skill-drain.png",
    "../public/icons/skill-thief-life.png",
    "../public/icons/skill-cruelty.png",
    "../public/offline.html",
    "../drizzle/0000_lumpy_hammerhead.sql",
    "../drizzle/0001_familiar_susan_delgado.sql",
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
  assert.match(migrationText, /ADD `poison_damage`/);
  assert.match(migrationText, /ADD `turns_taken`/);
  await assert.rejects(access(new URL("../app/_sites-preview/", templateRoot)));
});
