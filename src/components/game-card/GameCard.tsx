import Link from "next/link";
import { games } from "@/games/config";

type GameCardProps = {
  game: (typeof games)[number];
};

export function GameCard({ game }: GameCardProps) {
  const content = (
    <article className="group relative h-full overflow-hidden rounded-xl border border-line bg-white p-5 shadow-soft transition hover:-translate-y-1 hover:border-ocean/30 hover:shadow-lg">
      <img
        src={game.illustration}
        alt=""
        aria-hidden="true"
        className="pointer-events-none absolute -right-8 -top-7 h-32 w-32 opacity-20 transition group-hover:scale-105 group-hover:opacity-30"
      />
      <div className="relative flex items-start justify-between gap-3">
        <h3 className="font-display text-3xl font-semibold text-ink">{game.title}</h3>
        <span className="rounded-full border border-line bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-500">
          {game.status === "available" ? "Доступно" : "Скоро"}
        </span>
      </div>
      <p className="relative mt-4 min-h-16 text-sm leading-6 text-slate-600">{game.description}</p>
      <p className="relative mt-5 text-sm font-medium text-slate-500">
        {game.minPlayers}-{game.maxPlayers} игроков
      </p>
    </article>
  );

  if (game.status !== "available") {
    return <div className="opacity-70">{content}</div>;
  }

  return <Link href={game.route}>{content}</Link>;
}
