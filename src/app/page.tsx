import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { GameCard } from "@/components/game-card/GameCard";
import { games } from "@/games/config";

export default function HomePage() {
  return (
    <AppShell>
      <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.05fr_0.95fr] lg:py-20">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-[0.26em] text-ocean">party games online</p>
          <h1 className="font-display text-5xl font-semibold leading-none text-ink sm:text-7xl">
            Онлайн-игры для компании друзей
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-600">
            Создайте комнату, отправьте ссылку друзьям и играйте вместе в Мафию, Бункер,
            Шпиона и другие игры. Сейчас открыта первая игра: Мафия с комнатами
            в реальном времени.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/games">
              <Button>Выбрать игру</Button>
            </Link>
            <Link href="/games/mafia">
              <Button variant="secondary">Создать Мафию</Button>
            </Link>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between gap-4 border-b border-line pb-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-400">быстрый старт</p>
              <h2 className="mt-2 font-display text-3xl font-semibold text-ink">Комната за минуту</h2>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-mint">online</span>
          </div>
          <div className="mt-5 space-y-3">
            {["Выберите игру", "Создайте комнату", "Отправьте ссылку друзьям", "Запустите партию"].map((line, index) => (
              <div key={line} className="flex items-center gap-3 rounded-lg border border-line bg-cloud px-4 py-3 text-slate-700">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-sm font-semibold text-ocean">
                  {index + 1}
                </span>
                {line}
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="pb-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.22em] text-slate-400">Каталог</p>
            <h2 className="font-display text-4xl font-semibold text-ink">Игры</h2>
          </div>
          <Link className="text-sm font-medium text-slate-500 hover:text-ink" href="/games">
            Все игры
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>
    </AppShell>
  );
}
