import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { games } from "@/games/config";

export default function RulesPage() {
  return (
    <AppShell>
      <section className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Правила</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Выберите игру</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Откройте карточку игры, чтобы посмотреть подробные правила, роли и порядок хода.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => {
            const card = (
              <article className="group h-full rounded-2xl border border-line bg-white/90 p-5 shadow-soft transition hover:-translate-y-1 hover:border-ocean/30">
                <div className="flex items-start gap-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-cloud">
                    <img src={game.illustration} alt="" aria-hidden="true" className="h-12 w-12" />
                  </div>
                  <div>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ocean">
                      {game.status === "available" ? "Правила доступны" : "Скоро"}
                    </span>
                    <h2 className="mt-3 font-display text-2xl font-semibold text-ink">{game.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{game.description}</p>
                  </div>
                </div>
                {game.status === "available" ? (
                  <p className="mt-5 text-sm font-bold text-ocean">Открыть правила ›</p>
                ) : (
                  <p className="mt-5 text-sm font-bold text-slate-400">Правила появятся позже</p>
                )}
              </article>
            );

            return game.status === "available" ? (
              <Link key={game.id} href={`/rules/${game.id}`}>
                {card}
              </Link>
            ) : (
              <div key={game.id} className="opacity-70">
                {card}
              </div>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
