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
          <p className="text-sm uppercase tracking-[0.28em] text-red-200/60">Комната {code}</p>
          <h1 className="mt-3 font-display text-5xl text-white">Вход в игру</h1>
          <input
            className="mt-8 rounded-md border border-white/10 bg-black/35 px-4 py-3 text-white outline-none focus:border-red-300"
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
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}
        </section>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <section className="grid gap-5 py-8 lg:grid-cols-[1fr_22rem]">
        <div className="space-y-5">
          <div className="rounded-lg border border-white/10 bg-black/35 p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-red-200/60">Комната {code}</p>
                <h1 className="mt-2 font-display text-5xl text-white">{phaseLabels[room?.phase ?? "LOBBY"]}</h1>
                <p className="mt-3 text-white/65">{phaseHint}</p>
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
              {error ? <p className="rounded-md border border-red-400/30 bg-red-950/40 p-4 text-sm text-red-200">{error}</p> : null}
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
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
      {ownRole ? (
        <>
          <p className="text-sm uppercase tracking-[0.22em] text-white/45">Твоя роль</p>
          <h2 className="mt-2 font-display text-4xl text-white">{roleLabels[ownRole]}</h2>
          <p className="mt-2 text-white/65">{roleDescriptions[ownRole]}</p>
          {room.mafiaAllies.length > 0 ? (
            <p className="mt-4 text-sm text-red-200">
              Союзники: {room.mafiaAllies.map((player) => player.name).join(", ")}
            </p>
          ) : null}
          {room.detectiveResult ? (
            <p className="mt-4 rounded-md bg-black/35 p-3 text-sm text-white/75">
              Результат проверки:{" "}
              {room.players.find((player) => player.id === room.detectiveResult?.targetId)?.name} -
              {room.detectiveResult.isMafia ? " мафия" : " не мафия"}
            </p>
          ) : null}
        </>
      ) : (
        <p className="text-white/65">Ожидаем запуска игры.</p>
      )}
      {room.phase === "DAY_DISCUSSION" ? (
        <p className="mt-4 text-white/75">
          {killed ? `Этой ночью погиб: ${killed.name}` : "Этой ночью никто не погиб."}
        </p>
      ) : null}
      {eliminated && room.phase !== "DAY_VOTING" ? (
        <p className="mt-2 text-white/75">По итогам голосования выбыл: {eliminated.name}</p>
      ) : null}
      {room.phase === "GAME_OVER" ? (
        <p className="mt-4 text-xl text-red-100">
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
    return <div className="rounded-lg border border-white/10 bg-white/[0.04] p-5 text-white/60">Вы выбыли, но можете наблюдать за игрой.</div>;
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
  return (
    <div className="rounded-lg border border-red-300/20 bg-red-950/20 p-4">
      <p className="text-sm uppercase tracking-[0.22em] text-red-100/60">Ведущий</p>
      <div className="mt-4 grid gap-2">
        {room.phase === "LOBBY" ? (
          <Button onClick={() => emitAction("start_game")} disabled={room.players.filter((player) => player.connected).length < 5}>
            Начать игру
          </Button>
        ) : null}
        {room.phase !== "LOBBY" && room.phase !== "GAME_OVER" ? (
          <Button onClick={() => emitAction("next_phase")}>Следующая фаза</Button>
        ) : null}
        {room.phase === "GAME_OVER" ? <Button onClick={() => emitAction("restart_game")}>Вернуться в лобби</Button> : null}
      </div>
      {room.nightActions ? (
        <p className="mt-4 text-xs leading-5 text-white/50">
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
    <div className="rounded-lg border border-white/10 bg-black/30 p-4">
      <h2 className="font-display text-2xl text-white">{title}</h2>
      <div className="mt-4 space-y-2">
        {players.length === 0 ? <p className="text-sm text-white/45">{empty}</p> : null}
        {players.map((player) => (
          <div key={player.id} className="flex items-center justify-between gap-2 rounded-md bg-white/[0.06] px-3 py-2">
            <span className="text-white/85">
              {player.name} {player.isHost ? "· хост" : ""}
            </span>
            <span className="text-xs text-white/45">{player.role ? roleLabels[player.role] : player.connected ? "online" : "offline"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TargetList({ title, players, onPick }: { title: string; players: PublicPlayer[]; onPick: (id: string) => void }) {
  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.06] p-5">
      <h2 className="font-display text-3xl text-white">{title}</h2>
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
