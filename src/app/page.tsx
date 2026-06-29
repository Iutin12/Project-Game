import Link from "next/link";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { GameCard } from "@/components/game-card/GameCard";
import { games } from "@/games/config";

export default function HomePage() {
  const previewPlayers = [
    ["Аня", "Готова", "bg-rose-100"],
    ["Игорь", "Готов", "bg-blue-100"],
    ["Макс", "Ожидает", "bg-amber-100"],
    ["Лена", "Готова", "bg-emerald-100"],
    ["Даша", "Готова", "bg-teal-100"],
    ["Саша", "Готова", "bg-sky-100"]
  ];

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
          <div className="mt-10 flex flex-wrap items-center gap-5 text-sm font-semibold text-slate-600">
            <span className="flex items-center gap-2"><span className="text-ocean">♟</span> 2 847 комнат создано сегодня</span>
            <span className="h-4 w-px bg-line" />
            <span className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-500" /> 1 563 игрока онлайн</span>
          </div>
        </div>

        <div className="rounded-2xl border border-line bg-white p-5 shadow-soft">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-slate-500">Пример комнаты</p>
              <h2 className="mt-6 flex items-center gap-3 text-xl font-bold text-ink">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-ocean text-white">♟</span>
                Комната: MAFIA-4827
              </h2>
              <p className="mt-3 text-sm font-medium text-slate-500">Игра: Мафия <span className="ml-7">6 / 15 игроков</span></p>
            </div>
            <span className="rounded-full bg-emerald-50 px-3 py-2 text-sm font-bold text-mint">В игре</span>
          </div>
          <div className="grid gap-5 md:grid-cols-[1fr_17rem]">
            <div className="space-y-1">
              {previewPlayers.map(([name, status, color], index) => (
              <div key={name} className="flex items-center justify-between rounded-lg px-1 py-2 text-sm">
                <span className="flex items-center gap-3 font-medium text-ink">
                  <span className={`h-7 w-7 rounded-full ${color}`} />
                  {name} {index === 0 ? <span className="text-xs text-amber-500">♛ Хост</span> : null}
                </span>
                <span className={status === "Ожидает" ? "text-amber-500" : "text-mint"}>{status}</span>
              </div>
              ))}
            </div>
            <div className="flex flex-col items-center justify-center rounded-2xl bg-slate-50 p-5 text-center">
              <div className="text-5xl text-violet-500">♟♟</div>
              <p className="mt-5 font-bold text-ink">Ждем игроков...</p>
              <p className="mt-4 text-sm leading-6 text-slate-500">Поделитесь ссылкой, чтобы пригласить друзей</p>
              <Button variant="secondary" className="mt-8 w-full">🔗 Поделиться ссылкой</Button>
            </div>
          </div>
        </div>
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
