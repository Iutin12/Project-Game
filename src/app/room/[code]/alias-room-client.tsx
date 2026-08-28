"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { AppShell } from "@/components/layout/AppShell";
import { RoomExperienceTools, useRoomExperience } from "@/components/room/RoomExperience";
import { Button } from "@/components/ui/Button";
import { aliasCategories, aliasCategoryLabels } from "@/games/alias/categories";
import type { AliasSettings, AliasTeam, PublicAliasRoomState } from "@/games/alias/types";

type Ack = { ok: boolean; error?: string; playerId?: string; reconnectToken?: string };
type Tab = "game" | "chat" | "settings";
type SelectOption = { value: string; label: string };

const LAST_LEFT_ROOM_KEY = "project-game:last-left-room";
const phaseLabels: Record<PublicAliasRoomState["phase"], string> = {
  LOBBY: "Лобби",
  TURN_PREPARE: "Подготовка",
  TURN_ACTIVE: "Ход идет",
  LAST_WORD: "Последнее слово",
  TURN_RESULT: "Итоги хода",
  GAME_OVER: "Игра окончена"
};

let aliasAudioContext: AudioContext | null = null;

function unlockAliasAudio() {
  if (typeof window === "undefined") return;
  try {
    aliasAudioContext ??= new AudioContext();
    void aliasAudioContext.resume();
  } catch {
    // Audio remains optional when the browser blocks it.
  }
}

function playAliasSignal(kind: "tick" | "timeout") {
  if (typeof window === "undefined") return;
  try {
    unlockAliasAudio();
    const context = aliasAudioContext;
    if (!context) return;
    void context.resume();
    const startedAt = context.currentTime;
    const pulses = kind === "timeout" ? [0, 0.16, 0.32] : [0];
    pulses.forEach((offset, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = kind === "timeout" ? "square" : "sine";
      oscillator.frequency.value = kind === "timeout" ? 420 + index * 180 : 760;
      gain.gain.setValueAtTime(0.0001, startedAt + offset);
      gain.gain.exponentialRampToValueAtTime(kind === "timeout" ? 0.18 : 0.14, startedAt + offset + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, startedAt + offset + (kind === "timeout" ? 0.15 : 0.12));
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(startedAt + offset);
      oscillator.stop(startedAt + offset + (kind === "timeout" ? 0.16 : 0.13));
    });
  } catch {
    // Browsers can block audio before the first user interaction.
  }
}

export function AliasRoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<PublicAliasRoomState | null>(null);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("game");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [seenMessages, setSeenMessages] = useState(0);
  const [unreadAnchorId, setUnreadAnchorId] = useState<string | null>(null);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatSectionRef = useRef<HTMLElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const previousChatCountRef = useRef(0);
  const previousPhaseRef = useRef<PublicAliasRoomState["phase"] | null>(null);

  const ownPlayer = room?.players.find((player) => player.id === room.ownPlayerId);
  const { phaseClassName } = useRoomExperience("alias", room?.phase);
  const unreadMessages = Math.max(0, (room?.chatMessages.length ?? 0) - seenMessages);
  const inviteUrl = typeof window === "undefined" ? "" : `${window.location.origin}/room/${code}`;

  useEffect(() => {
    const unlock = () => unlockAliasAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const nextSocket = io({ path: "/socket.io" });
    setSocket(nextSocket);
    nextSocket.on("alias_room_updated", (nextRoom: PublicAliasRoomState) => setRoom(nextRoom));
    nextSocket.on("alias:kicked", () => {
      window.localStorage.removeItem(`playerId:${code}`);
      router.push("/");
    });
    nextSocket.on("connect_error", () => {
      setIsRestoring(false);
      setError("Не удалось подключиться к комнате. Проверьте соединение и повторите попытку.");
    });
    nextSocket.on("connect", () => {
      setError("");
      const playerId = window.localStorage.getItem(`playerId:${code}`);
      const reconnectToken = window.localStorage.getItem(`reconnectToken:${code}`) ?? undefined;
      const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;
      if (!playerId) return setIsRestoring(false);
      nextSocket.emit("join_alias_room", { code, name: "", hostKey, playerId, reconnectToken }, (ack: Ack) => {
        if (ack.ok) {
          setJoined(true);
          clearRememberedRoom(code);
          if (ack.reconnectToken) window.localStorage.setItem(`reconnectToken:${code}`, ack.reconnectToken);
        } else {
          window.localStorage.removeItem(`playerId:${code}`);
          window.localStorage.removeItem(`reconnectToken:${code}`);
        }
        setIsRestoring(false);
      });
    });
    return () => {
      nextSocket.disconnect();
    };
  }, [code, router]);

  useEffect(() => {
    if (!room || room.phase === "LOBBY") return;
    const remember = () => rememberRoom(room);
    window.addEventListener("beforeunload", remember);
    return () => window.removeEventListener("beforeunload", remember);
  }, [room]);

  useEffect(() => {
    const count = room?.chatMessages.length ?? 0;
    const previous = previousChatCountRef.current;
    if (count > previous && tab !== "chat" && !unreadAnchorId) setUnreadAnchorId(room?.chatMessages[previous]?.id ?? null);
    if (count > previous && tab === "chat") requestAnimationFrame(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" }));
    previousChatCountRef.current = count;
  }, [room?.chatMessages, tab, unreadAnchorId]);

  useEffect(() => {
    if (!room) return;
    if (previousPhaseRef.current === "TURN_ACTIVE" && (room.phase === "LAST_WORD" || room.phase === "TURN_RESULT")) playAliasSignal("timeout");
    previousPhaseRef.current = room.phase;
  }, [room]);

  useEffect(() => {
    if (tab !== "chat" || !room) return;
    const markSeen = () => {
      const chat = chatRef.current;
      if (!chat || chat.scrollHeight - chat.scrollTop - chat.clientHeight > 10) return;
      setSeenMessages(room.chatMessages.length);
      setUnreadAnchorId(null);
    };
    const chat = chatRef.current;
    chat?.addEventListener("scroll", markSeen);
    const timer = window.setTimeout(markSeen, 1800);
    return () => {
      chat?.removeEventListener("scroll", markSeen);
      window.clearTimeout(timer);
    };
  }, [room, tab]);

  function joinRoom() {
    const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;
    socket?.emit("join_alias_room", { code, name, hostKey }, (ack: Ack) => {
      if (!ack.ok) return setError(ack.error ?? "Не удалось войти");
      if (ack.playerId) window.localStorage.setItem(`playerId:${code}`, ack.playerId);
      if (ack.reconnectToken) window.localStorage.setItem(`reconnectToken:${code}`, ack.reconnectToken);
      window.localStorage.setItem(`playerName:${code}`, name.trim());
      clearRememberedRoom(code);
      setJoined(true);
      setError("");
    });
  }

  function emitAction(event: string, payload?: unknown, onSuccess?: () => void) {
    setError("");
    socket?.emit(event, payload ?? {}, (ack: Ack) => {
      if (!ack.ok) return setError(ack.error ?? "Действие не выполнено");
      onSuccess?.();
    });
  }

  function openChat() {
    setTab("chat");
    window.setTimeout(() => {
      chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      const chat = chatRef.current;
      const anchor = unreadAnchorId ? chat?.querySelector<HTMLElement>(`[data-chat-message-id="${unreadAnchorId}"]`) : null;
      chat?.scrollTo({ top: anchor ? Math.max(0, anchor.offsetTop - 16) : chat.scrollHeight, behavior: "smooth" });
      chatInputRef.current?.focus({ preventScroll: true });
    }, 0);
  }

  function requestLeave() {
    if (room && room.phase !== "GAME_OVER") return setLeaveModalOpen(true);
    leaveRoom();
  }

  function leaveRoom() {
    if (room) rememberRoom(room);
    socket?.emit("alias:leave_room", {}, () => router.push("/"));
    window.setTimeout(() => router.push("/"), 250);
  }

  if (isRestoring) return <CenteredMessage text="Возвращаем вас в комнату «Элиаса»..." />;
  if (!joined) return (
    <AppShell>
      <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12">
        <Eyebrow>Элиас · комната {code}</Eyebrow>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink dark:text-white sm:text-5xl">Вход в игру</h1>
        <p className="mt-4 text-slate-500 dark:text-white/60">Введите имя. Во время своего хода только вы увидите секретное слово.</p>
        <input className="mt-8 rounded-xl border border-line bg-white px-4 py-3 text-ink shadow-soft outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 dark:border-white/10 dark:bg-slate-900 dark:text-white" placeholder="Ваш никнейм" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && joinRoom()} />
        <Button className="mt-3" disabled={!socket || !name.trim()} onClick={joinRoom}>Войти</Button>
        {error ? <ErrorBanner error={error} /> : null}
      </section>
    </AppShell>
  );
  if (!room) return <CenteredMessage text="Синхронизируем комнату..." />;

  return (
    <AppShell onLogoClick={requestLeave}>
      <section className={`py-6 ${phaseClassName}`}>
        <div className="rounded-[1.5rem] border border-line bg-white/80 p-3 text-ink shadow-soft dark:border-white/10 dark:bg-slate-950/75 dark:text-white sm:p-5">
          <RoomHeader room={room} copied={copied} onCopy={async () => { await navigator.clipboard.writeText(inviteUrl); setCopied(true); window.setTimeout(() => setCopied(false), 1400); }} onLeave={requestLeave} />
          <nav className="room-mobile-tabs mt-4 flex flex-wrap gap-2 rounded-[1.25rem] border border-line bg-white/80 p-1.5 dark:border-white/10 dark:bg-slate-900/70">
            {(["game", "chat", "settings"] as Tab[]).map((item) => <button key={item} className={`rounded-xl px-5 py-3 text-sm font-black transition ${tab === item ? "bg-coral text-white" : "text-slate-500 hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/5"}`} onClick={() => item === "chat" ? openChat() : setTab(item)}>{item === "game" ? "Игра" : item === "chat" ? "Чат" : "Настройки"}{item === "chat" && unreadMessages ? <span className="ml-2 rounded-full bg-ocean px-2 py-0.5 text-xs text-white">{unreadMessages}</span> : null}</button>)}
          </nav>
          <RoomExperienceTools gameId="alias" phase={room.phase} />
          {error ? <ErrorBanner error={error} /> : null}
          {tab === "game" ? <GameTab room={room} emitAction={emitAction} /> : null}
          {tab === "chat" ? <ChatTab room={room} message={message} setMessage={setMessage} send={() => { const text = message.trim(); if (text) emitAction("send_alias_chat_message", { text }, () => setMessage("")); }} chatRef={chatRef} sectionRef={chatSectionRef} inputRef={chatInputRef} unreadAnchorId={unreadAnchorId} /> : null}
          {tab === "settings" ? <SettingsTab room={room} emitAction={emitAction} /> : null}
        </div>
      </section>
      {leaveModalOpen ? <Modal title="Выйти из игры?" onClose={() => setLeaveModalOpen(false)}><p className="text-slate-600 dark:text-white/65">Партия продолжится без вас. Вернуться за того же игрока можно с главной страницы.</p><div className="mt-6 flex gap-3"><Button onClick={leaveRoom}>Да, выйти</Button><Button variant="secondary" onClick={() => setLeaveModalOpen(false)}>Остаться</Button></div></Modal> : null}
    </AppShell>
  );
}

function RoomHeader({ room, copied, onCopy, onLeave }: { room: PublicAliasRoomState; copied: boolean; onCopy: () => void; onLeave: () => void }) {
  const connected = room.players.filter((player) => player.connected || player.isBot).length;
  return <header className="rounded-[1.25rem] border border-line bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80 sm:p-5"><div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between"><div><div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-white/55"><span className="tracking-[0.22em] text-coral">Комната {room.code}</span><Badge>{connected} / {room.settings.maxPlayers}</Badge><Badge>{room.visibility === "public" ? "Открытая" : "Закрытая"}</Badge><Badge>{phaseLabels[room.phase]}</Badge></div><h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Элиас</h1><p className="mt-2 text-sm text-slate-600 dark:text-white/60">{phaseHint(room.phase)}</p></div><div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={onCopy}>{copied ? "Скопировано" : "Пригласить"}</Button><Button variant="ghost" onClick={onLeave}>Выйти</Button></div></div></header>;
}

function GameTab({ room, emitAction }: { room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  if (room.phase === "LOBBY") return <>{room.devMode ? <DevPanel room={room} emitAction={emitAction} /> : null}<Lobby room={room} emitAction={emitAction} /></>;
  return <div className="mt-4"><Scoreboard room={room} />{room.devMode ? <DevPanel room={room} emitAction={emitAction} /> : null}<main className="mt-4 rounded-[1.25rem] border border-line bg-white/85 p-4 dark:border-white/10 dark:bg-slate-900/65 sm:p-6">{room.phase === "TURN_PREPARE" ? <TurnPrepare room={room} emitAction={emitAction} /> : null}{room.phase === "TURN_ACTIVE" ? <TurnActive room={room} emitAction={emitAction} /> : null}{room.phase === "LAST_WORD" ? <LastWord room={room} emitAction={emitAction} /> : null}{room.phase === "TURN_RESULT" ? <TurnResult room={room} emitAction={emitAction} /> : null}{room.phase === "GAME_OVER" ? <GameOver room={room} emitAction={emitAction} /> : null}</main></div>;
}

function Lobby({ room, emitAction }: { room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  const active = room.players.filter((player) => player.connected || player.isBot);
  const ready = active.filter((player) => player.ready).length;
  const teamOptions = room.teams.map((team) => ({ value: team.id, label: team.name }));
  return <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]"><section className="rounded-[1.25rem] border border-line bg-white/85 p-4 dark:border-white/10 dark:bg-slate-900/65 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><Eyebrow>Команды</Eyebrow><h2 className="mt-1 font-display text-3xl font-semibold">Соберите составы</h2></div><Badge>{ready} / {active.length} готовы</Badge></div><div className={`mt-5 grid gap-3 ${room.teams.length > 2 ? "lg:grid-cols-2" : "md:grid-cols-2"}`}>{room.teams.map((team) => <TeamCard key={team.id} team={team} room={room} emitAction={emitAction} teamOptions={teamOptions} />)}</div><div className="mt-5 flex flex-wrap gap-3"><Button className={own?.ready ? undefined : "ready-attention"} onClick={() => emitAction("alias:ready", { ready: !own?.ready })}>{own?.ready ? "Отменить готовность" : "Я готов"}</Button>{own?.isHost ? <Button variant="secondary" onClick={() => emitAction("alias:start_game")}>Начать игру</Button> : null}</div></section><aside className="rounded-[1.25rem] border border-line bg-white/85 p-5 dark:border-white/10 dark:bg-slate-900/65"><Eyebrow>Коротко</Eyebrow><h2 className="mt-2 font-display text-2xl font-semibold">Объясняйте без подсказок</h2><ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-white/60"><li>1. Один игрок видит слово.</li><li>2. Команда угадывает его на время.</li><li>3. Каждое угаданное слово приносит очко.</li></ol></aside></div>;
}

function TeamCard({ team, room, emitAction, teamOptions }: { team: AliasTeam; room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void; teamOptions: SelectOption[] }) {
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  const members = room.players.filter((player) => player.teamId === team.id);
  return <section className={`rounded-[1.25rem] border p-4 ${teamBorder(team.color)}`}><div className="flex items-center justify-between gap-3"><h3 className="font-display text-2xl font-semibold">{team.name}</h3><Badge>{members.length}</Badge></div><div className="mt-3 space-y-2">{members.length ? members.map((player) => <article key={player.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-white p-3 dark:border-white/10 dark:bg-slate-950/55"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-coral/10 font-black text-coral">{player.name[0]?.toUpperCase()}</span><div className="min-w-0 flex-1"><p className="truncate font-bold">{player.name}{player.id === room.ownPlayerId ? " · вы" : ""}</p><p className={`text-xs font-bold ${player.connected || player.isBot ? "text-mint" : "text-coral"}`}>{player.connected || player.isBot ? "online" : "offline"}{player.isHost ? " · хост" : ""}</p></div><span className={`h-3 w-3 rounded-full ${player.ready ? "bg-mint" : "bg-slate-300 dark:bg-slate-700"}`} />{own?.isHost && !room.settings.autoAssignTeams ? <div className="w-28"><CustomSelect value={team.id} options={teamOptions} disabled={false} onChange={(teamId) => emitAction("alias:move_player", { playerId: player.id, teamId })} /></div> : null}</article>) : <p className="rounded-xl border border-dashed border-line p-4 text-center text-sm text-slate-400 dark:border-white/10">Команда пока пуста</p>}</div>{!room.settings.autoAssignTeams && own?.teamId !== team.id ? <Button className="mt-3 w-full" variant="ghost" onClick={() => emitAction("alias:select_team", { teamId: team.id })}>Вступить</Button> : null}</section>;
}

function Scoreboard({ room }: { room: PublicAliasRoomState }) {
  const currentTeamId = room.currentTurn?.teamId;
  return <section className={`grid gap-2 ${room.teams.length === 2 ? "grid-cols-2" : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"}`}>{room.teams.map((team) => <article key={team.id} className={`rounded-xl border px-4 py-3 ${currentTeamId === team.id ? `${teamBorder(team.color)} shadow-soft` : "border-line bg-white/70 dark:border-white/10 dark:bg-slate-900/55"}`}><p className="truncate text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-white/50">{team.name}</p><p className="mt-1 text-3xl font-black">{team.score}</p></article>)}</section>;
}

function TurnPrepare({ room, emitAction }: { room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const turn = room.currentTurn!;
  const team = room.teams.find((item) => item.id === turn.teamId);
  const explainer = room.players.find((player) => player.id === turn.explainerPlayerId);
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  const candidates = room.players.filter((player) => player.teamId === turn.teamId && (player.connected || player.isBot));
  return <Waiting title={`Ход команды «${team?.name}»`} text={`${explainer?.name ?? "Игрок"} объясняет слова. Таймер начнется только после нажатия кнопки.`}>{room.ownPlayerId === explainer?.id ? <Button className="ready-attention" onClick={() => emitAction("alias:ready_turn")}>Я готов объяснять</Button> : <Badge>Ждем объясняющего</Badge>}{own?.isHost && candidates.length > 1 ? <CustomSelect value={explainer?.id ?? ""} options={candidates.map((player) => ({ value: player.id, label: `Объясняет: ${player.name}` }))} disabled={false} onChange={(playerId) => emitAction("alias:replace_explainer", { playerId })} /> : null}</Waiting>;
}

function TurnActive({ room, emitAction }: { room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const turn = room.currentTurn!;
  const explainer = room.players.find((player) => player.id === turn.explainerPlayerId);
  const isExplainer = room.ownPlayerId === turn.explainerPlayerId;
  const touchStart = useRef<number | null>(null);
  const swipeFeedbackTimer = useRef<number | null>(null);
  const actionPending = useRef(false);
  const [swipeFeedback, setSwipeFeedback] = useState<"guessed" | "skipped" | null>(null);
  const [displayedWord, setDisplayedWord] = useState(() => turn.currentWord);
  const [retiringWordId, setRetiringWordId] = useState<string | null>(null);
  const [finishConfirmationOpen, setFinishConfirmationOpen] = useState(false);
  const wordId = displayedWord?.id;

  useEffect(() => {
    if (turn.currentWord?.id === displayedWord?.id) return;

    // Keep the old word on screen until its exit animation has finished.
    setDisplayedWord(turn.currentWord);
    if (retiringWordId) {
      setSwipeFeedback(null);
      setRetiringWordId(null);
      actionPending.current = false;
    }
  }, [displayedWord?.id, retiringWordId, turn.currentWord]);

  const submitWord = (result: "guessed" | "skipped") => {
    if (!wordId || actionPending.current || (result === "skipped" && !room.settings.allowSkipWord)) return;
    actionPending.current = true;
    setRetiringWordId(wordId);
    setSwipeFeedback(result);
    if (swipeFeedbackTimer.current) window.clearTimeout(swipeFeedbackTimer.current);
    swipeFeedbackTimer.current = window.setTimeout(() => {
      emitAction(result === "guessed" ? "alias:word_guessed" : "alias:word_skipped", { wordId });
    }, 380);
  };
  useEffect(() => () => { if (swipeFeedbackTimer.current) window.clearTimeout(swipeFeedbackTimer.current); }, []);
  const handleTouchEnd = (endY: number) => {
    if (!wordId || touchStart.current === null) return;
    const difference = endY - touchStart.current;
    touchStart.current = null;
    if (difference <= -56) submitWord("guessed");
    if (difference >= 56) submitWord("skipped");
  };
  return <div className="mx-auto max-w-3xl text-center"><Countdown deadlineAt={turn.deadlineAt} /><Eyebrow>Объясняет {explainer?.name}</Eyebrow>{isExplainer && displayedWord ? <><div className="relative mt-5 overflow-hidden rounded-[1.5rem]"><div className={`touch-pan-x rounded-[1.5rem] border px-5 py-10 shadow-soft dark:via-slate-950 dark:to-slate-900 sm:py-12 ${swipeFeedback === "guessed" ? "animate-alias-card-out-up border-mint bg-mint/15" : swipeFeedback === "skipped" ? "animate-alias-card-out-down border-coral bg-coral/15" : "border-coral/30 bg-gradient-to-br from-coral/15 via-white to-orange-50"}`} onTouchStart={(event) => { touchStart.current = event.touches[0]?.clientY ?? null; }} onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0]?.clientY ?? 0)}><div className={`pointer-events-none absolute inset-0 flex items-center justify-center bg-slate-950/20 text-2xl font-black uppercase tracking-[0.16em] text-white transition duration-150 ${swipeFeedback ? "opacity-100" : "opacity-0"}`}>{swipeFeedback === "guessed" ? "↑ Угадано" : "↓ Пропуск"}</div><p className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">Секретное слово</p><h2 className="mt-4 max-w-full break-words font-display text-3xl font-semibold leading-tight [overflow-wrap:anywhere] sm:text-6xl">{displayedWord.word}</h2><p className="mt-5 text-xs font-bold text-slate-400 sm:hidden">Свайп вверх — угадали, вниз — пропуск</p></div></div><div className="mt-5 grid grid-cols-2 gap-3"><button className="min-h-24 rounded-[1.25rem] bg-mint px-4 text-xl font-black text-white shadow-soft transition active:scale-[0.98]" onClick={() => submitWord("guessed")}>УГАДАЛИ<br/><span className="text-sm opacity-80">+1 очко</span></button><button className="min-h-24 rounded-[1.25rem] border border-line bg-white px-4 text-xl font-black text-slate-600 shadow-soft transition active:scale-[0.98] disabled:opacity-40 dark:border-white/10 dark:bg-slate-950 dark:text-white/70" disabled={!room.settings.allowSkipWord} onClick={() => submitWord("skipped")}>ПРОПУСТИТЬ<br/><span className="text-sm opacity-60">{room.settings.skipPenalty === -1 ? "−1 очко" : "без штрафа"}</span></button></div></> : <Waiting title="Слушайте объясняющего" text="Секретное слово видно только игроку, который сейчас объясняет." />}<div className="mt-5 flex justify-center gap-3"><Badge>Угадано: {turn.guessedCount}</Badge><Badge>Пропущено: {turn.skippedCount}</Badge>{room.players.find((player) => player.id === room.ownPlayerId)?.isHost ? <Button variant="ghost" onClick={() => setFinishConfirmationOpen(true)}>Завершить ход</Button> : null}</div>{finishConfirmationOpen ? <Modal title="Завершить ход досрочно?" onClose={() => setFinishConfirmationOpen(false)}><p className="text-slate-600 dark:text-white/65">Таймер остановится, а текущие результаты хода будут показаны всем игрокам.</p><div className="mt-6 flex flex-wrap gap-3"><Button onClick={() => { emitAction("alias:force_finish_turn"); setFinishConfirmationOpen(false); }}>Завершить ход</Button><Button variant="secondary" onClick={() => setFinishConfirmationOpen(false)}>Продолжить играть</Button></div></Modal> : null}</div>;
}

function LastWord({ room, emitAction }: { room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const turn = room.currentTurn!;
  const canResolve = turn.explainerPlayerId === room.ownPlayerId;
  return <div className="mx-auto max-w-3xl text-center"><Eyebrow>Общее слово</Eyebrow><h2 className="mt-2 font-display text-4xl font-semibold">Последний шанс для всех команд</h2><p className="mt-3 text-slate-600 dark:text-white/60">Сигнал прозвучал: теперь слово могут угадывать все.</p>{turn.currentWord ? <div className="mt-5 rounded-[1.5rem] border border-coral/30 bg-coral/10 px-5 py-10"><p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Слово</p><p className="mt-3 break-words font-display text-4xl font-semibold [overflow-wrap:anywhere] sm:text-5xl">{turn.currentWord.word}</p></div> : <p className="mt-5 text-slate-500 dark:text-white/55">Слово видит только объясняющий.</p>}{canResolve ? <div className="mt-5 grid gap-2 sm:grid-cols-2">{room.teams.map((team) => <Button key={team.id} variant="secondary" onClick={() => emitAction("alias:last_word_result", { teamId: team.id })}>Угадали: {team.name}</Button>)}<Button variant="ghost" onClick={() => emitAction("alias:last_word_result", {})}>Никто не угадал</Button></div> : <Badge>Ждем результат объясняющего</Badge>}</div>;
}

function TurnResult({ room, emitAction }: { room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const turn = room.currentTurn!;
  const canReview = turn.canReviewWords && room.settings.reviewWordsAfterTurn && !turn.scoreApplied;
  const canConfirm = turn.explainerPlayerId === room.ownPlayerId;
  return <div className="mx-auto max-w-3xl"><Eyebrow>Ход завершен</Eyebrow><div className="flex flex-wrap items-end justify-between gap-3"><h2 className="mt-2 font-display text-4xl font-semibold">Проверьте слова</h2><Badge>Итог: {turn.scoreDelta >= 0 ? "+" : ""}{turn.scoreDelta}</Badge></div><p className="mt-3 text-slate-600 dark:text-white/60">Все видят изменения очков. Исправить отметки и подтвердить результат может только объясняющий.</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{turn.words.length ? turn.words.filter((entry) => !entry.id.includes("-last-")).map((entry) => <button key={entry.id} disabled={!canReview} className={`flex items-center justify-between gap-3 rounded-xl border p-4 text-left ${entry.result === "guessed" ? "border-mint/35 bg-mint/10" : "border-coral/30 bg-coral/10"}`} onClick={() => emitAction("alias:toggle_turn_word", { entryId: entry.id })}><span className="font-bold">{entry.word}</span><span className={`font-black ${entry.points > 0 ? "text-mint" : "text-coral"}`}>{entry.points > 0 ? "+" : ""}{entry.points}</span></button>) : <p className="text-slate-400">В этом ходу нет отмеченных слов.</p>}</div>{turn.lastWord ? <section className="mt-5 rounded-[1.25rem] border border-coral/25 bg-coral/5 p-4"><p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Последнее слово</p><div className="mt-2 flex flex-wrap items-center justify-between gap-3"><strong className="text-xl">{turn.lastWord}</strong><Badge>{turn.lastWordWinnerTeamId ? `Угадали: ${room.teams.find((team) => team.id === turn.lastWordWinnerTeamId)?.name}` : "Никто не угадал"}</Badge></div>{canReview ? <div className="mt-3 flex flex-wrap gap-2">{room.teams.map((team) => <Button key={team.id} variant="ghost" onClick={() => emitAction("alias:reassign_last_word", { teamId: team.id })}>Присудить: {team.name}</Button>)}<Button variant="ghost" onClick={() => emitAction("alias:reassign_last_word", {})}>Никто не угадал</Button></div> : null}</section> : null}{canConfirm ? <Button className="mt-5" onClick={() => emitAction("alias:confirm_turn_result")}>Подтвердить результат</Button> : <div className="mt-5"><Badge>Ждем подтверждения объясняющего</Badge></div>}</div>;
}

function GameOver({ room, emitAction }: { room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const winners = room.teams.filter((team) => room.winnerTeamIds.includes(team.id));
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  return <div className="mx-auto max-w-4xl text-center"><Eyebrow>Финал</Eyebrow><h2 className="mt-2 font-display text-5xl font-semibold">{winners.length === 1 ? `Победили «${winners[0].name}»` : "Ничья"}</h2><div className="mt-6 grid gap-3 sm:grid-cols-2">{[...room.teams].sort((a, b) => b.score - a.score).map((team, index) => <article key={team.id} className={`rounded-[1.25rem] border p-5 text-left ${room.winnerTeamIds.includes(team.id) ? "border-coral bg-coral/10" : "border-line dark:border-white/10"}`}><p className="text-xs font-black uppercase tracking-[0.18em] text-coral">{index + 1} место</p><div className="mt-2 flex items-end justify-between"><h3 className="font-display text-3xl font-semibold">{team.name}</h3><strong className="text-4xl">{team.score}</strong></div><p className="mt-3 text-sm text-slate-500 dark:text-white/55">{room.turnHistory.filter((turn) => turn.teamId === team.id).reduce((sum, turn) => sum + turn.guessedWords.length, 0)} слов угадано</p></article>)}</div>{own?.isHost ? <Button className="mt-6" onClick={() => emitAction("alias:return_to_lobby")}>Сыграть еще раз</Button> : null}</div>;
}

function SettingsTab({ room, emitAction }: { room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  const disabled = !own?.isHost || room.phase !== "LOBBY";
  const settings = room.settings;
  const update = (patch: Partial<AliasSettings>) => emitAction("alias:update_settings", patch);
  const skipMode = !settings.allowSkipWord ? "disabled" : settings.skipPenalty === -1 ? "penalty" : "free";
  return <div className="mt-4 grid gap-4 xl:grid-cols-2">
    <SettingsSection title="Команды и ход" description="Составы, время объяснения и правила пропусков.">
      <SettingSelect label="Вместимость комнаты" help="Максимальное число игроков, которые смогут войти в лобби." value={String(settings.maxPlayers)} options={[4,6,8,10,12,16,20].map((value) => [String(value), `${value} игроков`])} disabled={disabled} onChange={(value) => update({ maxPlayers: Number(value) })} />
      <SettingSelect label="Количество команд" help="Можно играть от двух до шести команд. В каждой должен быть хотя бы один активный игрок." value={String(settings.teamsCount)} options={[2,3,4,5,6].map((value) => [String(value), `${value} команд`])} disabled={disabled} onChange={(value) => update({ teamsCount: Number(value) as AliasSettings["teamsCount"] })} />
      <Toggle label="Автоматически распределять" help="Сервер равномерно распределит всех подключенных игроков." checked={settings.autoAssignTeams} disabled={disabled} onChange={(value) => update({ autoAssignTeams: value })} />
      <SettingSelect label="Время хода" help="Время, за которое объясняющий показывает как можно больше слов." value={String(settings.turnTimeSec)} options={[30,45,60,90,120].map((value) => [String(value), `${value} секунд`])} disabled={disabled} onChange={(value) => update({ turnTimeSec: Number(value) as AliasSettings["turnTimeSec"] })} />
      <SettingSelect label="Пропуск слова" help="Без ограничений: разрешён бесплатно; со штрафом: каждое пропущенное слово отнимает одно очко; запрет: кнопку пропуска нельзя использовать." value={skipMode} options={[["free", "Разрешить пропуск"], ["penalty", "Разрешить пропуск за −1 очко"], ["disabled", "Запретить пропуск"]]} disabled={disabled} onChange={(value) => update({ allowSkipWord: value !== "disabled", skipPenalty: value === "penalty" ? -1 : 0 })} />
    </SettingsSection>
    <SettingsSection title="Победа и результаты" description="Когда партия заканчивается и как фиксируются ответы.">
      <SettingSelect label="Условие победы" help="Игра идет до выбранного счета или заданного числа полных кругов." value={settings.gameEndMode} options={[["score", "До счета"], ["rounds", "По раундам"]]} disabled={disabled} onChange={(value) => update({ gameEndMode: value as AliasSettings["gameEndMode"] })} />
      {settings.gameEndMode === "score" ? <SettingNumber label="Очков для победы" help="Введите цель от 5 до 999 очков. После достижения цели команды доигрывают круг, если включено равенство ходов." value={settings.targetScore} disabled={disabled} onChange={(value) => update({ targetScore: value })} /> : <SettingSelect label="Количество раундов" help="Один раунд — по одному ходу каждой команды." value={String(settings.roundsCount)} options={[1,2,3,5,7,10].map((value) => [String(value), String(value)])} disabled={disabled} onChange={(value) => update({ roundsCount: Number(value) })} />}
      <Toggle label="Равное число ходов" help="После достижения целевого счета остальные команды доигрывают текущий круг." checked={settings.equalTurnsAtEnd} disabled={disabled || settings.gameEndMode !== "score"} onChange={(value) => update({ equalTurnsAtEnd: value })} />
      <SettingSelect label="Последнее слово" help="После таймера звучит сигнал и последнее слово могут угадывать все команды. По умолчанию эта механика включена." value={settings.lastWordMode} options={[["common_guess", "Общее угадывание"], ["disabled", "Выключено"]]} disabled={disabled} onChange={(value) => update({ lastWordMode: value as AliasSettings["lastWordMode"] })} />
      <Toggle label="Проверять слова после хода" help="Только объясняющий может исправить случайно нажатое «угадали» или «пропустить», после чего подтверждает итог." checked={settings.reviewWordsAfterTurn} disabled={disabled} onChange={(value) => update({ reviewWordsAfterTurn: value })} />
      <Toggle label="Показывать сыгранные слова" help="В итогах хода и партии отображается список ответов." checked={settings.showPlayedWords} disabled={disabled} onChange={(value) => update({ showPlayedWords: value })} />
    </SettingsSection>
    <SettingsSection title="Слова" description="Сложность и тематический набор без повторов внутри партии."><SettingSelect label="Сложность" help="Смешанная сложность использует слова всех уровней." value={settings.difficulty} options={[["mixed","Смешанная"],["easy","Легкая"],["medium","Средняя"],["hard","Сложная"]]} disabled={disabled} onChange={(value) => update({ difficulty: value as AliasSettings["difficulty"] })} /><SettingSelect label="Набор категорий" help="Можно использовать базовый набор или выбрать темы вручную." value={settings.wordPoolMode} options={[["all","Все безопасные категории"],["selected","Выбранные категории"]]} disabled={disabled} onChange={(value) => update({ wordPoolMode: value as AliasSettings["wordPoolMode"] })} />{settings.wordPoolMode === "selected" ? <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{aliasCategories.map((category) => <Toggle key={category} compact label={aliasCategoryLabels[category]} help={category === "adult" ? "Категория 18+ отключена по умолчанию." : undefined} checked={settings.selectedCategories.includes(category)} disabled={disabled} onChange={(checked) => update({ selectedCategories: checked ? [...settings.selectedCategories, category] : settings.selectedCategories.filter((item) => item !== category) })} />)}</div> : null}</SettingsSection>
    <SettingsSection title="Справка" description="Настройки доступны хосту до начала партии."><p className="text-sm leading-6 text-slate-600 dark:text-white/60">Минимум 4 игрока. Секретное слово отправляется только текущему объясняющему. Повторное нажатие по уже обработанному слову сервер отклоняет.</p>{!disabled ? null : <p className="mt-3 rounded-xl bg-slate-100 p-3 text-sm text-slate-500 dark:bg-white/5 dark:text-white/50">{room.phase !== "LOBBY" ? "Настройки заблокированы до следующей партии." : "Настройки может менять только хост."}</p>}</SettingsSection>
  </div>;
}

function SettingNumber({ label, help, value, disabled, onChange }: { label: string; help: string; value: number; disabled: boolean; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  const commit = () => {
    const next = Number(draft);
    if (!Number.isFinite(next)) return setDraft(String(value));
    onChange(Math.max(5, Math.min(999, Math.round(next))));
  };
  return <label className="block"><span className="mb-1.5 flex items-center gap-2 text-sm font-bold">{label}<Info text={help}/></span><input type="number" inputMode="numeric" min={5} max={999} value={draft} disabled={disabled} className="w-full rounded-xl border border-line bg-white px-4 py-3 text-sm font-bold shadow-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 disabled:opacity-50 dark:border-white/10 dark:bg-slate-950" onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => event.key === "Enter" && event.currentTarget.blur()} /></label>;
}

function ChatTab({ room, message, setMessage, send, chatRef, sectionRef, inputRef, unreadAnchorId }: { room: PublicAliasRoomState; message: string; setMessage: (value: string) => void; send: () => void; chatRef: RefObject<HTMLDivElement>; sectionRef: RefObject<HTMLElement>; inputRef: RefObject<HTMLInputElement>; unreadAnchorId: string | null }) {
  return <section ref={sectionRef} className="mt-4 flex h-[30rem] min-h-0 scroll-mt-4 flex-col rounded-[1.25rem] border border-line bg-white/85 p-4 dark:border-white/10 dark:bg-slate-900/65 sm:h-[34rem]"><div className="flex items-center justify-between"><h2 className="font-display text-3xl font-semibold">Чат комнаты</h2><Badge>{room.chatMessages.length}</Badge></div><div ref={chatRef} className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-xl bg-slate-100/70 p-3 dark:bg-slate-950/55">{room.chatMessages.length ? room.chatMessages.map((item) => <div key={item.id} data-chat-message-id={item.id}>{unreadAnchorId === item.id ? <div className="my-3 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-coral"><span className="h-px flex-1 bg-coral/30"/>Новые сообщения<span className="h-px flex-1 bg-coral/30"/></div> : null}<article className="rounded-xl bg-white p-3 dark:bg-slate-900"><div className="flex justify-between gap-3"><strong className="text-sm text-coral">{item.playerName}</strong><time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time></div><p className="mt-1 break-words text-sm text-slate-700 dark:text-white/70">{item.text}</p></article></div>) : <p className="p-4 text-center text-sm text-slate-400">Пока нет сообщений</p>}</div><div className="mt-3 flex flex-col gap-2 sm:flex-row"><input ref={inputRef} className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 dark:border-white/10 dark:bg-slate-950" placeholder="Написать сообщение..." value={message} maxLength={280} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && send()} /><Button disabled={!message.trim()} onClick={send}>Отправить</Button></div></section>;
}

function DevPanel({ room, emitAction }: { room: PublicAliasRoomState; emitAction: (event: string, payload?: unknown) => void }) { return <section className="mt-4 rounded-[1.25rem] border border-amber-400/35 bg-amber-400/10 p-4"><div className="flex flex-wrap items-center gap-2"><strong className="mr-auto text-sm uppercase tracking-[0.18em] text-amber-600">Dev-пульт</strong>{room.phase === "LOBBY" ? <><Button variant="ghost" onClick={() => emitAction("alias:dev_add_bot")}>+ бот</Button><Button variant="ghost" onClick={() => emitAction("alias:dev_remove_bot")}>− бот</Button></> : null}<Button variant="secondary" onClick={() => emitAction("alias:dev_next")}>Следующая фаза</Button>{room.phase === "TURN_ACTIVE" ? <><Button variant="ghost" onClick={() => emitAction("alias:dev_guess")}>Угадать</Button><Button variant="ghost" onClick={() => emitAction("alias:dev_skip")}>Пропустить</Button><Button variant="ghost" onClick={() => emitAction("alias:dev_expire")}>Истечь таймеру</Button></> : null}<Button variant="ghost" onClick={() => emitAction("alias:dev_finish_game")}>До финала</Button></div>{room.devSecrets?.currentWord ? <p className="mt-3 text-sm font-bold">Секрет: {room.devSecrets.currentWord.word}</p> : null}</section>; }
function Countdown({ deadlineAt }: { deadlineAt?: number }) { const [left, setLeft] = useState(() => deadlineAt ? Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000)) : 0); const previousLeft = useRef(left); useEffect(() => { if (!deadlineAt) return; const update = () => setLeft(Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000))); update(); const timer = window.setInterval(update, 200); return () => window.clearInterval(timer); }, [deadlineAt]); useEffect(() => { if (left > 0 && left <= 3 && previousLeft.current !== left) playAliasSignal("tick"); previousLeft.current = left; }, [left]); return <div className="mx-auto mb-5 flex w-fit items-center gap-3 rounded-[1.25rem] border border-coral/30 bg-coral/10 px-5 py-3"><span className="h-3 w-3 animate-pulse rounded-full bg-coral"/><strong className="min-w-24 text-3xl text-coral">{Math.floor(left / 60)}:{String(left % 60).padStart(2,"0")}</strong></div>; }
function SettingsSection({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <section className="rounded-[1.25rem] border border-line bg-white/85 p-4 dark:border-white/10 dark:bg-slate-900/65 sm:p-5"><h2 className="font-display text-2xl font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-white/50">{description}</p><div className="mt-4 space-y-3">{children}</div></section>; }
function SettingSelect({ label, help, value, options, disabled, onChange }: { label: string; help: string; value: string; options: string[][]; disabled: boolean; onChange: (value: string) => void }) { return <div><span className="mb-1.5 flex items-center gap-2 text-sm font-bold">{label}<Info text={help}/></span><CustomSelect value={value} options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))} disabled={disabled} onChange={onChange}/></div>; }
function CustomSelect({ value, options, disabled, onChange }: { value: string; options: SelectOption[]; disabled: boolean; onChange: (value: string) => void }) { const [open, setOpen] = useState(false); const ref = useRef<HTMLDivElement | null>(null); const selected = options.find((option) => option.value === value) ?? options[0]; useEffect(() => { if (!open) return; const outside = (event: PointerEvent) => { if (!ref.current?.contains(event.target as Node)) setOpen(false); }; const escape = (event: KeyboardEvent) => { if (event.key === "Escape") setOpen(false); }; document.addEventListener("pointerdown", outside); document.addEventListener("keydown", escape); return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", escape); }; }, [open]); return <div ref={ref} className={`relative ${open ? "z-50" : "z-0"}`}><button type="button" disabled={disabled} className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-left text-sm font-bold shadow-sm disabled:opacity-50 dark:border-white/10 dark:bg-slate-950" onClick={() => setOpen((current) => !current)}><span className="truncate">{selected?.label}</span><span className={`text-coral transition ${open ? "rotate-180" : ""}`}>⌄</span></button>{open && !disabled ? <div className="absolute left-0 top-full z-[60] mt-2 max-h-60 w-full min-w-48 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-2xl dark:border-white/10 dark:bg-slate-900">{options.map((option) => <button key={option.value} className={`w-full rounded-xl px-3 py-2 text-left text-sm font-bold ${option.value === value ? "bg-coral text-white" : "hover:bg-slate-100 dark:hover:bg-white/10"}`} onClick={() => { onChange(option.value); setOpen(false); }}>{option.label}</button>)}</div> : null}</div>; }
function Toggle({ label, help, checked, disabled, compact, onChange }: { label: string; help?: string; checked: boolean; disabled: boolean; compact?: boolean; onChange: (value: boolean) => void }) { return <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-white dark:border-white/10 dark:bg-slate-950/50 ${compact ? "px-3 py-2" : "p-3"}`}><span className="text-sm font-bold">{label}{help ? <span className="ml-2 inline-block"><Info text={help}/></span> : null}</span><input className="peer sr-only" type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)}/><span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-coral peer-disabled:opacity-45 dark:bg-slate-700"><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`}/></span></label>; }
function Waiting({ title, text, children }: { title: string; text: string; children?: ReactNode }) { return <div className="flex min-h-[22rem] flex-col items-center justify-center text-center"><span className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-coral/10 text-3xl font-black text-coral">A</span><h2 className="mt-5 font-display text-4xl font-semibold">{title}</h2><p className="mt-3 max-w-lg text-slate-600 dark:text-white/60">{text}</p>{children ? <div className="mt-6 flex w-full max-w-md flex-wrap items-center justify-center gap-3">{children}</div> : null}</div>; }
function Badge({ children }: { children: ReactNode }) { return <span className="inline-flex rounded-xl border border-line bg-slate-100 px-3 py-2 text-sm font-black text-slate-600 dark:border-white/10 dark:bg-white/5 dark:text-white/65">{children}</span>; }
function Eyebrow({ children }: { children: ReactNode }) { return <p className="text-xs font-black uppercase tracking-[0.22em] text-coral">{children}</p>; }
function Info({ text }: { text: string }) { return <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-coral/35 text-[0.65rem] font-black text-coral" title={text}>?</span>; }
function ErrorBanner({ error }: { error: string }) { return <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 p-3 text-sm font-bold text-coral">{error}</p>; }
function CenteredMessage({ text }: { text: string }) { return <AppShell><section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12 text-slate-600 dark:text-white/60">{text}</section></AppShell>; }
function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}><section className="w-full max-w-lg rounded-[1.5rem] border border-line bg-white p-6 text-ink shadow-2xl dark:border-white/10 dark:bg-slate-950 dark:text-white" onClick={(event) => event.stopPropagation()}><div className="flex justify-between gap-4"><h2 className="font-display text-3xl font-semibold">{title}</h2><button className="h-10 w-10 rounded-full bg-slate-100 text-xl dark:bg-white/10" onClick={onClose}>×</button></div><div className="mt-4">{children}</div></section></div>; }
function teamBorder(color: AliasTeam["color"]) { return color === "coral" ? "border-coral/40 bg-coral/5" : color === "ocean" ? "border-ocean/40 bg-ocean/5" : color === "mint" ? "border-mint/40 bg-mint/5" : color === "violet" ? "border-violet-400/40 bg-violet-400/5" : color === "cyan" ? "border-cyan-400/40 bg-cyan-400/5" : "border-amber-400/40 bg-amber-400/5"; }
function phaseHint(phase: PublicAliasRoomState["phase"]) { if (phase === "LOBBY") return "Распределитесь по командам и отметьте готовность."; if (phase === "TURN_PREPARE") return "Объясняющий готовится начать ход."; if (phase === "TURN_ACTIVE") return "Объясняйте и угадывайте как можно быстрее."; if (phase === "LAST_WORD") return "Последнее слово могут угадывать все команды."; if (phase === "TURN_RESULT") return "Проверьте ответы и подтвердите счет."; return "Партия завершена. Сравните результаты команд."; }
function rememberRoom(room: PublicAliasRoomState) { window.localStorage.setItem(LAST_LEFT_ROOM_KEY, JSON.stringify({ code: room.code, gameId: room.gameId, title: "Элиас", leftAt: Date.now() })); }
function clearRememberedRoom(code: string) { const raw = window.localStorage.getItem(LAST_LEFT_ROOM_KEY); if (!raw) return; try { const remembered = JSON.parse(raw) as { code?: string }; if (remembered.code === code) window.localStorage.removeItem(LAST_LEFT_ROOM_KEY); } catch { window.localStorage.removeItem(LAST_LEFT_ROOM_KEY); } }
