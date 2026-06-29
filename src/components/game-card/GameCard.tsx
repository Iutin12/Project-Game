import Link from "next/link";
import { games } from "@/games/config";

type GameCardProps = {
  game: (typeof games)[number];
};

export function GameCard({ game }: GameCardProps) {
  const content = (
    <article className="group h-full rounded-lg border border-white/10 bg-white/[0.06] p-5 transition hover:-translate-y-1 hover:border-red-400/50 hover:bg-white/[0.09]">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-3xl text-white">{game.title}</h3>
        <span className="rounded-full border border-white/10 bg-black/30 px-3 py-1 text-xs uppercase tracking-[0.18em] text-white/60">
          {game.status === "available" ? "Доступно" : "Скоро"}
        </span>
      </div>
      <p className="mt-4 min-h-16 text-sm leading-6 text-white/70">{game.description}</p>
      <p className="mt-5 text-sm text-white/50">
        {game.minPlayers}-{game.maxPlayers} игроков
      </p>
    </article>
  );

  if (game.status !== "available") {
    return <div className="opacity-70">{content}</div>;
  }

  return <Link href={game.route}>{content}</Link>;
}
