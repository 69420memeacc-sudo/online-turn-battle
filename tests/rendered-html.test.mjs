import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
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
  assert.match(page, /アイテムを3つまで/);
  assert.match(page, /試合を開始/);
  assert.match(layout, /オンライン・ターン制バトル/);
  assert.match(route, /operation === "create"/);
  assert.match(route, /operation === "join"/);
  assert.match(route, /operation === "act"/);
  assert.match(route, /death_scythe/);
  assert.match(route, /snow_white_tear/);
  assert.match(route, /diamond_crystal/);
  assert.match(game, /MP15で自身のHPを22回復/);
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
    "../drizzle/0000_lumpy_hammerhead.sql",
    "../drizzle/0001_familiar_susan_delgado.sql",
  ];
  await Promise.all(assets.map((asset) => access(new URL(asset, import.meta.url))));
  await assert.rejects(
    access(new URL("../app/_sites-preview/", templateRoot)),
  );
});
