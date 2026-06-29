import Link from "next/link";
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
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink" href="/rules/mafia">
            Правила
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink" href="/dev/mafia-test">
            Как играть
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink" href="/games/mafia">
            Поддержка
          </Link>
        </nav>
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link className="hidden rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-slate-50 sm:inline-flex" href="/room/DEMO">
            Войти по коду
          </Link>
          <Link href="/games/mafia">
            <button className="rounded-lg bg-ocean px-3 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 sm:px-4">
              + Создать<span className="hidden sm:inline"> комнату</span>
            </button>
          </Link>
        </div>
      </header>
      {children}
    </main>
  );
}
