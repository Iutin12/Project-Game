import Link from "next/link";
import Image from "next/image";
import { JoinByCode } from "@/components/layout/JoinByCode";
import { QuickCreateRoom } from "@/components/layout/QuickCreateRoom";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 py-2">
        <Link href="/" className="flex items-center gap-3 text-2xl font-semibold tracking-tight text-ink">
          <Image
            src="/brand/project-game-logo.png"
            alt="Project Game"
            width={44}
            height={44}
            className="h-11 w-11 rounded-2xl object-cover shadow-soft"
            priority
          />
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
