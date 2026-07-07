"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { bunkerCatastrophes } from "@/games/bunker/catastrophes";
import { bunkerShelters } from "@/games/bunker/shelters";
import { bunkerCategoryLabels, bunkerCharacteristicCategories } from "@/games/bunker/settings";
import type { BunkerCardCategory, BunkerSettings, PublicBunkerCard, PublicBunkerRoomState } from "@/games/bunker/types";

const LAST_LEFT_ROOM_KEY = "project-game:last-left-room";

type Ack = { ok: boolean; error?: string; playerId?: string };
type Tab = "game" | "players" | "chat" | "settings";

const phaseLabels: Record<PublicBunkerRoomState["phase"], string> = {
  LOBBY: "Лобби",
  SCENARIO_REVEAL: "Сценарий",
  CHARACTER_PREVIEW: "Персонаж",
  REVEAL_ROUND: "Раскрытие",
  DISCUSSION: "Обсуждение",
  SPECIAL_ACTIONS: "Спецкарты",
  VOTING: "Голосование",
  REVOTE: "Переголосование",
  VOTING_RESULT: "Итоги",
  ELIMINATION: "Исключение",
  GAME_OVER: "Финал"
};

export function BunkerRoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<PublicBunkerRoomState | null>(null);
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [joined, setJoined] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("game");
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const inviteUrl = typeof window === "undefined" ? "" : `${window.location.origin}/room/${code}`;
  const ownPlayer = room?.players.find((player) => player.id === room.ownPlayerId);
  const ownCharacter = room ? room.characters[room.ownPlayerId] : undefined;
  const isHost = Boolean(ownPlayer?.isHost);
  const alivePlayers = useMemo(() => room?.players.filter((player) => player.status === "alive") ?? [], [room?.players]);
  const connectedCount = room?.players.filter((player) => player.connected).length ?? 0;

  useEffect(() => {
    const nextSocket = io({ path: "/socket.io" });
    setSocket(nextSocket);
    nextSocket.on("bunker_room_updated", (nextRoom: PublicBunkerRoomState) => setRoom(nextRoom));
    nextSocket.on("connect", () => {
      const savedPlayerId = window.localStorage.getItem(`playerId:${code}`);
      const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;
      if (!savedPlayerId) {
        setIsRestoring(false);
        return;
      }
      nextSocket.emit("join_bunker_room", { code, name: "", hostKey, playerId: savedPlayerId }, (ack: Ack) => {
        if (ack.ok) {
          setJoined(true);
          setError("");
          clearRememberedRoom(code);
        } else {
          window.localStorage.removeItem(`playerId:${code}`);
        }
        setIsRestoring(false);
      });
    });
    return () => {
      nextSocket.disconnect();
    };
  }, [code]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [room?.chatMessages.length]);

  useEffect(() => {
    if (!room || room.phase === "GAME_OVER") return undefined;
    const handleBeforeUnload = () => rememberCurrentRoom(room);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [room]);

  function joinRoom() {
    const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;
    socket?.emit("join_bunker_room", { code, name, hostKey }, (ack: Ack) => {
      if (!ack.ok) {
        setError(ack.error ?? "Не удалось войти");
        return;
      }
      if (ack.playerId) window.localStorage.setItem(`playerId:${code}`, ack.playerId);
      window.localStorage.setItem(`playerName:${code}`, name.trim());
      clearRememberedRoom(code);
      setJoined(true);
      setError("");
    });
  }

  function emitAction(event: string, payload?: unknown, onOk?: () => void) {
    setError("");
    socket?.emit(event, payload ?? {}, (ack: Ack) => {
      if (!ack.ok) {
        setError(ack.error ?? "Действие не выполнено");
        return;
      }
      onOk?.();
    });
  }

  function updateSettings(patch: Partial<BunkerSettings>) {
    emitAction("bunker:update_settings", patch);
  }

  function sendMessage() {
    const text = message.trim();
    if (!text) return;
    emitAction("send_bunker_chat_message", { text }, () => setMessage(""));
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  function leaveRoom() {
    if (room) rememberCurrentRoom(room);
    router.push("/");
  }

  if (isRestoring) {
    return <AppShell><section className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center py-12 text-slate-600">Возвращаем вас в комнату Бункера...</section></AppShell>;
  }

  if (!joined) {
    return (
      <AppShell>
        <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-coral">Бункер · комната {code}</p>
          <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Вход в игру</h1>
          <p className="mt-4 text-slate-500">Введите никнейм, чтобы получить персонажа и место в обсуждении.</p>
          <input className="mt-8 rounded-md border border-line bg-white px-4 py-3 text-ink shadow-soft outline-none focus:border-coral" placeholder="Ваш никнейм" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && joinRoom()} />
          <Button className="mt-3" onClick={joinRoom} disabled={!socket || !name.trim()}>Войти</Button>
          {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
        </section>
      </AppShell>
    );
  }

  if (!room) return null;

  return (
    <AppShell onLogoClick={leaveRoom}>
      <section className="py-6">
        <div className="rounded-[2rem] border border-slate-700/30 bg-white/80 p-4 text-ink shadow-soft dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:p-6">
          <header className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/80">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600 dark:text-white/70">
                  <span className="tracking-[0.28em] text-coral">КОМНАТА {room.code}</span>
                  <span className="rounded-full border border-line px-3 py-1 dark:border-white/10">{connectedCount} / {room.settings.maxPlayers} игроков</span>
                  <span className="rounded-full border border-line px-3 py-1 dark:border-white/10">{room.visibility === "public" ? "Открытая" : "Закрытая"}</span>
                  <span className="rounded-full border border-line px-3 py-1 dark:border-white/10">{phaseLabels[room.phase]}</span>
                </div>
                <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">Бункер</h1>
                <p className="mt-2 max-w-2xl text-slate-600 dark:text-white/65">{getPhaseHint(room)}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="ghost" className="border-line bg-transparent text-ink hover:bg-slate-100 dark:border-white/15 dark:text-white" onClick={copyInvite}>{copied ? "Ссылка скопирована" : "Пригласить"}</Button>
                {room.phase === "LOBBY" && isHost ? <Button onClick={() => emitAction("bunker:start_game")}>Начать игру</Button> : null}
              </div>
            </div>
          </header>

          <nav className="mt-5 flex flex-wrap gap-2 rounded-[1.35rem] border border-line bg-white/85 p-2 dark:border-white/10 dark:bg-slate-900/70">
            {(["game", "players", "chat", "settings"] as Tab[]).map((item) => (
              <button key={item} className={`rounded-2xl px-5 py-3 font-bold ${tab === item ? "bg-coral text-white" : "text-slate-500 dark:text-white/60"}`} onClick={() => setTab(item)}>
                {item === "game" ? "Игра" : item === "players" ? "Игроки" : item === "chat" ? "Чат" : "Настройки"}
              </button>
            ))}
          </nav>
          {error ? <p className="mt-4 rounded-2xl border border-coral/30 bg-coral/10 p-3 text-sm text-coral">{error}</p> : null}

          {tab === "settings" ? <SettingsPanel room={room} isHost={isHost} updateSettings={updateSettings} /> : null}
          {tab === "chat" ? <ChatPanel room={room} message={message} setMessage={setMessage} sendMessage={sendMessage} chatEndRef={chatEndRef} /> : null}
          {tab === "players" ? <PlayersPanel room={room} /> : null}
          {tab === "game" ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.55fr)]">
              <MainGamePanel room={room} ownCharacter={ownCharacter} isHost={isHost} emitAction={emitAction} />
              <aside className="space-y-5">
                <OwnCharacterPanel room={room} character={ownCharacter} />
                <PlayersMini players={alivePlayers} />
              </aside>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

function MainGamePanel({ room, ownCharacter, isHost, emitAction }: { room: PublicBunkerRoomState; ownCharacter: PublicBunkerRoomState["characters"][string] | undefined; isHost: boolean; emitAction: (event: string, payload?: unknown) => void }) {
  const ownRevealed = new Set(ownCharacter?.revealedCategories ?? []);
  const canReady = ["SCENARIO_REVEAL", "CHARACTER_PREVIEW"].includes(room.phase);
  const currentCategory = room.currentRevealCategory;
  const revealOptions = room.settings.revealMode === "free_choice" ? bunkerCharacteristicCategories.filter((category) => !ownRevealed.has(category)) : currentCategory ? [currentCategory] : [];

  if (room.phase === "LOBBY") return <Panel title="Ожидаем игроков" label="Лобби"><p>Минимум 4 игрока. Хост может настроить режим, количество мест, таймеры, спецкарты и голосование.</p><Stats room={room} /></Panel>;
  if (room.phase === "SCENARIO_REVEAL") return <ScenarioPanel room={room} action={canReady ? () => emitAction("bunker:ready") : undefined} />;
  if (room.phase === "CHARACTER_PREVIEW") return <Panel title="Ваш персонаж" label="Ознакомление"><p>Посмотрите свои скрытые характеристики. Когда будете готовы, нажмите кнопку.</p><Button className="mt-5" onClick={() => emitAction("bunker:ready")}>Ознакомился</Button></Panel>;
  if (room.phase === "REVEAL_ROUND") return <Panel title={`Раунд ${room.currentRound}`} label="Раскрытие"><p>{room.settings.revealMode === "fixed_order" ? `Раскрывается категория: ${currentCategory ? bunkerCategoryLabels[currentCategory] : "любая"}.` : "Выберите характеристику, которую хотите раскрыть."}</p><div className="mt-4 flex flex-wrap gap-2">{revealOptions.map((category) => <Button key={category} disabled={ownRevealed.has(category)} onClick={() => emitAction("bunker:reveal_card", { category })}>Раскрыть {bunkerCategoryLabels[category]}</Button>)}</div>{isHost ? <Button variant="secondary" className="mt-3" onClick={() => emitAction("bunker:next_phase")}>К обсуждению</Button> : null}</Panel>;
  if (room.phase === "DISCUSSION") return <Panel title="Обсуждение" label="Аргументы"><p>Обсудите, кто будет полезен при катастрофе и условиях бункера. Используйте раскрытые характеристики.</p>{isHost ? <Button className="mt-5" onClick={() => emitAction("bunker:next_phase")}>{room.settings.useSpecialCards ? "К спецкартам" : "К голосованию"}</Button> : null}</Panel>;
  if (room.phase === "SPECIAL_ACTIONS") return <SpecialPanel room={room} ownCharacter={ownCharacter} emitAction={emitAction} />;
  if (room.phase === "VOTING" || room.phase === "REVOTE") return <VotingPanel room={room} emitAction={emitAction} isHost={isHost} />;
  if (room.phase === "VOTING_RESULT") return <VotingResultPanel room={room} isHost={isHost} emitAction={emitAction} />;
  if (room.phase === "GAME_OVER") return <GameOverPanel room={room} isHost={isHost} emitAction={emitAction} />;
  return <Panel title="Игра" label={phaseLabels[room.phase]}><p>Фаза в процессе.</p></Panel>;
}

function ScenarioPanel({ room, action }: { room: PublicBunkerRoomState; action?: () => void }) {
  return <Panel title={room.catastrophe?.title ?? "Катастрофа"} label="Сценарий"><p>{room.catastrophe?.fullDescription}</p><p className="mt-3 font-bold">Цель: {room.catastrophe?.survivalGoal}</p><div className="mt-5 rounded-2xl bg-slate-100/80 p-4 dark:bg-slate-950/50"><h3 className="font-display text-2xl font-semibold">{room.shelter?.title}</h3><p className="mt-2 text-sm text-slate-500 dark:text-white/60">{room.shelter?.description}</p><p className="mt-2 text-sm">Мест: {room.bunkerSlots} · Запасов: {room.shelter?.durationMonths} мес.</p><p className="mt-2 text-sm">Комнаты: {room.shelter?.rooms.join(", ")}</p><p className="mt-2 text-sm">Проблемы: {room.shelter?.problems.join(", ")}</p></div>{action ? <Button className="mt-5" onClick={action}>Продолжить</Button> : null}</Panel>;
}

function SpecialPanel({ room, ownCharacter, emitAction }: { room: PublicBunkerRoomState; ownCharacter: PublicBunkerRoomState["characters"][string] | undefined; emitAction: (event: string, payload?: unknown) => void }) {
  const cards = ownCharacter?.specialCards.filter((card) => !card.used) ?? [];
  return <Panel title="Специальные действия" label="Спецкарты">{cards.length === 0 ? <p>У вас нет доступных спецкарт.</p> : <div className="grid gap-3">{cards.map((card) => <article key={card.id} className="rounded-2xl border border-line bg-slate-100/80 p-3 dark:border-white/10 dark:bg-slate-950/50"><h3 className="font-bold">{card.title}</h3><p className="mt-1 text-sm text-slate-500 dark:text-white/60">{card.description}</p><Button className="mt-3" onClick={() => emitAction("bunker:use_special_card", { cardId: card.id })}>Использовать</Button></article>)}</div>}<Button variant="secondary" className="mt-4" onClick={() => emitAction("bunker:next_phase")}>Пропустить и голосовать</Button></Panel>;
}

function VotingPanel({ room, isHost, emitAction }: { room: PublicBunkerRoomState; isHost: boolean; emitAction: (event: string, payload?: unknown) => void }) {
  const candidates = room.phase === "REVOTE" && room.revoteCandidateIds?.length ? room.players.filter((player) => room.revoteCandidateIds?.includes(player.id)) : room.players.filter((player) => player.status === "alive");
  return <Panel title={room.phase === "REVOTE" ? "Переголосование" : "Голосование"} label="Выбор"><div className="grid gap-2 sm:grid-cols-2">{candidates.map((player) => <button key={player.id} className={`rounded-2xl border p-3 text-left font-bold transition hover:border-coral ${room.votes[room.ownPlayerId] === player.id ? "border-coral bg-coral/15" : "border-line bg-slate-100/80 dark:border-white/10 dark:bg-slate-950/50"}`} onClick={() => emitAction("bunker:cast_vote", { targetId: player.id })}>{player.name}<span className="block text-xs text-slate-400">{room.settings.votingMode === "open" ? `${Object.values(room.votes).filter((id) => id === player.id).length} голосов` : "анонимно"}</span></button>)}</div><p className="mt-3 text-sm text-slate-500">Ваш голос можно изменить до подсчета.</p>{isHost ? <Button className="mt-4" onClick={() => emitAction("bunker:next_phase")}>Подсчитать голоса</Button> : null}</Panel>;
}

function VotingResultPanel({ room, isHost, emitAction }: { room: PublicBunkerRoomState; isHost: boolean; emitAction: (event: string, payload?: unknown) => void }) {
  const eliminated = room.players.find((player) => player.id === room.lastVotingResult?.eliminatedPlayerId);
  return <Panel title="Результаты голосования" label="Итоги"><p>{eliminated ? `Исключен: ${eliminated.name}` : "Никто не исключен."}</p>{room.lastVotingResult?.tiedPlayerIds?.length ? <p className="mt-2">Была ничья: {room.lastVotingResult.tiedPlayerIds.map((id) => room.players.find((player) => player.id === id)?.name).join(", ")}</p> : null}<VoteList room={room} />{isHost ? <Button className="mt-5" onClick={() => emitAction("bunker:next_phase")}>Следующий раунд</Button> : null}</Panel>;
}

function GameOverPanel({ room, isHost, emitAction }: { room: PublicBunkerRoomState; isHost: boolean; emitAction: (event: string, payload?: unknown) => void }) {
  const winners = room.players.filter((player) => room.winnerPlayerIds?.includes(player.id));
  const eliminated = room.players.filter((player) => player.status === "eliminated");
  return <Panel title="Бункер закрыт" label="Финал"><h3 className="font-display text-2xl font-semibold">Выжившие</h3><div className="mt-3 grid gap-2">{winners.map((player) => <p key={player.id} className="rounded-2xl bg-emerald-500/10 p-3 font-bold">{player.name} — {cardTitle(room.characters[player.id]?.profession)}</p>)}</div><h3 className="mt-5 font-display text-2xl font-semibold">Исключенные</h3><p className="mt-2 text-slate-500">{eliminated.map((player) => player.name).join(", ") || "никого"}</p>{isHost ? <Button className="mt-5" onClick={() => emitAction("bunker:restart_game")}>Вернуться в лобби</Button> : null}</Panel>;
}

function OwnCharacterPanel({ room, character }: { room: PublicBunkerRoomState; character?: PublicBunkerRoomState["characters"][string] }) {
  if (!character) return <Panel title="Ваш персонаж" label="Скрыт"><p>Персонаж появится после старта игры.</p></Panel>;
  return <Panel title="Ваш персонаж" label="Карты"><div className="grid gap-2">{bunkerCharacteristicCategories.map((category) => <CardLine key={category} label={bunkerCategoryLabels[category]} card={character[category]} own revealed={character.revealedCategories.includes(category)} />)}</div>{character.specialCards.length ? <div className="mt-3 rounded-2xl bg-coral/10 p-3 text-sm"><b>Спецкарта:</b> {character.specialCards.map((card) => card.title).join(", ")}</div> : null}</Panel>;
}

function PlayersPanel({ room }: { room: PublicBunkerRoomState }) {
  return <section className="mt-5 grid gap-4 lg:grid-cols-2">{room.players.map((player) => <article key={player.id} className="rounded-[1.5rem] border border-line bg-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/70"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">{player.name}{player.isHost ? " · хост" : ""}</h2><span className={player.status === "alive" ? "text-mint" : "text-coral"}>{player.status === "alive" ? "жив" : "выбыл"}</span></div><p className={player.connected ? "text-sm text-emerald-400" : "text-sm text-coral"}>{player.connected ? "online" : "offline"}</p><div className="mt-4 grid gap-2">{bunkerCharacteristicCategories.map((category) => <CardLine key={category} label={bunkerCategoryLabels[category]} card={room.characters[player.id]?.[category]} />)}</div></article>)}</section>;
}

function ChatPanel({ room, message, setMessage, sendMessage, chatEndRef }: { room: PublicBunkerRoomState; message: string; setMessage: (value: string) => void; sendMessage: () => void; chatEndRef: React.RefObject<HTMLDivElement> }) {
  return <section className="mt-5 flex min-h-[34rem] flex-col rounded-[1.5rem] border border-line bg-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/70"><h2 className="font-display text-3xl font-semibold">Чат комнаты</h2><div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[1.25rem] bg-slate-100/80 p-4 dark:bg-slate-950/45">{room.chatMessages.map((item) => <article key={item.id} className="rounded-2xl bg-white p-3 text-slate-700 dark:bg-slate-900 dark:text-white/80"><p className="text-sm font-bold text-coral">{item.playerName}</p><p>{item.text}</p></article>)}<div ref={chatEndRef} /></div><div className="mt-4 flex gap-2"><input className="min-w-0 flex-1 rounded-2xl border border-line bg-slate-100/80 px-4 py-3 outline-none focus:border-coral dark:border-white/10 dark:bg-slate-950/70" placeholder="Написать сообщение..." value={message} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} /><Button onClick={sendMessage} disabled={!message.trim()}>Отпр.</Button></div></section>;
}

function SettingsPanel({ room, isHost, updateSettings }: { room: PublicBunkerRoomState; isHost: boolean; updateSettings: (patch: Partial<BunkerSettings>) => void }) {
  const disabled = !isHost || room.phase !== "LOBBY";
  const s = room.settings;
  return <section className="mt-5 rounded-[1.5rem] border border-line bg-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/70"><p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">Настройки</p><h2 className="mt-2 font-display text-3xl font-semibold">Правила Бункера</h2>{!isHost ? <p className="mt-2 text-sm text-slate-500">Менять настройки может только хост.</p> : null}<div className="mt-5 grid gap-4 lg:grid-cols-2"><Setting title="Режим"><Select disabled={disabled} value={s.gameMode} onChange={(value) => updateSettings({ gameMode: value as BunkerSettings["gameMode"] })}><option value="classic">Классический</option><option value="quick">Быстрый</option></Select><Select disabled={disabled} value={s.hostMode} onChange={(value) => updateSettings({ hostMode: value as BunkerSettings["hostMode"] })}><option value="auto">Без ведущего</option><option value="manual_host">Ведущий</option></Select></Setting><Setting title="Места и раунды"><Select disabled={disabled} value={s.bunkerSlots === "auto" ? "auto" : String(s.bunkerSlots)} onChange={(value) => updateSettings({ bunkerSlots: value === "auto" ? "auto" : Number(value) })}><option value="auto">Места авто</option>{[1,2,3,4,5,6,7,8].map((value) => <option key={value} value={value}>{value} мест</option>)}</Select><Select disabled={disabled} value={s.revealMode} onChange={(value) => updateSettings({ revealMode: value as BunkerSettings["revealMode"] })}><option value="fixed_order">По порядку</option><option value="free_choice">Свободный выбор</option></Select></Setting><Setting title="Таймеры"><Toggle disabled={disabled} checked={s.useTimer} onChange={(value) => updateSettings({ useTimer: value })}>Использовать таймер</Toggle><Select disabled={disabled} value={String(s.discussionTimeSec)} onChange={(value) => updateSettings({ discussionTimeSec: Number(value) })}>{[60,120,180,300].map((value) => <option key={value} value={value}>Обсуждение {value} сек</option>)}</Select><Select disabled={disabled} value={String(s.votingTimeSec)} onChange={(value) => updateSettings({ votingTimeSec: Number(value) })}>{[30,45,60,90,120].map((value) => <option key={value} value={value}>Голосование {value} сек</option>)}</Select></Setting><Setting title="Голосование"><Select disabled={disabled} value={s.votingMode} onChange={(value) => updateSettings({ votingMode: value as BunkerSettings["votingMode"] })}><option value="open">Публичное</option><option value="anonymous">Анонимное</option></Select><Select disabled={disabled} value={s.tieMode} onChange={(value) => updateSettings({ tieMode: value as BunkerSettings["tieMode"] })}><option value="revote">Переголосование</option><option value="no_elimination">Никто не выбывает</option><option value="random">Случайный вылет</option></Select><Toggle disabled={disabled} checked={s.allowSelfVote} onChange={(value) => updateSettings({ allowSelfVote: value })}>Можно голосовать за себя</Toggle></Setting><Setting title="Карты"><Toggle disabled={disabled} checked={s.useSpecialCards} onChange={(value) => updateSettings({ useSpecialCards: value })}>Спецкарты</Toggle><Toggle disabled={disabled} checked={s.revealProfessionAtStart} onChange={(value) => updateSettings({ revealProfessionAtStart: value })}>Профессия открыта сразу</Toggle><Toggle disabled={disabled} checked={s.showEliminatedCards} onChange={(value) => updateSettings({ showEliminatedCards: value })}>Показывать карты выбывших</Toggle></Setting><Setting title="Сценарий"><Select disabled={disabled} value={s.selectedCatastropheId ?? "random"} onChange={(value) => updateSettings({ catastropheMode: value === "random" ? "random" : "select", selectedCatastropheId: value === "random" ? undefined : value })}><option value="random">Катастрофа случайно</option>{bunkerCatastrophes.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select><Select disabled={disabled} value={s.selectedBunkerId ?? "random"} onChange={(value) => updateSettings({ bunkerMode: value === "random" ? "random" : "select", selectedBunkerId: value === "random" ? undefined : value })}><option value="random">Бункер случайно</option>{bunkerShelters.map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</Select></Setting></div></section>;
}

function Panel({ title, label, children }: { title: string; label: string; children: React.ReactNode }) { return <section className="rounded-[1.5rem] border border-line bg-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/70"><p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">{label}</p><h2 className="mt-2 font-display text-3xl font-semibold">{title}</h2><div className="mt-4 text-slate-600 dark:text-white/65">{children}</div></section>; }
function Setting({ title, children }: { title: string; children: React.ReactNode }) { return <div className="rounded-[1.25rem] border border-line bg-slate-100/80 p-4 dark:border-white/10 dark:bg-slate-950/45"><h3 className="mb-3 text-lg font-black">{title}</h3><div className="space-y-3">{children}</div></div>; }
function Select({ value, disabled, onChange, children }: { value: string; disabled: boolean; onChange: (value: string) => void; children: React.ReactNode }) { return <select className="w-full rounded-2xl border border-line bg-white px-4 py-3 font-bold text-ink dark:border-white/10 dark:bg-slate-900 dark:text-white" value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>{children}</select>; }
function Toggle({ checked, disabled, onChange, children }: { checked: boolean; disabled: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) { return <label className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3 font-bold dark:border-white/10 dark:bg-slate-900"><span>{children}</span><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /></label>; }
function CardLine({ label, card, revealed, own }: { label: string; card?: PublicBunkerCard; revealed?: boolean; own?: boolean }) { return <div className="flex justify-between gap-3 rounded-2xl bg-slate-100/80 p-3 text-sm dark:bg-slate-950/45"><span className="font-bold text-slate-500">{label}</span><span className="text-right font-semibold">{cardTitle(card)}{own && !revealed ? " 🔒" : ""}</span></div>; }
function cardTitle(card?: PublicBunkerCard) { return !card ? "-" : "hidden" in card ? "Скрыто" : card.title; }
function PlayersMini({ players }: { players: PublicBunkerRoomState["players"] }) { return <Panel title="Живые игроки" label="Состав"><div className="space-y-2">{players.map((player) => <p key={player.id} className="rounded-2xl bg-slate-100/80 p-3 font-bold dark:bg-slate-950/45">{player.name}</p>)}</div></Panel>; }
function Stats({ room }: { room: PublicBunkerRoomState }) { return <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-950/45">Мест: {room.settings.bunkerSlots === "auto" ? "авто" : room.settings.bunkerSlots}</div><div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-950/45">Режим: {room.settings.gameMode === "classic" ? "классика" : "быстрый"}</div><div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-950/45">Спецкарты: {room.settings.useSpecialCards ? "вкл" : "выкл"}</div></div>; }
function VoteList({ room }: { room: PublicBunkerRoomState }) { if (room.settings.votingMode === "anonymous") return <p className="mt-4 text-sm text-slate-500">Голосование было анонимным.</p>; return <div className="mt-4 space-y-2">{Object.entries(room.lastVotingResult?.votes ?? {}).map(([voterId, targetId]) => <p key={voterId} className="rounded-2xl bg-slate-100/80 p-3 text-sm dark:bg-slate-950/45">{room.players.find((p) => p.id === voterId)?.name} → {room.players.find((p) => p.id === targetId)?.name}</p>)}</div>; }
function getPhaseHint(room: PublicBunkerRoomState) { if (room.phase === "LOBBY") return "Настройте игру и пригласите друзей."; if (room.phase === "SCENARIO_REVEAL") return "Ознакомьтесь с катастрофой и бункером."; if (room.phase === "REVEAL_ROUND") return "Раскройте характеристику и готовьте аргументы."; if (room.phase === "DISCUSSION") return "Убедите остальных, что вы нужны группе."; if (room.phase === "VOTING" || room.phase === "REVOTE") return "Выберите, кого исключить из очереди в бункер."; if (room.phase === "GAME_OVER") return "Финальный состав выживших определен."; return "Следуйте текущему действию."; }
function rememberCurrentRoom(room: PublicBunkerRoomState) { window.localStorage.setItem(LAST_LEFT_ROOM_KEY, JSON.stringify({ code: room.code, gameId: room.gameId, phase: room.phase, visibility: room.visibility, leftAt: Date.now() })); }
function clearRememberedRoom(code: string) { const raw = window.localStorage.getItem(LAST_LEFT_ROOM_KEY); if (!raw) return; try { const remembered = JSON.parse(raw) as { code?: string }; if (remembered.code === code) window.localStorage.removeItem(LAST_LEFT_ROOM_KEY); } catch { window.localStorage.removeItem(LAST_LEFT_ROOM_KEY); } }
