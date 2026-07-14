"use client";

import { useRouter } from "next/navigation";
import { games } from "@/games/config";
import { Button } from "@/components/ui/Button";

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
    <Button
      variant={variant === "hero" ? "secondary" : "primary"}
      className={variant === "hero" ? "w-full whitespace-nowrap sm:w-auto sm:min-w-44" : "shrink-0 whitespace-nowrap px-3 sm:px-4"}
      onClick={openRandomGameCreation}
      type="button"
    >
      {label}
      {variant === "header" ? <span className="hidden sm:inline"> комнату</span> : null}
    </Button>
  );
}
