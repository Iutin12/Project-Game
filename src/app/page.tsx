import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { GameCard } from "@/components/game-card/GameCard";
import { HomeStats } from "@/components/home/HomeStats";
import { OpenRooms } from "@/components/home/OpenRooms";
import { games } from "@/games/config";

export default function HomePage() {
  return (
    <AppShell>
      <section className="mt-8 grid gap-8 rounded-2xl border border-line bg-white/80 p-5 shadow-soft backdrop-blur lg:grid-cols-[1fr_1.05fr] lg:p-8">
        <div className="flex flex-col justify-center py-8">
          <p className="mb-5 w-fit rounded-full bg-violet-50 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-violet-600">
            party games online
          </p>
          <h1 className="max-w-2xl text-5xl font-black leading-tight tracking-tight text-ink sm:text-6xl">
            Онлайн-игры для компании <span className="text-ocean">друзей</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Создавайте комнаты, приглашайте друзей по ссылке и играйте в увлекательные игры вместе.
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link href="/games">
              <Button className="min-w-44">Выбрать игру</Button>
            </Link>
            <Link href="/games/mafia">
              <Button variant="secondary" className="min-w-44">🔗 Создать комнату</Button>
            </Link>
          </div>
          <HomeStats />
        </div>

        <OpenRooms />
      </section>

      <section className="py-8">
        <div className="mb-5 flex items-end justify-between gap-4">
          <div>
            <h2 className="text-2xl font-black text-ink">Каталог игр</h2>
          </div>
          <Link className="text-sm font-bold text-violet-600 hover:text-ink" href="/games">
            Все игры →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {games.map((game) => (
            <GameCard key={game.id} game={game} />
          ))}
        </div>
      </section>

      <section className="mb-10 rounded-2xl border border-line bg-white/80 p-5 shadow-soft backdrop-blur">
        <h2 className="text-2xl font-black text-ink">Как это работает</h2>
        <div className="mt-7 grid gap-4 lg:grid-cols-4">
          {[
            ["+", "Выберите игру", "Выберите игру из каталога, которая вам нравится."],
            ["♟", "Создайте комнату", "Настройте параметры и создайте комнату для друзей."],
            ["🔗", "Пригласите друзей", "Отправьте ссылку или код комнаты своим друзьям."],
            ["🎮", "Играйте вместе", "Наслаждайтесь игрой и веселой атмосферой."]
          ].map(([icon, title, text], index) => (
            <div key={title} className="flex items-center gap-5">
              <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-600">
                {index + 1}
              </span>
              <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-3xl text-slate-600">{icon}</span>
              <div>
                <h3 className="font-bold text-ink">{title}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
