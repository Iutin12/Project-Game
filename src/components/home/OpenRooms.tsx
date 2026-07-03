"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type GameId = "mafia" | "crocodile";

type OpenRoom = {
  code: string;
  gameId: GameId;
  phase: string;
  phaseLabel?: string;
  title?: string;
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
  gameId: GameId;
  phase?: string;
  visibility?: "private" | "public";
  leftAt: number;
};

const LAST_LEFT_ROOM_KEY = "project-game:last-left-room";

const fallbackPhaseLabels: Record<string, string> = {
  LOBBY: "Лобби",
  ROLE_REVEAL: "Роли",
  NIGHT_MAFIA: "Ночь",
  NIGHT_MISTRESS: "Ночь",
  NIGHT_DON: "Ночь",
  NIGHT_DETECTIVE: "Ночь",
  NIGHT_DOCTOR: "Ночь",
  DAY_DISCUSSION: "Обсуждение",
  DAY_VOTING: "Голосование",
  DAY_REVOTE: "Переголосование",
  DAY_TIE_CHALLENGE: "Испытание",
  GAME_OVER: "Финал",
  ROUND_ACTIVE: "Раунд идет",
  ROUND_RESULT: "Итоги раунда"
};

const gameTitles: Record<GameId, string> = {
  mafia: "Мафия",
  crocodile: "Крокодил"
};

const gameIcons: Record<GameId, string> = {
  mafia: "♟",
  crocodile: "✋"
};

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
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ocean text-white">✦</span>
            Сейчас нет открытых комнат
          </h2>
          <p className="mt-4 max-w-md text-sm leading-6 text-slate-500">
            Создайте открытую комнату для любой доступной игры, и она появится здесь. Любой игрок сможет зайти с главного экрана.
          </p>
        </div>
        <Link href="/games">
          <Button className="mt-8 w-full">Выбрать игру</Button>
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
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ocean text-white">✦</span>
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
                <h3 className="mt-1 text-lg font-bold text-ink">
                  {gameTitles[rememberedRoom.gameId]} · {rememberedRoom.code}
                </h3>
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
          <article key={`${room.gameId}-${room.code}`} className="rounded-2xl border border-line bg-cloud/70 p-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <span className="mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ocean text-white">
                  {gameIcons[room.gameId]}
                </span>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-[0.18em] text-ocean">Комната {room.code}</p>
                  <h3 className="mt-1 text-lg font-bold text-ink">{room.title ?? gameTitles[room.gameId]}</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    {room.playersCount} / {room.maxPlayers} игроков · {room.phaseLabel ?? fallbackPhaseLabels[room.phase] ?? "Лобби"}
                  </p>
                  {room.hostName ? <p className="mt-1 text-xs text-slate-400">Хост: {room.hostName}</p> : null}
                </div>
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
    if (!parsed.code || (parsed.gameId !== "mafia" && parsed.gameId !== "crocodile")) {
      window.localStorage.removeItem(LAST_LEFT_ROOM_KEY);
      return;
    }
    setRememberedRoom(parsed);
  } catch {
    window.localStorage.removeItem(LAST_LEFT_ROOM_KEY);
  }
}
