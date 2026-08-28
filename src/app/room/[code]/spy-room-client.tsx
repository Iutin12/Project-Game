"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { AppShell } from "@/components/layout/AppShell";
import { RoomExperienceTools, useRoomExperience } from "@/components/room/RoomExperience";
import { Button } from "@/components/ui/Button";
import { spyLocations } from "@/games/spy/locations";
import type { PublicSpyRoomState, SpyLocation, SpySettings } from "@/games/spy/types";

type Ack = { ok: boolean; error?: string; playerId?: string; reconnectToken?: string };
type Tab = "game" | "chat" | "settings";
type SelectOption = { value: string; label: string };

const LAST_LEFT_ROOM_KEY = "project-game:last-left-room";

const phaseLabels: Record<PublicSpyRoomState["phase"], string> = {
  LOBBY: "Лобби",
  ROLE_REVEAL: "Личная роль",
  WAITING_FOR_CONFIRMATION: "Подтверждение",
  DISCUSSION: "Обсуждение",
  SPY_GUESS: "Попытка шпиона",
  VOTING: "Голосование",
  REVOTE: "Переголосование",
  ROUND_RESULT: "Итоги раунда",
  GAME_RESULT: "Итоги игры"
};

export function SpyRoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<PublicSpyRoomState | null>(null);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<Tab>("game");
  const [copied, setCopied] = useState(false);
  const [message, setMessage] = useState("");
  const [roleCardOpen, setRoleCardOpen] = useState(true);
  const [seenMessages, setSeenMessages] = useState(0);
  const [unreadAnchorId, setUnreadAnchorId] = useState<string | null>(null);
  const [keepUnreadDivider, setKeepUnreadDivider] = useState(false);
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const chatSectionRef = useRef<HTMLElement | null>(null);
  const chatInputRef = useRef<HTMLInputElement | null>(null);
  const previousChatCountRef = useRef(0);

  const ownPlayer = room?.players.find((player) => player.id === room.ownPlayerId);
  const { phaseClassName } = useRoomExperience("spy", room?.phase);
  const isHost = Boolean(ownPlayer?.isHost);
  const connectedPlayers = useMemo(() => room?.players.filter((player) => player.connected || player.isBot) ?? [], [room?.players]);
  const unreadMessages = Math.max(0, (room?.chatMessages.length ?? 0) - seenMessages);
  const inviteUrl = typeof window === "undefined" ? "" : `${window.location.origin}/room/${code}`;

  function scrollChatToRelevantMessage(behavior: ScrollBehavior = "smooth") {
    requestAnimationFrame(() => {
      const chat = chatRef.current;
      if (!chat) return;
      const target = unreadAnchorId
        ? Array.from(chat.querySelectorAll<HTMLElement>("[data-chat-message-id]"))
            .find((item) => item.dataset.chatMessageId === unreadAnchorId)
        : null;
      chat.scrollTo({
        top: target ? Math.max(target.offsetTop - 18, 0) : chat.scrollHeight,
        behavior
      });
    });
  }

  useEffect(() => {
    const nextSocket = io({ path: "/socket.io" });
    setSocket(nextSocket);
    nextSocket.on("spy_room_updated", (nextRoom: PublicSpyRoomState) => setRoom(nextRoom));
    nextSocket.on("spy:kicked", () => {
      window.localStorage.removeItem(`playerId:${code}`);
      router.push("/");
    });
    nextSocket.on("connect_error", () => {
      setIsRestoring(false);
      setError("Не удалось подключиться к комнате. Проверьте соединение и повторите попытку.");
    });
    nextSocket.on("connect", () => {
      setError("");
      const savedPlayerId = window.localStorage.getItem(`playerId:${code}`);
      const reconnectToken = window.localStorage.getItem(`reconnectToken:${code}`) ?? undefined;
      const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;
      if (!savedPlayerId) {
        setIsRestoring(false);
        return;
      }
      nextSocket.emit("join_spy_room", { code, name: "", hostKey, playerId: savedPlayerId, reconnectToken }, (ack: Ack) => {
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
    if (!room || room.phase === "LOBBY") return undefined;
    const remember = () => rememberRoom(room);
    window.addEventListener("beforeunload", remember);
    return () => window.removeEventListener("beforeunload", remember);
  }, [room]);

  useEffect(() => {
    if (room?.phase === "ROLE_REVEAL" && !room.privateState?.hasViewedRole) setRoleCardOpen(true);
  }, [room?.phase, room?.privateState?.hasViewedRole]);

  useEffect(() => {
    const chatCount = room?.chatMessages.length ?? 0;
    const previousCount = previousChatCountRef.current;

    if (chatCount > previousCount && !unreadAnchorId) {
      setUnreadAnchorId(room?.chatMessages[previousCount]?.id ?? null);
      setKeepUnreadDivider(true);
    }

    if (tab === "chat" && chatCount > previousCount) {
      requestAnimationFrame(() => {
        chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
      });
    }

    previousChatCountRef.current = chatCount;
  }, [room?.chatMessages, tab, unreadAnchorId]);

  useEffect(() => {
    if (tab !== "chat" || !room) return undefined;
    const chat = chatRef.current;
    const markSeenIfBottom = () => {
      const current = chatRef.current;
      if (!current) return;
      const isAtBottom = current.scrollHeight - current.scrollTop - current.clientHeight < 8;
      if (!isAtBottom) return;
      setSeenMessages(room.chatMessages.length);
      setUnreadAnchorId(null);
      setKeepUnreadDivider(false);
    };
    chat?.addEventListener("scroll", markSeenIfBottom);
    const timer = window.setTimeout(markSeenIfBottom, keepUnreadDivider ? 1800 : 0);
    return () => {
      chat?.removeEventListener("scroll", markSeenIfBottom);
      window.clearTimeout(timer);
    };
  }, [room, tab, keepUnreadDivider]);

  function joinRoom() {
    const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;
    socket?.emit("join_spy_room", { code, name, hostKey }, (ack: Ack) => {
      if (!ack.ok) {
        setError(ack.error ?? "Не удалось войти");
        return;
      }
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
      if (!ack.ok) {
        setError(ack.error ?? "Действие не выполнено");
        return;
      }
      onSuccess?.();
    });
  }

  function sendMessage() {
    const text = message.trim();
    if (!text) return;
    emitAction("send_spy_chat_message", { text }, () => setMessage(""));
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1400);
  }

  function requestLeave() {
    if (room && room.phase !== "GAME_RESULT") {
      setLeaveModalOpen(true);
      return;
    }
    leaveRoom();
  }

  function leaveRoom() {
    if (room) rememberRoom(room);
    socket?.emit("spy:leave_room", {}, () => router.push("/"));
    window.setTimeout(() => router.push("/"), 250);
  }

  if (isRestoring) return <CenteredMessage text="Возвращаем вас в комнату «Шпиона»..." />;

  if (!joined) {
    return (
      <AppShell>
        <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-coral">Шпион · комната {code}</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">Вход в игру</h1>
          <p className="mt-4 text-slate-500 dark:text-white/60">Введите имя. После начала раунда только вы увидите свою секретную карточку.</p>
          <input className="mt-8 rounded-xl border border-line bg-white px-4 py-3 text-ink shadow-soft outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 dark:border-white/10 dark:bg-slate-900 dark:text-white" placeholder="Ваш никнейм" value={name} maxLength={24} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && joinRoom()} />
          <Button className="mt-3" onClick={joinRoom} disabled={!socket || !name.trim()}>Войти</Button>
          {error ? <ErrorBanner error={error} /> : null}
        </section>
      </AppShell>
    );
  }

  if (!room) return <CenteredMessage text="Синхронизируем комнату..." />;

  return (
    <AppShell onLogoClick={requestLeave}>
      <section className={`py-6 ${phaseClassName}`}>
        <div className="rounded-[1.5rem] border border-line bg-white/80 p-3 text-ink shadow-soft dark:border-white/10 dark:bg-slate-950/75 dark:text-white sm:p-5">
          <RoomHeader room={room} copied={copied} copyInvite={copyInvite} requestLeave={requestLeave} />
          <nav className="room-mobile-tabs mt-4 flex flex-wrap gap-2 rounded-[1.25rem] border border-line bg-white/80 p-1.5 dark:border-white/10 dark:bg-slate-900/70">
            {(["game", "chat", "settings"] as Tab[]).map((item) => (
              <button
                key={item}
                className={`rounded-xl px-5 py-3 text-sm font-black transition ${tab === item ? "bg-coral text-white" : "text-slate-500 hover:bg-slate-100 dark:text-white/60 dark:hover:bg-white/5"}`}
                onClick={() => {
                  setTab(item);
                  if (item === "chat") {
                    window.setTimeout(() => {
                      chatSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
                      scrollChatToRelevantMessage();
                      chatInputRef.current?.focus({ preventScroll: true });
                    }, 0);
                  }
                }}
              >
                {item === "game" ? "Комната" : item === "chat" ? "Чат" : "Настройки"}
                {item === "chat" && unreadMessages ? <span className="ml-2 rounded-full bg-ocean px-2 py-0.5 text-xs text-white">{unreadMessages}</span> : null}
              </button>
            ))}
          </nav>
          <RoomExperienceTools gameId="spy" phase={room.phase} />
          {room.deadlineAt ? <Countdown deadlineAt={room.deadlineAt} phase={room.phase} /> : null}
          {error ? <ErrorBanner error={error} /> : null}

          {tab === "game" ? (
            <>
              {room.devMode ? <DevPanel room={room} emitAction={emitAction} /> : null}
              <GameTab
                room={room}
                roleCardOpen={roleCardOpen}
                setRoleCardOpen={setRoleCardOpen}
                emitAction={emitAction}
              />
            </>
          ) : null}
          {tab === "chat" ? <ChatTab room={room} message={message} setMessage={setMessage} sendMessage={sendMessage} chatRef={chatRef} sectionRef={chatSectionRef} inputRef={chatInputRef} unreadAnchorId={unreadAnchorId} /> : null}
          {tab === "settings" ? <SettingsTab room={room} isHost={isHost} emitAction={emitAction} /> : null}
        </div>
      </section>
      {leaveModalOpen ? (
        <Modal title="Выйти из игры?" onClose={() => setLeaveModalOpen(false)}>
          <p className="text-slate-600 dark:text-white/65">Вы сможете вернуться за того же игрока с главной страницы. Пока вас нет, партия продолжится.</p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={leaveRoom}>Да, выйти</Button>
            <Button variant="secondary" onClick={() => setLeaveModalOpen(false)}>Остаться</Button>
          </div>
        </Modal>
      ) : null}
    </AppShell>
  );
}

function RoomHeader({ room, copied, copyInvite, requestLeave }: { room: PublicSpyRoomState; copied: boolean; copyInvite: () => void; requestLeave: () => void }) {
  const connected = room.players.filter((player) => player.connected || player.isBot).length;
  return (
    <header className="rounded-[1.25rem] border border-line bg-white/90 p-4 shadow-sm dark:border-white/10 dark:bg-slate-900/80 sm:p-5">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-slate-500 dark:text-white/55">
            <span className="tracking-[0.22em] text-coral">Комната {room.code}</span>
            <span className="rounded-full border border-line px-3 py-1 dark:border-white/10">{connected} / {room.settings.maxPlayers}</span>
            <span className="rounded-full border border-line px-3 py-1 dark:border-white/10">{room.visibility === "public" ? "Открытая" : "Закрытая"}</span>
            <span className="rounded-full border border-line px-3 py-1 dark:border-white/10">{phaseLabels[room.phase]}</span>
          </div>
          <h1 className="mt-3 font-display text-4xl font-semibold sm:text-5xl">Шпион</h1>
          <p className="mt-2 text-sm text-slate-600 dark:text-white/60">{phaseHint(room)}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="secondary" onClick={copyInvite}>{copied ? "Скопировано" : "Пригласить"}</Button>
          <Button variant="ghost" onClick={requestLeave}>Выйти</Button>
        </div>
      </div>
    </header>
  );
}

function GameTab({ room, roleCardOpen, setRoleCardOpen, emitAction }: {
  room: PublicSpyRoomState;
  roleCardOpen: boolean;
  setRoleCardOpen: (open: boolean) => void;
  emitAction: (event: string, payload?: unknown, onSuccess?: () => void) => void;
}) {
  if (room.phase === "LOBBY") return <Lobby room={room} emitAction={emitAction} />;
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_19rem]">
      <main className="min-w-0 rounded-[1.25rem] border border-line bg-white/85 p-4 dark:border-white/10 dark:bg-slate-900/65 sm:p-6">
        {room.phase === "ROLE_REVEAL" ? <RoleReveal room={room} open={roleCardOpen} setOpen={setRoleCardOpen} emitAction={emitAction} /> : null}
        {room.phase === "WAITING_FOR_CONFIRMATION" ? <RoleConfirmation room={room} emitAction={emitAction} /> : null}
        {room.phase === "DISCUSSION" ? <Discussion room={room} emitAction={emitAction} /> : null}
        {room.phase === "SPY_GUESS" ? <SpyGuess room={room} emitAction={emitAction} /> : null}
        {(room.phase === "VOTING" || room.phase === "REVOTE") ? <Voting room={room} emitAction={emitAction} /> : null}
        {room.phase === "ROUND_RESULT" ? <RoundResult room={room} emitAction={emitAction} /> : null}
        {room.phase === "GAME_RESULT" ? <GameResult room={room} emitAction={emitAction} /> : null}
      </main>
      <PlayersPanel room={room} emitAction={emitAction} />
    </div>
  );
}

function Lobby({ room, emitAction }: { room: PublicSpyRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  const active = room.players.filter((player) => player.connected || player.isBot);
  const ready = active.filter((player) => player.ready).length;
  const canStart = active.length >= 3 && (!room.settings.requireReady || ready === active.length);
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <section className="rounded-[1.25rem] border border-line bg-white/85 p-4 dark:border-white/10 dark:bg-slate-900/65 sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><Eyebrow>Участники</Eyebrow><h2 className="mt-1 font-display text-3xl font-semibold">Готовы играть</h2></div>
          <span className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black dark:bg-white/5">{ready} / {active.length} готовы</span>
        </div>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          {room.players.map((player) => (
            <article key={player.id} className="flex min-w-0 items-center gap-3 rounded-xl border border-line bg-white p-3 dark:border-white/10 dark:bg-slate-950/55">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral/12 font-black text-coral">{player.name.slice(0, 1).toUpperCase()}</span>
              <div className="min-w-0 flex-1"><p className="truncate font-bold">{player.name}{player.id === room.ownPlayerId ? " · вы" : ""}</p><p className={`text-xs font-bold ${player.connected ? "text-mint" : "text-coral"}`}>{player.connected || player.isBot ? "online" : "offline"}{player.isHost ? " · ведущий" : ""}</p></div>
              <span className={`h-3 w-3 rounded-full ${player.ready ? "bg-mint" : "bg-slate-300 dark:bg-slate-700"}`} title={player.ready ? "Готов" : "Не готов"} />
            </article>
          ))}
        </div>
        <div className="mt-5 flex flex-wrap gap-3">
          <Button className={own?.ready ? undefined : "ready-attention"} onClick={() => emitAction("spy:ready", { ready: !own?.ready })}>{own?.ready ? "Отменить готовность" : "Я готов"}</Button>
          {own?.isHost ? <Button variant="secondary" disabled={!canStart} onClick={() => emitAction("spy:start_game")}>Начать игру</Button> : null}
        </div>
      </section>
      <aside className="rounded-[1.25rem] border border-line bg-white/85 p-5 dark:border-white/10 dark:bg-slate-900/65">
        <Eyebrow>Как играть</Eyebrow>
        <h2 className="mt-2 font-display text-2xl font-semibold">Не выдайте локацию</h2>
        <ol className="mt-4 space-y-3 text-sm leading-6 text-slate-600 dark:text-white/60">
          <li>1. Посмотрите личную роль.</li><li>2. Задавайте осторожные вопросы.</li><li>3. Найдите шпиона или угадайте локацию.</li>
        </ol>
      </aside>
    </div>
  );
}

function RoleReveal({ room, open, setOpen, emitAction }: { room: PublicSpyRoomState; open: boolean; setOpen: (open: boolean) => void; emitAction: (event: string, payload?: unknown, onSuccess?: () => void) => void }) {
  const privateState = room.privateState;
  if (!privateState) return <WaitingCard title="Вы наблюдаете за раундом" text="Секретная карточка выдается только участникам текущего раунда." />;
  if (!open) return <WaitingCard title="Карточка закрыта" text="Не открывайте ее, когда кто-то смотрит на экран."><Button onClick={() => setOpen(true)}>Посмотреть еще раз</Button></WaitingCard>;
  return (
    <div className={`mx-auto max-w-xl rounded-[1.5rem] border p-6 text-center shadow-soft sm:p-8 ${privateState.isSpy ? "border-coral/40 bg-gradient-to-br from-slate-950 to-[#24141b] text-white" : "border-line bg-gradient-to-br from-white to-orange-50 dark:border-white/10 dark:from-slate-950 dark:to-[#17212b]"}`}>
      <Eyebrow>{privateState.isSpy ? "Секретная роль" : "Ваша локация"}</Eyebrow>
      <h2 className={`mt-4 font-display text-4xl font-semibold sm:text-5xl ${privateState.isSpy ? "text-coral" : ""}`}>{privateState.isSpy ? "Вы — шпион" : privateState.location?.name}</h2>
      {privateState.isSpy ? <p className="mx-auto mt-4 max-w-sm text-white/65">Узнайте локацию по вопросам и ответам. Не выдайте себя.</p> : <><p className="mt-3 text-slate-600 dark:text-white/60">{privateState.location?.description}</p>{room.settings.useLocationRoles ? <div className="mt-6 rounded-xl bg-slate-950/5 p-4 dark:bg-white/5"><p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Ваша роль</p><p className="mt-2 text-2xl font-black">{privateState.locationRole}</p></div> : null}</>}
      <Button className="mt-7 w-full" onClick={() => emitAction("spy:view_role", {}, () => setOpen(false))}>Я запомнил</Button>
    </div>
  );
}

function RoleConfirmation({ room, emitAction }: { room: PublicSpyRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const confirmed = room.round?.confirmedCount ?? 0;
  const total = room.round?.activePlayersCount ?? 0;
  const ownConfirmed = room.privateState?.hasConfirmedRole;
  return <WaitingCard title="Все посмотрели роли" text="Подтвердите готовность, и обсуждение начнется автоматически после ответа всех игроков."><ReadyProgress value={confirmed} total={total} />{room.privateState ? <Button className={ownConfirmed ? undefined : "ready-attention"} disabled={ownConfirmed} onClick={() => emitAction("spy:confirm_role")}>{ownConfirmed ? "Готовность подтверждена" : "Готов к обсуждению"}</Button> : null}</WaitingCard>;
}

function Discussion({ room, emitAction }: { room: PublicSpyRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  const questioner = room.players.find((player) => player.id === room.round?.currentQuestionerId);
  const responder = room.players.find((player) => player.id === room.round?.currentResponderId);
  const earlyVotes = room.round?.earlyVotePlayerIds.length ?? 0;
  return (
    <div>
      <Eyebrow>Раунд {room.currentRound}</Eyebrow><h2 className="mt-2 font-display text-4xl font-semibold">Обсуждение</h2>
      <p className="mt-3 max-w-2xl text-slate-600 dark:text-white/60">Задавайте вопросы так, чтобы проверить собеседника, но не назвать локацию слишком прямо.</p>
      {room.settings.questionMode === "turns" ? <div className="mt-5 rounded-[1.25rem] border border-coral/30 bg-coral/10 p-5"><p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Текущая пара</p><p className="mt-2 text-xl font-black">{questioner?.name ?? "—"} спрашивает {responder?.name ?? "—"}</p>{(room.ownPlayerId === questioner?.id || room.ownPlayerId === responder?.id) ? <Button className="mt-4" onClick={() => emitAction("spy:question_answered")}>Ответ получен</Button> : null}</div> : null}
      {room.settings.showLocationList && room.privateState?.availableLocations ? <LocationList locations={room.privateState.availableLocations} /> : null}
      <div className="mt-6 flex flex-wrap gap-3">
        {room.settings.allowEarlyVoting && room.privateState ? <Button disabled={room.round?.earlyVotePlayerIds.includes(room.ownPlayerId)} onClick={() => emitAction("spy:request_voting")}>{room.round?.earlyVotePlayerIds.includes(room.ownPlayerId) ? "Голос учтен" : "Перейти к голосованию"} · {earlyVotes}</Button> : null}
        {room.privateState?.isSpy && room.settings.allowSpyGuess ? <Button variant="secondary" onClick={() => emitAction("spy:start_guess")}>Угадать локацию</Button> : null}
        {own?.isHost ? <Button variant="ghost" onClick={() => emitAction("spy:begin_voting")}>Начать голосование</Button> : null}
      </div>
    </div>
  );
}

function SpyGuess({ room, emitAction }: { room: PublicSpyRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const [selected, setSelected] = useState("");
  const isGuessing = room.round?.guessingSpyId === room.ownPlayerId;
  if (!isGuessing) return <WaitingCard title="Шпион выбирает локацию" text="Результат попытки сразу завершит раунд или продолжит поиск оставшихся шпионов." />;
  const locations = room.privateState?.availableLocations ?? [];
  return <div><Eyebrow>Решающий выбор</Eyebrow><h2 className="mt-2 font-display text-4xl font-semibold">Где вы находитесь?</h2><p className="mt-3 text-slate-600 dark:text-white/60">Выберите одну локацию. После подтверждения изменить ответ нельзя.</p><div className="mt-5 grid max-h-[28rem] gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{locations.map((location) => <ChoiceCard key={location.id} selected={selected === location.id} onClick={() => setSelected(location.id)} title={location.name} />)}</div><Button className="mt-5" disabled={!selected} onClick={() => emitAction("spy:guess_location", { locationId: selected })}>Подтвердить локацию</Button></div>;
}

function Voting({ room, emitAction }: { room: PublicSpyRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const privateState = room.privateState;
  const ownPlayer = room.players.find((player) => player.id === room.ownPlayerId);
  const candidates = room.players.filter((player) => player.id !== room.ownPlayerId && !room.round?.foundSpyIds.includes(player.id) && (!room.round?.revoteCandidateIds || room.round.revoteCandidateIds.includes(player.id)));
  if (!privateState) return <WaitingCard title="Идет голосование" text={`${room.round?.votesSubmitted ?? 0} игроков уже подтвердили свой выбор.`} />;
  const hostResolvesTie = room.phase === "REVOTE" && room.settings.tieMode === "host" && ownPlayer?.isHost;
  return <div><Eyebrow>{room.phase === "REVOTE" ? "Ничья" : "Тайное голосование"}</Eyebrow><h2 className="mt-2 font-display text-4xl font-semibold">{hostResolvesTie ? "Выберите кандидата" : room.phase === "REVOTE" ? "Переголосование" : "Кто шпион?"}</h2><p className="mt-3 text-slate-600 dark:text-white/60">{hostResolvesTie ? "По настройкам комнаты окончательное решение после ничьей принимает ведущий." : "Выбор скрыт до результата. За себя голосовать нельзя, подтвержденный голос изменить нельзя."}</p><div className="mt-5 grid gap-2 sm:grid-cols-2">{candidates.map((player) => hostResolvesTie ? <button key={player.id} className="rounded-xl border border-line bg-white p-4 text-left font-bold transition hover:border-coral hover:bg-coral/10 dark:border-white/10 dark:bg-slate-950/50" onClick={() => emitAction("spy:resolve_host_tie", { targetId: player.id })}>{player.name}<span className="mt-1 block text-xs text-coral">Выбрать решением ведущего</span></button> : <ChoiceCard key={player.id} title={player.name} subtitle={player.connected || player.isBot ? "online" : "offline"} selected={privateState.selectedVoteId === player.id} disabled={privateState.hasConfirmedVote} onClick={() => emitAction("spy:select_vote", { targetId: player.id })} />)}</div>{!hostResolvesTie ? <div className="mt-5 flex flex-wrap items-center gap-3"><Button disabled={!privateState.selectedVoteId || privateState.hasConfirmedVote} onClick={() => emitAction("spy:confirm_vote")}>{privateState.hasConfirmedVote ? "Голос подтвержден" : "Подтвердить голос"}</Button><ReadyProgress value={room.round?.votesSubmitted ?? 0} total={room.round?.activePlayersCount ?? 0} compact /></div> : null}</div>;
}

function RoundResult({ room, emitAction }: { room: PublicSpyRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const result = room.round?.result;
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  if (!result) return null;
  const spies = result.spyIds.map((id) => room.players.find((player) => player.id === id)?.name ?? "Неизвестный");
  return <div><Eyebrow>Раунд {result.roundNumber} завершен</Eyebrow><h2 className="mt-2 font-display text-4xl font-semibold">{result.winningSide === "spies" ? "Победили шпионы" : "Победили обычные игроки"}</h2><p className="mt-3 text-slate-600 dark:text-white/60">{resultReason(result.reason)}</p><div className="mt-6 grid gap-3 sm:grid-cols-2"><ResultCard label="Локация" value={result.location.name} /><ResultCard label="Шпионы" value={spies.join(", ")} /></div><ScoreTable room={room} roundOnly />{own?.isHost ? <Button className="mt-5" onClick={() => emitAction("spy:continue_game")}>{room.settings.totalRounds !== null && room.currentRound >= room.settings.totalRounds ? "Показать итоги игры" : "Следующий раунд"}</Button> : null}</div>;
}

function GameResult({ room, emitAction }: { room: PublicSpyRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  const leader = [...room.players].sort((a, b) => b.score - a.score)[0];
  return <div><Eyebrow>Игра завершена</Eyebrow><h2 className="mt-2 font-display text-4xl font-semibold">Победитель — {leader?.name ?? "—"}</h2><p className="mt-3 text-slate-600 dark:text-white/60">Сыграно раундов: {room.roundHistory.length}. Итог определяется по сумме очков.</p><ScoreTable room={room} />{own?.isHost ? <Button className="mt-5" onClick={() => emitAction("spy:continue_game")}>Вернуться в лобби</Button> : null}</div>;
}

function PlayersPanel({ room, emitAction }: { room: PublicSpyRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const own = room.players.find((player) => player.id === room.ownPlayerId);
  return <aside className="rounded-[1.25rem] border border-line bg-white/85 p-4 dark:border-white/10 dark:bg-slate-900/65"><div className="flex items-center justify-between"><h2 className="font-display text-2xl font-semibold">Игроки</h2><span className="rounded-xl bg-slate-100 px-2.5 py-1 text-xs font-black dark:bg-white/5">{room.players.length}</span></div><div className="mt-4 max-h-[34rem] space-y-2 overflow-y-auto pr-1">{room.players.map((player) => <article key={player.id} className="rounded-xl border border-line bg-white p-3 dark:border-white/10 dark:bg-slate-950/45"><div className="flex items-center gap-2"><span className={`h-2.5 w-2.5 rounded-full ${player.connected || player.isBot ? "bg-mint" : "bg-coral"}`} /><p className="min-w-0 flex-1 truncate font-bold">{player.name}</p><strong className="text-sm text-coral">{player.score}</strong></div><div className="mt-1 flex items-center justify-between text-[0.68rem] font-bold uppercase tracking-[0.1em] text-slate-400"><span>{player.isHost ? "ведущий" : player.isBot ? "бот" : player.connected ? "online" : "offline"}</span>{room.round?.foundSpyIds.includes(player.id) ? <span className="text-coral">найден</span> : null}</div>{own?.isHost && player.id !== own.id && room.phase === "LOBBY" ? <div className="mt-2 flex gap-2"><button className="text-xs font-bold text-coral" onClick={() => emitAction("spy:kick_player", { playerId: player.id })}>Удалить</button><button className="text-xs font-bold text-slate-500 dark:text-white/50" onClick={() => emitAction("spy:transfer_host", { playerId: player.id })}>Сделать ведущим</button></div> : null}</article>)}</div></aside>;
}

function DevPanel({ room, emitAction }: { room: PublicSpyRoomState; emitAction: (event: string, payload?: unknown) => void }) {
  const [locationId, setLocationId] = useState("");
  const [spyId, setSpyId] = useState("");
  const secrets = room.devSecrets;
  return (
    <section className="mt-4 rounded-[1.25rem] border border-amber-400/40 bg-amber-50/80 p-4 text-slate-900 dark:bg-amber-400/10 dark:text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-xs font-black uppercase tracking-[0.2em] text-amber-600 dark:text-amber-300">Dev / test</p><h2 className="mt-1 font-display text-2xl font-semibold">Управление симуляцией</h2></div>
        <div className="flex flex-wrap gap-2"><Button variant="secondary" onClick={() => emitAction("spy:dev_advance")}>Следующая фаза</Button><Button variant="secondary" onClick={() => emitAction("spy:dev_simulate_round")}>Весь раунд</Button><Button variant="secondary" onClick={() => emitAction("spy:dev_simulate_game")}>Игра до финала</Button></div>
      </div>
      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_1fr_auto]">
        <CustomSelect value={locationId} options={[{ value: "", label: "Случайная локация" }, ...spyLocations.map((location) => ({ value: location.id, label: location.name }))]} disabled={false} onChange={setLocationId} />
        <CustomSelect value={spyId} options={[{ value: "", label: "Случайный шпион" }, ...room.players.filter((player) => player.connected || player.isBot).map((player) => ({ value: player.id, label: player.name }))]} disabled={false} onChange={setSpyId} />
        <Button onClick={() => emitAction("spy:dev_restart_round", { locationId: locationId || undefined, spyIds: spyId ? [spyId] : undefined })}>Перезапустить раунд</Button>
      </div>
      <div className="mt-3 flex flex-wrap gap-2"><Button variant="ghost" onClick={() => emitAction("spy:dev_add_bot")}>+ Бот</Button><Button variant="ghost" onClick={() => emitAction("spy:dev_remove_bot")}>− Бот</Button>{room.players.filter((player) => player.isBot).map((player) => <button key={player.id} className={`rounded-xl border px-3 py-2 text-xs font-bold ${player.connected ? "border-mint/40 text-mint" : "border-coral/40 text-coral"}`} onClick={() => emitAction("spy:dev_toggle_connection", { playerId: player.id })}>{player.name}: {player.connected ? "online" : "offline"}</button>)}</div>
      {secrets?.location ? <div className="mt-4 grid gap-2 rounded-xl bg-white/65 p-3 text-sm dark:bg-slate-950/45 sm:grid-cols-2"><p><strong>Локация:</strong> {secrets.location.name}</p><p><strong>Шпионы:</strong> {secrets.spyIds.map((id) => room.players.find((player) => player.id === id)?.name).join(", ")}</p>{room.players.filter((player) => !secrets.spyIds.includes(player.id) && secrets.rolesByPlayerId[player.id]).map((player) => <p key={player.id}><strong>{player.name}:</strong> {secrets.rolesByPlayerId[player.id]}</p>)}</div> : null}
    </section>
  );
}

function SettingsTab({ room, isHost, emitAction }: { room: PublicSpyRoomState; isHost: boolean; emitAction: (event: string, payload?: unknown) => void }) {
  const [customName, setCustomName] = useState("");
  const [customRoles, setCustomRoles] = useState("");
  const settings = room.settings;
  const update = (patch: Partial<SpySettings>) => emitAction("spy:update_settings", patch);
  const allLocations = [...spyLocations, ...settings.customLocations];
  const disabled = !isHost || room.phase !== "LOBBY";
  function addCustomLocation() {
    const roles = customRoles.split(",").map((role) => role.trim()).filter(Boolean);
    if (!customName.trim() || roles.length < 3) return;
    const id = `custom-${Date.now().toString(36)}`;
    const location: SpyLocation = { id, name: customName.trim(), description: "Пользовательская локация", roles, custom: true };
    update({ customLocations: [...settings.customLocations, location], enabledLocationIds: [...settings.enabledLocationIds, id] });
    setCustomName(""); setCustomRoles("");
  }
  return (
    <div className="mt-4 grid gap-4 xl:grid-cols-2">
      <SettingsSection title="Основные правила" description="Количество шпионов, раундов и формат вопросов.">
        <SettingSelect label="Количество шпионов" help="Авто назначает одного шпиона при 3–7 игроках и двух при 8–12." disabled={disabled} value={String(settings.spyCount)} onChange={(value) => update({ spyCount: value === "auto" ? "auto" : Number(value) })} options={[['auto','Автоматически'],['1','1 шпион'],['2','2 шпиона'],['3','3 шпиона']]} />
        <SettingSelect label="Количество раундов" help="Бесконечный режим продолжается, пока ведущий не завершит игру." disabled={disabled} value={settings.totalRounds === null ? "infinite" : String(settings.totalRounds)} onChange={(value) => update({ totalRounds: value === "infinite" ? null : Number(value) })} options={[['1','1 раунд'],['3','3 раунда'],['5','5 раундов'],['10','10 раундов'],['infinite','Без ограничения']]} />
        <SettingSelect label="Режим вопросов" help="В пошаговом режиме интерфейс показывает, кто спрашивает и кто отвечает." disabled={disabled} value={settings.questionMode} onChange={(value) => update({ questionMode: value as SpySettings["questionMode"] })} options={[['free','Свободное обсуждение'],['turns','По очереди']]} />
        <SettingSelect label="Ничья" help="При переголосовании проводится до двух дополнительных голосований." disabled={disabled} value={settings.tieMode} onChange={(value) => update({ tieMode: value as SpySettings["tieMode"] })} options={[['revote','Переголосование'],['no_result','Никто не найден'],['host','Решает ведущий'],['random','Случайный кандидат']]} />
      </SettingsSection>
      <SettingsSection title="Таймеры" description="Нулевое время отключает таймер обсуждения.">
        <SettingSelect label="Обсуждение" help="После таймера начнется голосование или победят шпионы, если автопереход выключен." disabled={disabled} value={String(settings.discussionTimeSec)} onChange={(value) => update({ discussionTimeSec: Number(value) })} options={[['0','Без таймера'],['180','3 минуты'],['300','5 минут'],['420','7 минут'],['600','10 минут']]} />
        <SettingSelect label="Голосование" help="Неподтвержденные голоса не учитываются после окончания времени." disabled={disabled} value={String(settings.votingTimeSec)} onChange={(value) => update({ votingTimeSec: Number(value) })} options={[['30','30 секунд'],['45','45 секунд'],['60','60 секунд'],['90','90 секунд']]} />
        <Toggle label="Автопереход к голосованию" help="По окончании обсуждения голосование начнется автоматически." checked={settings.autoStartVoting} disabled={disabled} onChange={(value) => update({ autoStartVoting: value })} />
        <Toggle label="Досрочное голосование" help="Игроки смогут большинством завершить обсуждение раньше." checked={settings.allowEarlyVoting} disabled={disabled} onChange={(value) => update({ allowEarlyVoting: value })} />
      </SettingsSection>
      <SettingsSection title="Роли и подсказки" description="Настройте доступную игрокам информацию.">
        <Toggle label="Роли внутри локации" help="Обычные игроки получают профессию или роль, связанную с локацией." checked={settings.useLocationRoles} disabled={disabled} onChange={(value) => update({ useLocationRoles: value })} />
        <Toggle label="Обязательная готовность" help="Ведущий не сможет начать игру, пока не готовы все участники." checked={settings.requireReady} disabled={disabled} onChange={(value) => update({ requireReady: value })} />
        <Toggle label="Шпион угадывает локацию" help="Во время обсуждения шпион может сделать одну решающую попытку." checked={settings.allowSpyGuess} disabled={disabled} onChange={(value) => update({ allowSpyGuess: value })} />
        <Toggle label="Последний шанс" help="Найденный шпион получает попытку угадать локацию перед выбыванием." checked={settings.lastChance} disabled={disabled} onChange={(value) => update({ lastChance: value })} />
        <Toggle label="Показывать список локаций" help="Шпион видит список возможных мест во время обсуждения." checked={settings.showLocationList} disabled={disabled} onChange={(value) => update({ showLocationList: value })} />
        <Toggle label="Система очков" help="Начисляет очки за победу команды, верный голос и догадку шпиона." checked={settings.useScoring} disabled={disabled} onChange={(value) => update({ useScoring: value })} />
      </SettingsSection>
      <SettingsSection title={`Локации · ${settings.enabledLocationIds.length}`} description="Отключенные места не попадутся в новых раундах.">
        <div className="grid max-h-72 gap-2 overflow-y-auto pr-1 sm:grid-cols-2">{allLocations.map((location) => <Toggle key={location.id} label={location.name} checked={settings.enabledLocationIds.includes(location.id)} disabled={disabled} compact onChange={(checked) => update({ enabledLocationIds: checked ? [...settings.enabledLocationIds, location.id] : settings.enabledLocationIds.filter((id) => id !== location.id) })} />)}</div>
        <div className="mt-4 grid gap-2"><input disabled={disabled} className="rounded-xl border border-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Название своей локации" value={customName} onChange={(event) => setCustomName(event.target.value)} /><input disabled={disabled} className="rounded-xl border border-line bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-slate-950" placeholder="Роли через запятую, минимум 3" value={customRoles} onChange={(event) => setCustomRoles(event.target.value)} /><Button variant="secondary" disabled={disabled || !customName.trim() || customRoles.split(",").filter(Boolean).length < 3} onClick={addCustomLocation}>Добавить локацию</Button></div>
        <div className="mt-4 space-y-2"><Toggle label="Разрешить повторения" checked={settings.allowRepeatLocations} disabled={disabled} onChange={(value) => update({ allowRepeatLocations: value })} /><Toggle label="Скрывать использованные" checked={settings.hideUsedLocations} disabled={disabled} onChange={(value) => update({ hideUsedLocations: value })} /></div>
      </SettingsSection>
      {!isHost ? <p className="xl:col-span-2 rounded-xl bg-slate-100 p-3 text-sm text-slate-500 dark:bg-white/5 dark:text-white/50">Настройки может менять только ведущий в лобби.</p> : null}
    </div>
  );
}

function ChatTab({ room, message, setMessage, sendMessage, chatRef, sectionRef, inputRef, unreadAnchorId }: { room: PublicSpyRoomState; message: string; setMessage: (value: string) => void; sendMessage: () => void; chatRef: React.RefObject<HTMLDivElement>; sectionRef: React.RefObject<HTMLElement>; inputRef: React.RefObject<HTMLInputElement>; unreadAnchorId: string | null }) {
  return (
    <section ref={sectionRef} className="mt-4 flex h-[30rem] min-h-0 scroll-mt-4 flex-col rounded-[1.25rem] border border-line bg-white/85 p-4 dark:border-white/10 dark:bg-slate-900/65 sm:h-[34rem]">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-3xl font-semibold">Чат комнаты</h2>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-black text-slate-500 dark:bg-slate-950/50 dark:text-white/60">{room.chatMessages.length}</span>
      </div>
      <div ref={chatRef} className="mt-4 min-h-0 flex-1 space-y-2 overflow-y-auto overscroll-contain rounded-xl bg-slate-100/70 p-3 dark:bg-slate-950/55">
        {room.chatMessages.length ? room.chatMessages.map((item) => (
          <div key={item.id} data-chat-message-id={item.id}>
            {unreadAnchorId === item.id ? (
              <div className="my-3 flex items-center gap-3 text-xs font-black uppercase tracking-[0.18em] text-coral">
                <span className="h-px flex-1 bg-coral/30" />
                Новые сообщения
                <span className="h-px flex-1 bg-coral/30" />
              </div>
            ) : null}
            <article className="rounded-xl bg-white p-3 dark:bg-slate-900">
              <div className="flex justify-between gap-3">
                <strong className="text-sm text-coral">{item.playerName}</strong>
                <time className="text-xs text-slate-400">{new Date(item.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</time>
              </div>
              <p className="mt-1 break-words text-sm text-slate-700 dark:text-white/70">{item.text}</p>
            </article>
          </div>
        )) : <p className="p-4 text-center text-sm text-slate-400">Пока нет сообщений</p>}
      </div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <input ref={inputRef} className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 dark:border-white/10 dark:bg-slate-950" placeholder="Написать сообщение..." value={message} maxLength={280} onChange={(event) => setMessage(event.target.value)} onKeyDown={(event) => event.key === "Enter" && sendMessage()} />
        <Button disabled={!message.trim()} onClick={sendMessage}>Отправить</Button>
      </div>
    </section>
  );
}

function SettingsSection({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return <section className="rounded-[1.25rem] border border-line bg-white/85 p-4 dark:border-white/10 dark:bg-slate-900/65 sm:p-5"><h2 className="font-display text-2xl font-semibold">{title}</h2><p className="mt-1 text-sm text-slate-500 dark:text-white/50">{description}</p><div className="mt-4 space-y-3">{children}</div></section>;
}

function SettingSelect({ label, help, value, options, disabled, onChange }: { label: string; help: string; value: string; options: string[][]; disabled: boolean; onChange: (value: string) => void }) {
  return <div><span className="mb-1.5 flex items-center gap-2 text-sm font-bold">{label}<Info text={help} /></span><CustomSelect value={value} options={options.map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }))} disabled={disabled} onChange={onChange} /></div>;
}

function CustomSelect({ value, options, disabled, onChange }: { value: string; options: SelectOption[]; disabled: boolean; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const selected = options.find((option) => option.value === value) ?? options[0];

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", closeOnOutside);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnOutside);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  return (
    <div ref={containerRef} className={`relative ${open ? "z-50" : "z-0"}`}>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        disabled={disabled}
        className="flex w-full items-center justify-between rounded-xl border border-line bg-white px-4 py-3 text-left text-sm font-bold text-ink shadow-sm transition hover:border-coral/50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-slate-950 dark:text-white"
        onClick={() => setOpen((current) => !current)}
      >
        <span className="truncate">{selected?.label}</span>
        <span className={`ml-3 text-coral transition-transform ${open ? "rotate-180" : ""}`}>⌄</span>
      </button>
      {open && !disabled ? (
        <div role="listbox" className="absolute left-0 top-full z-[60] mt-2 max-h-60 w-full min-w-48 overflow-y-auto rounded-2xl border border-line bg-white p-2 shadow-[0_18px_50px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-slate-900">
          {options.map((option) => (
            <button
              key={option.value}
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={`w-full rounded-xl px-3 py-2 text-left text-sm font-bold transition ${option.value === value ? "bg-coral text-white" : "text-slate-600 hover:bg-slate-100 dark:text-white/70 dark:hover:bg-white/10"}`}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function Toggle({ label, help, checked, disabled, compact, onChange }: { label: string; help?: string; checked: boolean; disabled: boolean; compact?: boolean; onChange: (checked: boolean) => void }) {
  return <label className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-white dark:border-white/10 dark:bg-slate-950/50 ${compact ? "px-3 py-2" : "p-3"}`}><span className="min-w-0 text-sm font-bold">{label}{help ? <span className="ml-2 inline-block"><Info text={help} /></span> : null}</span><input type="checkbox" className="peer sr-only" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} /><span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-coral peer-disabled:opacity-45 dark:bg-slate-700"><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></span></label>;
}

function Countdown({ deadlineAt, phase }: { deadlineAt: number; phase: PublicSpyRoomState["phase"] }) {
  const [left, setLeft] = useState(() => Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000)));
  useEffect(() => { const update = () => setLeft(Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000))); update(); const timer = window.setInterval(update, 250); return () => window.clearInterval(timer); }, [deadlineAt]);
  return <div className="mt-3 flex flex-wrap items-center justify-center gap-3 rounded-xl border border-coral/30 bg-coral/10 px-4 py-3"><span className="h-2.5 w-2.5 animate-pulse rounded-full bg-coral" /><span className="text-sm font-black uppercase tracking-[0.12em] text-coral">{phase === "DISCUSSION" ? "До голосования" : phase === "SPY_GUESS" ? "На догадку" : "До конца голосования"}</span><strong className="min-w-20 rounded-xl bg-coral px-3 py-1.5 text-center text-lg text-white">{Math.floor(left / 60)}:{String(left % 60).padStart(2, "0")}</strong></div>;
}

function WaitingCard({ title, text, children }: { title: string; text: string; children?: React.ReactNode }) { return <div className="flex min-h-[24rem] flex-col items-center justify-center text-center"><span className="flex h-16 w-16 items-center justify-center rounded-[1.25rem] bg-coral/10 text-3xl text-coral">?</span><h2 className="mt-5 font-display text-4xl font-semibold">{title}</h2><p className="mt-3 max-w-lg text-slate-600 dark:text-white/60">{text}</p>{children ? <div className="mt-6 flex flex-wrap items-center justify-center gap-3">{children}</div> : null}</div>; }
function ReadyProgress({ value, total, compact }: { value: number; total: number; compact?: boolean }) { return <span className={`inline-flex items-center rounded-xl bg-slate-100 font-black text-slate-600 dark:bg-white/5 dark:text-white/60 ${compact ? "px-3 py-2 text-sm" : "px-4 py-3"}`}>Готовы: {value} / {total}</span>; }
function ChoiceCard({ title, subtitle, selected, disabled, onClick }: { title: string; subtitle?: string; selected: boolean; disabled?: boolean; onClick: () => void }) { return <button type="button" disabled={disabled} className={`rounded-xl border p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-65 ${selected ? "border-coral bg-coral/10 shadow-[0_0_0_2px_rgba(255,99,92,0.12)]" : "border-line bg-white hover:border-coral/50 dark:border-white/10 dark:bg-slate-950/50"}`} onClick={onClick}><strong className="block text-base">{title}</strong>{subtitle ? <span className="mt-1 block text-xs font-bold text-slate-400">{subtitle}</span> : null}</button>; }
function ResultCard({ label, value }: { label: string; value: string }) { return <article className="rounded-xl border border-line bg-slate-50 p-4 dark:border-white/10 dark:bg-slate-950/50"><p className="text-xs font-black uppercase tracking-[0.16em] text-coral">{label}</p><p className="mt-2 text-xl font-black">{value}</p></article>; }
function ScoreTable({ room, roundOnly }: { room: PublicSpyRoomState; roundOnly?: boolean }) { const deltas = room.round?.result?.scoreDeltas ?? {}; return <div className="mt-6 overflow-hidden rounded-xl border border-line dark:border-white/10"><table className="w-full text-left text-sm"><thead className="bg-slate-100 text-xs uppercase tracking-[0.12em] text-slate-500 dark:bg-white/5 dark:text-white/45"><tr><th className="px-4 py-3">Игрок</th>{roundOnly ? <th className="px-4 py-3 text-right">Раунд</th> : null}<th className="px-4 py-3 text-right">Всего</th></tr></thead><tbody>{[...room.players].sort((a,b) => b.score-a.score).map((player) => <tr key={player.id} className="border-t border-line dark:border-white/10"><td className="px-4 py-3 font-bold">{player.name}</td>{roundOnly ? <td className="px-4 py-3 text-right text-mint">+{deltas[player.id] ?? 0}</td> : null}<td className="px-4 py-3 text-right font-black text-coral">{player.score}</td></tr>)}</tbody></table></div>; }
function LocationList({ locations }: { locations: { id: string; name: string }[] }) { return <details className="mt-5 rounded-xl border border-line bg-white dark:border-white/10 dark:bg-slate-950/45"><summary className="cursor-pointer p-4 font-bold">Возможные локации · {locations.length}</summary><div className="grid gap-1 border-t border-line p-4 text-sm text-slate-600 dark:border-white/10 dark:text-white/60 sm:grid-cols-3">{locations.map((location) => <span key={location.id}>{location.name}</span>)}</div></details>; }
function Eyebrow({ children }: { children: React.ReactNode }) { return <p className="text-xs font-black uppercase tracking-[0.22em] text-coral">{children}</p>; }
function Info({ text }: { text: string }) { return <span className="inline-flex h-5 w-5 cursor-help items-center justify-center rounded-full border border-coral/35 text-[0.65rem] font-black text-coral" title={text}>?</span>; }
function ErrorBanner({ error }: { error: string }) { return <p className="mt-4 rounded-xl border border-coral/30 bg-coral/10 p-3 text-sm font-bold text-coral">{error}</p>; }
function CenteredMessage({ text }: { text: string }) { return <AppShell><section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12 text-slate-600 dark:text-white/60">{text}</section></AppShell>; }
function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) { return <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" onClick={onClose}><section className="w-full max-w-lg rounded-[1.5rem] border border-line bg-white p-6 text-ink shadow-2xl dark:border-white/10 dark:bg-slate-950 dark:text-white" onClick={(event) => event.stopPropagation()}><div className="flex items-start justify-between gap-4"><h2 className="font-display text-3xl font-semibold">{title}</h2><button className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-xl dark:bg-white/10" onClick={onClose}>×</button></div><div className="mt-4">{children}</div></section></div>; }

function phaseHint(room: PublicSpyRoomState) {
  if (room.phase === "LOBBY") return "Соберите компанию, настройте правила и отметьте готовность.";
  if (room.phase === "ROLE_REVEAL") return "Посмотрите секретную карточку так, чтобы ее никто не увидел.";
  if (room.phase === "WAITING_FOR_CONFIRMATION") return "Все роли просмотрены. Подтвердите готовность к обсуждению.";
  if (room.phase === "DISCUSSION") return "Задавайте вопросы и ищите шпиона, не раскрывая локацию.";
  if (room.phase === "SPY_GUESS") return "Шпион делает решающую попытку угадать локацию.";
  if (room.phase === "VOTING" || room.phase === "REVOTE") return "Выберите подозреваемого и подтвердите голос.";
  return room.phase === "ROUND_RESULT" ? "Посмотрите результаты и начисленные очки." : "Игра завершена. Сравните итоговые результаты.";
}

function resultReason(reason: NonNullable<PublicSpyRoomState["round"]>["result"] extends infer Result ? Result extends { reason: infer Reason } ? Reason : never : never) {
  const labels: Record<string, string> = { spy_guessed_location: "Шпион правильно угадал локацию.", spy_guess_failed: "Шпион ошибся с локацией.", spy_not_found: "Время вышло, а шпион не найден.", all_spies_found: "Все шпионы были найдены.", wrong_player_eliminated: "Группа выбрала обычного игрока.", voting_tie: "Голосование не выявило шпиона.", host_finished_round: "Ведущий досрочно завершил раунд." };
  return labels[String(reason)] ?? "Раунд завершен.";
}

function rememberRoom(room: PublicSpyRoomState) {
  window.localStorage.setItem(LAST_LEFT_ROOM_KEY, JSON.stringify({ code: room.code, gameId: room.gameId, title: "Шпион", leftAt: Date.now() }));
}

function clearRememberedRoom(code: string) {
  const raw = window.localStorage.getItem(LAST_LEFT_ROOM_KEY);
  if (!raw) return;
  try { const remembered = JSON.parse(raw) as { code?: string }; if (remembered.code === code) window.localStorage.removeItem(LAST_LEFT_ROOM_KEY); } catch { window.localStorage.removeItem(LAST_LEFT_ROOM_KEY); }
}
