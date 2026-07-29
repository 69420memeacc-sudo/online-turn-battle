import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const templateRoot = new URL("../", import.meta.url);

test("ships the Crown & Claw entrance and online game flow", async () => {
  const [page, layout, route] = await Promise.all([
    readFile(new URL("../app/page.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/layout.tsx", import.meta.url), "utf8"),
    readFile(new URL("../app/api/game/route.ts", import.meta.url), "utf8"),
  ]);

  assert.match(page, /CROWN/);
  assert.match(page, /CLAW/);
  assert.match(page, /新しい戦場を作る/);
  assert.match(page, /持ち込み装備/);
  assert.match(page, /試合を開始/);
  assert.match(layout, /オンライン・ターン制バトル/);
  assert.match(route, /operation === "create"/);
  assert.match(route, /operation === "join"/);
  assert.match(route, /operation === "act"/);
});

test("includes production assets and removes the starter preview", async () => {
  await access(new URL("../public/og.png", import.meta.url));
  await access(new URL("../drizzle/0000_lumpy_hammerhead.sql", import.meta.url));
  await assert.rejects(
    access(new URL("../app/_sites-preview/", templateRoot)),
  );
});

