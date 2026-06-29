"use client";

import { useEffect, useMemo, useState } from "react";
import { io, type Socket } from "socket.io-client";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { phaseLabels } from "@/games/mafia/phases";
import { roleLabels } from "@/games/mafia/roles";
import type { PublicRoom } from "@/games/mafia/types";

type Ack = { ok: boolean; error?: string; playerId?: string };

export default function MafiaTestPage() {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [room, setRoom] = useState<PublicRoom | null>(null);
  const [error, setError] = useState("");
  const [isCreating, setIsCreating] = useState(false);

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

  function emitDev(event: string) {
    setError("");
    socket?.emit(event, {}, (ack: Ack) => {
      if (!ack.ok) setError(ack.error ?? "Dev-действие не выполнено");
    });
  }

  const aliveCount = useMemo(() => room?.players.filter((player) => player.alive).length ?? 0, [room]);

  return (
    <AppShell>
      <section className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">dev / mafia test</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-5xl font-semibold text-ink">Самостоятельная проверка Мафии</h1>
            <p className="mt-4 max-w-2xl text-slate-600">
              Тестовая комната показывает все роли и позволяет симулировать фазы без второго браузера.
              Обычные комнаты не получают эти кнопки и сохраняют лимит минимум 5 игроков.
            </p>
          </div>
          <Button onClick={createTestRoom} disabled={!socket || isCreating}>
            {isCreating ? "Создаем..." : "Создать тестовую комнату"}
          </Button>
        </div>
      </section>

      {error ? <p className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-coral">{error}</p> : null}

      {room ? (
        <section className="grid gap-5 pb-10 lg:grid-cols-[1fr_24rem]">
          <div className="space-y-5">
            <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Комната {room.code}
                  </p>
                  <h2 className="mt-2 font-display text-4xl font-semibold text-ink">{phaseLabels[room.phase]}</h2>
                  <p className="mt-2 text-slate-600">
                    Живых игроков: {aliveCount}. Победитель:{" "}
                    {room.winner ? (room.winner === "MAFIA" ? "Мафия" : "Мирные") : "пока нет"}.
                  </p>
                </div>
                <a href={`/room/${room.code}`} className="text-sm font-semibold text-ocean hover:text-ink">
                  Открыть обычную комнату
                </a>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {room.players.map((player) => (
                <article key={player.id} className="rounded-xl border border-line bg-white p-4 shadow-soft">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="font-semibold text-ink">{player.name}</h3>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-500">
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
          </div>

          <aside className="space-y-4">
            <div className="rounded-2xl border border-line bg-white p-4 shadow-soft">
              <h2 className="font-display text-2xl font-semibold text-ink">Dev-контроль</h2>
              <div className="mt-4 grid gap-2">
                <Button variant="secondary" onClick={() => emitDev("dev_add_bot")}>
                  Добавить бота
                </Button>
                <Button variant="secondary" onClick={() => emitDev("dev_fill_bots")}>
                  Добрать до 5 игроков
                </Button>
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

            <div className="rounded-2xl border border-line bg-white p-4 text-sm text-slate-600 shadow-soft">
              <p className="font-semibold text-ink">Что проверять</p>
              <p className="mt-2">Dev-режим видит все роли, заполняет действия ботов и быстро гоняет цикл игры.</p>
            </div>
          </aside>
        </section>
      ) : (
        <section className="rounded-2xl border border-line bg-white p-8 text-slate-600 shadow-soft">
          Создайте тестовую комнату, чтобы начать проверку.
        </section>
      )}
    </AppShell>
  );
}
