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

type RememberedRoom = {
  code: string;
  gameId: "mafia";
  phase?: GamePhase;
  visibility?: "private" | "public";
  leftAt: number;
};

const LAST_LEFT_ROOM_KEY = "project-game:last-left-room";

export function OpenRooms() {
  const [rooms, setRooms] = useState<OpenRoom[]>([]);
  const [rememberedRoom, setRememberedRoom] = useState<RememberedRoom | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadRooms() {
      const response = await fetch("/api/stats", { cache: "no-store" });
      if (!response.ok) return;
      const stats = (await response.json()) as Stats;
      if (mounted) setRooms(stats.publicRooms ?? []);
    }

    loadRooms();
    loadRememberedRoom(setRememberedRoom);
    const timer = window.setInterval(loadRooms, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  const visibleRooms = rememberedRoom ? rooms.filter((room) => room.code !== rememberedRoom.code) : rooms;

  if (rooms.length === 0 && !rememberedRoom) {
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
    <div className="flex h-full min-h-[26rem] max-h-[32rem] flex-col rounded-2xl border border-line bg-white p-5 shadow-soft">
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

      <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {rememberedRoom ? (
          <article className="rounded-2xl border border-coral/30 bg-coral/10 p-3 shadow-soft">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Последняя комната</p>
                <h3 className="mt-1 text-lg font-bold text-ink">Мафия · {rememberedRoom.code}</h3>
                <p className="mt-1 text-sm text-slate-500">
                  Вы недавно вышли отсюда. Можно вернуться за того же игрока.
                </p>
              </div>
              <Link href={`/room/${rememberedRoom.code}`}>
                <Button className="px-4 py-2">Вернуться</Button>
              </Link>
            </div>
          </article>
        ) : null}
        {visibleRooms.map((room) => (
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
        {visibleRooms.length === 0 && rememberedRoom ? (
          <p className="rounded-2xl border border-line bg-cloud/70 p-4 text-sm text-slate-500">
            Других открытых комнат сейчас нет.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function loadRememberedRoom(setRememberedRoom: (room: RememberedRoom | null) => void) {
  const raw = window.localStorage.getItem(LAST_LEFT_ROOM_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw) as RememberedRoom;
    if (!parsed.code || parsed.gameId !== "mafia") {
      window.localStorage.removeItem(LAST_LEFT_ROOM_KEY);
      return;
    }
    setRememberedRoom(parsed);
  } catch {
    window.localStorage.removeItem(LAST_LEFT_ROOM_KEY);
  }
}
