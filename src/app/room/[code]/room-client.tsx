"use client";

import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { phaseLabels } from "@/games/mafia/phases";
import { roleDescriptions, roleLabels } from "@/games/mafia/roles";
import type { PublicPlayer, PublicRoom } from "@/games/mafia/types";

type Ack = { ok: boolean; error?: string; playerId?: string };

export function RoomClient({ code }: { code: string }) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [name, setName] = useState("");
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteUrl = typeof window === "undefined" ? "" : `${window.location.origin}/room/${code}`;
  const ownPlayer = room?.players.find((player) => player.id === room.ownPlayerId);
  const alivePlayers = room?.players.filter((player) => player.alive) ?? [];
  const deadPlayers = room?.players.filter((player) => !player.alive) ?? [];

  useEffect(() => {
    const nextSocket = io({ path: "/socket.io" });
    setSocket(nextSocket);
    nextSocket.on("room_updated", (nextRoom: PublicRoom) => setRoom(nextRoom));
    return () => {
      nextSocket.disconnect();
    };
  }, []);

  function emitAction(event: string, payload?: unknown) {
    setError("");
    socket?.emit(event, payload ?? {}, (ack: Ack) => {
      if (!ack.ok) setError(ack.error ?? "Действие не выполнено");
    });
  }

  function joinRoom() {
    const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;
    socket?.emit("join_room", { code, name, hostKey }, (ack: Ack) => {
      if (!ack.ok) {
        setError(ack.error ?? "Не удалось войти");
        return;
      }
      setJoined(true);
      setError("");
    });
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  }

  const phaseHint = useMemo(() => {
    if (!room) return "";
    if (room.phase === "NIGHT_MAFIA") return "Город засыпает. Мафия выбирает жертву.";
    if (room.phase === "NIGHT_DETECTIVE") return "Комиссар выходит на проверку.";
    if (room.phase === "NIGHT_DOCTOR") return "Доктор выбирает, кого спасти.";
    if (room.phase === "DAY_DISCUSSION") return "Наступает день. Обсудите события ночи.";
    if (room.phase === "DAY_VOTING") return "Выберите игрока, против которого голосуете.";
    return "Ожидаем запуска игры.";
  }, [room]);

  if (!joined) {
    return (
      <AppShell>
        <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Комната {code}</p>
          <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Вход в игру</h1>
          <input
            className="mt-8 rounded-md border border-line bg-white px-4 py-3 text-ink shadow-soft outline-none focus:border-ocean"
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

  return (
    <AppShell>
      <section className="grid gap-5 py-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Комната {code}</p>
                <h1 className="mt-2 font-display text-5xl font-semibold text-ink">{phaseLabels[room?.phase ?? "LOBBY"]}</h1>
                <p className="mt-3 text-slate-600">{phaseHint}</p>
              </div>
              <Button variant="secondary" onClick={copyInvite}>
                {copied ? "Скопировано" : "Ссылка"}
              </Button>
            </div>
          </div>

          {room ? (
            <>
              <RolePanel room={room} />
              <ActionPanel room={room} emitAction={emitAction} />
              {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-coral">{error}</p> : null}
            </>
          ) : null}
        </div>

        <aside className="space-y-4">
          {room && ownPlayer?.isHost ? (
            <HostPanel room={room} emitAction={emitAction} />
          ) : null}
          <PlayersPanel title="Живые игроки" players={alivePlayers} />
          <PlayersPanel title="Выбывшие" players={deadPlayers} empty="Пока никто не выбыл" />
        </aside>
      </section>
    </AppShell>
  );
}

function RolePanel({ room }: { room: PublicRoom }) {
  const ownRole = room.ownRole;
  const killed = room.players.find((player) => player.id === room.lastNightKilledId);
  const eliminated = room.players.find((player) => player.id === room.lastVoteEliminatedId);

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      {ownRole ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Твоя роль</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-ink">{roleLabels[ownRole]}</h2>
          <p className="mt-2 text-slate-600">{roleDescriptions[ownRole]}</p>
          {room.mafiaAllies.length > 0 ? (
            <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              Союзники: {room.mafiaAllies.map((player) => player.name).join(", ")}
            </p>
          ) : null}
          {room.detectiveResult ? (
            <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              Результат проверки:{" "}
              {room.players.find((player) => player.id === room.detectiveResult?.targetId)?.name} -
              {room.detectiveResult.isMafia ? " мафия" : " не мафия"}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-slate-600">Ожидаем запуска игры.</p>
      )}
      {room.phase === "DAY_DISCUSSION" ? (
        <p className="mt-4 text-slate-700">
          {killed ? `Этой ночью погиб: ${killed.name}` : "Этой ночью никто не погиб."}
        </p>
      ) : null}
      {eliminated && room.phase !== "DAY_VOTING" ? (
        <p className="mt-2 text-slate-700">По итогам голосования выбыл: {eliminated.name}</p>
      ) : null}
      {room.phase === "GAME_OVER" ? (
        <p className="mt-4 text-xl font-semibold text-mint">
          Победили: {room.winner === "MAFIA" ? "Мафия" : "Мирные жители"}
        </p>
      ) : null}
    </div>
  );
}

function ActionPanel({ room, emitAction }: { room: PublicRoom; emitAction: (event: string, payload?: unknown) => void }) {
  const ownPlayer = room.players.find((player) => player.id === room.ownPlayerId);
  const targets = room.players.filter((player) => player.alive && player.id !== room.ownPlayerId);
  const healTargets = room.players.filter((player) => player.alive);

  if (!ownPlayer?.alive && room.phase !== "LOBBY") {
    return <div className="rounded-2xl border border-line bg-white p-5 text-slate-600 shadow-soft">Вы выбыли, но можете наблюдать за игрой.</div>;
  }

  if (room.phase === "NIGHT_MAFIA" && room.ownRole === "MAFIA") {
    return <TargetList title="Выберите жертву" players={targets} onPick={(id) => emitAction("mafia_choose_target", { targetId: id })} />;
  }

  if (room.phase === "NIGHT_DETECTIVE" && room.ownRole === "DETECTIVE") {
    return <TargetList title="Выберите игрока для проверки" players={targets} onPick={(id) => emitAction("detective_check_player", { targetId: id })} />;
  }

  if (room.phase === "NIGHT_DOCTOR" && room.ownRole === "DOCTOR") {
    return <TargetList title="Кого спасти этой ночью" players={healTargets} onPick={(id) => emitAction("doctor_save_player", { targetId: id })} />;
  }

  if (room.phase === "DAY_VOTING") {
    return <TargetList title="Голосование" players={targets} onPick={(id) => emitAction("cast_vote", { targetId: id })} />;
  }

  return null;
}

function HostPanel({ room, emitAction }: { room: PublicRoom; emitAction: (event: string, payload?: unknown) => void }) {
  const connectedPlayersCount = room.players.filter((player) => player.connected).length;
  const resolvedMafiaCount =
    room.settings.mafiaCount === "auto" ? Math.max(1, Math.floor(connectedPlayersCount / 4)) : room.settings.mafiaCount;

  function updateSettings(payload: Partial<PublicRoom["settings"]>) {
    emitAction("update_settings", payload);
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-500">Ведущий</p>
      <div className="mt-3 rounded-xl border border-line bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-ink">Настройки матча</p>
          <span className="text-xs font-medium text-slate-500">{resolvedMafiaCount} мафия</span>
        </div>
        {room.phase === "LOBBY" ? (
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm text-slate-600">
              Количество мафии
              <select
                className="rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-ocean"
                value={room.settings.mafiaCount}
                onChange={(event) =>
                  updateSettings({
                    mafiaCount: event.target.value === "auto" ? "auto" : Number(event.target.value)
                  })
                }
              >
                <option value="auto">Авто</option>
                <option value="1">1 мафия</option>
                <option value="2">2 мафии</option>
                <option value="3">3 мафии</option>
                <option value="4">4 мафии</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-cloud px-3 py-2 text-sm text-slate-700">
              Комиссар / шериф
              <input
                type="checkbox"
                checked={room.settings.hasDetective}
                onChange={(event) => updateSettings({ hasDetective: event.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-cloud px-3 py-2 text-sm text-slate-700">
              Доктор
              <input
                type="checkbox"
                checked={room.settings.hasDoctor}
                onChange={(event) => updateSettings({ hasDoctor: event.target.checked })}
              />
            </label>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Комиссар / шериф: {room.settings.hasDetective ? "есть" : "нет"}. Доктор:{" "}
            {room.settings.hasDoctor ? "есть" : "нет"}.
          </p>
        )}
      </div>
      <div className="mt-4 grid gap-2">
        {room.phase === "LOBBY" ? (
          <Button onClick={() => emitAction("start_game")} disabled={connectedPlayersCount < 5}>
            Начать игру
          </Button>
        ) : null}
        {room.phase !== "LOBBY" && room.phase !== "GAME_OVER" ? (
          <Button onClick={() => emitAction("next_phase")}>Следующая фаза</Button>
        ) : null}
        {room.phase === "GAME_OVER" ? <Button onClick={() => emitAction("restart_game")}>Вернуться в лобби</Button> : null}
      </div>
      {room.nightActions ? (
        <p className="mt-4 text-xs leading-5 text-blue-900/60">
          Ночные действия: мафия {room.nightActions.mafiaTargetId ? "выбрала цель" : "ждет"}, комиссар{" "}
          {room.nightActions.detectiveTargetId ? "проверил" : "ждет"}, доктор{" "}
          {room.nightActions.doctorTargetId ? "выбрал" : "ждет"}.
        </p>
      ) : null}
    </div>
  );
}

function PlayersPanel({ title, players, empty = "Нет игроков" }: { title: string; players: PublicPlayer[]; empty?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-4 space-y-2">
        {players.length === 0 ? <p className="text-sm text-slate-400">{empty}</p> : null}
        {players.map((player) => (
          <div key={player.id} className="flex items-center justify-between gap-2 rounded-md border border-line bg-cloud px-3 py-2">
            <span className="text-slate-700">
              {player.name} {player.isHost ? "· хост" : ""}
            </span>
            <span className="text-xs font-medium text-slate-400">{player.role ? roleLabels[player.role] : player.connected ? "online" : "offline"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetList({ title, players, onPick }: { title: string; players: PublicPlayer[]; onPick: (id: string) => void }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <h2 className="font-display text-3xl font-semibold text-ink">{title}</h2>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {players.map((player) => (
          <Button key={player.id} variant="secondary" onClick={() => onPick(player.id)}>
            {player.name}
          </Button>
        ))}
      </div>
    </div>
  );
}
