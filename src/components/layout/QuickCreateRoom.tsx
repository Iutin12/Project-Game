"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { games } from "@/games/config";

export function QuickCreateRoom() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const availableGames = games.filter((game) => game.status === "available");

  async function createRoom() {
    if (availableGames.length === 0 || isCreating) return;
    setIsCreating(true);
    const game = availableGames[Math.floor(Math.random() * availableGames.length)];

    try {
      const response = await fetch("/api/create-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId: game.id, visibility: "private" })
      });
      if (!response.ok) throw new Error("Не удалось создать комнату");
      const data = (await response.json()) as { code: string; hostKey: string };
      window.localStorage.setItem(`hostKey:${data.code}`, data.hostKey);
      router.push(`/room/${data.code}`);
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <button
      className="shrink-0 whitespace-nowrap rounded-lg bg-ocean px-3 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
      disabled={availableGames.length === 0 || isCreating}
      onClick={createRoom}
      type="button"
    >
      {isCreating ? "Создаем..." : "+ Создать"}
      <span className="hidden sm:inline"> комнату</span>
    </button>
  );
}
