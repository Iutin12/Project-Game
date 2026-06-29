"use client";

import { useEffect, useState } from "react";

type Stats = {
  roomsCreatedToday: number;
  activeRooms: number;
  onlinePlayers: number;
};

export function HomeStats() {
  const [stats, setStats] = useState<Stats>({
    roomsCreatedToday: 0,
    activeRooms: 0,
    onlinePlayers: 0
  });

  useEffect(() => {
    let mounted = true;

    async function loadStats() {
      const response = await fetch("/api/stats", { cache: "no-store" });
      if (!response.ok) return;
      const nextStats = (await response.json()) as Stats;
      if (mounted) setStats(nextStats);
    }

    loadStats();
    const timer = window.setInterval(loadStats, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, []);

  return (
    <div className="mt-10 flex flex-wrap items-center gap-5 text-sm font-semibold text-slate-600">
      <span className="flex items-center gap-2">
        <span className="text-ocean">♟</span> {stats.roomsCreatedToday.toLocaleString("ru-RU")} комнат создано сегодня
      </span>
      <span className="h-4 w-px bg-line" />
      <span className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-emerald-500" /> {stats.onlinePlayers.toLocaleString("ru-RU")} игрока онлайн
      </span>
    </div>
  );
}
