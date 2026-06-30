"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { io, type Socket } from "socket.io-client";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { phaseLabels } from "@/games/mafia/phases";
import { roleLabels } from "@/games/mafia/roles";
import type { PublicRoom, Role } from "@/games/mafia/types";

type Ack = { ok: boolean; error?: string; playerId?: string };

export default function MafiaTestPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [devTab, setDevTab] = useState<"actions" | "players" | "settings">("actions");

  useEffect(() => {
    const nextSocket = io({ path: "/socket.io" });
    setSocket(nextSocket);
    nextSocket.on("room_updated", (nextRoom: PublicRoom) => setRoom(nextRoom));
    return () => {
      nextSocket.disconnect();
    };
  }, []);

  async function createTestRoom() {
    setIsCreating(true);
    setError("");

    try {
      const response = await fetch("/api/dev/create-mafia-test-room", { method: "POST" });
      if (!response.ok) throw new Error("Не удалось создать dev-комнату");
      const data = (await response.json()) as { code: string; hostKey: string };
      socket?.emit("join_room", { code: data.code, name: "Dev Host", hostKey: data.hostKey }, (ack: Ack) => {
        if (!ack.ok) {
          setError(ack.error ?? "Не удалось войти в dev-комнату");
          return;
        }
        window.localStorage.setItem(`hostKey:${data.code}`, data.hostKey);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать dev-комнату");
    } finally {
      setIsCreating(false);
    }
  }

  function emitDev(event: string, payload: unknown = {}) {
    setError("");
    socket?.emit(event, payload, (ack: Ack) => {
      if (!ack.ok) setError(ack.error ?? "Dev-действие не выполнено");
    });
  }

  const aliveCount = useMemo(() => room?.players.filter((player) => player.alive).length ?? 0, [room]);
  const alivePlayers = useMemo(() => room?.players.filter((player) => player.alive) ?? [], [room]);

  return (
    <AppShell>
      <section className="py-6">
        <div className="rounded-[2rem] border border-line bg-white/85 p-4 shadow-soft backdrop-blur">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-ocean">dev / mafia test</p>
          <div className="mt-2 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-semibold text-ink md:text-4xl">Самостоятельная проверка Мафии</h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                Тестовая комната показывает все роли и позволяет симулировать фазы без второго браузера.
                Обычные комнаты не получают эти кнопки и сохраняют лимит минимум 5 игроков.
              </p>
            </div>
            <Button onClick={createTestRoom} disabled={!socket || isCreating}>
              {isCreating ? "Создаем..." : "Создать тестовую комнату"}
            </Button>
          </div>
        </div>
      </section>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-coral">{error}</p> : null}

      {room ? (
        <section className="space-y-4 pb-10">
          <div className="rounded-[1.75rem] border border-line bg-white/90 p-4 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-ocean">Комната {room.code}</p>
                <h2 className="mt-2 font-display text-3xl font-semibold text-ink">{phaseLabels[room.phase]}</h2>
                <p className="mt-1 text-sm text-slate-600">
                  Живых игроков: {aliveCount}. Победитель:{" "}
                  {room.winner ? (room.winner === "MAFIA" ? "Мафия" : "Мирные") : "пока нет"}.
                </p>
              </div>
              <a
                href={`/room/${room.code}`}
                className="rounded-2xl border border-line px-4 py-2 text-sm font-semibold text-ocean hover:bg-cloud hover:text-ink"
              >
                Открыть обычную комнату
              </a>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 rounded-[1.5rem] border border-line bg-cloud/70 p-2">
            <DevTabButton active={devTab === "actions"} onClick={() => setDevTab("actions")}>
              Проверка фаз
            </DevTabButton>
            <DevTabButton active={devTab === "players"} onClick={() => setDevTab("players")}>
              Игроки
              <span className="ml-2 rounded-full bg-white/70 px-2 py-0.5 text-xs">{room.players.length}</span>
            </DevTabButton>
            <DevTabButton active={devTab === "settings"} onClick={() => setDevTab("settings")}>
              Dev-контроль
            </DevTabButton>
          </div>

          {devTab === "actions" ? <ManualPlayPanel room={room} alivePlayers={alivePlayers} emitDev={emitDev} /> : null}

          {devTab === "players" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {room.players.map((player) => (
                <article key={player.id} className="rounded-2xl border border-line bg-white/90 p-4 shadow-soft">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-ink">{player.name}</h3>
                    <span className="rounded-full bg-cloud px-2 py-1 text-xs font-semibold text-slate-500">
                      {player.isBot ? "бот" : player.isHost ? "хост" : "игрок"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">
                    Роль: {player.role ? roleLabels[player.role] : "не выдана"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">{player.alive ? "Жив" : "Выбыл"}</p>
                </article>
              ))}
            </div>
          ) : null}

          {devTab === "settings" ? (
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="rounded-2xl border border-line bg-white/90 p-4 text-sm leading-6 text-slate-600 shadow-soft">
                <p className="font-semibold text-ink">Что проверять</p>
                <p className="mt-2">
                  Ручная панель во вкладке фаз позволяет полноценно выбирать действия ролей.
                  Кнопки симуляции остаются как быстрый автопрогон.
                </p>
              </div>
              <DevControls room={room} emitDev={emitDev} />
            </div>
          ) : null}
        </section>
      ) : (
        <section className="rounded-2xl border border-line bg-white p-8 text-slate-600 shadow-soft">
          Создайте тестовую комнату, чтобы начать проверку.
        </section>
      )}
    </AppShell>
  );
}

function DevTabButton({ active, children, onClick }: { active: boolean; children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      className={[
        "rounded-2xl px-4 py-2 text-sm font-semibold transition hover:-translate-y-0.5",
        active ? "bg-ocean text-white shadow-soft" : "text-slate-500 hover:bg-white/80 hover:text-ink"
      ].join(" ")}
      onClick={onClick}
    >
      {children}
    </button>
  );
}

function DevControls({
  room,
  emitDev
}: {
  room: PublicRoom;
  emitDev: (event: string, payload?: unknown) => void;
}) {
  return (
    <div className="rounded-2xl border border-line bg-white/90 p-4 shadow-soft">
      <h2 className="font-display text-2xl font-semibold text-ink">Dev-контроль</h2>
      <div className="mt-4 grid gap-2">
        <Button variant="secondary" onClick={() => emitDev("dev_add_bot")}>
          Добавить бота
        </Button>
        <Button variant="secondary" onClick={() => emitDev("dev_fill_bots")}>
          Добрать до 5 игроков
        </Button>
        {room.phase === "LOBBY" ? <DevSettings room={room} emitDev={emitDev} /> : null}
        <Button onClick={() => emitDev("start_game")} disabled={room.phase !== "LOBBY"}>
          Запустить игру
        </Button>
        <Button variant="secondary" onClick={() => emitDev("next_phase")} disabled={room.phase === "LOBBY"}>
          Следующая фаза
        </Button>
        <Button variant="secondary" onClick={() => emitDev("dev_simulate_phase")}>
          Симулировать фазу
        </Button>
        <Button variant="secondary" onClick={() => emitDev("dev_simulate_round")}>
          Симулировать раунд
        </Button>
        <Button variant="secondary" onClick={() => emitDev("dev_play_to_win")}>
          Играть до победы
        </Button>
        <Button variant="ghost" onClick={() => emitDev("restart_game")}>
          Вернуть в лобби
        </Button>
      </div>
    </div>
  );
}

function DevSettings({
  room,
  emitDev
}: {
  room: PublicRoom;
  emitDev: (event: string, payload?: unknown) => void;
}) {
  return (
    <div className="rounded-xl border border-line bg-cloud p-3">
      <p className="font-semibold text-ink">Настройки ролей</p>
      <label className="mt-3 grid gap-1 text-sm text-slate-600">
        Убийц мафии
        <select
          className="rounded-md border border-line bg-white px-3 py-2 text-ink outline-none focus:border-ocean"
          value={room.settings.mafiaCount}
          onChange={(event) =>
            emitDev("update_settings", {
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
      <label className="mt-3 flex items-center justify-between gap-3 text-sm text-slate-700">
        Дон мафии
        <input
          type="checkbox"
          checked={room.settings.hasDon}
          onChange={(event) => emitDev("update_settings", { hasDon: event.target.checked })}
        />
      </label>
      <label className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-700">
        Любовница
        <input
          type="checkbox"
          checked={room.settings.hasMistress}
          onChange={(event) => emitDev("update_settings", { hasMistress: event.target.checked })}
        />
      </label>
      <label className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-700">
        Комиссар / шериф
        <input
          type="checkbox"
          checked={room.settings.hasDetective}
          onChange={(event) => emitDev("update_settings", { hasDetective: event.target.checked })}
        />
      </label>
      <label className="mt-2 flex items-center justify-between gap-3 text-sm text-slate-700">
        Доктор
        <input
          type="checkbox"
          checked={room.settings.hasDoctor}
          onChange={(event) => emitDev("update_settings", { hasDoctor: event.target.checked })}
        />
      </label>
    </div>
  );
}

function ManualPlayPanel({
  room,
  alivePlayers,
  emitDev
}: {
  room: PublicRoom;
  alivePlayers: PublicRoom["players"];
  emitDev: (event: string, payload?: unknown) => void;
}) {
  const mafiaTarget = room.players.find((player) => player.id === room.nightActions?.mafiaTargetId);
  const mistressTarget = room.players.find((player) => player.id === room.nightActions?.mistressTargetId);
  const detectiveTarget = room.players.find((player) => player.id === room.nightActions?.detectiveTargetId);
  const doctorTarget = room.players.find((player) => player.id === room.nightActions?.doctorTargetId);
  const mafiaKillers = alivePlayers.filter((player) => player.role === "MAFIA" || player.role === "DON");

  if (room.phase === "LOBBY") {
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="font-display text-3xl font-semibold text-ink">Подготовка партии</h2>
        <p className="mt-2 text-slate-600">
          Добавьте ботов до пяти игроков и нажмите “Запустить игру”. После этого появятся ручные действия
          для каждой фазы.
        </p>
      </section>
    );
  }

  if (room.phase === "ROLE_REVEAL") {
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="font-display text-3xl font-semibold text-ink">Роли выданы</h2>
        <p className="mt-2 text-slate-600">
          Посмотрите роли на карточках игроков и переходите к ночи кнопкой “Следующая фаза”.
        </p>
      </section>
    );
  }

  if (room.phase === "NIGHT_MAFIA") {
    const targets = alivePlayers.filter((player) => !isMafiaRole(player.role));
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="font-display text-3xl font-semibold text-ink">Ход мафии</h2>
        <p className="mt-2 text-slate-600">
          Итоговая жертва: {mafiaTarget ? mafiaTarget.name : "пока не решена"}.
          {room.players.some((player) => player.role === "MISTRESS") ? (
            <> Любовница отвлекает: {mistressTarget ? mistressTarget.name : "пока никто"}.</>
          ) : null}
        </p>
        {room.nightActions?.mafiaVoteDeadlineAt ? (
          <p className="mt-2 text-sm text-slate-500">
            Без Дона авто-выбор сработает через{" "}
            {Math.max(0, Math.ceil((room.nightActions.mafiaVoteDeadlineAt - Date.now()) / 1000))} сек.
          </p>
        ) : null}
        <div className="mt-4 grid gap-4">
          {mafiaKillers.map((mafiaPlayer) => (
            <div key={mafiaPlayer.id} className="rounded-xl border border-line bg-cloud p-3">
              <p className="font-semibold text-ink">
                {mafiaPlayer.name} выбирает:{" "}
                <span className="text-slate-500">
                  {room.players.find((player) => player.id === room.nightActions?.mafiaVotes?.[mafiaPlayer.id])?.name ??
                    "не выбрано"}
                </span>
              </p>
              <TargetButtons
                players={targets}
                activeId={room.nightActions?.mafiaVotes?.[mafiaPlayer.id]}
                onPick={(targetId) => emitDev("dev_mafia_choose_target", { voterId: mafiaPlayer.id, targetId })}
              />
            </div>
          ))}
        </div>
        {room.players.some((player) => player.role === "MISTRESS") ? (
          <>
            <h3 className="mt-5 font-semibold text-ink">Любовница отвлекает</h3>
            <TargetButtons
              players={targets}
              activeId={room.nightActions?.mistressTargetId}
              onPick={(targetId) => emitDev("dev_mistress_distract_player", { targetId })}
            />
          </>
        ) : null}
      </section>
    );
  }

  if (room.phase === "NIGHT_DETECTIVE") {
    const detective = alivePlayers.find((player) => player.role === "DETECTIVE");
    const targets = alivePlayers.filter((player) => player.id !== detective?.id);
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="font-display text-3xl font-semibold text-ink">Ход комиссара</h2>
        <p className="mt-2 text-slate-600">
          Проверен: {detectiveTarget ? detectiveTarget.name : "пока никто"}.
          {room.detectiveResult ? ` Результат: ${room.detectiveResult.isMafia ? "мафия" : "не мафия"}.` : ""}
        </p>
        <TargetButtons
          players={targets}
          activeId={room.nightActions?.detectiveTargetId}
          onPick={(targetId) => emitDev("dev_detective_check_player", { targetId })}
        />
      </section>
    );
  }

  if (room.phase === "NIGHT_DOCTOR") {
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="font-display text-3xl font-semibold text-ink">Ход доктора</h2>
        <p className="mt-2 text-slate-600">
          Лечение: {doctorTarget ? doctorTarget.name : "пока никто"}. Если доктор выберет жертву мафии,
          игрок переживет ночь.
        </p>
        <TargetButtons
          players={alivePlayers}
          activeId={room.nightActions?.doctorTargetId}
          onPick={(targetId) => emitDev("dev_doctor_save_player", { targetId })}
        />
      </section>
    );
  }

  if (room.phase === "DAY_DISCUSSION") {
    const killed = room.players.find((player) => player.id === room.lastNightKilledId);
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <h2 className="font-display text-3xl font-semibold text-ink">День</h2>
        <p className="mt-2 text-slate-600">
          Итог ночи: {killed ? `погиб ${killed.name}` : "никто не погиб"}. После обсуждения переходите к
          голосованию.
        </p>
      </section>
    );
  }

  if (room.phase === "DAY_VOTING") {
    return (
      <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-3xl font-semibold text-ink">Голосование</h2>
            <p className="mt-2 text-slate-600">Выберите, кто из живых игроков голосует против кого.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {alivePlayers.map((target) => (
              <Button
                key={target.id}
                variant="secondary"
                onClick={() => emitDev("dev_cast_all_votes", { targetId: target.id })}
              >
                Все против {target.name}
              </Button>
            ))}
          </div>
        </div>
        <div className="mt-5 space-y-3">
          {alivePlayers.map((voter) => (
            <div key={voter.id} className="rounded-xl border border-line bg-cloud p-3">
              <p className="font-semibold text-ink">
                {voter.name} голосует против:{" "}
                <span className="text-slate-500">
                  {room.votes[voter.id]
                    ? room.players.find((player) => player.id === room.votes[voter.id])?.name
                    : "не выбрано"}
                </span>
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {alivePlayers
                  .filter((target) => target.id !== voter.id)
                  .map((target) => (
                    <Button
                      key={target.id}
                      variant={room.votes[voter.id] === target.id ? "primary" : "secondary"}
                      onClick={() => emitDev("dev_cast_vote", { voterId: voter.id, targetId: target.id })}
                    >
                      {target.name}
                    </Button>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <h2 className="font-display text-3xl font-semibold text-ink">Игра окончена</h2>
      <p className="mt-2 text-slate-600">
        Победили: {room.winner === "MAFIA" ? "Мафия" : "Мирные жители"}.
      </p>
    </section>
  );
}

function TargetButtons({
  players,
  activeId,
  onPick
}: {
  players: PublicRoom["players"];
  activeId?: string;
  onPick: (targetId: string) => void;
}) {
  return (
    <div className="mt-4 flex flex-wrap gap-2">
      {players.map((player) => (
        <Button
          key={player.id}
          variant={activeId === player.id ? "primary" : "secondary"}
          onClick={() => onPick(player.id)}
        >
          {player.name}
        </Button>
      ))}
    </div>
  );
}

function isMafiaRole(role?: Role) {
  return role === "MAFIA" || role === "DON" || role === "MISTRESS";
}
