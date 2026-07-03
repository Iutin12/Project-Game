"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { crocodileCategories } from "@/games/crocodile/categories";
import type { CrocodileCategoryId, CrocodileDifficultyFilter, CrocodileSettings, PublicCrocodileRoom } from "@/games/crocodile/types";

const LAST_LEFT_ROOM_KEY = "project-game:last-left-room";

type Ack = { ok: boolean; error?: string; playerId?: string; correct?: boolean };

type SettingsPatch = Partial<CrocodileSettings>;

const phaseLabels: Record<PublicCrocodileRoom["phase"], string> = {
  LOBBY: "Лобби",
  ROUND_ACTIVE: "Раунд",
  ROUND_RESULT: "Итоги",
  GAME_OVER: "Финал"
};

const difficultyLabels: Record<CrocodileDifficultyFilter, string> = {
  mixed: "Смешанная",
  easy: "Легкая",
  medium: "Средняя",
  hard: "Сложная"
};

export function CrocodileRoomClient({ code }: { code: string }) {
  const router = useRouter();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<PublicCrocodileRoom | null>(null);
  const [name, setName] = useState("");
  const [guess, setGuess] = useState("");
  const [joined, setJoined] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<"room" | "settings">("room");
  const [timeLeft, setTimeLeft] = useState<number | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  const inviteUrl = typeof window === "undefined" ? "" : `${window.location.origin}/room/${code}`;
  const ownPlayer = room?.players.find((player) => player.id === room.ownPlayerId);
  const host = room?.players.find((player) => player.isHost);
  const explainer = room?.players.find((player) => player.id === room.round?.explainerId);
  const isHost = Boolean(ownPlayer?.isHost);
  const isExplainer = Boolean(ownPlayer && ownPlayer.id === room?.round?.explainerId);
  const canGuess = Boolean(
    room?.phase === "ROUND_ACTIVE" &&
      ownPlayer &&
      !isExplainer &&
      (room.settings.gameMode === "solo" || ownPlayer.teamId === room.round?.activeTeamId)
  );

  useEffect(() => {
    const nextSocket = io({ path: "/socket.io" });
    setSocket(nextSocket);
    nextSocket.on("crocodile_room_updated", (nextRoom: PublicCrocodileRoom) => setRoom(nextRoom));
    nextSocket.on("connect", () => {
      const savedPlayerId = window.localStorage.getItem(`playerId:${code}`);
      const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;

      if (!savedPlayerId) {
        setIsRestoring(false);
        return;
      }

      nextSocket.emit("join_crocodile_room", { code, name: "", hostKey, playerId: savedPlayerId }, (ack: Ack) => {
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
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [room?.chatMessages.length]);

  useEffect(() => {
    if (!room?.round?.deadlineAt || room.phase !== "ROUND_ACTIVE") {
      setTimeLeft(null);
      return undefined;
    }

    const update = () => setTimeLeft(Math.max(0, Math.ceil((room.round!.deadlineAt! - Date.now()) / 1000)));
    update();
    const timer = window.setInterval(update, 500);
    return () => window.clearInterval(timer);
  }, [room?.round?.deadlineAt, room?.phase]);

  useEffect(() => {
    if (!room || room.phase === "GAME_OVER") return undefined;

    const handleBeforeUnload = () => rememberCurrentRoom(room);
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [room]);

  function joinRoom() {
    const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;
    socket?.emit("join_crocodile_room", { code, name, hostKey }, (ack: Ack) => {
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

  function updateSettings(patch: SettingsPatch) {
    emitAction("update_crocodile_settings", patch);
  }

  function sendGuess() {
    const text = guess.trim();
    if (!text) return;
    emitAction("send_crocodile_guess", { text }, () => setGuess(""));
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

  const sortedPlayers = useMemo(() => {
    return [...(room?.players ?? [])].sort((first, second) => {
      if (first.connected !== second.connected) return first.connected ? -1 : 1;
      return second.score - first.score;
    });
  }, [room?.players]);

  if (isRestoring) {
    return (
      <AppShell>
        <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12 text-slate-600">
          Возвращаем вас в комнату Крокодила...
        </section>
      </AppShell>
    );
  }

  if (!joined) {
    return (
      <AppShell>
        <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-coral">Крокодил · комната {code}</p>
          <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Вход в игру</h1>
          <p className="mt-4 text-slate-500">Введите никнейм, чтобы присоединиться к объяснениям и угадываниям.</p>
          <input
            className="mt-8 rounded-md border border-line bg-white px-4 py-3 text-ink shadow-soft outline-none focus:border-coral"
            placeholder="Ваш никнейм"
            value={name}
            maxLength={24}
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") joinRoom();
            }}
          />
          <Button className="mt-3" onClick={joinRoom} disabled={!socket || !name.trim()}>
            Войти
          </Button>
          {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
        </section>
      </AppShell>
    );
  }

  if (!room) return null;

  const connectedCount = room.players.filter((player) => player.connected).length;
  const isRoundActive = room.phase === "ROUND_ACTIVE";

  return (
    <AppShell onLogoClick={leaveRoom}>
      <section className="py-6">
        <div className="rounded-[2rem] border border-slate-700/30 bg-white/80 p-4 text-ink shadow-soft dark:border-slate-700 dark:bg-slate-950 dark:text-white sm:p-6">
          <header className="rounded-[1.5rem] border border-line dark:border-white/10 bg-white/90 dark:bg-slate-900/80 p-5 shadow-soft">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-slate-600 dark:text-white/70">
                  <span className="tracking-[0.28em] text-coral">КОМНАТА {room.code}</span>
                  <span className="rounded-full border border-line dark:border-white/10 px-3 py-1">{connectedCount} / 20 игроков</span>
                  <span className="rounded-full border border-line dark:border-white/10 px-3 py-1">{room.visibility === "public" ? "Открытая" : "Закрытая"}</span>
                  <span className="rounded-full border border-line dark:border-white/10 px-3 py-1">{phaseLabels[room.phase]}</span>
                </div>
                <h1 className="mt-4 font-display text-4xl font-semibold sm:text-5xl">Крокодил</h1>
                <p className="mt-2 max-w-2xl text-slate-600 dark:text-white/65">{getPhaseHint(room, explainer?.name)}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="ghost" className="border-line bg-transparent text-ink hover:bg-slate-100 dark:border-white/15 dark:text-white dark:hover:bg-white/10" onClick={copyInvite}>
                  {copied ? "Ссылка скопирована" : "Пригласить"}
                </Button>
                {room.phase === "LOBBY" && isHost ? (
                  <Button onClick={() => emitAction("start_crocodile_game")}>Начать игру</Button>
                ) : null}
              </div>
            </div>
          </header>

          <div className="mt-5 rounded-[1.35rem] border border-line dark:border-white/10 bg-white/85 dark:bg-slate-900/70 p-2">
            <button
              className={`rounded-2xl px-5 py-3 font-bold ${tab === "room" ? "bg-coral text-white" : "text-slate-500 dark:text-white/60"}`}
              onClick={() => setTab("room")}
            >
              Комната
            </button>
            <button
              className={`rounded-2xl px-5 py-3 font-bold ${tab === "settings" ? "bg-coral text-white" : "text-slate-500 dark:text-white/60"}`}
              onClick={() => setTab("settings")}
            >
              Настройки
            </button>
          </div>

          {error ? <p className="mt-4 rounded-2xl border border-coral/30 bg-coral/10 p-3 text-sm text-coral">{error}</p> : null}

          {tab === "settings" ? (
            <SettingsPanel room={room} isHost={isHost} updateSettings={updateSettings} />
          ) : (
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
              <div className="space-y-5">
                {isRoundActive ? (
                  <RoundPanel
                    room={room}
                    ownPlayerId={room.ownPlayerId}
                    explainerName={explainer?.name}
                    timeLeft={timeLeft}
                    onSkip={() => emitAction("skip_crocodile_word")}
                    onEnd={() => emitAction("end_crocodile_round")}
                  />
                ) : room.phase === "ROUND_RESULT" ? (
                  <ResultPanel room={room} isHost={isHost} onNext={() => emitAction("next_crocodile_round")} />
                ) : room.phase === "GAME_OVER" ? (
                  <GameOverPanel room={room} isHost={isHost} onRestart={() => emitAction("restart_crocodile_game")} />
                ) : (
                  <LobbyPanel room={room} />
                )}

                <PlayersPanel players={sortedPlayers} gameMode={room.settings.gameMode} />
              </div>

              <ChatPanel
                room={room}
                guess={guess}
                canGuess={canGuess}
                setGuess={setGuess}
                sendGuess={sendGuess}
                chatEndRef={chatEndRef}
              />
            </div>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function LobbyPanel({ room }: { room: PublicCrocodileRoom }) {
  return (
    <section className="rounded-[1.5rem] border border-line dark:border-white/10 bg-white/85 dark:bg-slate-900/70 p-5">
      <p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">Ожидание</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Готовим игру</h2>
      <p className="mt-3 text-slate-600 dark:text-white/65">Для старта нужно минимум 3 игрока. Хост может выбрать режим, таймер, категории и количество раундов.</p>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <StatCard label="Режим" value={room.settings.gameMode === "teams" ? "Команды" : "Каждый за себя"} />
        <StatCard label="Раунды" value={room.settings.roundsCount === null ? "Без лимита" : String(room.settings.roundsCount)} />
        <StatCard label="Сложность" value={difficultyLabels[room.settings.difficulty]} />
      </div>
    </section>
  );
}

function RoundPanel({
  room,
  ownPlayerId,
  explainerName,
  timeLeft,
  onSkip,
  onEnd
}: {
  room: PublicCrocodileRoom;
  ownPlayerId: string;
  explainerName?: string;
  timeLeft: number | null;
  onSkip: () => void;
  onEnd: () => void;
}) {
  const isExplainer = ownPlayerId === room.round?.explainerId;
  const activeTeam = room.round?.activeTeamId ? room.round.activeTeamId.replace("team_", "Команда ") : undefined;

  return (
    <section className="rounded-[1.5rem] border border-line dark:border-white/10 bg-white/85 dark:bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">Раунд {room.round?.index}</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">Объясняет {explainerName ?? "игрок"}</h2>
          {activeTeam ? <p className="mt-2 text-slate-500 dark:text-white/60">Угадывает {activeTeam}</p> : null}
        </div>
        {timeLeft !== null ? <div className="rounded-2xl bg-coral px-5 py-3 text-2xl font-black">{formatTime(timeLeft)}</div> : null}
      </div>

      <div className="mt-5 rounded-[1.35rem] border border-line dark:border-white/10 bg-slate-100/80 dark:bg-slate-950/70 p-5">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-slate-400 dark:text-white/45">Слово</p>
        <h3 className="mt-2 font-display text-4xl font-semibold">{room.round?.word?.text ?? "Скрыто"}</h3>
        <p className="mt-2 text-sm text-slate-500 dark:text-white/55">
          {isExplainer ? "Покажите это слово жестами. Не называйте само слово и однокоренные формы." : "Пишите догадки в чат справа."}
        </p>
      </div>

      <div className="mt-4 flex flex-wrap gap-3">
        {isExplainer && room.settings.allowSkipWord ? (
          <Button variant="ghost" className="border-line bg-transparent text-ink hover:bg-slate-100 dark:border-white/15 dark:text-white dark:hover:bg-white/10" onClick={onSkip}>
            Пропустить ({room.settings.maxSkipsPerTurn === null ? "без лимита" : `${room.round?.skipsUsed ?? 0}/${room.settings.maxSkipsPerTurn}`})
          </Button>
        ) : null}
        {(isExplainer || room.players.find((player) => player.id === ownPlayerId)?.isHost) ? <Button onClick={onEnd}>Завершить раунд</Button> : null}
      </div>
    </section>
  );
}

function ResultPanel({ room, isHost, onNext }: { room: PublicCrocodileRoom; isHost: boolean; onNext: () => void }) {
  const lastGuesser = room.players.find((player) => player.id === room.round?.lastGuesserId);

  return (
    <section className="rounded-[1.5rem] border border-line dark:border-white/10 bg-white/85 dark:bg-slate-900/70 p-5">
      <p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">Итоги</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Раунд завершен</h2>
      <p className="mt-3 text-slate-600 dark:text-white/65">
        Последнее угаданное слово: <span className="font-bold text-ink dark:text-white">{room.round?.lastCorrectWord ?? "не было"}</span>
        {lastGuesser ? ` · угадал ${lastGuesser.name}` : ""}
      </p>
      <p className="mt-2 text-slate-500 dark:text-white/55">Угадано слов за раунд: {room.round?.guessedWords.length ?? 0}</p>
      {isHost ? <Button className="mt-5" onClick={onNext}>Следующий раунд</Button> : null}
    </section>
  );
}

function GameOverPanel({ room, isHost, onRestart }: { room: PublicCrocodileRoom; isHost: boolean; onRestart: () => void }) {
  const winners = room.settings.gameMode === "teams"
    ? `Команда ${room.winningTeamId?.replace("team_", "") ?? "?"}`
    : room.players.filter((player) => room.winnerIds?.includes(player.id)).map((player) => player.name).join(", ");

  return (
    <section className="rounded-[1.5rem] border border-line dark:border-white/10 bg-white/85 dark:bg-slate-900/70 p-5">
      <p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">Финал</p>
      <h2 className="mt-2 font-display text-3xl font-semibold">Победитель: {winners || "ничья"}</h2>
      <p className="mt-3 text-slate-600 dark:text-white/65">Можно сыграть еще раз с теми же игроками и настройками.</p>
      {isHost ? <Button className="mt-5" onClick={onRestart}>Создать новое лобби</Button> : null}
    </section>
  );
}

function PlayersPanel({ players, gameMode }: { players: PublicCrocodileRoom["players"]; gameMode: CrocodileSettings["gameMode"] }) {
  return (
    <section className="rounded-[1.5rem] border border-line dark:border-white/10 bg-white/85 dark:bg-slate-900/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold">Игроки</h2>
        <span className="rounded-full bg-slate-100/80 dark:bg-slate-950/70 px-3 py-1 text-sm font-bold text-slate-600 dark:text-white/70">{players.length}</span>
      </div>
      <div className="mt-4 max-h-[24rem] space-y-2 overflow-y-auto pr-1">
        {players.map((player) => (
          <article key={player.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line dark:border-white/10 bg-slate-100/80 dark:bg-slate-950/45 p-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-coral/15 font-black text-coral">
                {player.name.slice(0, 1).toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate font-bold text-ink dark:text-white">{player.name}{player.isHost ? " · хост" : ""}</p>
                <p className={player.connected ? "text-sm text-emerald-400" : "text-sm text-coral"}>{player.connected ? "online" : "offline"}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-black text-ink dark:text-white">{player.score}</p>
              {gameMode === "teams" && player.teamId ? <p className="text-xs text-slate-400 dark:text-white/45">Команда {player.teamId.replace("team_", "")}</p> : null}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ChatPanel({
  room,
  guess,
  canGuess,
  setGuess,
  sendGuess,
  chatEndRef
}: {
  room: PublicCrocodileRoom;
  guess: string;
  canGuess: boolean;
  setGuess: (value: string) => void;
  sendGuess: () => void;
  chatEndRef: React.RefObject<HTMLDivElement>;
}) {
  return (
    <section className="flex min-h-[34rem] flex-col rounded-[1.5rem] border border-line dark:border-white/10 bg-white/85 dark:bg-slate-900/70 p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-3xl font-semibold">Ответы</h2>
        <span className="rounded-full bg-slate-100/80 dark:bg-slate-950/70 px-3 py-1 text-sm font-bold text-slate-600 dark:text-white/70">{room.chatMessages.length}</span>
      </div>
      <div className="mt-4 min-h-0 flex-1 space-y-3 overflow-y-auto rounded-[1.25rem] bg-slate-100/80 dark:bg-slate-950/45 p-4">
        {room.chatMessages.length === 0 ? <p className="text-slate-400 dark:text-white/45">Пока нет ответов. Первый смелый обычно задает темп.</p> : null}
        {room.chatMessages.map((message) => (
          <article key={message.id} className={`rounded-2xl p-3 ${message.correct ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-100" : "bg-white dark:bg-slate-900 text-slate-700 dark:text-white/80"}`}>
            <p className="text-sm font-bold text-coral">{message.playerName}</p>
            <p className="mt-1">{message.text}</p>
            {message.correct ? <p className="mt-1 text-sm font-bold text-emerald-300">Верно</p> : null}
          </article>
        ))}
        <div ref={chatEndRef} />
      </div>
      <div className="mt-4 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-2xl border border-line dark:border-white/10 bg-slate-100/80 dark:bg-slate-950/70 px-4 py-3 text-ink outline-none placeholder:text-slate-400 dark:text-white focus:border-coral"
          placeholder={canGuess ? "Написать ответ..." : "Сейчас вы не угадываете"}
          value={guess}
          disabled={!canGuess}
          onChange={(event) => setGuess(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") sendGuess();
          }}
        />
        <Button onClick={sendGuess} disabled={!canGuess || !guess.trim()}>Отпр.</Button>
      </div>
    </section>
  );
}

function SettingsPanel({
  room,
  isHost,
  updateSettings
}: {
  room: PublicCrocodileRoom;
  isHost: boolean;
  updateSettings: (patch: SettingsPatch) => void;
}) {
  const disabled = !isHost || room.phase !== "LOBBY";
  const settings = room.settings;
  const connectedPlayersCount = room.players.filter((player) => player.connected).length;
  const teamsDisabled = connectedPlayersCount < 4;

  return (
    <section className="mt-5 rounded-[1.5rem] border border-line dark:border-white/10 bg-white/85 dark:bg-slate-900/70 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.22em] text-coral">Настройки</p>
          <h2 className="mt-2 font-display text-3xl font-semibold">Правила Крокодила</h2>
        </div>
        {!isHost ? <span className="text-sm text-slate-500 dark:text-white/50">Менять настройки может только хост</span> : null}
      </div>

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        <SettingCard title="Формат" hint="Выберите, играют ли все сами за себя или игроки делятся на команды. В командном режиме угадывает только активная команда.">
          <Segmented
            disabled={disabled}
            value={settings.gameMode}
            options={[
              { value: "solo", label: "Каждый за себя" },
              { value: "teams", label: teamsDisabled ? "Команды от 4 игроков" : "Команды", disabled: teamsDisabled }
            ]}
            onChange={(value) => updateSettings({ gameMode: value as CrocodileSettings["gameMode"] })}
          />
          <Segmented
            disabled={disabled}
            value={settings.roundMode}
            options={[{ value: "single_word", label: "Одно слово" }, { value: "multiple_words", label: "Много слов" }]}
            onChange={(value) => updateSettings({ roundMode: value as CrocodileSettings["roundMode"] })}
          />
        </SettingCard>

        <SettingCard title="Раунд" hint="Количество раундов определяет, когда игра закончится. Без лимита хост завершает игру вручную через раунды.">
          <SelectRow label="Сложность" hint="Фильтрует слова по сложности. Смешанная сложность берет задания из всех уровней." disabled={disabled} value={settings.difficulty} onChange={(value) => updateSettings({ difficulty: value as CrocodileDifficultyFilter })}>
            {Object.entries(difficultyLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </SelectRow>
          <SelectRow
            label="Раундов"
            hint="Если выбрать без лимита, игра не закончится автоматически по количеству раундов."
            disabled={disabled}
            value={settings.roundsCount === null ? "unlimited" : String(settings.roundsCount)}
            onChange={(value) => updateSettings({ roundsCount: value === "unlimited" ? null : Number(value) })}
          >
            <option value="unlimited">Без лимита</option>
            {[5, 10, 15, 20, 25, 30].map((value) => <option key={value} value={value}>{value}</option>)}
          </SelectRow>
        </SettingCard>

        <SettingCard title="Таймер" hint="Таймер автоматически завершает раунд, когда время истекло. Если выключить, раунд завершает объясняющий или хост.">
          <ToggleRow label="Использовать таймер" hint="Включает ограничение времени на объяснение." checked={settings.useTimer} disabled={disabled} onChange={(value) => updateSettings({ useTimer: value })} />
          <SelectRow label="Время" hint="Сколько секунд длится один раунд с таймером." disabled={disabled || !settings.useTimer} value={String(settings.roundTimeSec)} onChange={(value) => updateSettings({ roundTimeSec: Number(value) })}>
            {[30, 45, 60, 90, 120, 180].map((value) => <option key={value} value={value}>{value} сек</option>)}
          </SelectRow>
        </SettingCard>

        <SettingCard title="Слова" hint="Управляет пулом заданий и пропусками для объясняющего игрока.">
          <ToggleRow label="Добавлять фразы в задания" hint="Если включено, в пул попадут не только одиночные слова, но и фразы вроде 'горячий шоколад'." checked={settings.allowPhrases} disabled={disabled} onChange={(value) => updateSettings({ allowPhrases: value })} />
          <ToggleRow label="Можно пропускать" hint="Разрешает объясняющему заменить текущее слово без начисления очков." checked={settings.allowSkipWord} disabled={disabled} onChange={(value) => updateSettings({ allowSkipWord: value })} />
          <SelectRow
            label="Пропусков"
            hint="Лимит пропусков за один раунд. Без лимита можно менять слова сколько угодно."
            disabled={disabled || !settings.allowSkipWord}
            value={settings.maxSkipsPerTurn === null ? "unlimited" : String(settings.maxSkipsPerTurn)}
            onChange={(value) => updateSettings({ maxSkipsPerTurn: value === "unlimited" ? null : Number(value) })}
          >
            <option value="unlimited">Без лимита</option>
            {[0, 1, 2, 3, 5].map((value) => <option key={value} value={value}>{value}</option>)}
          </SelectRow>
        </SettingCard>
      </div>

      {settings.gameMode === "teams" ? (
        <SettingCard title="Команды" className="mt-4" hint="Командный режим доступен только если в комнате минимум 4 подключенных игрока.">
          <SelectRow label="Количество" hint="Сколько команд будет создано при автоматической раздаче." disabled={disabled} value={String(settings.teamsCount)} onChange={(value) => updateSettings({ teamsCount: Number(value) })}>
            {[2, 3, 4].map((value) => <option key={value} value={value}>{value}</option>)}
          </SelectRow>
          <ToggleRow label="Автоматически раздать команды" hint="Игроки будут распределены по командам при старте игры." checked={settings.autoAssignTeams} disabled={disabled} onChange={(value) => updateSettings({ autoAssignTeams: value })} />
        </SettingCard>
      ) : null}

      <SettingCard title="Категории" className="mt-4" hint="Можно играть со всеми словами или ограничить задания выбранными темами.">
        <Segmented
          disabled={disabled}
          value={settings.wordPoolMode}
          options={[{ value: "all", label: "Все" }, { value: "categories", label: "Выбранные" }]}
          onChange={(value) =>
            updateSettings({
              wordPoolMode: value as CrocodileSettings["wordPoolMode"],
              selectedCategories: value === "all" ? [] : settings.selectedCategories
            })
          }
        />
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {crocodileCategories.map((category) => {
            const checked = settings.selectedCategories.includes(category.id);
            return (
              <label key={category.id} className={`rounded-2xl border p-3 text-sm font-bold ${checked ? "border-coral bg-coral/15 text-white" : "border-line dark:border-white/10 bg-slate-100/80 dark:bg-slate-950/40 text-slate-500 dark:text-white/60"}`}>
                <input
                  type="checkbox"
                  className="sr-only"
                  disabled={disabled || settings.wordPoolMode !== "categories"}
                  checked={checked}
                  onChange={() => updateSettings({ selectedCategories: toggleCategory(settings.selectedCategories, category.id) })}
                />
                {category.title}
              </label>
            );
          })}
        </div>
      </SettingCard>
    </section>
  );
}

function SettingCard({
  title,
  hint,
  className = "",
  children
}: {
  title: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`rounded-[1.25rem] border border-line dark:border-white/10 bg-slate-100/80 dark:bg-slate-950/45 p-4 ${className}`}>
      <h3 className="mb-3 flex items-center gap-2 text-lg font-black text-ink dark:text-white">
        {title}
        {hint ? <Hint text={hint} /> : null}
      </h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Segmented({
  value,
  options,
  disabled,
  onChange
}: {
  value: string;
  options: Array<{ value: string; label: string; disabled?: boolean }>;
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          disabled={disabled || option.disabled}
          className={`rounded-2xl px-4 py-3 font-bold transition disabled:cursor-not-allowed disabled:opacity-45 ${value === option.value ? "bg-coral text-white" : "border border-line dark:border-white/10 bg-white dark:bg-slate-900 text-slate-600 dark:text-white/65 hover:text-ink dark:hover:text-white"}`}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SelectRow({
  label,
  hint,
  value,
  disabled,
  onChange,
  children
}: {
  label: string;
  hint?: string;
  value: string;
  disabled: boolean;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border border-line dark:border-white/10 bg-white dark:bg-slate-900 px-4 py-3">
      <span className="flex items-center gap-2 font-bold text-slate-600 dark:text-white/70">
        {label}
        {hint ? <Hint text={hint} /> : null}
      </span>
      <select
        className="rounded-xl border border-line dark:border-white/10 bg-slate-100 dark:bg-slate-950 px-3 py-2 font-bold text-ink dark:text-white outline-none disabled:opacity-50"
        disabled={disabled}
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {children}
      </select>
    </label>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  disabled,
  onChange
}: {
  label: string;
  hint?: string;
  checked: boolean;
  disabled: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-3 rounded-2xl border border-line dark:border-white/10 bg-white px-4 py-3 dark:bg-slate-900">
      <span className="flex items-center gap-2 font-bold text-slate-600 dark:text-white/70">
        {label}
        {hint ? <Hint text={hint} /> : null}
      </span>
      <input
        type="checkbox"
        className="peer sr-only"
        disabled={disabled}
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="relative h-7 w-12 shrink-0 rounded-full bg-slate-300 transition after:absolute after:left-1 after:top-1 after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow-sm after:transition peer-checked:bg-coral peer-checked:after:translate-x-5 peer-disabled:cursor-not-allowed peer-disabled:opacity-50 peer-focus-visible:ring-2 peer-focus-visible:ring-coral/30 dark:bg-slate-700" />
    </label>
  );
}

function Hint({ text }: { text: string }) {
  return (
    <span
      className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-line bg-white text-xs font-black text-slate-400 shadow-sm dark:border-white/10 dark:bg-slate-900 dark:text-white/50"
      title={text}
      aria-label={text}
    >
      ?
    </span>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-line dark:border-white/10 bg-slate-100/80 dark:bg-slate-950/45 p-4">
      <p className="text-sm text-slate-400 dark:text-white/45">{label}</p>
      <p className="mt-1 font-black text-ink dark:text-white">{value}</p>
    </div>
  );
}

function toggleCategory(categories: CrocodileCategoryId[], categoryId: CrocodileCategoryId) {
  return categories.includes(categoryId) ? categories.filter((item) => item !== categoryId) : [...categories, categoryId];
}

function formatTime(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return `${minutes}:${String(rest).padStart(2, "0")}`;
}

function getPhaseHint(room: PublicCrocodileRoom, explainerName?: string) {
  if (room.phase === "LOBBY") return "Соберите друзей, выберите настройки и запускайте игру.";
  if (room.phase === "ROUND_ACTIVE") return `${explainerName ?? "Игрок"} объясняет слово, остальные угадывают в чате.`;
  if (room.phase === "ROUND_RESULT") return "Раунд завершен. Посмотрите очки и переходите дальше.";
  return "Игра завершена. Хост может быстро создать новое лобби для следующей партии.";
}

function rememberCurrentRoom(room: PublicCrocodileRoom) {
  window.localStorage.setItem(
    LAST_LEFT_ROOM_KEY,
    JSON.stringify({
      code: room.code,
      gameId: room.gameId,
      phase: room.phase,
      visibility: room.visibility,
      leftAt: Date.now()
    })
  );
}

function clearRememberedRoom(code: string) {
  const raw = window.localStorage.getItem(LAST_LEFT_ROOM_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as { code?: string };
    if (parsed.code === code) window.localStorage.removeItem(LAST_LEFT_ROOM_KEY);
  } catch {
    window.localStorage.removeItem(LAST_LEFT_ROOM_KEY);
  }
}
