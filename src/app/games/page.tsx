import { AppShell } from "@/components/layout/AppShell";
import { GameCard } from "@/components/game-card/GameCard";
import { games } from "@/games/config";

export default function GamesPage() {
  return (
    <AppShell>
      <section className="py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Каталог игр</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Выберите игру</h1>
        <p className="mt-5 max-w-2xl text-slate-600">
          Платформа построена как общий каталог party games. Сейчас доступна Мафия, остальные
          игры уже зарезервированы в структуре проекта.
        </p>
      </section>
      <section className="grid gap-4 pb-12 md:grid-cols-2 xl:grid-cols-4">
        {games.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </section>
    </AppShell>
  );
}
