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
          <p className="mb-4 text-sm uppercase tracking-[0.34em] text-red-300/80">party games online</p>
          <h1 className="font-display text-5xl leading-none text-white sm:text-7xl">
            Онлайн-игры для компании друзей
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-white/72">
            Создайте комнату, отправьте ссылку друзьям и играйте вместе в Мафию, Бункер,
            Шпиона и другие игры. Сейчас открыта первая игра: атмосферная Мафия с комнатами
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

        <div className="rounded-lg border border-red-300/20 bg-black/35 p-5 shadow-glow">
          <p className="text-sm uppercase tracking-[0.28em] text-white/50">Ночь наступает</p>
          <div className="mt-8 space-y-4">
            {["Мафия выбирает жертву", "Комиссар выходит на проверку", "Город просыпается"].map(
              (line) => (
                <div key={line} className="rounded-md border border-white/10 bg-white/[0.06] px-4 py-4 text-white/80">
                  {line}
                </div>
              )
            )}
          </div>
        </div>
      </section>

      <section className="pb-12">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-red-200/60">Каталог</p>
            <h2 className="font-display text-4xl text-white">Игры</h2>
          </div>
          <Link className="text-sm text-white/60 hover:text-white" href="/games">
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
