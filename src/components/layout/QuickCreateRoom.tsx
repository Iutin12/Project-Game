"use client";

import { useRouter } from "next/navigation";
import { games } from "@/games/config";

type QuickCreateRoomProps = {
  label?: string;
  variant?: "header" | "hero";
};

export function QuickCreateRoom({ label = "+ Создать", variant = "header" }: QuickCreateRoomProps) {
  const router = useRouter();
  const availableGames = games.filter((game) => game.status === "available");

  function openRandomGameCreation() {
    if (availableGames.length === 0) {
      router.push("/games");
      return;
    }

    const game = availableGames[Math.floor(Math.random() * availableGames.length)];
    router.push(game.route);
  }

  return (
    <button
      className={
        variant === "hero"
          ? "min-w-44 shrink-0 whitespace-nowrap rounded-md border border-line bg-white px-5 py-3 text-sm font-bold text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-ocean/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-white"
          : "shrink-0 whitespace-nowrap rounded-lg bg-ocean px-3 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
      }
      onClick={openRandomGameCreation}
      type="button"
    >
      {label}
      {variant === "header" ? <span className="hidden sm:inline"> комнату</span> : null}
    </button>
  );
}
