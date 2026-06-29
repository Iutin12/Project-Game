import Link from "next/link";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 rounded-xl border border-line/80 bg-white/80 px-4 py-3 shadow-soft backdrop-blur">
        <Link href="/" className="font-display text-2xl font-semibold tracking-wide text-ink">
          Project Game
        </Link>
        <nav className="flex items-center gap-2 text-sm font-medium text-slate-600">
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink" href="/games">
            Игры
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink" href="/rules/mafia">
            Правила
          </Link>
          <ThemeToggle />
        </nav>
      </header>
      {children}
    </main>
  );
}
