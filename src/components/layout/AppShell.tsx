import Link from "next/link";
import { JoinByCode } from "@/components/layout/JoinByCode";
import { QuickCreateRoom } from "@/components/layout/QuickCreateRoom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 py-2">
        <Link href="/" className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-ink">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-ocean text-xl text-white shadow-soft">♟</span>
          <span>Project <span className="text-ocean">Game</span></span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex">
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink" href="/games">
            Игры
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink" href="/rules">
            Правила
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink" href="/how-to-play">
            Как играть
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink" href="/games/mafia">
            Поддержка
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <JoinByCode />
          <QuickCreateRoom />
        </div>
      </header>
      {children}
    </main>
  );
}
