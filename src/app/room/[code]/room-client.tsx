"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
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
  const [isRestoring, setIsRestoring] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const inviteUrl = typeof window === "undefined" ? "" : `${window.location.origin}/room/${code}`;
  const ownPlayer = room?.players.find((player) => player.id === room.ownPlayerId);
  const alivePlayers = room?.players.filter((player) => player.alive && !player.isSpectator) ?? [];
  const deadPlayers = room?.players.filter((player) => !player.alive && !player.isSpectator) ?? [];
  const spectators = room?.players.filter((player) => player.isSpectator) ?? [];

  useEffect(() => {
    const nextSocket = io({ path: "/socket.io" });
    setSocket(nextSocket);
    nextSocket.on("room_updated", (nextRoom: PublicRoom) => setRoom(nextRoom));
    nextSocket.on("connect", () => {
      const savedPlayerId = window.localStorage.getItem(`playerId:${code}`);
      const hostKey = window.localStorage.getItem(`hostKey:${code}`) ?? undefined;

      if (!savedPlayerId) {
        setIsRestoring(false);
        return;
      }

      nextSocket.emit("join_room", { code, name: "", hostKey, playerId: savedPlayerId }, (ack: Ack) => {
        if (ack.ok) {
          setJoined(true);
          setError("");
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
      if (ack.playerId) window.localStorage.setItem(`playerId:${code}`, ack.playerId);
      window.localStorage.setItem(`playerName:${code}`, name.trim());
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

  if (isRestoring) {
    return (
      <AppShell>
        <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12 text-slate-600">
          Возвращаем вас в комнату...
        </section>
      </AppShell>
    );
  }

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
                {room?.phaseDeadlineAt ? <PhaseCountdown deadlineAt={room.phaseDeadlineAt} /> : null}
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
          {spectators.length > 0 ? <PlayersPanel title="Ведущие" players={spectators} empty="Нет ведущих" /> : null}
          {room ? <ChatPanel room={room} emitAction={emitAction} /> : null}
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
      {room.players.find((player) => player.id === room.ownPlayerId)?.isSpectator ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Ваш режим</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-ink">Ведущий</h2>
          <p className="mt-2 text-slate-600">Вы управляете партией, но не получаете роль и не участвуете в голосованиях.</p>
        </>
      ) : ownRole ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Твоя роль</p>
          <h2 className="mt-2 font-display text-4xl font-semibold text-ink">{roleLabels[ownRole]}</h2>
          <p className="mt-2 text-slate-600">{roleDescriptions[ownRole]}</p>
          {room.mafiaAllies.length > 0 ? (
            <p className="mt-4 rounded-md bg-slate-50 p-3 text-sm text-slate-700">
              Союзники: {room.mafiaAllies.map((player) => player.name).join(", ")}
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
  const targets = room.players.filter((player) => player.alive && !player.isSpectator && player.id !== room.ownPlayerId);
  const mafiaAllyIds = new Set(room.mafiaAllies.map((player) => player.id));
  const nonMafiaTargets = targets.filter((player) => !mafiaAllyIds.has(player.id));
  const healTargets = room.players.filter((player) => player.alive && !player.isSpectator);

  if (ownPlayer?.isSpectator) {
    return <div className="rounded-2xl border border-line bg-white p-5 text-slate-600 shadow-soft">Вы ведущий этой партии и наблюдаете за игрой без роли.</div>;
  }

  if (!ownPlayer?.alive && room.phase !== "LOBBY") {
    return <div className="rounded-2xl border border-line bg-white p-5 text-slate-600 shadow-soft">Вы выбыли, но можете наблюдать за игрой.</div>;
  }

  if (room.phase === "NIGHT_MAFIA" && (room.ownRole === "MAFIA" || room.ownRole === "DON")) {
    return (
      <div className="space-y-3">
        <TargetList
          title="Проголосуйте за жертву"
          players={nonMafiaTargets}
          activeId={room.nightActions?.mafiaVotes?.[room.ownPlayerId]}
          lockAfterPick
          onPick={(id) => emitAction("mafia_choose_target", { targetId: id })}
        >
          <MafiaVoteStatus room={room} />
        </TargetList>
        <PhaseAdvanceButton room={room} emitAction={emitAction} />
      </div>
    );
  }

  if (room.phase === "NIGHT_MAFIA" && room.ownRole === "MISTRESS") {
    return (
      <div className="space-y-3">
        <TargetList
          title="Кого отвлечь этой ночью"
          players={nonMafiaTargets}
          activeId={room.nightActions?.mistressTargetId}
          lockAfterPick
          onPick={(id) => emitAction("mistress_distract_player", { targetId: id })}
        />
        <PhaseAdvanceButton room={room} emitAction={emitAction} />
      </div>
    );
  }

  if (room.phase === "NIGHT_DETECTIVE" && room.ownRole === "DETECTIVE") {
    return (
      <div className="space-y-3">
        <TargetList
          title="Выберите игрока для проверки"
          players={targets}
          activeId={room.nightActions?.detectiveTargetId}
          lockAfterPick
          onPick={(id) => emitAction("detective_check_player", { targetId: id })}
        >
          {room.detectiveResult ? (
            <p className="mt-4 rounded-md bg-blue-50 p-3 text-sm text-blue-800">
              {room.players.find((player) => player.id === room.detectiveResult?.targetId)?.name} -
              {room.detectiveResult.isMafia ? " мафия" : " не мафия"}
            </p>
          ) : null}
        </TargetList>
        <PhaseAdvanceButton room={room} emitAction={emitAction} />
      </div>
    );
  }

  if (room.phase === "NIGHT_DOCTOR" && room.ownRole === "DOCTOR") {
    return (
      <div className="space-y-3">
        <TargetList
          title="Кого спасти этой ночью"
          players={healTargets}
          activeId={room.nightActions?.doctorTargetId}
          lockAfterPick
          onPick={(id) => emitAction("doctor_save_player", { targetId: id })}
        />
        <PhaseAdvanceButton room={room} emitAction={emitAction} />
      </div>
    );
  }

  if (room.phase === "DAY_DISCUSSION") {
    const readyPlayers = room.players.filter((player) => player.alive && !player.isSpectator && room.discussionReady[player.id]);
    const alivePlayers = room.players.filter((player) => player.alive && !player.isSpectator);
    const ownReady = Boolean(room.discussionReady[room.ownPlayerId]);

    return (
      <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="font-display text-3xl font-semibold text-ink">Обсуждение</h2>
        <p className="mt-2 text-sm text-slate-600">
          Готовы к голосованию: {readyPlayers.length} / {alivePlayers.length}
        </p>
        <Button
          className={ownReady ? "mt-4 w-full" : "mt-4 w-full animate-pulse ring-2 ring-ocean/25"}
          disabled={ownReady}
          onClick={() => emitAction("ready_for_voting")}
        >
          {ownReady ? "Ждем остальных игроков" : "Перейти к голосованию"}
        </Button>
      </div>
    );
  }

  if (room.phase === "DAY_VOTING") {
    return (
      <div className="space-y-3">
        <TargetList
          title="Голосование"
          players={targets}
          activeId={room.votes[room.ownPlayerId]}
          lockAfterPick
          onPick={(id) => emitAction("cast_vote", { targetId: id })}
        />
        <PhaseAdvanceButton room={room} emitAction={emitAction} />
      </div>
    );
  }

  return null;
}

function PhaseAdvanceButton({ room, emitAction }: { room: PublicRoom; emitAction: (event: string) => void }) {
  const canAdvance = canOwnPlayerAdvancePhase(room);

  if (room.settings.mode !== "manual" || !canAdvance) return null;

  return (
    <Button className="w-full animate-pulse ring-2 ring-ocean/25" onClick={() => emitAction("next_phase")}>
      Следующая фаза
    </Button>
  );
}

function canOwnPlayerAdvancePhase(room: PublicRoom) {
  const ownPlayer = room.players.find((player) => player.id === room.ownPlayerId);
  if (!ownPlayer?.alive || ownPlayer.isSpectator) return false;

  if (room.phase === "NIGHT_MAFIA" && (room.ownRole === "MAFIA" || room.ownRole === "DON" || room.ownRole === "MISTRESS")) {
    return isNightMafiaReadyToAdvance(room);
  }
  if (room.phase === "NIGHT_DETECTIVE" && room.ownRole === "DETECTIVE") {
    return Boolean(room.nightActions?.detectiveTargetId);
  }
  if (room.phase === "NIGHT_DOCTOR" && room.ownRole === "DOCTOR") {
    return Boolean(room.nightActions?.doctorTargetId);
  }
  if (room.phase === "DAY_VOTING") {
    return areVotesReady(room);
  }

  return false;
}

function isNightMafiaReadyToAdvance(room: PublicRoom) {
  const mistress = room.mafiaAllies.find((player) => player.alive && player.role === "MISTRESS");
  return isMafiaKillReady(room) && (!mistress || Boolean(room.nightActions?.mistressTargetId));
}

function isMafiaKillReady(room: PublicRoom) {
  const mafiaKillers = room.mafiaAllies.filter((player) => player.alive && (player.role === "MAFIA" || player.role === "DON"));
  const votes = room.nightActions?.mafiaVotes ?? {};
  const firstVote = mafiaKillers[0] ? votes[mafiaKillers[0].id] : undefined;
  return Boolean(firstVote) && mafiaKillers.every((player) => votes[player.id] === firstVote);
}

function areVotesReady(room: PublicRoom) {
  const eligibleVoters = room.players.filter(
    (player) => player.alive && !player.isSpectator && player.id !== room.nightActions?.mistressTargetId
  );
  return eligibleVoters.length > 0 && eligibleVoters.every((player) => room.votes[player.id]);
}

function PhaseCountdown({ deadlineAt }: { deadlineAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p className="mt-3 w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-600">
      Осталось {Math.max(0, Math.ceil((deadlineAt - now) / 1000))} сек.
    </p>
  );
}

function HostPanel({ room, emitAction }: { room: PublicRoom; emitAction: (event: string, payload?: unknown) => void }) {
  const ownPlayer = room.players.find((player) => player.id === room.ownPlayerId);
  const connectedPlayersCount = room.players.filter((player) => player.connected && !player.isSpectator).length;
  const resolvedMafiaCount =
    room.settings.mafiaCount === "auto" ? Math.max(1, Math.floor(connectedPlayersCount / 4)) : room.settings.mafiaCount;
  const mafiaKillersLabel =
    resolvedMafiaCount === 1 ? "1 убийца" : `${resolvedMafiaCount} убийцы`;

  function updateSettings(payload: Partial<PublicRoom["settings"]>) {
    emitAction("update_settings", payload);
  }

  return (
    <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 shadow-soft">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-blue-500">Ведущий</p>
      {room.phase === "LOBBY" ? (
        <div className="mt-3 rounded-xl border border-line bg-white p-3">
          <p className="font-semibold text-ink">Ваше участие</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button
              variant={!ownPlayer?.isSpectator ? "primary" : "secondary"}
              onClick={() => emitAction("set_host_participation", { participates: true })}
            >
              Играю
            </Button>
            <Button
              variant={ownPlayer?.isSpectator ? "primary" : "secondary"}
              onClick={() => emitAction("set_host_participation", { participates: false })}
            >
              Я ведущий
            </Button>
          </div>
          <p className="mt-2 text-xs leading-5 text-slate-500">
            В режиме ведущего вы управляете фазами, но не получаете роль и не считаетесь игроком.
          </p>
        </div>
      ) : null}
      <div className="mt-3 rounded-xl border border-line bg-white p-3">
        <div className="flex items-center justify-between gap-3">
          <p className="font-semibold text-ink">Настройки матча</p>
          <span className="text-xs font-medium text-slate-500">{mafiaKillersLabel}</span>
        </div>
        {room.phase === "LOBBY" ? (
          <div className="mt-3 grid gap-3">
            <label className="grid gap-1 text-sm text-slate-600">
              Убийц мафии
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
                <option value="1">1 убийца</option>
                <option value="2">2 убийцы</option>
                <option value="3">3 убийцы</option>
                <option value="4">4 убийцы</option>
              </select>
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-cloud px-3 py-2 text-sm text-slate-700">
              Дон мафии
              <input
                type="checkbox"
                checked={room.settings.hasDon}
                onChange={(event) => updateSettings({ hasDon: event.target.checked })}
              />
            </label>
            <label className="flex items-center justify-between gap-3 rounded-md border border-line bg-cloud px-3 py-2 text-sm text-slate-700">
              Любовница
              <input
                type="checkbox"
                checked={room.settings.hasMistress}
                onChange={(event) => updateSettings({ hasMistress: event.target.checked })}
              />
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
            <div className="rounded-xl border border-line bg-cloud p-3">
              <p className="text-sm font-semibold text-ink">Переход фаз</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Button
                  variant={room.settings.mode === "manual" ? "primary" : "secondary"}
                  onClick={() => updateSettings({ mode: "manual" })}
                >
                  Кнопка
                </Button>
                <Button
                  variant={room.settings.mode === "timed" ? "primary" : "secondary"}
                  onClick={() => updateSettings({ mode: "timed" })}
                >
                  Таймеры
                </Button>
              </div>
              {room.settings.mode === "timed" ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <TimerInput label="Мафия" value={room.settings.mafiaTimerSec} onChange={(value) => updateSettings({ mafiaTimerSec: value })} />
                  <TimerInput label="Дон" value={room.settings.donTimerSec} onChange={(value) => updateSettings({ donTimerSec: value })} />
                  <TimerInput
                    label="Комиссар"
                    value={room.settings.detectiveTimerSec}
                    onChange={(value) => updateSettings({ detectiveTimerSec: value })}
                  />
                  <TimerInput label="Доктор" value={room.settings.doctorTimerSec} onChange={(value) => updateSettings({ doctorTimerSec: value })} />
                  <TimerInput
                    label="Обсуждение"
                    value={room.settings.dayTimerSec}
                    onChange={(value) => updateSettings({ dayTimerSec: value })}
                  />
                  <TimerInput
                    label="Голосование"
                    value={room.settings.votingTimerSec}
                    onChange={(value) => updateSettings({ votingTimerSec: value })}
                  />
                </div>
              ) : (
                <p className="mt-2 text-xs leading-5 text-slate-500">
                  Активные игроки смогут завершать фазу после своего выбора.
                </p>
              )}
            </div>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600">
            Дон: {room.settings.hasDon ? "есть" : "нет"}. Любовница:{" "}
            {room.settings.hasMistress ? "есть" : "нет"}. Комиссар / шериф:{" "}
            {room.settings.hasDetective ? "есть" : "нет"}. Доктор: {room.settings.hasDoctor ? "есть" : "нет"}.
            Режим фаз: {room.settings.mode === "timed" ? "таймеры" : "кнопка"}.
          </p>
        )}
      </div>
      <div className="mt-4 grid gap-2">
        {room.phase === "LOBBY" ? (
          <Button onClick={() => emitAction("start_game")} disabled={connectedPlayersCount < 5}>
            Начать игру
          </Button>
        ) : null}
        {room.phase !== "LOBBY" &&
        room.phase !== "GAME_OVER" &&
        ((ownPlayer?.isSpectator && room.phase !== "DAY_DISCUSSION") || room.devMode || room.phase === "ROLE_REVEAL") &&
        (room.settings.mode === "manual" || room.phase === "ROLE_REVEAL") ? (
          <Button onClick={() => emitAction("next_phase")}>Следующая фаза</Button>
        ) : null}
        {room.phase === "GAME_OVER" ? <Button onClick={() => emitAction("restart_game")}>Вернуться в лобби</Button> : null}
      </div>
      {room.nightActions ? (
        <p className="mt-4 text-xs leading-5 text-blue-900/60">
          Ночные действия: мафия {room.nightActions.mafiaTargetId ? "определила цель" : "голосует"}, комиссар{" "}
          {room.nightActions.detectiveTargetId ? "проверил" : "ждет"}, доктор{" "}
          {room.nightActions.doctorTargetId ? "выбрал" : "ждет"}.
        </p>
      ) : null}
      {room.nightActions ? <MafiaVoteStatus room={room} compact /> : null}
    </div>
  );
}

function TimerInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-slate-500">
      {label}
      <input
        type="number"
        min={10}
        max={1800}
        className="rounded-md border border-line bg-white px-2 py-2 text-sm text-ink outline-none focus:border-ocean"
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
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
            <span className="text-xs font-medium text-slate-400">
              {player.isSpectator ? "ведущий" : player.role ? roleLabels[player.role] : player.connected ? "online" : "offline"}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ChatPanel({ room, emitAction }: { room: PublicRoom; emitAction: (event: string, payload?: unknown) => void }) {
  const [message, setMessage] = useState("");
  const [hasUnreadMessages, setHasUnreadMessages] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(room.chatMessages.length);
  const emojis = ["🙂", "😂", "😈", "🤔", "👏", "🔥"];

  useEffect(() => {
    const messagesNode = messagesRef.current;
    if (!messagesNode) return;

    const lastMessage = room.chatMessages.at(-1);
    const hasNewMessage = room.chatMessages.length > previousMessageCountRef.current;
    const shouldStayPinned =
      isChatNearBottom(messagesNode) || lastMessage?.playerId === room.ownPlayerId || previousMessageCountRef.current === 0;

    if (shouldStayPinned) {
      messagesNode.scrollTo({ top: messagesNode.scrollHeight, behavior: hasNewMessage ? "smooth" : "auto" });
      setHasUnreadMessages(false);
    } else if (hasNewMessage) {
      setHasUnreadMessages(true);
    }

    previousMessageCountRef.current = room.chatMessages.length;
  }, [room.chatMessages, room.ownPlayerId]);

  function scrollChatToBottom() {
    messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
    setHasUnreadMessages(false);
  }

  function sendMessage() {
    const text = message.trim();
    if (!text) return;
    emitAction("send_chat_message", { text });
    setMessage("");
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl font-semibold text-ink">Чат</h2>
        {hasUnreadMessages ? (
          <button
            type="button"
            className="rounded-full bg-ocean/10 px-3 py-1 text-xs font-semibold text-ocean transition hover:bg-ocean/15"
            onClick={scrollChatToBottom}
          >
            Новые
          </button>
        ) : null}
      </div>
      <div
        ref={messagesRef}
        className="mt-4 flex max-h-64 flex-col gap-2 overflow-y-auto rounded-xl bg-cloud p-3"
        onScroll={(event) => {
          if (isChatNearBottom(event.currentTarget)) setHasUnreadMessages(false);
        }}
      >
        {room.chatMessages.length === 0 ? (
          <p className="text-sm text-slate-400">Пока нет сообщений</p>
        ) : null}
        {room.chatMessages.map((item) => (
          <div key={item.id} className="rounded-lg bg-white px-3 py-2 text-sm shadow-sm">
            <p className="font-semibold text-ink">{item.playerName}</p>
            <p className="mt-1 break-words text-slate-600">{item.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        {emojis.map((emoji) => (
          <button
            key={emoji}
            type="button"
            className="rounded-lg border border-line bg-cloud px-2 py-1 text-lg hover:bg-slate-100"
            onClick={() => setMessage((current) => `${current}${emoji}`)}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          className="min-w-0 flex-1 rounded-lg border border-line bg-white px-3 py-2 text-sm text-ink outline-none focus:border-ocean"
          placeholder="Написать сообщение..."
          value={message}
          maxLength={280}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") sendMessage();
          }}
        />
        <Button type="button" className="px-3" onClick={sendMessage}>
          Отпр.
        </Button>
      </div>
    </div>
  );
}

function isChatNearBottom(node: HTMLDivElement) {
  return node.scrollHeight - node.scrollTop - node.clientHeight < 32;
}

function TargetList({
  title,
  players,
  activeId,
  lockAfterPick = false,
  children,
  onPick
}: {
  title: string;
  players: PublicPlayer[];
  activeId?: string;
  lockAfterPick?: boolean;
  children?: ReactNode;
  onPick: (id: string) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <h2 className="font-display text-3xl font-semibold text-ink">{title}</h2>
      {children}
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        {players.map((player) => (
          <Button
            key={player.id}
            variant={activeId === player.id ? "primary" : "secondary"}
            disabled={lockAfterPick && Boolean(activeId)}
            onClick={() => onPick(player.id)}
          >
            {player.name}
          </Button>
        ))}
      </div>
    </div>
  );
}

function MafiaVoteStatus({ room, compact = false }: { room: PublicRoom; compact?: boolean }) {
  const [now, setNow] = useState(Date.now());
  const votes = room.nightActions?.mafiaVotes ?? {};
  const mafiaKillers = room.mafiaAllies.filter((player) => player.alive && (player.role === "MAFIA" || player.role === "DON"));
  const selectedTarget = room.players.find((player) => player.id === room.nightActions?.mafiaTargetId);
  const deadlineAt = room.nightActions?.mafiaVoteDeadlineAt;

  useEffect(() => {
    if (!deadlineAt) return undefined;

    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadlineAt]);

  if (mafiaKillers.length === 0 || room.phase !== "NIGHT_MAFIA") return null;

  return (
    <div className={compact ? "mt-3 rounded-xl bg-white/60 p-3 text-xs text-slate-600" : "mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-600"}>
      <p className="font-semibold text-ink">
        Цель мафии: {selectedTarget ? selectedTarget.name : "пока не решена"}
      </p>
      {deadlineAt ? (
        <p className="mt-1">
          Без Дона итог будет выбран автоматически через {Math.max(0, Math.ceil((deadlineAt - now) / 1000))} сек.
        </p>
      ) : null}
      <div className="mt-2 grid gap-1">
        {mafiaKillers.map((player) => {
          const target = room.players.find((item) => item.id === votes[player.id]);
          return (
            <span key={player.id}>
              {player.name}: {target ? target.name : "не выбрал"}
            </span>
          );
        })}
      </div>
    </div>
  );
}
