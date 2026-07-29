# CROWN & CLAW

人間軍と魔物軍に分かれて戦う、オンライン・ターン制バトルゲームです。

## 現在のプロトタイプ

- 部屋コードと招待URLによるオンライン対戦
- 1対1から4対4までの2陣営戦
- 武器1、防具1、スキル/魔法2、アイテム3のロードアウト
- HP・MP、装備防御、クールダウン、睡眠、戦闘ログ
- 攻撃、回復、防壁、魔法、吸引、盗賊、撃破時パッシブ
- 消費アイテムと所持中に発動する結晶パッシブ
- 防具とアイテムごとのオリジナル生成アイコン
- サーバー判定による交互ターンと勝敗処理

## 公開版

https://crown-claw-turn-battle.crown-claw-game.workers.dev/

## ローカル起動

```bash
npm install
npm run dev
```

## 検証

```bash
npm run build
npm test
```

## Cloudflareへ公開

```bash
npx wrangler d1 migrations apply DB --remote
npm run deploy
```
