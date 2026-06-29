import Link from "next/link";

export function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex items-center justify-between gap-4 border-b border-white/10 pb-4">
        <Link href="/" className="font-display text-2xl tracking-wide text-white">
          Project Game
        </Link>
        <nav className="flex items-center gap-2 text-sm text-white/70">
          <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/games">
            Игры
          </Link>
          <Link className="rounded-full px-3 py-2 hover:bg-white/10 hover:text-white" href="/rules/mafia">
            Правила
          </Link>
        </nav>
      </header>
      {children}
    </main>
  );
}
