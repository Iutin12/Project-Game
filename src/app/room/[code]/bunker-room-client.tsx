"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { bunkerCatastrophes } from "@/games/bunker/catastrophes";
import { bunkerShelters } from "@/games/bunker/shelters";
import { bunkerCategoryLabels, bunkerCharacteristicCategories } from "@/games/bunker/settings";
import type { BunkerCardCategory, BunkerSettings, BunkerSpecialCard, PublicBunkerCard, PublicBunkerRoomState } from "@/games/bunker/types";

const LAST_LEFT_ROOM_KEY = "project-game:last-left-room";
const bunkerCardImages: Record<BunkerCardCategory, string> = {
  profession: "/bunker-cards/profession.png",
  age: "/bunker-cards/age.png",
  gender: "/bunker-cards/gender.png",
  health: "/bunker-cards/health.png",
  biology: "/bunker-cards/biology.png",
  hobby: "/bunker-cards/hobby.png",
  phobia: "/bunker-cards/phobia.png",
  baggage: "/bunker-cards/baggage.png",
  skill: "/bunker-cards/skill.png",
  character: "/bunker-cards/character.png",
  fact: "/bunker-cards/fact.png",
  special: "/bunker-cards/special_reveal_extra.png"
};

const bunkerSpecialCardImages: Record<string, string> = {
  special_reveal_extra: "/bunker-cards/special_reveal_extra.png",
  special_hide_card: "/bunker-cards/special_hide_card.png",
  special_force_reveal: "/bunker-cards/special_force_reveal.png",
  special_swap_card: "/bunker-cards/special_swap_card.png",
  special_protect_vote: "/bunker-cards/special_protect_vote.png",
  special_revote: "/bunker-cards/special_revote.png",
  special_cancel_special: "/bunker-cards/special_cancel_special.png"
};

type Ack = { ok: boolean; error?: string; playerId?: string };
type Tab = "game" | "players" | "chat" | "settings";
type SelectOption = { value: string; label: string };

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
  const [seenChatCount, setSeenChatCount] = useState(0);
  const [unreadAnchorId, setUnreadAnchorId] = useState<string | null>(null);
  const [keepUnreadDivider, setKeepUnreadDivider] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement | null>(null);
  const previousChatCountRef = useRef(0);

  const inviteUrl = typeof window === "undefined" ? "" : `${window.location.origin}/room/${code}`;
  const ownPlayer = room?.players.find((player) => player.id === room.ownPlayerId);
  const ownCharacter = room ? room.characters[room.ownPlayerId] : undefined;
  const isHost = Boolean(ownPlayer?.isHost);
  const alivePlayers = useMemo(() => room?.players.filter((player) => player.status === "alive") ?? [], [room?.players]);
  const connectedCount = room?.players.filter((player) => player.connected).length ?? 0;
  const unreadChatCount = Math.max(0, (room?.chatMessages.length ?? 0) - seenChatCount);
  const useBunkerBoard = tab === "game" && room && room.phase !== "LOBBY" && room.phase !== "GAME_OVER";

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
    const chatCount = room?.chatMessages.length ?? 0;
    const previousCount = previousChatCountRef.current;

    if (chatCount > previousCount && !unreadAnchorId) {
      setUnreadAnchorId(room?.chatMessages[previousCount]?.id ?? null);
      setKeepUnreadDivider(true);
    }

    if (tab === "chat") {
      requestAnimationFrame(() => {
        const chatScroll = chatScrollRef.current;
        if (!chatScroll) return;
        const isNearBottom = chatScroll.scrollHeight - chatScroll.scrollTop - chatScroll.clientHeight < 120;
        if (isNearBottom || chatCount > previousCount) chatScroll.scrollTo({ top: chatScroll.scrollHeight, behavior: "smooth" });
      });
    }

    previousChatCountRef.current = chatCount;
  }, [room?.chatMessages, tab, unreadAnchorId]);

  useEffect(() => {
    if (tab !== "chat" || !room) return undefined;
    const chatScroll = chatScrollRef.current;
    const markSeenIfBottom = () => {
      const current = chatScrollRef.current;
      if (!current) return;
      const isAtBottom = current.scrollHeight - current.scrollTop - current.clientHeight < 8;
      if (!isAtBottom) return;
      setSeenChatCount(room?.chatMessages.length ?? 0);
      setUnreadAnchorId(null);
      setKeepUnreadDivider(false);
    };
    chatScroll?.addEventListener("scroll", markSeenIfBottom);
    const timer = window.setTimeout(markSeenIfBottom, keepUnreadDivider ? 1800 : 0);
    return () => {
      chatScroll?.removeEventListener("scroll", markSeenIfBottom);
      window.clearTimeout(timer);
    };
  }, [room, tab, keepUnreadDivider]);

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
      <section className={useBunkerBoard ? "py-2" : "py-6"}>
        <div className={useBunkerBoard ? "rounded-[1.5rem] border border-line bg-white/80 p-2 text-ink shadow-soft dark:border-slate-700 dark:bg-slate-950 dark:text-white" : "rounded-[2rem] border border-line bg-white/80 p-4 text-ink shadow-soft dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:p-6"}>
          {!useBunkerBoard ? <header className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/80">
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
          </header> : null}

          <nav className={useBunkerBoard ? "flex flex-wrap gap-2 rounded-[1.1rem] border border-line bg-white/85 p-1.5 dark:border-white/10 dark:bg-slate-900/70" : "mt-5 flex flex-wrap gap-2 rounded-[1.35rem] border border-line bg-white/85 p-2 dark:border-white/10 dark:bg-slate-900/70"}>
            {(["game", "players", "chat", "settings"] as Tab[]).map((item) => (
              <button key={item} className={`relative rounded-2xl font-bold ${useBunkerBoard ? "px-4 py-2 text-sm" : "px-5 py-3"} ${tab === item ? "bg-coral text-white" : "text-slate-500 dark:text-white/60"}`} onClick={() => setTab(item)}>
                {item === "game" ? "Игра" : item === "players" ? "Игроки" : item === "chat" ? "Чат" : "Настройки"}
                {item === "chat" && unreadChatCount > 0 ? <span className="ml-2 rounded-full bg-ocean px-2 py-0.5 text-xs text-white">{unreadChatCount}</span> : null}
              </button>
            ))}
          </nav>
          {error ? <p className="mt-4 rounded-2xl border border-coral/30 bg-coral/10 p-3 text-sm text-coral">{error}</p> : null}

          {tab === "settings" ? <SettingsPanel room={room} isHost={isHost} updateSettings={(patch) => emitAction("bunker:update_settings", patch)} /> : null}
          {tab === "chat" ? <ChatPanel room={room} message={message} setMessage={setMessage} sendMessage={sendMessage} chatScrollRef={chatScrollRef} unreadAnchorId={unreadAnchorId} /> : null}
          {tab === "players" ? <PlayersPanel room={room} /> : null}
          {tab === "game" && useBunkerBoard ? (
            <BunkerBoard room={room} ownCharacter={ownCharacter} isHost={isHost} emitAction={emitAction} />
          ) : null}
          {tab === "game" && !useBunkerBoard ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(22rem,0.55fr)]">
              <MainGamePanel room={room} ownCharacter={ownCharacter} isHost={isHost} emitAction={emitAction} />
              <aside className="space-y-5">
                <OwnCharacterPanel room={room} character={ownCharacter} />
                {room.catastrophe && room.shelter ? <ScenarioSummaryPanel room={room} /> : null}
                {room.phase !== "LOBBY" && room.phase !== "GAME_OVER" ? <QuickSpecialCardsPanel character={ownCharacter} emitAction={emitAction} /> : null}
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
  const currentCategory = room.currentRevealCategory;
  const revealOptions = bunkerCharacteristicCategories.filter((category) => !ownRevealed.has(category) && room.settings.enabledCardCategories.includes(category));
  const alreadyRevealedThisRound = room.revealedThisRoundPlayerIds.includes(room.ownPlayerId);

  if (room.phase === "LOBBY") return <Panel title="Ожидаем игроков" label="Лобби"><p>Минимум 4 игрока. Хост может настроить режим, количество мест, таймеры, спецкарты и голосование.</p><Stats room={room} /></Panel>;
  if (room.phase === "SCENARIO_REVEAL") return <ScenarioPanel room={room} onReady={() => emitAction("bunker:ready")} />;
  if (room.phase === "CHARACTER_PREVIEW") return <ReadyPanel room={room} title="Ваш персонаж" text="Посмотрите свои скрытые характеристики. Когда будете готовы, нажмите кнопку." onReady={() => emitAction("bunker:ready")} />;
  if (room.phase === "REVEAL_ROUND") return (
    <Panel title={`Раунд ${room.currentRound}`} label="Раскрытие">
      <p>Выберите одну характеристику, которую хотите раскрыть в этом раунде. Подсказка раунда: {currentCategory ? bunkerCategoryLabels[currentCategory] : "любая карта"}.</p>
      {alreadyRevealedThisRound ? <p className="mt-3 rounded-2xl bg-mint/10 p-3 text-sm font-bold text-mint">Вы уже раскрыли характеристику в этом раунде.</p> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {revealOptions.map((category) => (
          <button
            key={category}
            disabled={alreadyRevealedThisRound || ownRevealed.has(category)}
            className="flex items-center gap-3 rounded-2xl border border-line bg-slate-100/80 p-3 text-left font-bold transition hover:border-coral disabled:cursor-not-allowed disabled:opacity-45 dark:border-white/10 dark:bg-slate-950/45"
            onClick={() => emitAction("bunker:reveal_card", { category })}
          >
            <img src={bunkerCardImages[category]} alt="" className="h-20 w-10 rounded-md object-cover shadow-sm" />
            <span>Раскрыть {bunkerCategoryLabels[category]}</span>
          </button>
        ))}
      </div>
      {isHost ? <Button variant="secondary" className="mt-3" onClick={() => emitAction("bunker:next_phase")}>К обсуждению</Button> : null}
    </Panel>
  );
  if (room.phase === "DISCUSSION") return <Panel title="Обсуждение" label="Аргументы"><p>Обсудите, кто будет полезен при катастрофе и условиях бункера. Используйте раскрытые характеристики.</p>{room.settings.useTimer ? (isHost ? <Button className="mt-5" onClick={() => emitAction("bunker:next_phase")}>К голосованию</Button> : null) : <ReadyFooter room={room} onReady={() => emitAction("bunker:ready")} actionLabel="Перейти к голосованию" readyLabel="Готов к голосованию" />}</Panel>;
  if (room.phase === "SPECIAL_ACTIONS") return <SpecialPanel room={room} ownCharacter={ownCharacter} emitAction={emitAction} />;
  if (room.phase === "VOTING" || room.phase === "REVOTE") return <VotingPanel room={room} emitAction={emitAction} isHost={isHost} />;
  if (room.phase === "VOTING_RESULT") return <VotingResultPanel room={room} isHost={isHost} emitAction={emitAction} />;
  if (room.phase === "GAME_OVER") return <GameOverPanel room={room} isHost={isHost} emitAction={emitAction} />;
  return <Panel title="Игра" label={phaseLabels[room.phase]}><p>Фаза в процессе.</p></Panel>;
}

function BunkerBoard({
  room,
  ownCharacter,
  isHost,
  emitAction
}: {
  room: PublicBunkerRoomState;
  ownCharacter: PublicBunkerRoomState["characters"][string] | undefined;
  isHost: boolean;
  emitAction: (event: string, payload?: unknown) => void;
}) {
  const phaseAction = getBoardPhaseAction(room, isHost, emitAction);

  return (
    <section className="mt-2 overflow-hidden rounded-[1.55rem] border border-[#2c3845] bg-[#070d13] p-2 text-[#ede8dd] shadow-[0_24px_90px_rgba(0,0,0,0.34)] xl:h-[calc(100vh-7rem)] xl:min-h-[44rem]">
      <div className="grid h-full gap-0 overflow-hidden rounded-[1.25rem] border border-white/10 bg-[radial-gradient(circle_at_10%_0%,rgba(255,99,92,0.16),transparent_32%),linear-gradient(135deg,#101923,#071018)] lg:grid-cols-[0.95fr_1.05fr]">
        <div className="min-h-0 overflow-hidden border-b border-white/10 p-4 sm:p-5 lg:border-b-0 lg:border-r">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.28em] text-coral">Сценарий</p>
          <h2 className="mt-2 font-display text-3xl font-semibold leading-none text-[#f4eee3] sm:text-4xl">{room.catastrophe?.title ?? "Катастрофа"}</h2>
          <p className="mt-4 max-h-28 max-w-2xl overflow-y-auto pr-2 text-sm leading-7 text-white/68">{room.catastrophe?.fullDescription}</p>
          <p className="mt-4 flex items-start gap-3 text-base font-bold text-[#f4eee3]">
            <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-coral text-coral">⌖</span>
            <span>Цель: <span className="font-medium text-white/72">{room.catastrophe?.survivalGoal}</span></span>
          </p>

          <article className="mt-5 overflow-hidden rounded-[1.15rem] border border-white/18 bg-[#0d151d] shadow-soft">
            <div className="relative min-h-[20rem] p-4 pb-6 sm:p-5 sm:pb-6">
              <img src="/bunker-cards/shelter-scene.png" alt="" className="absolute inset-0 h-full w-full object-cover opacity-52" />
              <div className="absolute inset-0 bg-gradient-to-r from-[#0d151d]/96 via-[#0d151d]/78 to-[#0d151d]/18" />
              <div className="relative max-w-[34rem]">
                <h3 className="font-display text-3xl font-semibold text-[#f4eee3]">{room.shelter?.title ?? "Бункер"}</h3>
                <p className="mt-3 text-base leading-7 text-white/72">{room.shelter?.description}</p>
                <div className="mt-4 h-px bg-white/20" />
                <div className="mt-4 space-y-2 text-base leading-6 text-white/72">
                  <p><span className="mr-3 text-coral">▣</span>Мест: {room.bunkerSlots} · Запасов: {room.shelter?.durationMonths} мес.</p>
                  <p className="line-clamp-1"><span className="mr-3 text-coral">⌂</span>Комнаты: {room.shelter?.rooms.join(", ")}</p>
                  <p className="line-clamp-1"><span className="mr-3 text-coral">△</span>Проблемы: {room.shelter?.problems.join(", ")}</p>
                </div>
              </div>
            </div>
          </article>

          <div className="mt-4">{phaseAction}</div>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden p-4 sm:p-5">
          <p className="text-[0.65rem] font-black uppercase tracking-[0.28em] text-coral">Карты</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-[#f4eee3]">Ваш персонаж</h2>
          <FeaturedProfessionCard character={ownCharacter} />
          <BoardCharacterCards character={ownCharacter} />
        </div>
      </div>
    </section>
  );
}

function getBoardPhaseAction(room: PublicBunkerRoomState, isHost: boolean, emitAction: (event: string, payload?: unknown) => void) {
  if (room.phase === "SCENARIO_REVEAL") return <BoardReadyFooter room={room} onReady={() => emitAction("bunker:ready")} />;
  if (room.phase === "CHARACTER_PREVIEW") return <BoardReadyFooter room={room} onReady={() => emitAction("bunker:ready")} actionLabel="Ознакомился" readyLabel="Ознакомление отмечено" />;
  if (room.phase === "REVEAL_ROUND") return <BoardRevealAction room={room} emitAction={emitAction} isHost={isHost} />;
  if (room.phase === "DISCUSSION") {
    if (room.settings.useTimer) return isHost ? <Button onClick={() => emitAction("bunker:next_phase")}>К голосованию</Button> : <p className="text-sm text-white/60">Идет обсуждение. Используйте раскрытые карты как аргументы.</p>;
    return <BoardReadyFooter room={room} onReady={() => emitAction("bunker:ready")} actionLabel="Перейти к голосованию" readyLabel="Готов к голосованию" />;
  }
  if (room.phase === "VOTING" || room.phase === "REVOTE") return <VotingPanel room={room} emitAction={emitAction} isHost={isHost} />;
  if (room.phase === "VOTING_RESULT") return <VotingResultPanel room={room} isHost={isHost} emitAction={emitAction} />;
  if (room.phase === "SPECIAL_ACTIONS") return <SpecialPanel room={room} ownCharacter={room.characters[room.ownPlayerId]} emitAction={emitAction} />;
  return <p className="text-sm text-white/60">{getPhaseHint(room)}</p>;
}

function BoardReadyFooter({
  room,
  onReady,
  actionLabel = "Я готов",
  readyLabel = "Готовность отмечена"
}: {
  room: PublicBunkerRoomState;
  onReady: () => void;
  actionLabel?: string;
  readyLabel?: string;
}) {
  const aliveCount = room.players.filter((player) => player.status === "alive").length;
  const isReady = room.readyPlayerIds.includes(room.ownPlayerId);
  return (
    <div className="flex flex-wrap gap-3">
      <button
        type="button"
        disabled={isReady}
        className="relative inline-flex h-16 min-w-72 items-center justify-center gap-3 overflow-hidden rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-[#f4eee3] shadow-[0_0_30px_rgba(255,99,92,0.16)] transition hover:scale-[1.01] disabled:opacity-75"
        onClick={onReady}
      >
        <img src="/bunker-cards/ready-button-red.png" alt="" className="absolute inset-0 h-full w-full object-fill" />
        <span className="relative inline-flex h-9 w-9 items-center justify-center">
          <img src="/bunker-cards/ready-check.png" alt="" className="h-9 w-9 rounded-full object-cover" />
        </span>
        <span className="relative whitespace-nowrap">{isReady ? readyLabel : actionLabel}</span>
      </button>
      <div className="relative inline-flex h-16 min-w-56 items-center justify-center gap-3 overflow-hidden rounded-2xl px-5 py-4 text-sm font-black uppercase tracking-[0.12em] text-white/76">
        <img src="/bunker-cards/ready-counter-blue.png" alt="" className="absolute inset-0 h-full w-full object-fill" />
        <img src="/bunker-cards/ready-players.png" alt="" className="relative h-9 w-12 object-cover object-center mix-blend-screen" />
        <span className="relative">Готовы: {room.readyPlayerIds.length} / {aliveCount}</span>
      </div>
    </div>
  );
}

function BoardRevealAction({ room, emitAction, isHost }: { room: PublicBunkerRoomState; emitAction: (event: string, payload?: unknown) => void; isHost: boolean }) {
  const ownCharacter = room.characters[room.ownPlayerId];
  const ownRevealed = new Set(ownCharacter?.revealedCategories ?? []);
  const alreadyRevealedThisRound = room.revealedThisRoundPlayerIds.includes(room.ownPlayerId);
  const revealOptions = bunkerCharacteristicCategories.filter((category) => !ownRevealed.has(category) && room.settings.enabledCardCategories.includes(category));
  return (
    <div>
      <p className="text-sm leading-6 text-white/65">Раунд {room.currentRound}: выберите одну характеристику, которую хотите раскрыть группе.</p>
      {alreadyRevealedThisRound ? <p className="mt-3 rounded-2xl border border-mint/30 bg-mint/10 p-3 text-sm font-bold text-mint">Вы уже раскрыли характеристику в этом раунде.</p> : null}
      <div className="mt-4 flex gap-3 overflow-x-auto pb-2">
        {revealOptions.map((category) => (
          <button
            key={category}
            disabled={alreadyRevealedThisRound}
            className="min-w-36 rounded-2xl border border-white/14 bg-white/5 p-3 text-left text-sm font-black text-white/80 transition hover:border-coral hover:bg-coral/10 disabled:cursor-not-allowed disabled:opacity-45"
            onClick={() => emitAction("bunker:reveal_card", { category })}
          >
            <img src={bunkerCardImages[category]} alt="" className="mb-2 h-24 w-full rounded-xl object-cover object-top" />
            {bunkerCategoryLabels[category]}
          </button>
        ))}
      </div>
      {isHost ? <Button variant="secondary" className="mt-3" onClick={() => emitAction("bunker:next_phase")}>К обсуждению</Button> : null}
    </div>
  );
}

function ScenarioPanel({ room, onReady }: { room: PublicBunkerRoomState; onReady: () => void }) {
  return (
    <Panel title={room.catastrophe?.title ?? "Катастрофа"} label="Сценарий">
      <p>{room.catastrophe?.fullDescription}</p>
      <p className="mt-3 font-bold">Цель: {room.catastrophe?.survivalGoal}</p>
      <div className="mt-5 rounded-2xl bg-slate-100/80 p-4 dark:bg-slate-950/50">
        <h3 className="font-display text-2xl font-semibold">{room.shelter?.title}</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-white/60">{room.shelter?.description}</p>
        <p className="mt-2 text-sm">Мест: {room.bunkerSlots} · Запасов: {room.shelter?.durationMonths} мес.</p>
        <p className="mt-2 text-sm">Комнаты: {room.shelter?.rooms.join(", ")}</p>
        <p className="mt-2 text-sm">Проблемы: {room.shelter?.problems.join(", ")}</p>
      </div>
      <ReadyFooter room={room} onReady={onReady} />
    </Panel>
  );
}

function ReadyPanel({ room, title, text, onReady }: { room: PublicBunkerRoomState; title: string; text: string; onReady: () => void }) {
  return <Panel title={title} label="Готовность"><p>{text}</p><ReadyFooter room={room} onReady={onReady} /></Panel>;
}

function ReadyFooter({
  room,
  onReady,
  actionLabel = "Я готов",
  readyLabel = "Готовность отмечена"
}: {
  room: PublicBunkerRoomState;
  onReady: () => void;
  actionLabel?: string;
  readyLabel?: string;
}) {
  const aliveCount = room.players.filter((player) => player.status === "alive").length;
  const isReady = room.readyPlayerIds.includes(room.ownPlayerId);
  return (
    <div className="mt-5 flex flex-wrap items-center gap-3">
      <Button onClick={onReady} disabled={isReady}>{isReady ? readyLabel : actionLabel}</Button>
      <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 dark:bg-slate-950/50 dark:text-white/60">
        Готовы: {room.readyPlayerIds.length} / {aliveCount}
      </span>
    </div>
  );
}

function SpecialPanel({ room, ownCharacter, emitAction }: { room: PublicBunkerRoomState; ownCharacter: PublicBunkerRoomState["characters"][string] | undefined; emitAction: (event: string, payload?: unknown) => void }) {
  const cards = ownCharacter?.specialCards.filter((card) => !card.used) ?? [];
  return <Panel title="Специальные действия" label="Спецкарты">{cards.length === 0 ? <p>У вас нет доступных спецкарт.</p> : <div className="grid gap-3">{cards.map((card) => <SpecialCardAction key={card.id} card={card} onUse={() => emitAction("bunker:use_special_card", { cardId: card.id })} />)}</div>}<Button variant="secondary" className="mt-4" onClick={() => emitAction("bunker:next_phase")}>Пропустить и голосовать</Button></Panel>;
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
  return (
    <Panel title="Ваш персонаж" label="Колода">
      <CharacterDeck character={character} own />
      {character.specialCards.length ? (
        <div className="mt-5">
          <p className="mb-3 text-sm font-black uppercase tracking-[0.18em] text-coral">Спецкарты</p>
          <div className="flex gap-3 overflow-x-auto pb-2">
            {character.specialCards.map((card) => <SpecialCardPreview key={card.id} card={card} />)}
          </div>
        </div>
      ) : null}
    </Panel>
  );
}

function QuickSpecialCardsPanel({
  character,
  emitAction
}: {
  character?: PublicBunkerRoomState["characters"][string];
  emitAction: (event: string, payload?: unknown) => void;
}) {
  const cards = character?.specialCards.filter((card) => !card.used) ?? [];
  if (cards.length === 0) return null;

  return (
    <Panel title="Спецкарты" label="Быстрое действие">
      <p className="text-sm">Можно применить в подходящий момент игры отдельной кнопкой.</p>
      <div className="mt-3 space-y-2">
        {cards.map((card) => (
          <SpecialCardAction key={card.id} card={card} compact onUse={() => emitAction("bunker:use_special_card", { cardId: card.id })} />
        ))}
      </div>
    </Panel>
  );
}

function ScenarioSummaryPanel({ room }: { room: PublicBunkerRoomState }) {
  return (
    <Panel title="Сценарий" label="Памятка">
      <details className="rounded-2xl border border-line bg-slate-100/80 p-3 dark:border-white/10 dark:bg-slate-950/45" open>
        <summary className="cursor-pointer font-bold text-ink dark:text-white">{room.catastrophe?.title}</summary>
        <p className="mt-2 text-sm leading-6">{room.catastrophe?.fullDescription}</p>
        <p className="mt-2 text-sm font-bold">Цель: {room.catastrophe?.survivalGoal}</p>
      </details>
      <details className="mt-3 rounded-2xl border border-line bg-slate-100/80 p-3 dark:border-white/10 dark:bg-slate-950/45">
        <summary className="cursor-pointer font-bold text-ink dark:text-white">{room.shelter?.title}</summary>
        <p className="mt-2 text-sm leading-6">{room.shelter?.description}</p>
        <p className="mt-2 text-sm">Мест: {room.bunkerSlots} · Запасов: {room.shelter?.durationMonths} мес.</p>
        <p className="mt-2 text-sm">Комнаты: {room.shelter?.rooms.join(", ")}</p>
        <p className="mt-2 text-sm">Ресурсы: {room.shelter?.resources.join(", ")}</p>
        <p className="mt-2 text-sm">Проблемы: {room.shelter?.problems.join(", ")}</p>
        <p className="mt-2 text-sm">Плюсы: {room.shelter?.bonuses.join(", ")}</p>
      </details>
    </Panel>
  );
}

function PlayersPanel({ room }: { room: PublicBunkerRoomState }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const players = room.players;
  const activePlayer = players[Math.min(activeIndex, players.length - 1)];

  useEffect(() => {
    if (activeIndex >= players.length) setActiveIndex(Math.max(0, players.length - 1));
  }, [activeIndex, players.length]);

  if (!activePlayer) return null;

  return (
    <section className="mt-5 rounded-[1.5rem] border border-line bg-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">Игроки</p>
          <h2 className="mt-1 font-display text-3xl font-semibold">Карточки игроков</h2>
        </div>
        <div className="flex items-center gap-2">
          <button className="h-11 w-11 rounded-full border border-line font-black dark:border-white/10" onClick={() => setActiveIndex((value) => (value - 1 + players.length) % players.length)}>‹</button>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-bold text-slate-500 dark:bg-slate-950/50 dark:text-white/60">{activeIndex + 1} / {players.length}</span>
          <button className="h-11 w-11 rounded-full border border-line font-black dark:border-white/10" onClick={() => setActiveIndex((value) => (value + 1) % players.length)}>›</button>
        </div>
      </div>
      <div className="mt-5 overflow-hidden">
        <div className="flex gap-3 overflow-x-auto pb-2">
          {players.map((player, index) => (
            <button key={player.id} className={`min-w-40 rounded-2xl border p-3 text-left transition ${index === activeIndex ? "border-coral bg-coral/10" : "border-line bg-slate-100/70 dark:border-white/10 dark:bg-slate-950/35"}`} onClick={() => setActiveIndex(index)}>
              <p className="truncate font-bold">{player.name}</p>
              <p className={player.status === "alive" ? "text-xs text-mint" : "text-xs text-coral"}>{player.status === "alive" ? "жив" : "выбыл"}</p>
            </button>
          ))}
        </div>
      </div>
      <article className="mt-4 rounded-[1.25rem] border border-line bg-slate-100/80 p-4 dark:border-white/10 dark:bg-slate-950/45">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-display text-3xl font-semibold">{activePlayer.name}{activePlayer.isHost ? " · хост" : ""}</h3>
          <span className={activePlayer.connected ? "text-sm font-bold text-mint" : "text-sm font-bold text-coral"}>{activePlayer.connected ? "online" : "offline"}</span>
        </div>
        <CharacterDeck character={room.characters[activePlayer.id]} className="mt-4" />
      </article>
    </section>
  );
}

function ChatPanel({
  room,
  message,
  setMessage,
  sendMessage,
  chatScrollRef,
  unreadAnchorId
}: {
  room: PublicBunkerRoomState;
  message: string;
  setMessage: (value: string) => void;
  sendMessage: () => void;
  chatScrollRef: React.RefObject<HTMLDivElement>;
  unreadAnchorId: string | null;
}) {
  return (
    <section className="mt-5 flex h-[34rem] min-h-0 flex-col rounded-[1.5rem] border border-line bg-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/70">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl font-semibold">Чат комнаты</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-500 dark:bg-slate-950/50 dark:text-white/60">
          {room.chatMessages.length}
        </span>
      </div>
      <div ref={chatScrollRef} className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[1.25rem] bg-slate-100/80 p-4 dark:bg-slate-950/45">
        {room.chatMessages.length === 0 ? <p className="text-slate-400">Пока нет сообщений.</p> : null}
        {room.chatMessages.map((item) => (
          <div key={item.id}>
            {unreadAnchorId === item.id ? (
              <div className="my-3 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-coral">
                <span className="h-px flex-1 bg-coral/30" />
                Новые сообщения
                <span className="h-px flex-1 bg-coral/30" />
              </div>
            ) : null}
            <article className="rounded-2xl bg-white p-3 text-slate-700 dark:bg-slate-900 dark:text-white/80">
              <p className="text-sm font-bold text-coral">{item.playerName}</p>
              <p>{item.text}</p>
            </article>
          </div>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-2xl border border-line bg-slate-100/80 px-4 py-3 outline-none focus:border-coral dark:border-white/10 dark:bg-slate-950/70"
          placeholder="Написать сообщение..."
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && sendMessage()}
        />
        <Button onClick={sendMessage} disabled={!message.trim()}>Отправить</Button>
      </div>
    </section>
  );
}

function SettingsPanel({ room, isHost, updateSettings }: { room: PublicBunkerRoomState; isHost: boolean; updateSettings: (patch: Partial<BunkerSettings>) => void }) {
  const disabled = !isHost || room.phase !== "LOBBY";
  const s = room.settings;
  return (
    <section className="mt-5 rounded-[1.5rem] border border-line bg-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/70">
      <p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">Настройки</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Правила Бункера</h2>
      {!isHost ? <p className="mt-2 text-sm text-slate-500">Менять настройки может только хост.</p> : null}
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <Setting title="Режим" hint="Классический режим раскрывает больше характеристик. Быстрый режим делает партии короче.">
          <CustomSelect disabled={disabled} value={s.gameMode} options={[{ value: "classic", label: "Классический" }, { value: "quick", label: "Быстрый" }]} onChange={(value) => updateSettings({ gameMode: value as BunkerSettings["gameMode"] })} />
          <CustomSelect disabled={disabled} value={s.hostMode} options={[{ value: "auto", label: "Без ведущего" }, { value: "manual_host", label: "Ведущий" }]} onChange={(value) => updateSettings({ hostMode: value as BunkerSettings["hostMode"] })} />
        </Setting>
        <Setting title="Места и раунды" hint="Авто-режим берет примерно половину игроков. Режим раскрытия определяет, что игроки открывают в раунде.">
          <CustomSelect disabled={disabled} value={s.bunkerSlots === "auto" ? "auto" : String(s.bunkerSlots)} options={[{ value: "auto", label: "Места авто" }, ...[1, 2, 3, 4, 5, 6, 7, 8].map((value) => ({ value: String(value), label: `${value} мест` }))]} onChange={(value) => updateSettings({ bunkerSlots: value === "auto" ? "auto" : Number(value) })} />
          <CustomSelect disabled={disabled} value={s.revealMode} options={[{ value: "fixed_order", label: "По порядку" }, { value: "free_choice", label: "Свободный выбор" }]} onChange={(value) => updateSettings({ revealMode: value as BunkerSettings["revealMode"] })} />
        </Setting>
        <Setting title="Таймеры" hint="Если таймер включен, обсуждение и голосование ограничены временем. Хост все равно может перевести фазу вручную.">
          <Toggle disabled={disabled} checked={s.useTimer} onChange={(value) => updateSettings({ useTimer: value })}>Использовать таймер</Toggle>
          <CustomSelect disabled={disabled} value={String(s.discussionTimeSec)} options={[60, 120, 180, 300].map((value) => ({ value: String(value), label: `Обсуждение ${value} сек` }))} onChange={(value) => updateSettings({ discussionTimeSec: Number(value) })} />
          <CustomSelect disabled={disabled} value={String(s.votingTimeSec)} options={[30, 45, 60, 90, 120].map((value) => ({ value: String(value), label: `Голосование ${value} сек` }))} onChange={(value) => updateSettings({ votingTimeSec: Number(value) })} />
        </Setting>
        <Setting title="Голосование" hint="Публичное голосование показывает, кто за кого голосует. При ничьей можно запустить переголосование, оставить всех или выбрать случайного кандидата.">
          <CustomSelect disabled={disabled} value={s.votingMode} options={[{ value: "open", label: "Публичное" }, { value: "anonymous", label: "Анонимное" }]} onChange={(value) => updateSettings({ votingMode: value as BunkerSettings["votingMode"] })} />
          <CustomSelect disabled={disabled} value={s.tieMode} options={[{ value: "revote", label: "Переголосование" }, { value: "no_elimination", label: "Никто не выбывает" }, { value: "random", label: "Случайный вылет" }]} onChange={(value) => updateSettings({ tieMode: value as BunkerSettings["tieMode"] })} />
          <Toggle disabled={disabled} checked={s.allowSelfVote} onChange={(value) => updateSettings({ allowSelfVote: value })}>Можно голосовать за себя</Toggle>
        </Setting>
        <Setting title="Карты" hint="Спецкарты добавляют разовые действия. Раскрытие профессии на старте помогает быстрее начать обсуждение.">
          <Toggle disabled={disabled} checked={s.useSpecialCards} onChange={(value) => updateSettings({ useSpecialCards: value })}>Спецкарты</Toggle>
          <Toggle disabled={disabled} checked={s.revealProfessionAtStart} onChange={(value) => updateSettings({ revealProfessionAtStart: value })}>Профессия открыта сразу</Toggle>
          <Toggle disabled={disabled} checked={s.showEliminatedCards} onChange={(value) => updateSettings({ showEliminatedCards: value })}>Показывать карты выбывших</Toggle>
        </Setting>
        <Setting title="Сценарий" hint="Можно оставить случайный сценарий или заранее выбрать катастрофу и тип убежища.">
          <CustomSelect disabled={disabled} value={s.selectedCatastropheId ?? "random"} options={[{ value: "random", label: "Катастрофа случайно" }, ...bunkerCatastrophes.map((item) => ({ value: item.id, label: item.title }))]} onChange={(value) => updateSettings({ catastropheMode: value === "random" ? "random" : "select", selectedCatastropheId: value === "random" ? undefined : value })} />
          <CustomSelect disabled={disabled} value={s.selectedBunkerId ?? "random"} options={[{ value: "random", label: "Бункер случайно" }, ...bunkerShelters.map((item) => ({ value: item.id, label: item.title }))]} onChange={(value) => updateSettings({ bunkerMode: value === "random" ? "random" : "select", selectedBunkerId: value === "random" ? undefined : value })} />
        </Setting>
      </div>
    </section>
  );
}

function Panel({ title, label, children }: { title: string; label: string; children: React.ReactNode }) { return <section className="rounded-[1.5rem] border border-line bg-white/85 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/70"><p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">{label}</p><h2 className="mt-2 font-display text-3xl font-semibold">{title}</h2><div className="mt-4 text-slate-600 dark:text-white/65">{children}</div></section>; }
function Setting({ title, hint, children }: { title: string; hint: string; children: React.ReactNode }) { return <div className="rounded-[1.25rem] border border-line bg-slate-100/80 p-4 dark:border-white/10 dark:bg-slate-950/45"><h3 className="mb-3 flex items-center gap-2 text-lg font-black">{title}<Hint text={hint} /></h3><div className="space-y-3">{children}</div></div>; }
function Hint({ text }: { text: string }) { return <span className="group relative inline-flex h-5 w-5 items-center justify-center rounded-full bg-coral/15 text-xs font-black text-coral">?<span className="pointer-events-none absolute left-1/2 top-7 z-20 w-64 -translate-x-1/2 rounded-2xl border border-line bg-white p-3 text-xs font-semibold leading-5 text-slate-600 opacity-0 shadow-soft transition group-hover:opacity-100 dark:border-white/10 dark:bg-slate-900 dark:text-white/75">{text}</span></span>; }
function CustomSelect({ value, options, disabled, onChange }: { value: string; options: SelectOption[]; disabled: boolean; onChange: (value: string) => void }) { const [open, setOpen] = useState(false); const selected = options.find((option) => option.value === value) ?? options[0]; return <div className="relative"><button type="button" disabled={disabled} className="flex w-full items-center justify-between rounded-2xl border border-line bg-white px-4 py-3 text-left font-bold text-ink shadow-sm disabled:opacity-50 dark:border-white/10 dark:bg-slate-900 dark:text-white" onClick={() => setOpen((current) => !current)}><span>{selected?.label}</span><span className="text-coral">⌄</span></button>{open && !disabled ? <div className="absolute z-30 mt-2 max-h-60 w-full overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-soft dark:border-white/10 dark:bg-slate-900">{options.map((option) => <button key={option.value} type="button" className={`w-full rounded-xl px-3 py-2 text-left text-sm font-bold ${option.value === value ? "bg-coral text-white" : "text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10"}`} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div> : null}</div>; }
function Toggle({ checked, disabled, onChange, children }: { checked: boolean; disabled: boolean; onChange: (value: boolean) => void; children: React.ReactNode }) { return <button type="button" disabled={disabled} className="flex w-full items-center justify-between gap-3 rounded-2xl border border-line bg-white p-3 text-left font-bold disabled:opacity-50 dark:border-white/10 dark:bg-slate-900" onClick={() => onChange(!checked)}><span>{children}</span><span className={`relative h-7 w-12 rounded-full transition ${checked ? "bg-coral" : "bg-slate-300 dark:bg-slate-700"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-sm transition ${checked ? "left-6" : "left-1"}`} /></span></button>; }
function SpecialCardAction({ card, onUse, compact }: { card: BunkerSpecialCard; onUse: () => void; compact?: boolean }) {
  return (
    <article className={`grid grid-cols-[4.25rem_minmax(0,1fr)] gap-3 rounded-2xl border border-line bg-slate-100/80 p-3 dark:border-white/10 dark:bg-slate-950/45 ${compact ? "items-center" : ""}`}>
      <img src={specialCardImage(card)} alt="" className="h-28 w-16 rounded-lg object-cover shadow-sm" />
      <div>
        <h3 className="font-bold text-ink dark:text-white">{card.title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-white/60">{card.description}</p>
        <Button className="mt-3 w-full" onClick={onUse}>Применить спецкарту</Button>
      </div>
    </article>
  );
}

function SpecialCardPreview({ card }: { card: BunkerSpecialCard }) {
  return (
    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded-xl border border-line bg-slate-950 shadow-soft dark:border-white/10">
      <img src={specialCardImage(card)} alt="" className="h-full w-full object-cover" />
      <div className="absolute inset-x-1 bottom-1 rounded-lg bg-black/70 p-1 text-center text-white backdrop-blur-sm">
        <p className="text-[0.44rem] font-black uppercase leading-2">{card.title}</p>
        <p className="mt-0.5 text-[0.42rem] text-white/70">{card.used ? "исп." : "доступна"}</p>
      </div>
    </div>
  );
}

function FeaturedProfessionCard({ character }: { character?: PublicBunkerRoomState["characters"][string] }) {
  const profession = character?.profession;
  return (
    <article className="mt-2 grid shrink-0 overflow-hidden rounded-[0.95rem] border border-[#7f6b57]/55 bg-[#0c141c] shadow-[0_16px_40px_rgba(0,0,0,0.24)] sm:grid-cols-[9.5rem_minmax(0,1fr)]">
      <div className="relative h-32 border-b border-[#7f6b57]/35 bg-[#0b1219] sm:border-b-0 sm:border-r">
        <img src={bunkerCardImages.profession} alt="" className="absolute inset-2 h-[calc(100%-1rem)] w-[calc(100%-1rem)] object-contain opacity-90" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent to-[#0c141c]/16" />
      </div>
      <div className="relative h-32 overflow-hidden p-4">
        <div className="absolute right-4 top-3 h-20 w-20 rounded-full border border-[#7f6b57]/28 opacity-45" />
        <div className="absolute right-8 top-7 h-12 w-12 rounded-full border border-[#7f6b57]/28 opacity-45" />
        <p className="text-[0.58rem] font-black uppercase tracking-[0.24em] text-coral">Профессия</p>
        <h3 className="mt-2 font-display text-xl font-semibold leading-tight text-[#f4eee3]">{cardTitle(profession)}</h3>
        <p className="mt-2 line-clamp-2 max-w-lg text-[0.7rem] leading-4 text-white/58">{profession && !("hidden" in profession) ? profession.description : "Главная карта персонажа будет видна после выдачи ролей."}</p>
      </div>
    </article>
  );
}

function BoardCharacterCards({ character }: { character?: PublicBunkerRoomState["characters"][string] }) {
  if (!character) return <p className="mt-5 text-white/45">Карты появятся после старта игры.</p>;
  const visibleCategories = bunkerCharacteristicCategories.filter((category) => category !== "profession");
  return (
    <div className="mt-4 grid min-h-0 flex-1 grid-cols-2 content-start justify-between gap-x-3 gap-y-3 overflow-hidden sm:grid-cols-3 lg:grid-cols-[repeat(4,6.25rem)] xl:grid-cols-[repeat(4,6.85rem)] 2xl:grid-cols-[repeat(4,7.25rem)]">
      {visibleCategories.map((category) => (
        <BoardCharacterCard
          key={category}
          category={category}
          card={character[category]}
          revealed={character.revealedCategories.includes(category)}
        />
      ))}
      <p className="sr-only">
        Все характеристики персонажа доступны в этой сетке и раскрываются по правилам раунда.
      </p>
    </div>
  );
}

function BoardCharacterCard({
  category,
  card,
  revealed
}: {
  category: Exclude<BunkerCardCategory, "special">;
  card?: PublicBunkerCard;
  revealed?: boolean;
}) {
  const isHidden = !card || "hidden" in card;
  return (
    <article className="relative aspect-[0.7] w-full overflow-hidden rounded-[0.78rem] border border-[#7f6b57]/55 bg-[#eadfcb] p-0 text-[#1d1713] shadow-[0_16px_35px_rgba(0,0,0,0.22)]">
      <img src={bunkerCardImages[category]} alt="" className={`absolute inset-0 h-full w-full object-fill ${isHidden ? "opacity-70 grayscale" : ""}`} />
      <div className="absolute inset-x-1.5 bottom-1.5 rounded-md border border-[#7d6554]/50 bg-[#0d151d] px-1.5 py-1 text-center text-[#f4eee3] shadow-sm">
        <p className="text-[0.64rem] font-black leading-3">{cardTitle(card)}</p>
        <p className="mt-0.5 text-[0.42rem] font-black uppercase tracking-[0.12em] text-[#d9bfa6]">{revealed ? "открыто" : "скрыто"}</p>
      </div>
    </article>
  );
}

function CharacterDeck({
  character,
  own,
  className = ""
}: {
  character?: PublicBunkerRoomState["characters"][string];
  own?: boolean;
  className?: string;
}) {
  if (!character) return <p className={`text-slate-400 ${className}`}>Карты появятся после старта игры.</p>;
  return (
    <div className={`-mx-1 flex snap-x gap-3 overflow-x-auto px-1 pb-3 ${className}`}>
      {bunkerCharacteristicCategories.map((category) => (
        <CharacterCardTile
          key={category}
          category={category}
          card={character[category]}
          own={own}
          revealed={character.revealedCategories.includes(category)}
        />
      ))}
    </div>
  );
}

function CharacterCardTile({
  category,
  card,
  revealed,
  own
}: {
  category: Exclude<BunkerCardCategory, "special">;
  card?: PublicBunkerCard;
  revealed?: boolean;
  own?: boolean;
}) {
  const isHidden = !card || "hidden" in card;
  const title = cardTitle(card);
  return (
    <article className={`group relative h-72 w-36 shrink-0 snap-start overflow-hidden rounded-[1.15rem] border shadow-soft transition hover:-translate-y-1 hover:border-coral ${isHidden ? "border-line bg-slate-200 dark:border-white/10 dark:bg-slate-950" : "border-line bg-stone-100 dark:border-white/10 dark:bg-slate-950"}`}>
      <img src={bunkerCardImages[category]} alt="" className={`h-full w-full object-cover ${isHidden ? "opacity-35 grayscale" : ""}`} />
      <div className="absolute inset-0 bg-gradient-to-b from-black/5 via-transparent to-black/65" />
      <div className="absolute left-2 right-2 top-2 rounded-xl bg-white/80 px-2 py-1 text-center text-[0.62rem] font-black uppercase tracking-[0.12em] text-slate-700 shadow-sm backdrop-blur-sm dark:bg-slate-950/75 dark:text-white/80">
        {bunkerCategoryLabels[category]}
      </div>
      <div className="absolute inset-x-2 bottom-2 rounded-2xl border border-white/35 bg-white/88 p-2 text-center shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-slate-950/82">
        <p className="text-[0.72rem] font-black leading-4 text-ink dark:text-white">{title}</p>
        {own && !revealed ? <p className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-coral">закрыто для других</p> : null}
        {isHidden ? <p className="mt-1 text-[0.58rem] font-bold uppercase tracking-[0.12em] text-slate-400">не раскрыто</p> : null}
      </div>
    </article>
  );
}

function CardLine({ label, card, revealed, own, compact }: { label: string; card?: PublicBunkerCard; revealed?: boolean; own?: boolean; compact?: boolean }) {
  const category = card?.category ?? "special";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-2xl bg-slate-100/80 text-sm dark:bg-slate-950/45 ${compact ? "p-2" : "p-3"}`}>
      <div className="flex min-w-0 items-center gap-3">
        <img src={bunkerCardImages[category]} alt="" className={`${compact ? "h-14 w-7" : "h-20 w-10"} shrink-0 rounded-md object-cover shadow-sm`} />
        <span className="font-bold text-slate-500">{label}</span>
      </div>
      <span className="text-right font-semibold">{cardTitle(card)}{own && !revealed ? " · закрыто" : ""}</span>
    </div>
  );
}
function specialCardImage(card: BunkerSpecialCard) { return bunkerSpecialCardImages[card.id.split("_").slice(0, 3).join("_")] ?? bunkerSpecialCardImages[card.id.replace(/_[a-z0-9]+$/i, "")] ?? bunkerCardImages.special; }
function cardTitle(card?: PublicBunkerCard) { return !card ? "-" : "hidden" in card ? "Скрыто" : card.title; }
function PlayersMini({ players }: { players: PublicBunkerRoomState["players"] }) { return <Panel title="Живые игроки" label="Состав"><div className="max-h-72 space-y-2 overflow-y-auto pr-1">{players.map((player) => <p key={player.id} className="rounded-2xl bg-slate-100/80 p-3 font-bold dark:bg-slate-950/45">{player.name}</p>)}</div></Panel>; }
function Stats({ room }: { room: PublicBunkerRoomState }) { return <div className="mt-5 grid gap-3 sm:grid-cols-3"><div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-950/45">Мест: {room.settings.bunkerSlots === "auto" ? "авто" : room.settings.bunkerSlots}</div><div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-950/45">Режим: {room.settings.gameMode === "classic" ? "классика" : "быстрый"}</div><div className="rounded-2xl bg-slate-100/80 p-3 dark:bg-slate-950/45">Спецкарты: {room.settings.useSpecialCards ? "вкл" : "выкл"}</div></div>; }
function VoteList({ room }: { room: PublicBunkerRoomState }) { if (room.settings.votingMode === "anonymous") return <p className="mt-4 text-sm text-slate-500">Голосование было анонимным.</p>; return <div className="mt-4 space-y-2">{Object.entries(room.lastVotingResult?.votes ?? {}).map(([voterId, targetId]) => <p key={voterId} className="rounded-2xl bg-slate-100/80 p-3 text-sm dark:bg-slate-950/45">{room.players.find((p) => p.id === voterId)?.name} → {room.players.find((p) => p.id === targetId)?.name}</p>)}</div>; }
function getPhaseHint(room: PublicBunkerRoomState) { if (room.phase === "LOBBY") return "Настройте игру и пригласите друзей."; if (room.phase === "SCENARIO_REVEAL") return "Все игроки знакомятся со сценарием и нажимают готовность."; if (room.phase === "REVEAL_ROUND") return "Раскройте характеристику и готовьте аргументы."; if (room.phase === "DISCUSSION") return "Убедите остальных, что вы нужны группе."; if (room.phase === "VOTING" || room.phase === "REVOTE") return "Выберите, кого исключить из очереди в бункер."; if (room.phase === "GAME_OVER") return "Финальный состав выживших определен."; return "Следуйте текущему действию."; }
function rememberCurrentRoom(room: PublicBunkerRoomState) { window.localStorage.setItem(LAST_LEFT_ROOM_KEY, JSON.stringify({ code: room.code, gameId: room.gameId, phase: room.phase, visibility: room.visibility, leftAt: Date.now() })); }
function clearRememberedRoom(code: string) { const raw = window.localStorage.getItem(LAST_LEFT_ROOM_KEY); if (!raw) return; try { const remembered = JSON.parse(raw) as { code?: string }; if (remembered.code === code) window.localStorage.removeItem(LAST_LEFT_ROOM_KEY); } catch { window.localStorage.removeItem(LAST_LEFT_ROOM_KEY); } }
