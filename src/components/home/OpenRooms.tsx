"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";
import { phaseLabels } from "@/games/mafia/phases";
import type { GamePhase } from "@/games/mafia/types";

type OpenRoom = {
  code: string;
  gameId: "mafia";
  phase: GamePhase;
  playersCount: number;
  maxPlayers: number;
  hostName?: string;
  createdAt: number;
};

type Stats = {
  publicRooms?: OpenRoom[];
};

export function OpenRooms() {
  const [rooms, setRooms] = useState<OpenRoom[]>([]);

  useEffect(() => {
    let mounted = true;

    async function loadRooms() {
      const response = await fetch("/api/stats", { cache: "no-store" });
      if (!response.ok) return;
      const stats = (await response.json()) as Stats;
      if (mounted) setRooms(stats.publicRooms ?? []);
    }

    loadRooms();
    const timer = window.setInterval(loadRooms, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  if (rooms.length === 0) {
    return (
      <div className="flex min-h-[26rem] flex-col justify-between rounded-2xl border border-line bg-white p-5 shadow-soft">
        <div>
          <p className="text-sm font-semibold text-slate-500">Открытые комнаты</p>
          <h2 className="mt-6 flex items-center gap-3 text-xl font-bold text-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ocean text-white">♟</span>
            Сейчас нет открытых комнат
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">
            Создайте открытую комнату, и она появится здесь вместо примера. Любой игрок сможет зайти в нее с главного экрана.
          </p>
        </div>
        <Link href="/games/mafia">
          <Button className="mt-8 w-full">Создать открытую комнату</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-semibold text-slate-500">Открытые комнаты</p>
          <h2 className="mt-6 flex items-center gap-3 text-xl font-bold text-ink">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ocean text-white">♟</span>
            Можно войти свободно
          </h2>
        </div>
        <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-mint">{rooms.length} онлайн</span>
      </div>

      <div className="max-h-[36rem] space-y-2 overflow-y-auto pr-1">
        {rooms.map((room) => (
          <article key={room.code} className="rounded-2xl border border-line bg-cloud/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-ocean">Комната {room.code}</p>
                <h3 className="mt-1 text-lg font-bold text-ink">Мафия</h3>
                <p className="mt-1 text-sm text-slate-500">
                  {room.playersCount} / {room.maxPlayers} игроков · {phaseLabels[room.phase]}
                </p>
              </div>
              <Link href={`/room/${room.code}`}>
                <Button className="px-4 py-2">Войти</Button>
              </Link>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
