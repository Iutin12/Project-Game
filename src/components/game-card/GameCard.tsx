import Link from "next/link";
import { games } from "@/games/config";

type GameCardProps = {
  game: (typeof games)[number];
};

export function GameCard({ game }: GameCardProps) {
  const content = (
    <article className="group relative h-full overflow-hidden rounded-xl border border-line bg-white p-4 shadow-soft transition hover:-translate-y-1 hover:border-ocean/30 hover:shadow-lg">
      <div className="relative flex items-start gap-4">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-50">
          <img
            src={game.illustration}
            alt=""
            aria-hidden="true"
            className="h-12 w-12 opacity-90 transition group-hover:scale-105"
          />
        </div>
        <div className="min-w-0 flex-1">
          <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ocean">
            {game.status === "available" ? "Доступно" : "Скоро"}
          </span>
          <h3 className="mt-3 text-lg font-bold text-ink">{game.title}</h3>
          <p className="mt-1 text-xs leading-5 text-slate-600">{game.description}</p>
        </div>
        <span className="hidden rounded-full border border-line bg-slate-50 px-3 py-1 text-xs uppercase tracking-[0.16em] text-slate-500">
          {game.status === "available" ? "Доступно" : "Скоро"}
        </span>
      </div>
      <div className="relative mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs font-semibold text-slate-500">
        <span className="whitespace-nowrap">♟ {game.minPlayers}-{game.maxPlayers} игроков</span>
        <span className="whitespace-nowrap">◷ {game.duration}</span>
        {game.status === "available" ? <span className="ml-auto whitespace-nowrap text-ocean">Играть ›</span> : null}
      </div>
    </article>
  );

  if (game.status !== "available") {
    return <div className="opacity-70">{content}</div>;
  }

  return <Link href={game.route}>{content}</Link>;
}
