"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ARMORS,
  ITEMS,
  ITEM_LIMIT,
  SKILLS,
  SKILL_LIMIT,
  WEAPONS,
  armorById,
  itemById,
  skillById,
  weaponById,
  type PublicPlayer,
  type PublicRoom,
  type Team,
} from "@/lib/game";

type GameSession = {
  code: string;
  playerId: string;
  token: string;
};

type ApiResult = {
  room?: PublicRoom;
  session?: GameSession;
  error?: string;
};

const SESSION_KEY = "crown-and-claw-session";

function teamLabel(team: Team) {
  return team === "humans" ? "人間軍" : "魔物軍";
}

function countOf(ids: string[], id: string) {
  return ids.filter((currentId) => currentId === id).length;
}

function PlayerCard({
  player,
  active,
  self,
}: {
  player: PublicPlayer;
  active: boolean;
  self: boolean;
}) {
  const hpPercent = Math.max(0, (player.hp / player.maxHp) * 100);
  const mpPercent = Math.max(0, (player.mp / player.maxMp) * 100);
  const passives = player.itemIds
    .map(itemById)
    .filter((item) => item?.kind === "passive");
  return (
    <article
      className={`fighter-card ${player.team} ${active ? "active" : ""} ${
        player.hp <= 0 ? "defeated" : ""
      }`}
    >
      <div className="fighter-topline">
        <span className="fighter-name">
          {player.name}
          {self ? <small>あなた</small> : null}
        </span>
        <span className="fighter-hp">
          HP {player.hp}/{player.maxHp}
        </span>
      </div>
      <div className="hp-track" aria-label={`${player.name}のHP ${player.hp}`}>
        <span style={{ width: `${hpPercent}%` }} />
      </div>
      <div className="mp-line">
        <div className="mp-track" aria-label={`${player.name}のMP ${player.mp}`}>
          <span style={{ width: `${mpPercent}%` }} />
        </div>
        <small>MP {player.mp}/{player.maxMp}</small>
      </div>
      <div className="fighter-meta">
        <span>
          {weaponById(player.weaponId)?.icon}{" "}
          {weaponById(player.weaponId)?.name}
        </span>
        <span>
          {armorById(player.armorId)?.icon} 防御{" "}
          {armorById(player.armorId)?.defense}
        </span>
        {player.barrier > 0 ? (
          <span className="barrier">⬟ 防壁 {player.barrier}</span>
        ) : null}
        {player.sleepTurns > 0 ? (
          <span className="sleeping">☾ 睡眠 {player.sleepTurns}</span>
        ) : null}
      </div>
      {passives.length ? (
        <div className="passive-row">
          {passives.map((item, index) => (
            <span key={`${item!.id}-${index}`} title={item!.name}>
              <img src={item!.image} alt="" width={16} height={16} />
              {item!.name}
            </span>
          ))}
        </div>
      ) : null}
      {active ? <div className="turn-ribbon">行動中</div> : null}
    </article>
  );
}

export default function Home() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState<Team>("humans");
  const [joinCode, setJoinCode] = useState(() =>
    typeof window === "undefined"
      ? ""
      : (new URLSearchParams(window.location.search).get("room") ?? "")
          .toUpperCase()
          .slice(0, 6),
  );
  const [session, setSession] = useState<GameSession | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [weaponId, setWeaponId] = useState("longsword");
  const [armorId, setArmorId] = useState("chainmail");
  const [skillIds, setSkillIds] = useState<string[]>(["guard", "mend"]);
  const [itemIds, setItemIds] = useState<string[]>([]);
  const [enemyTargetId, setEnemyTargetId] = useState("");
  const [allyTargetId, setAllyTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const requestGame = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = (await response.json()) as ApiResult;
      if (!response.ok) throw new Error(result.error || "操作に失敗しました。");
      if (result.session) {
        setSession(result.session);
        localStorage.setItem(SESSION_KEY, JSON.stringify(result.session));
        window.history.replaceState(null, "", `?room=${result.session.code}`);
      }
      if (result.room) setRoom(result.room);
      return result;
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "操作に失敗しました。",
      );
      return null;
    } finally {
      setBusy(false);
    }
  }, []);

  const refreshRoom = useCallback(async (code: string) => {
    try {
      const response = await fetch(`/api/game?code=${encodeURIComponent(code)}`, {
        cache: "no-store",
      });
      const result = (await response.json()) as ApiResult;
      if (response.ok && result.room) setRoom(result.room);
    } catch {
      // The next poll retries automatically.
    }
  }, []);

  useEffect(() => {
    const queryCode = new URLSearchParams(window.location.search).get("room");
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    try {
      const restored = JSON.parse(saved) as GameSession;
      if (!queryCode || restored.code === queryCode.toUpperCase()) {
        queueMicrotask(() => {
          setSession(restored);
          void refreshRoom(restored.code);
        });
      }
    } catch {
      localStorage.removeItem(SESSION_KEY);
    }
  }, [refreshRoom]);

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => {
      void refreshRoom(session.code);
    }, 1200);
    return () => window.clearInterval(timer);
  }, [refreshRoom, session]);

  useEffect(() => {
    if (!session) return;
    const heartbeat = () =>
      fetch("/api/game", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          operation: "heartbeat",
          code: session.code,
          playerId: session.playerId,
          token: session.token,
        }),
      }).catch(() => undefined);
    void heartbeat();
    const timer = window.setInterval(() => {
      void heartbeat();
    }, 4000);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session) return;
    const notifyForfeit = () => {
      const payload = new Blob(
        [
          JSON.stringify({
            operation: "forfeit",
            code: session.code,
            playerId: session.playerId,
            token: session.token,
          }),
        ],
        { type: "application/json" },
      );
      navigator.sendBeacon("/api/game", payload);
    };
    window.addEventListener("pagehide", notifyForfeit);
    return () => window.removeEventListener("pagehide", notifyForfeit);
  }, [session]);

  const self = room?.players.find((player) => player.id === session?.playerId);
  const humans = room?.players.filter((player) => player.team === "humans") ?? [];
  const monsters =
    room?.players.filter((player) => player.team === "monsters") ?? [];
  const enemies = useMemo(
    () =>
      room?.players.filter(
        (player) => player.team !== self?.team && player.hp > 0,
      ) ?? [],
    [room?.players, self?.team],
  );
  const allies = useMemo(
    () =>
      room?.players.filter(
        (player) => player.team === self?.team && player.hp > 0,
      ) ?? [],
    [room?.players, self?.team],
  );
  const selectedEnemyTargetId = enemies.some(
    (player) => player.id === enemyTargetId,
  )
    ? enemyTargetId
    : (enemies[0]?.id ?? "");
  const selectedAllyTargetId = allies.some(
    (player) => player.id === allyTargetId,
  )
    ? allyTargetId
    : (self?.id ?? allies[0]?.id ?? "");

  function createRoom() {
    void requestGame({ operation: "create", name, team });
  }

  function joinRoom() {
    void requestGame({ operation: "join", code: joinCode, name, team });
  }

  function authenticatedBody(operation: string) {
    if (!session) return null;
    return {
      operation,
      code: session.code,
      playerId: session.playerId,
      token: session.token,
    };
  }

  function saveLoadout() {
    const auth = authenticatedBody("loadout");
    if (!auth) return;
    void requestGame({ ...auth, weaponId, armorId, skillIds, itemIds });
  }

  function startBattle() {
    const auth = authenticatedBody("start");
    if (auth) void requestGame(auth);
  }

  function rematch() {
    const auth = authenticatedBody("rematch");
    if (auth) void requestGame(auth);
  }

  function act(actionId: string, targetId = selectedEnemyTargetId) {
    const auth = authenticatedBody("act");
    if (!auth) return;
    void requestGame({ ...auth, actionId, targetId });
  }

  function toggleSkill(skillId: string) {
    const skill = skillById(skillId);
    const weapon = weaponById(weaponId);
    if (
      skill?.requiredWeaponType &&
      weapon?.type !== skill.requiredWeaponType
    ) {
      const requiredWeapon =
        skill.requiredWeaponType === "bow" ? "弓" : "杖";
      setError(`${skill.name}を装備するには${requiredWeapon}武器が必要です。`);
      return;
    }
    setSkillIds((current) => {
      if (current.includes(skillId)) {
        return current.filter((id) => id !== skillId);
      }
      if (current.length >= SKILL_LIMIT) {
        setError(`スキルと魔法は合わせて${SKILL_LIMIT}枠までです。`);
        return current;
      }
      return [...current, skillId];
    });
  }

  function selectWeapon(nextWeaponId: string) {
    const nextWeapon = weaponById(nextWeaponId);
    if (!nextWeapon) return;
    const incompatible = skillIds
      .map(skillById)
      .filter(
        (skill) =>
          skill?.requiredWeaponType &&
          skill.requiredWeaponType !== nextWeapon.type,
      );
    setWeaponId(nextWeaponId);
    if (incompatible.length) {
      setSkillIds((current) =>
        current.filter(
          (id) =>
            !incompatible.some((skill) => skill?.id === id),
        ),
      );
      setError(
        `${incompatible.map((skill) => skill!.name).join("・")}は${nextWeapon.name}では使えないため、技枠から外しました。`,
      );
    }
  }

  function addItem(itemId: string) {
    const item = itemById(itemId);
    if (!item) return;
    setItemIds((current) => {
      const count = countOf(current, itemId);
      if (current.length >= ITEM_LIMIT) {
        setError(`アイテムは${ITEM_LIMIT}個までです。`);
        return current;
      }
      if (item.maxCopies && count >= item.maxCopies) {
        setError(`${item.name}は${item.maxCopies}個までです。`);
        return current;
      }
      return [...current, itemId];
    });
  }

  function removeItem(itemId: string) {
    setItemIds((current) => {
      const index = current.lastIndexOf(itemId);
      if (index < 0) return current;
      return current.filter((_, currentIndex) => currentIndex !== index);
    });
  }

  function leaveRoom() {
    localStorage.removeItem(SESSION_KEY);
    setSession(null);
    setRoom(null);
    setError("");
    window.history.replaceState(null, "", "/");
  }

  async function copyInvite() {
    if (!room) return;
    const url = `${window.location.origin}?room=${room.code}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  const allReady =
    Boolean(room?.players.length) && room!.players.every((player) => player.ready);
  const canStart =
    humans.length > 0 && monsters.length > 0 && allReady && !busy;
  const myTurn =
    room?.status === "battle" && room.currentPlayerId === session?.playerId;
  const uniqueBattleItems = self
    ? [...new Set(self.itemIds)]
        .map(itemById)
        .filter((item) => item?.kind === "consumable")
    : [];

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="brand" onClick={leaveRoom} aria-label="タイトルへ戻る">
          <span className="brand-crown">♛</span>
          <span>
            <strong>
              CROWN <i>&amp;</i> CLAW
            </strong>
            <small>剣と爪、交互に刻む戦場</small>
          </span>
        </button>
        <div className="header-status">
          <span className="live-dot" />
          ONLINE TURN BATTLE
        </div>
      </header>

      {error ? (
        <div className="error-banner" role="alert">
          <span>!</span>
          {error}
          <button onClick={() => setError("")}>閉じる</button>
        </div>
      ) : null}

      {!room ? (
        <section className="entrance">
          <div className="entrance-copy">
            <p className="eyebrow">THE TWO BANNERS AWAIT</p>
            <h1>
              王国か、魔境か。
              <br />
              <em>選んだ装備で勝ち残れ。</em>
            </h1>
            <p className="lead">
              武器と防具、2つの技、3つのアイテムを編成。
              仲間と陣営を組み、HPとMPを読み合うオンライン戦術バトル。
            </p>
            <div className="feature-row">
              <span>
                <b>01</b> 装備を編成
              </span>
              <span>
                <b>02</b> 部屋へ集結
              </span>
              <span>
                <b>03</b> 交互に行動
              </span>
            </div>
          </div>

          <div className="gate-panel">
            <div className="gate-heading">
              <span>戦場への登録</span>
              <small>最大 4 VS 4</small>
            </div>
            <label>
              <span>戦士名</span>
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="名前を入力"
                maxLength={16}
              />
            </label>
            <fieldset>
              <legend>所属陣営</legend>
              <div className="team-choice">
                <button
                  type="button"
                  className={team === "humans" ? "selected humans" : ""}
                  onClick={() => setTeam("humans")}
                >
                  <span className="sigil">♜</span>
                  <b>人間軍</b>
                  <small>王冠と鋼の連盟</small>
                </button>
                <button
                  type="button"
                  className={team === "monsters" ? "selected monsters" : ""}
                  onClick={() => setTeam("monsters")}
                >
                  <span className="sigil">♞</span>
                  <b>魔物軍</b>
                  <small>牙と深淵の軍勢</small>
                </button>
              </div>
            </fieldset>
            <button
              className="primary-action"
              onClick={createRoom}
              disabled={!name.trim() || busy}
            >
              {busy ? "門を開いています…" : "新しい戦場を作る"}
            </button>
            <div className="divider">
              <span>または招待から参加</span>
            </div>
            <div className="join-row">
              <input
                value={joinCode}
                onChange={(event) =>
                  setJoinCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, "")
                      .slice(0, 6),
                  )
                }
                placeholder="6桁の部屋コード"
                aria-label="部屋コード"
              />
              <button
                onClick={joinRoom}
                disabled={!name.trim() || joinCode.length !== 6 || busy}
              >
                参加
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {room?.status === "lobby" ? (
        <section className="lobby">
          <div className="lobby-topline">
            <div>
              <p className="eyebrow">WAR ROOM / {room.code}</p>
              <h1>出陣準備</h1>
              <p>武器1・防具1・技2・アイテム3で編成します。</p>
            </div>
            <div className="room-code-box">
              <small>招待コード</small>
              <strong>{room.code}</strong>
              <button onClick={copyInvite}>
                {copied ? "コピー済み" : "招待URLをコピー"}
              </button>
            </div>
          </div>

          <div className="lobby-grid">
            <div className="loadout-panel">
              <div className="section-heading">
                <div>
                  <span>LOADOUT</span>
                  <h2>持ち込み装備</h2>
                </div>
                <div className="loadout-limits">
                  技 {skillIds.length}/{SKILL_LIMIT} ・ 道具 {itemIds.length}/
                  {ITEM_LIMIT}
                </div>
              </div>

              <div className="loadout-group">
                <h3>
                  <span>01</span> 武器を1つ選択
                </h3>
                <div className="item-grid">
                  {WEAPONS.map((weapon) => (
                    <button
                      key={weapon.id}
                      className={
                        weaponId === weapon.id
                          ? "item-card selected"
                          : "item-card"
                      }
                      onClick={() => selectWeapon(weapon.id)}
                    >
                      <span className="item-icon">{weapon.icon}</span>
                      <span className="item-copy">
                        <b>{weapon.name}</b>
                        <small>{weapon.description}</small>
                      </span>
                      <span className="item-stat">
                        攻 {weapon.damage}
                        <i>{weapon.type === "staff" ? "MP 300" : "MP 100"}</i>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="loadout-group">
                <h3>
                  <span>02</span> 防具を1つ選択
                </h3>
                <div className="item-grid">
                  {ARMORS.map((armor) => (
                    <button
                      key={armor.id}
                      className={
                        armorId === armor.id
                          ? "item-card selected"
                          : "item-card"
                      }
                      onClick={() => setArmorId(armor.id)}
                    >
                      <img
                        className="generated-icon"
                        src={armor.image}
                        alt={armor.name}
                        width={52}
                        height={52}
                      />
                      <span className="item-copy">
                        <b>{armor.name}</b>
                        <small>{armor.description}</small>
                      </span>
                      <span className="item-stat">防 {armor.defense}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="loadout-group">
                <h3>
                  <span>03</span> スキルと魔法を2つまで
                </h3>
                <div className="item-grid skills-grid">
                  {SKILLS.map((skill) => {
                    const selected = skillIds.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        className={
                          selected ? "item-card selected" : "item-card"
                        }
                        onClick={() => toggleSkill(skill.id)}
                      >
                        <span className="item-icon">{skill.icon}</span>
                        <span className="item-copy">
                          <b>{skill.name}</b>
                          <small>{skill.description}</small>
                        </span>
                        <span className="item-stat">
                          {skill.kind === "passive"
                            ? "自動"
                            : skill.mpCost
                              ? `MP ${skill.mpCost}`
                              : `待 ${skill.cooldown}`}
                          <i>
                            {skill.requiredWeaponType === "bow"
                              ? "弓限定"
                              : skill.requiredWeaponType === "staff"
                                ? "杖限定"
                                : skill.kind === "magic"
                                  ? "魔法"
                                  : "スキル"}
                          </i>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="loadout-group">
                <h3>
                  <span>04</span> アイテムを3つまで
                </h3>
                <div className="item-grid item-picker-grid">
                  {ITEMS.map((item) => {
                    const count = countOf(itemIds, item.id);
                    const canAdd =
                      itemIds.length < ITEM_LIMIT &&
                      (!item.maxCopies || count < item.maxCopies);
                    return (
                      <article
                        key={item.id}
                        className={`item-card item-picker ${
                          count ? "selected" : ""
                        }`}
                      >
                        <img
                          className="generated-icon"
                          src={item.image}
                          alt={item.name}
                          width={52}
                          height={52}
                        />
                        <span className="item-copy">
                          <b>{item.name}</b>
                          <small>{item.description}</small>
                        </span>
                        <span className="item-count">×{count}</span>
                        <div className="quantity-controls">
                          <button
                            type="button"
                            onClick={() => removeItem(item.id)}
                            disabled={!count}
                            aria-label={`${item.name}を1つ減らす`}
                          >
                            −
                          </button>
                          <button
                            type="button"
                            onClick={() => addItem(item.id)}
                            disabled={!canAdd}
                            aria-label={`${item.name}を1つ増やす`}
                          >
                            ＋
                          </button>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>

              <button
                className="primary-action loadout-save"
                onClick={saveLoadout}
                disabled={
                  busy ||
                  skillIds.length > SKILL_LIMIT ||
                  itemIds.length > ITEM_LIMIT
                }
              >
                {self?.ready ? "編成を更新して準備完了" : "この編成で準備完了"}
              </button>
            </div>

            <aside className="roster-panel">
              <div className="section-heading">
                <div>
                  <span>ROSTER</span>
                  <h2>参戦者</h2>
                </div>
                <small>{room.players.length} / 8</small>
              </div>
              {(
                [
                  ["humans", humans],
                  ["monsters", monsters],
                ] as [Team, PublicPlayer[]][]
              ).map(([rosterTeam, players]) => (
                <div className={`roster-team ${rosterTeam}`} key={rosterTeam}>
                  <h3>
                    <span>{rosterTeam === "humans" ? "♜" : "♞"}</span>
                    {teamLabel(rosterTeam)}
                    <small>{players.length}/4</small>
                  </h3>
                  {players.length ? (
                    players.map((player) => (
                      <div className="roster-player" key={player.id}>
                        <span>{player.name}</span>
                        <small className={player.ready ? "ready" : ""}>
                          {player.ready ? "準備完了" : "編成中"}
                        </small>
                      </div>
                    ))
                  ) : (
                    <p className="empty-roster">参戦者を待っています</p>
                  )}
                </div>
              ))}

              {room.hostPlayerId === session?.playerId ? (
                <button
                  className="start-battle"
                  onClick={startBattle}
                  disabled={!canStart}
                >
                  <span>⚔</span>
                  試合を開始
                  <small>
                    {!humans.length || !monsters.length
                      ? "両軍に1人以上必要"
                      : !allReady
                        ? "全員の準備を待っています"
                        : "戦場へ進む"}
                  </small>
                </button>
              ) : (
                <div className="waiting-host">部屋主の開始を待っています</div>
              )}
            </aside>
          </div>
        </section>
      ) : null}

      {room && room.status !== "lobby" ? (
        <section className="battlefield">
          <div className="battle-heading">
            <div>
              <p className="eyebrow">BATTLE / ROOM {room.code}</p>
              <h1>
                {room.status === "finished"
                  ? `${teamLabel(room.winnerTeam!)}の勝利`
                  : myTurn
                    ? "あなたの手番"
                    : `${
                        room.players.find(
                          (player) => player.id === room.currentPlayerId,
                        )?.name ?? "相手"
                      }の手番`}
              </h1>
            </div>
            <div className="turn-counter">
              <small>TURN</small>
              <strong>{room.turnNumber}</strong>
            </div>
          </div>

          <div className="arena">
            <div className="army humans">
              <div className="army-title">
                <span>♜</span> 人間軍 <small>THE CROWN</small>
              </div>
              {humans.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  active={room.currentPlayerId === player.id}
                  self={session?.playerId === player.id}
                />
              ))}
            </div>
            <div className="versus-mark">
              <span>V</span>
              <i>S</i>
            </div>
            <div className="army monsters">
              <div className="army-title">
                <span>♞</span> 魔物軍 <small>THE CLAW</small>
              </div>
              {monsters.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  active={room.currentPlayerId === player.id}
                  self={session?.playerId === player.id}
                />
              ))}
            </div>
          </div>

          <div className="battle-console">
            <div className="action-panel">
              <div className="action-topline">
                <div>
                  <span>ACTIONS</span>
                  <h2>{myTurn ? "行動を選択" : "戦況を見守る"}</h2>
                </div>
                <div className="target-stack">
                  <label className="target-select">
                    敵対象
                    <select
                      value={selectedEnemyTargetId}
                      onChange={(event) => setEnemyTargetId(event.target.value)}
                    >
                      {enemies.map((enemy) => (
                        <option value={enemy.id} key={enemy.id}>
                          {enemy.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="target-select">
                    味方対象
                    <select
                      value={selectedAllyTargetId}
                      onChange={(event) => setAllyTargetId(event.target.value)}
                    >
                      {allies.map((ally) => (
                        <option value={ally.id} key={ally.id}>
                          {ally.name}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="resource-summary">
                <span>
                  HP <b>{self?.hp ?? 0}</b> / {self?.maxHp ?? 0}
                </span>
                <span className="mana">
                  MP <b>{self?.mp ?? 0}</b> / {self?.maxMp ?? 0}
                </span>
                <span>
                  {weaponById(self?.weaponId ?? "")?.name ?? "武器なし"}
                </span>
              </div>

              <h3 className="action-section-title">攻撃・スキル・魔法</h3>
              <div className="action-grid">
                <button disabled={!myTurn || busy} onClick={() => act("basic")}>
                  <span>⚔</span>
                  <b>基本攻撃</b>
                  <small>
                    {weaponById(self?.weaponId ?? "")?.damage ?? 0} 基礎ダメージ
                  </small>
                </button>
                {self?.skillIds.map((skillId) => {
                  const skill = skillById(skillId);
                  if (!skill || skill.kind === "passive") return null;
                  const cooldown = self.cooldowns[skillId] ?? 0;
                  const wrongWeapon =
                    skill.requiredWeaponType &&
                    weaponById(self.weaponId)?.type !== skill.requiredWeaponType;
                  const insufficientMp = (skill.mpCost ?? 0) > self.mp;
                  const insufficientHp = (skill.hpCost ?? 0) >= self.hp;
                  const noItemSpace =
                    skill.kind === "steal" && self.itemIds.length >= ITEM_LIMIT;
                  return (
                    <button
                      key={skill.id}
                      disabled={
                        !myTurn ||
                        busy ||
                        cooldown > 0 ||
                        wrongWeapon ||
                        insufficientMp ||
                        insufficientHp ||
                        noItemSpace
                      }
                      onClick={() => act(skill.id)}
                    >
                      <span>{skill.icon}</span>
                      <b>{skill.name}</b>
                      <small>
                        {cooldown > 0
                          ? `あと${cooldown}手番`
                          : wrongWeapon
                            ? "必要な武器を装備していません"
                            : insufficientMp
                              ? "MP不足"
                              : insufficientHp
                                ? "HP不足"
                                : noItemSpace
                                  ? "アイテム枠が満杯"
                                  : skill.description}
                      </small>
                    </button>
                  );
                })}
                {self?.skillIds.includes("cruelty") ? (
                  <div className="passive-skill-card">
                    <span>♰</span>
                    <b>残忍</b>
                    <small>敵撃破時に自動発動</small>
                  </div>
                ) : null}
              </div>

              <h3 className="action-section-title">アイテム</h3>
              <div className="action-grid consumable-grid">
                {uniqueBattleItems.length ? (
                  uniqueBattleItems.map((item) => {
                    const count = countOf(self?.itemIds ?? [], item!.id);
                    const allyItem =
                      item!.id === "ruby_crystal" ||
                      item!.id === "sapphire_crystal";
                    return (
                      <button
                        key={item!.id}
                        disabled={!myTurn || busy}
                        onClick={() =>
                          act(
                            item!.id,
                            allyItem
                              ? selectedAllyTargetId
                              : selectedEnemyTargetId,
                          )
                        }
                      >
                        <img
                          src={item!.image}
                          alt=""
                          width={40}
                          height={40}
                        />
                        <b>
                          {item!.name} ×{count}
                        </b>
                        <small>{item!.description}</small>
                      </button>
                    );
                  })
                ) : (
                  <p className="no-items">使えるアイテムはありません。</p>
                )}
              </div>
            </div>
            <aside className="battle-log">
              <div className="log-heading">
                <span>BATTLE LOG</span>
                <b>戦況記録</b>
              </div>
              <div className="log-list">
                {room.actions.length ? (
                  [...room.actions].reverse().map((action) => (
                    <p key={action.id}>
                      <small>TURN {action.turnNumber}</small>
                      {action.message}
                    </p>
                  ))
                ) : (
                  <p className="log-empty">開戦の鐘が鳴りました。</p>
                )}
              </div>
            </aside>
          </div>

          {room.status === "finished" ? (
            <div className={`victory-banner ${room.winnerTeam}`}>
              <span>{room.winnerTeam === "humans" ? "♛" : "♞"}</span>
              <div>
                <small>VICTORY</small>
                <strong>{teamLabel(room.winnerTeam!)}</strong>
              </div>
              <div className="victory-actions">
                {room.hostPlayerId === session?.playerId ? (
                  <button onClick={rematch} disabled={busy}>
                    {busy ? "戦場を整えています…" : "同じ編成で再戦"}
                  </button>
                ) : (
                  <small>部屋主の再戦を待っています</small>
                )}
                <button onClick={leaveRoom}>タイトルへ戻る</button>
              </div>
            </div>
          ) : null}
        </section>
      ) : null}

      <footer>
        <span>CROWN &amp; CLAW — PROTOTYPE 02</span>
        <span>交互ターン制・2陣営対戦</span>
      </footer>
    </main>
  );
}
