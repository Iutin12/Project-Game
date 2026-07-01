import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { games } from "@/games/config";

const testRoutes: Record<string, string> = {
  mafia: "/dev/mafia-test"
};

export default function HowToPlayPage() {
  return (
    <AppShell>
      <section className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Как играть</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Тренировка и тестовые комнаты</h1>
        <p className="mt-4 max-w-2xl text-slate-600">
          Выберите игру, чтобы открыть тестовый режим, проверить роли и спокойно разобраться с ходом партии.
        </p>

        <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {games.map((game) => {
            const testRoute = testRoutes[game.id];
            return (
              <article key={game.id} className="rounded-2xl border border-line bg-white/90 p-5 shadow-soft">
                <div className="flex items-start gap-4">
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl bg-cloud">
                    <img src={game.illustration} alt="" aria-hidden="true" className="h-full w-full object-cover" />
                  </div>
                  <div>
                    <span className="rounded-full bg-red-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-ocean">
                      {testRoute ? "Тест доступен" : "Скоро"}
                    </span>
                    <h2 className="mt-3 font-display text-2xl font-semibold text-ink">{game.title}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-500">{game.description}</p>
                  </div>
                </div>
                {testRoute ? (
                  <Link
                    className="mt-5 inline-flex w-full items-center justify-center rounded-lg bg-ocean px-5 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-95"
                    href={testRoute}
                  >
                    Запустить тестовую игру
                  </Link>
                ) : (
                  <button
                    className="mt-5 inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-ocean px-5 py-3 text-sm font-semibold text-white opacity-45 shadow-soft"
                    disabled
                    type="button"
                  >
                    Тестовый режим скоро
                  </button>
                )}
              </article>
            );
          })}
        </div>
      </section>
    </AppShell>
  );
}
