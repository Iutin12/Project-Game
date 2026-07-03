"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { JoinByCode } from "@/components/layout/JoinByCode";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AppShell({ children, onLogoClick }: { children: React.ReactNode; onLogoClick?: () => void }) {
  const [showBackToTop, setShowBackToTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 480);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
      <header className="flex flex-wrap items-center justify-between gap-3 py-2 sm:gap-4">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 text-xl font-semibold tracking-tight text-ink sm:gap-3 sm:text-2xl"
          onClick={(event) => {
            if (!onLogoClick) return;
            event.preventDefault();
            onLogoClick();
          }}
        >
          <Image
            src="/brand/project-game-logo.png"
            alt="Project Game"
            width={44}
            height={44}
            className="h-10 w-10 rounded-2xl object-cover shadow-soft sm:h-11 sm:w-11"
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
        <div className="flex w-full min-w-0 items-center justify-end gap-2 sm:w-auto sm:gap-3">
          <ThemeToggle />
          <JoinByCode />
        </div>
      </header>
      {children}
      <button
        type="button"
        className={[
          "fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-ocean text-xl font-black text-white shadow-soft transition duration-300 md:hidden",
          showBackToTop ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"
        ].join(" ")}
        aria-label="Подняться наверх"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      >
        ↑
      </button>
    </main>
  );
}
