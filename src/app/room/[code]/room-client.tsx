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
    if (room.phase === "DAY_REVOTE") return "Голоса разделились. Голосуйте только за кандидатов переголосования.";
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
      <section className="py-6">
        <div className="rounded-[2rem] border border-line bg-white/85 p-4 shadow-soft backdrop-blur md:p-6">
          <div className="relative overflow-hidden rounded-[1.5rem] border border-line bg-[radial-gradient(circle_at_0%_0%,rgba(239,61,61,0.18),transparent_22rem),linear-gradient(135deg,var(--color-surface),var(--color-surface-muted))] p-5 md:p-7">
            <div className="relative z-10 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.34em] text-ocean">Комната {code}</p>
                <h1 className="mt-3 font-display text-4xl font-semibold text-ink md:text-6xl">{phaseLabels[room?.phase ?? "LOBBY"]}</h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">{phaseHint}</p>
                {room?.phaseDeadlineAt ? <PhaseCountdown deadlineAt={room.phaseDeadlineAt} /> : null}
                <div className="mt-5 flex flex-wrap gap-2">
                  <RoomChip>{alivePlayers.length} / 15 игроков</RoomChip>
                  <RoomChip>{deadPlayers.length} выбыло</RoomChip>
                  <RoomChip>ID: {code}</RoomChip>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <Button variant="secondary" onClick={copyInvite}>
                  {copied ? "Ссылка скопирована" : "Пригласить"}
                </Button>
                {room?.phase === "LOBBY" && ownPlayer?.isHost ? (
                  <Button onClick={() => emitAction("start_game")} disabled={alivePlayers.length < 5}>
                    Начать игру
                  </Button>
                ) : null}
              </div>
            </div>
          </div>

          {room ? (
            <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-5">
                    <RolePanel room={room} />
                    <ActionPanel room={room} emitAction={emitAction} />
                  </div>
                  <ChatPanel room={room} emitAction={emitAction} />
                </div>
                {error ? <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-coral">{error}</p> : null}
                <div className="grid gap-5 lg:grid-cols-2">
                  <PlayersPanel title="Живые игроки" players={alivePlayers} />
                  <PlayersPanel title="Выбывшие" players={deadPlayers} empty="Пока никто не выбыл" />
                </div>
              </div>

              <aside className="space-y-5">
                {ownPlayer?.isHost ? <HostPanel room={room} emitAction={emitAction} /> : null}
                {spectators.length > 0 ? <PlayersPanel title="Ведущие" players={spectators} empty="Нет ведущих" /> : null}
              </aside>
            </div>
          ) : null}
        </div>
      </section>
    </AppShell>
  );
}

function RoomChip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-xl border border-line bg-white/70 px-3 py-2 text-xs font-semibold text-slate-600 shadow-sm">
      {children}
    </span>
  );
}

function RolePanel({ room }: { room: PublicRoom }) {
  const ownRole = room.ownRole;
  const killed = room.players.find((player) => player.id === room.lastNightKilledId);
  const eliminated = room.players.find((player) => player.id === room.lastVoteEliminatedId);
  const eliminatedPlayers = room.players.filter((player) => room.lastVoteEliminatedIds?.includes(player.id));

  return (
    <div className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft">
      {room.players.find((player) => player.id === room.ownPlayerId)?.isSpectator ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Ваш режим</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Ведущий</h2>
          <p className="mt-2 text-slate-600">Вы управляете партией, но не получаете роль и не участвуете в голосованиях.</p>
        </>
      ) : ownRole ? (
        <>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">Твоя роль</p>
          <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{roleLabels[ownRole]}</h2>
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
      {(eliminated || eliminatedPlayers.length > 0) && room.phase !== "DAY_VOTING" && room.phase !== "DAY_REVOTE" ? (
        <p className="mt-2 text-slate-700">
          По итогам голосования выбыл{eliminatedPlayers.length > 1 ? "и" : ""}:{" "}
          {eliminatedPlayers.length > 0 ? eliminatedPlayers.map((player) => player.name).join(", ") : eliminated?.name}
        </p>
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
    return <div className="rounded-[1.5rem] border border-line bg-white/90 p-5 text-slate-600 shadow-soft">Вы ведущий этой партии и наблюдаете за игрой без роли.</div>;
  }

  if (!ownPlayer?.alive && room.phase !== "LOBBY") {
    return <div className="rounded-[1.5rem] border border-line bg-white/90 p-5 text-slate-600 shadow-soft">Вы выбыли, но можете наблюдать за игрой.</div>;
  }

  if (room.phase === "NIGHT_MAFIA" && (room.ownRole === "MAFIA" || room.ownRole === "DON")) {
    return (
      <div className="space-y-3">
        <MafiaTargetPicker
          room={room}
          players={nonMafiaTargets}
          activeId={room.nightActions?.mafiaVotes?.[room.ownPlayerId]}
          onPick={(id) => emitAction("mafia_choose_target", { targetId: id })}
        />
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
      <div className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft">
        <h2 className="font-display text-2xl font-semibold text-ink">Обсуждение</h2>
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

  if (room.phase === "DAY_VOTING" || room.phase === "DAY_REVOTE") {
    const votingTargets =
      room.phase === "DAY_REVOTE" ? targets.filter((player) => room.runoffCandidateIds?.includes(player.id)) : targets;
    return (
      <div className="space-y-3">
        <VotingTargetPicker
          room={room}
          title={room.phase === "DAY_REVOTE" ? "Переголосование" : "Голосование"}
          players={votingTargets}
          activeId={room.votes[room.ownPlayerId]}
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
  if (room.phase === "DAY_REVOTE") {
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
  const [settingsTab, setSettingsTab] = useState<"roles" | "vote" | "phase">("roles");
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
    <div className="rounded-[1.75rem] border border-line bg-white/90 p-4 shadow-soft backdrop-blur">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-ocean">Управление</p>
          <h2 className="mt-1 font-display text-2xl font-semibold text-ink">Комната</h2>
        </div>
        <span className="rounded-xl bg-cloud px-3 py-2 text-xs font-semibold text-slate-500">{mafiaKillersLabel}</span>
      </div>

      {room.phase === "LOBBY" ? (
        <div className="mt-4 rounded-2xl border border-line bg-cloud/70 p-3">
          <p className="text-sm font-semibold text-ink">Ваше участие</p>
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
              Ведущий
            </Button>
          </div>
        </div>
      ) : null}

      <div className="mt-4 rounded-2xl border border-line bg-white/70 p-2">
        <div className="grid grid-cols-3 gap-1 text-xs font-semibold">
          <SettingsTabButton active={settingsTab === "roles"} onClick={() => setSettingsTab("roles")}>Роли</SettingsTabButton>
          <SettingsTabButton active={settingsTab === "vote"} onClick={() => setSettingsTab("vote")}>Голосование</SettingsTabButton>
          <SettingsTabButton active={settingsTab === "phase"} onClick={() => setSettingsTab("phase")}>Фазы</SettingsTabButton>
        </div>

        {room.phase === "LOBBY" ? (
          <div className="mt-3 p-1">
            {settingsTab === "roles" ? (
              <div className="grid gap-2">
                <label className="grid gap-1 text-sm text-slate-600">
                  Убийц мафии
                  <select
                    className="rounded-xl border border-line bg-white px-3 py-2 text-ink outline-none focus:border-ocean"
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
                <SettingSwitch label="Дон мафии" checked={room.settings.hasDon} onChange={(checked) => updateSettings({ hasDon: checked })} />
                <SettingSwitch label="Любовница" checked={room.settings.hasMistress} onChange={(checked) => updateSettings({ hasMistress: checked })} />
                <SettingSwitch label="Комиссар / шериф" checked={room.settings.hasDetective} onChange={(checked) => updateSettings({ hasDetective: checked })} />
                <SettingSwitch label="Доктор" checked={room.settings.hasDoctor} onChange={(checked) => updateSettings({ hasDoctor: checked })} />
              </div>
            ) : null}

            {settingsTab === "vote" ? (
              <div className="grid gap-2">
                <p className="text-sm font-semibold text-ink">Если голоса равны</p>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant={room.settings.voteTieMode === "revote" ? "primary" : "secondary"}
                    onClick={() => updateSettings({ voteTieMode: "revote" })}
                  >
                    Переголосование
                  </Button>
                  <Button
                    variant={room.settings.voteTieMode === "skip" ? "primary" : "secondary"}
                    onClick={() => updateSettings({ voteTieMode: "skip" })}
                  >
                    Никто
                  </Button>
                </div>
              </div>
            ) : null}

            {settingsTab === "phase" ? (
              <div className="grid gap-3">
                <div className="grid grid-cols-2 gap-2">
                  <Button variant={room.settings.mode === "manual" ? "primary" : "secondary"} onClick={() => updateSettings({ mode: "manual" })}>
                    Кнопка
                  </Button>
                  <Button variant={room.settings.mode === "timed" ? "primary" : "secondary"} onClick={() => updateSettings({ mode: "timed" })}>
                    Таймеры
                  </Button>
                </div>
                {room.settings.mode === "timed" ? (
                  <div className="grid grid-cols-2 gap-2">
                    <TimerInput label="Мафия" value={room.settings.mafiaTimerSec} onChange={(value) => updateSettings({ mafiaTimerSec: value })} />
                    <TimerInput label="Дон" value={room.settings.donTimerSec} onChange={(value) => updateSettings({ donTimerSec: value })} />
                    <TimerInput label="Комиссар" value={room.settings.detectiveTimerSec} onChange={(value) => updateSettings({ detectiveTimerSec: value })} />
                    <TimerInput label="Доктор" value={room.settings.doctorTimerSec} onChange={(value) => updateSettings({ doctorTimerSec: value })} />
                    <TimerInput label="Обсуждение" value={room.settings.dayTimerSec} onChange={(value) => updateSettings({ dayTimerSec: value })} />
                    <TimerInput label="Голосование" value={room.settings.votingTimerSec} onChange={(value) => updateSettings({ votingTimerSec: value })} />
                  </div>
                ) : (
                  <p className="text-xs leading-5 text-slate-500">Активные игроки завершают фазу после выбора.</p>
                )}
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 p-2 text-sm leading-6 text-slate-600">
            {room.settings.mode === "timed" ? "Фазы по таймеру" : "Фазы по кнопке"} · ничья:{" "}
            {room.settings.voteTieMode === "revote" ? "переголосование" : "никто не выбывает"}
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
      {room.nightActions ? <MafiaVoteStatus room={room} compact /> : null}
    </div>
  );
}

function SettingsTabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={active ? "rounded-xl bg-ocean px-2 py-2 text-white" : "rounded-xl px-2 py-2 text-slate-500 hover:bg-cloud hover:text-ink"}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function SettingSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border border-line bg-cloud/70 px-3 py-2 text-sm text-slate-700">
      {label}
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
    </label>
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
    <div className="rounded-[1.5rem] border border-line bg-white/90 p-4 shadow-soft">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
        <span className="rounded-lg bg-cloud px-2 py-1 text-xs font-semibold text-slate-500">{players.length}</span>
      </div>
      <div className="mt-4 space-y-2">
        {players.length === 0 ? <p className="text-sm text-slate-400">{empty}</p> : null}
        {players.map((player) => (
          <div key={player.id} className="flex items-center justify-between gap-3 rounded-2xl border border-line bg-cloud/70 px-3 py-2">
            <span className="flex min-w-0 items-center gap-3 text-slate-700">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-sm font-bold text-ocean">
                {player.name.slice(0, 1).toUpperCase()}
              </span>
              <span className="min-w-0 truncate">
                {player.name} {player.isHost ? "· хост" : ""}
                <span className="block text-xs text-mint">{player.connected ? "online" : "offline"}</span>
              </span>
            </span>
            <span className="shrink-0 rounded-lg bg-white px-2 py-1 text-xs font-medium text-slate-400">
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
  const panelRef = useRef<HTMLDivElement | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const previousMessageCountRef = useRef(room.chatMessages.length);
  const emojis = ["🙂", "😂", "😈", "🤔", "👏", "🔥"];

  useEffect(() => {
    const messagesNode = messagesRef.current;
    if (!messagesNode) return;

    const lastMessage = room.chatMessages.at(-1);
    const hasNewMessage = room.chatMessages.length > previousMessageCountRef.current;
    const isOwnMessage = lastMessage?.playerId === room.ownPlayerId;
    const isChatVisible = isElementMostlyInViewport(messagesNode);
    if (hasNewMessage || previousMessageCountRef.current === 0) {
      messagesNode.scrollTo({ top: messagesNode.scrollHeight, behavior: hasNewMessage ? "smooth" : "auto" });
    }

    if (hasNewMessage && !isOwnMessage && !isChatVisible) {
      setHasUnreadMessages(true);
    } else if (isChatVisible || isOwnMessage) {
      setHasUnreadMessages(false);
    }

    previousMessageCountRef.current = room.chatMessages.length;
  }, [room.chatMessages, room.ownPlayerId]);

  function scrollChatToBottom() {
    panelRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      messagesRef.current?.scrollTo({ top: messagesRef.current.scrollHeight, behavior: "smooth" });
    }, 120);
    setHasUnreadMessages(false);
  }

  function sendMessage() {
    const text = message.trim();
    if (!text) return;
    emitAction("send_chat_message", { text });
    setMessage("");
  }

  return (
    <div ref={panelRef} className="flex min-h-[28rem] flex-col rounded-[1.5rem] border border-line bg-white/90 p-4 shadow-soft">
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-semibold text-ink">Чат комнаты</h2>
        <span className="rounded-lg bg-cloud px-2 py-1 text-xs font-semibold text-slate-500">{room.chatMessages.length}</span>
      </div>
      {hasUnreadMessages ? (
        <button
          type="button"
          className="fixed bottom-5 right-5 z-40 rounded-full border border-ocean/20 bg-white/95 px-4 py-2 text-sm font-semibold text-ocean shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:bg-ocean/10 sm:bottom-7 sm:right-7"
          onClick={scrollChatToBottom}
        >
          <span className="mr-2 inline-flex h-2 w-2 rounded-full bg-coral shadow-[0_0_0_4px_rgba(255,107,93,0.14)]" />
          Новое сообщение
        </button>
      ) : null}
      <div
        ref={messagesRef}
        className="mt-4 flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto rounded-2xl bg-cloud/70 p-3"
        onScroll={(event) => {
          if (isChatNearBottom(event.currentTarget)) setHasUnreadMessages(false);
        }}
      >
        {room.chatMessages.length === 0 ? (
          <p className="text-sm text-slate-400">Пока нет сообщений</p>
        ) : null}
        {room.chatMessages.map((item) => (
          <div key={item.id} className="rounded-2xl bg-white px-3 py-2 text-sm shadow-sm">
            <p className="font-semibold text-ocean">{item.playerName}</p>
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
          className="min-w-0 flex-1 rounded-2xl border border-line bg-white px-3 py-3 text-sm text-ink outline-none focus:border-ocean"
          placeholder="Написать сообщение..."
          value={message}
          maxLength={280}
          onChange={(event) => setMessage(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") sendMessage();
          }}
        />
        <Button type="button" className="rounded-2xl px-4" onClick={sendMessage}>
          Отпр.
        </Button>
      </div>
    </div>
  );
}

function isChatNearBottom(node: HTMLDivElement) {
  return node.scrollHeight - node.scrollTop - node.clientHeight < 32;
}

function isElementMostlyInViewport(node: HTMLElement) {
  const rect = node.getBoundingClientRect();
  return rect.top >= 0 && rect.bottom <= window.innerHeight;
}

function MafiaTargetPicker({
  room,
  players,
  activeId,
  onPick
}: {
  room: PublicRoom;
  players: PublicPlayer[];
  activeId?: string;
  onPick: (id: string) => void;
}) {
  const votes = room.nightActions?.mafiaVotes ?? {};
  const selectedTarget = room.players.find((player) => player.id === room.nightActions?.mafiaTargetId);
  const deadlineAt = room.nightActions?.mafiaVoteDeadlineAt;

  return (
    <div className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft">
      <h2 className="font-display text-2xl font-semibold text-ink">Проголосуйте за жертву</h2>
      <p className="mt-2 text-sm text-slate-600">
        {selectedTarget ? `Текущая цель: ${selectedTarget.name}` : "Выберите общую цель. Выбор можно менять до завершения фазы."}
      </p>
      {deadlineAt ? <MafiaVoteTimer deadlineAt={deadlineAt} /> : null}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {players.map((player) => {
          const voters = room.mafiaAllies.filter((ally) => votes[ally.id] === player.id);
          const isOwnPick = activeId === player.id;
          const isResolvedTarget = room.nightActions?.mafiaTargetId === player.id;

          return (
            <button
              key={player.id}
              type="button"
              className={[
                "rounded-2xl border p-3 text-left transition hover:-translate-y-0.5",
                isOwnPick || isResolvedTarget
                  ? "border-coral/40 bg-coral/10 shadow-soft"
                  : voters.length > 0
                    ? "border-ocean/25 bg-ocean/10"
                    : "border-line bg-cloud hover:border-ocean/30"
              ].join(" ")}
              onClick={() => onPick(player.id)}
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold",
                    isOwnPick || isResolvedTarget ? "bg-coral text-white" : voters.length > 0 ? "bg-ocean text-white" : "bg-white text-slate-500"
                  ].join(" ")}
                >
                  {player.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{player.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {voters.length > 0 ? voters.map((voter) => voter.name).join(", ") : "Пока никто не выбрал"}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function MafiaVoteTimer({ deadlineAt }: { deadlineAt: number }) {
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
      Если мафия не договорится, цель выберется автоматически через {Math.max(0, Math.ceil((deadlineAt - now) / 1000))} сек.
    </p>
  );
}

function VotingTargetPicker({
  room,
  title,
  players,
  activeId,
  onPick
}: {
  room: PublicRoom;
  title: string;
  players: PublicPlayer[];
  activeId?: string;
  onPick: (id: string) => void;
}) {
  return (
    <div className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 text-sm text-slate-600">
        {room.phase === "DAY_REVOTE"
          ? "Можно голосовать только за игроков, набравших равное число голосов."
          : "Выберите игрока. После выбора голос изменить нельзя."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {players.map((player) => {
          const voters = room.players.filter((voter) => room.votes[voter.id] === player.id);
          const isOwnPick = activeId === player.id;

          return (
            <button
              key={player.id}
              type="button"
              disabled={Boolean(activeId)}
              className={[
                "rounded-2xl border p-3 text-left transition disabled:cursor-not-allowed",
                isOwnPick
                  ? "border-coral/40 bg-coral/10 shadow-soft"
                  : voters.length > 0
                    ? "border-ocean/25 bg-ocean/10"
                    : "border-line bg-cloud hover:-translate-y-0.5 hover:border-ocean/30",
                activeId && !isOwnPick ? "opacity-70" : ""
              ].join(" ")}
              onClick={() => onPick(player.id)}
            >
              <div className="flex items-start gap-3">
                <span
                  className={[
                    "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-lg font-bold",
                    isOwnPick ? "bg-coral text-white" : voters.length > 0 ? "bg-ocean text-white" : "bg-white text-slate-500"
                  ].join(" ")}
                >
                  {player.name.slice(0, 1).toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-ink">{player.name}</span>
                  <span className="mt-1 block text-xs leading-5 text-slate-500">
                    {voters.length > 0 ? voters.map((voter) => voter.name).join(", ") : "Пока нет голосов"}
                  </span>
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
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
    <div className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
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
