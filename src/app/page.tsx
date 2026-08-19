import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { GameCard } from "@/components/game-card/GameCard";
import { HomeStats } from "@/components/home/HomeStats";
import { OpenRooms } from "@/components/home/OpenRooms";
import { QuickCreateRoom } from "@/components/layout/QuickCreateRoom";
import { gamesByAvailability } from "@/games/config";

export default function HomePage() {
  return (
    <AppShell>
      <section className="mt-6 grid gap-6 rounded-[1.5rem] border border-line bg-white/80 p-5 shadow-soft backdrop-blur sm:mt-8 lg:grid-cols-[1fr_1.05fr] lg:gap-8 lg:p-8">
        <div className="flex min-w-0 flex-col justify-center py-5 sm:py-8">
          <p className="mb-5 w-fit rounded-full border border-coral/15 bg-coral/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-coral">
            Бета-тест · возможны ошибки
          </p>
          <h1 className="max-w-2xl text-4xl font-black leading-tight tracking-tight text-ink sm:text-6xl">
            Онлайн-игры для компании <span className="text-ocean">друзей</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Создавайте комнаты, приглашайте друзей по ссылке и играйте в увлекательные игры вместе.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
            <Link className="sm:w-auto" href="/games">
              <Button className="w-full sm:min-w-44">Выбрать игру</Button>
            </Link>
            <QuickCreateRoom label="🔗 Создать комнату" variant="hero" />
          </div>
          <HomeStats />
        </div>

        <OpenRooms />
      </section>

      <section className="py-8">
        <h2 className="mb-5 text-2xl font-black text-ink">Каталог игр</h2>
        <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto px-1 pb-3 [scrollbar-width:thin]">
          {gamesByAvailability.map((game) => (
            <div key={game.id} className="w-[17rem] shrink-0 snap-start sm:w-[18rem]">
              <GameCard game={game} />
            </div>
          ))}
        </div>
      </section>

      <section className="mb-10 rounded-[1.5rem] border border-line bg-white/80 p-5 shadow-soft backdrop-blur">
        <h2 className="text-2xl font-black text-ink">Как это работает</h2>
        <div className="mt-7 grid gap-4 lg:grid-cols-4">
          {[
            ["+", "Выберите игру", "Выберите игру из каталога, которая вам нравится."],
            ["♟", "Создайте комнату", "Настройте параметры и создайте комнату для друзей."],
            ["🔗", "Пригласите друзей", "Отправьте ссылку или код комнаты своим друзьям."],
            ["🎮", "Играйте вместе", "Наслаждайтесь игрой и веселой атмосферой."]
          ].map(([icon, title, text], index) => (
            <div key={title} className="grid grid-cols-[auto_auto_minmax(0,1fr)] items-center gap-4 sm:gap-5">
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
