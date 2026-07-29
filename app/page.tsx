"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ARMORS,
  INVENTORY_LIMIT,
  SKILLS,
  WEAPONS,
  armorById,
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
          {player.hp}/{player.maxHp}
        </span>
      </div>
      <div className="hp-track" aria-label={`${player.name}のHP ${player.hp}`}>
        <span style={{ width: `${hpPercent}%` }} />
      </div>
      <div className="fighter-meta">
        <span>{weaponById(player.weaponId)?.icon} {weaponById(player.weaponId)?.name}</span>
        <span>{armorById(player.armorId)?.icon} 防御 {armorById(player.armorId)?.defense}</span>
        {player.barrier > 0 ? <span className="barrier">⬟ 防壁 {player.barrier}</span> : null}
      </div>
      {active ? <div className="turn-ribbon">行動中</div> : null}
    </article>
  );
}

export default function Home() {
  const [name, setName] = useState("");
  const [team, setTeam] = useState<Team>("humans");
  const [joinCode, setJoinCode] = useState("");
  const [session, setSession] = useState<GameSession | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [weaponId, setWeaponId] = useState("longsword");
  const [armorId, setArmorId] = useState("chainmail");
  const [skillIds, setSkillIds] = useState<string[]>(["guard", "mend"]);
  const [targetId, setTargetId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const requestGame = useCallback(
    async (body: Record<string, unknown>) => {
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
    },
    [],
  );

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
    if (queryCode) setJoinCode(queryCode.toUpperCase().slice(0, 6));
    const saved = localStorage.getItem(SESSION_KEY);
    if (!saved) return;
    try {
      const restored = JSON.parse(saved) as GameSession;
      if (!queryCode || restored.code === queryCode.toUpperCase()) {
        setSession(restored);
        void refreshRoom(restored.code);
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

  const self = room?.players.find((player) => player.id === session?.playerId);
  const humans = room?.players.filter((player) => player.team === "humans") ?? [];
  const monsters =
    room?.players.filter((player) => player.team === "monsters") ?? [];
  const enemies =
    room?.players.filter(
      (player) => player.team !== self?.team && player.hp > 0,
    ) ?? [];
  const inventoryUsed = useMemo(() => {
    const weapon = weaponById(weaponId);
    const armor = armorById(armorId);
    return (
      (weapon?.slots ?? 0) +
      (armor?.slots ?? 0) +
      skillIds.reduce(
        (total, selectedId) => total + (skillById(selectedId)?.slots ?? 0),
        0,
      )
    );
  }, [armorId, skillIds, weaponId]);

  useEffect(() => {
    if (!targetId && enemies[0]) setTargetId(enemies[0].id);
    if (targetId && !enemies.some((player) => player.id === targetId)) {
      setTargetId(enemies[0]?.id ?? "");
    }
  }, [enemies, targetId]);

  function createRoom() {
    void requestGame({ operation: "create", name, team });
  }

  function joinRoom() {
    void requestGame({
      operation: "join",
      code: joinCode,
      name,
      team,
    });
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
    void requestGame({ ...auth, weaponId, armorId, skillIds });
  }

  function startBattle() {
    const auth = authenticatedBody("start");
    if (auth) void requestGame(auth);
  }

  function act(actionId: string) {
    const auth = authenticatedBody("act");
    if (!auth) return;
    void requestGame({ ...auth, actionId, targetId });
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

  return (
    <main className="game-shell">
      <header className="game-header">
        <button className="brand" onClick={leaveRoom} aria-label="タイトルへ戻る">
          <span className="brand-crown">♛</span>
          <span>
            <strong>CROWN <i>&amp;</i> CLAW</strong>
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
              武器、防具、スキルを6枠に編成。仲間と陣営を組み、
              一手ずつ相手の命運を削るオンライン戦術バトル。
            </p>
            <div className="feature-row">
              <span><b>01</b> 装備を編成</span>
              <span><b>02</b> 部屋へ集結</span>
              <span><b>03</b> 交互に行動</span>
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
            <div className="divider"><span>または招待から参加</span></div>
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
              <p>6枠以内で装備を整え、両軍の準備完了を待ちます。</p>
            </div>
            <div className="room-code-box">
              <small>招待コード</small>
              <strong>{room.code}</strong>
              <button onClick={copyInvite}>{copied ? "コピー済み" : "招待URLをコピー"}</button>
            </div>
          </div>

          <div className="lobby-grid">
            <div className="loadout-panel">
              <div className="section-heading">
                <div>
                  <span>LOADOUT</span>
                  <h2>持ち込み装備</h2>
                </div>
                <div className={inventoryUsed > INVENTORY_LIMIT ? "slots over" : "slots"}>
                  <b>{inventoryUsed}</b> / {INVENTORY_LIMIT} 枠
                </div>
              </div>

              <div className="loadout-group">
                <h3><span>01</span> 武器を1つ選択</h3>
                <div className="item-grid">
                  {WEAPONS.map((weapon) => (
                    <button
                      key={weapon.id}
                      className={weaponId === weapon.id ? "item-card selected" : "item-card"}
                      onClick={() => setWeaponId(weapon.id)}
                    >
                      <span className="item-icon">{weapon.icon}</span>
                      <span className="item-copy">
                        <b>{weapon.name}</b>
                        <small>{weapon.description}</small>
                      </span>
                      <span className="item-stat">攻 {weapon.damage}<i>{weapon.slots}枠</i></span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="loadout-group">
                <h3><span>02</span> 防具を1つ選択</h3>
                <div className="item-grid">
                  {ARMORS.map((armor) => (
                    <button
                      key={armor.id}
                      className={armorId === armor.id ? "item-card selected" : "item-card"}
                      onClick={() => setArmorId(armor.id)}
                    >
                      <span className="item-icon">{armor.icon}</span>
                      <span className="item-copy">
                        <b>{armor.name}</b>
                        <small>{armor.description}</small>
                      </span>
                      <span className="item-stat">防 {armor.defense}<i>{armor.slots}枠</i></span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="loadout-group">
                <h3><span>03</span> スキルを選択</h3>
                <div className="item-grid">
                  {SKILLS.map((skill) => {
                    const selected = skillIds.includes(skill.id);
                    return (
                      <button
                        key={skill.id}
                        className={selected ? "item-card selected" : "item-card"}
                        onClick={() =>
                          setSkillIds((current) =>
                            selected
                              ? current.filter((id) => id !== skill.id)
                              : [...current, skill.id],
                          )
                        }
                      >
                        <span className="item-icon">{skill.icon}</span>
                        <span className="item-copy">
                          <b>{skill.name}</b>
                          <small>{skill.description}</small>
                        </span>
                        <span className="item-stat">待 {skill.cooldown}<i>{skill.slots}枠</i></span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <button
                className="primary-action loadout-save"
                onClick={saveLoadout}
                disabled={busy || inventoryUsed > INVENTORY_LIMIT}
              >
                {self?.ready ? "装備を更新して準備完了" : "この装備で準備完了"}
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
              {([
                ["humans", humans],
                ["monsters", monsters],
              ] as [Team, PublicPlayer[]][]).map(([rosterTeam, players]) => (
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
                    : `${room.players.find((player) => player.id === room.currentPlayerId)?.name ?? "相手"}の手番`}
              </h1>
            </div>
            <div className="turn-counter">
              <small>TURN</small>
              <strong>{room.turnNumber}</strong>
            </div>
          </div>

          <div className="arena">
            <div className="army humans">
              <div className="army-title"><span>♜</span> 人間軍 <small>THE CROWN</small></div>
              {humans.map((player) => (
                <PlayerCard
                  key={player.id}
                  player={player}
                  active={room.currentPlayerId === player.id}
                  self={session?.playerId === player.id}
                />
              ))}
            </div>
            <div className="versus-mark"><span>V</span><i>S</i></div>
            <div className="army monsters">
              <div className="army-title"><span>♞</span> 魔物軍 <small>THE CLAW</small></div>
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
                {enemies.length > 1 ? (
                  <label className="target-select">
                    対象
                    <select value={targetId} onChange={(event) => setTargetId(event.target.value)}>
                      {enemies.map((enemy) => (
                        <option value={enemy.id} key={enemy.id}>{enemy.name}</option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
              <div className="action-grid">
                <button disabled={!myTurn || busy} onClick={() => act("basic")}>
                  <span>⚔</span>
                  <b>基本攻撃</b>
                  <small>{weaponById(self?.weaponId ?? "")?.damage ?? 0} 基礎ダメージ</small>
                </button>
                {self?.skillIds.map((skillId) => {
                  const skill = skillById(skillId);
                  if (!skill) return null;
                  const cooldown = self.cooldowns[skillId] ?? 0;
                  return (
                    <button
                      key={skill.id}
                      disabled={!myTurn || busy || cooldown > 0}
                      onClick={() => act(skill.id)}
                    >
                      <span>{skill.icon}</span>
                      <b>{skill.name}</b>
                      <small>{cooldown > 0 ? `あと${cooldown}手番` : skill.description}</small>
                    </button>
                  );
                })}
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
              <button onClick={leaveRoom}>タイトルへ戻る</button>
            </div>
          ) : null}
        </section>
      ) : null}

      <footer>
        <span>CROWN &amp; CLAW — PROTOTYPE 01</span>
        <span>交互ターン制・2陣営対戦</span>
      </footer>
    </main>
  );
}

