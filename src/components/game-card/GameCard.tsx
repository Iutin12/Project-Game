import Link from "next/link";
import { games } from "@/games/config";

type GameCardProps = {
  game: (typeof games)[number];
};

export function GameCard({ game }: GameCardProps) {
  const content = (
    <article className="group relative h-full overflow-hidden rounded-xl border border-line bg-white p-4 shadow-soft transition hover:-translate-y-1 hover:border-ocean/30 hover:shadow-lg">
      <div className="relative mb-4 h-36 overflow-hidden rounded-xl bg-slate-950">
        <img
          src={game.illustration}
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover opacity-95 transition duration-300 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950/60 via-transparent to-transparent" />
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ocean shadow-sm">
          {game.status === "available" ? "Доступно" : "Скоро"}
        </span>
      </div>
      <div className="relative">
        <h3 className="text-lg font-bold text-ink">{game.title}</h3>
        <p className="mt-1 text-xs leading-5 text-slate-600">{game.description}</p>
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
