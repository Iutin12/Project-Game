"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { JoinByCode } from "@/components/layout/JoinByCode";
import { ThemeToggle } from "@/components/theme/ThemeToggle";

export function AppShell({ children, onLogoClick }: { children: React.ReactNode; onLogoClick?: () => void }) {
  const [showBackToTop, setShowBackToTop] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navigation = [
    { href: "/games", label: "Игры" },
    { href: "/rules", label: "Правила" },
    { href: "/how-to-play", label: "Как играть" },
    { href: "/support", label: "Поддержка" }
  ];

  useEffect(() => {
    const handleScroll = () => setShowBackToTop(window.scrollY > 480);

    handleScroll();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <main className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
      <header className="relative flex min-h-16 flex-wrap items-center justify-between gap-x-3 gap-y-2 py-2 sm:gap-4">
        <Link
          href="/"
          className="flex min-w-0 shrink-0 items-center gap-2 text-lg font-semibold tracking-tight text-ink sm:gap-3 sm:text-2xl"
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
            className="h-9 w-9 rounded-xl object-cover shadow-soft sm:h-11 sm:w-11 sm:rounded-2xl"
            priority
          />
          <span>Project <span className="text-ocean">Game</span></span>
        </Link>
        <nav className="hidden items-center gap-7 text-sm font-semibold text-slate-600 md:flex dark:text-white/65">
          {navigation.map((item) => (
            <Link key={item.href} className="rounded-full px-3 py-2 hover:bg-slate-100 hover:text-ink dark:hover:bg-white/10 dark:hover:text-white" href={item.href}>
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex min-w-0 items-center justify-end gap-2 sm:gap-3">
          <ThemeToggle />
          <JoinByCode />
          <button
            type="button"
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-line bg-white text-xl font-black text-ink shadow-sm transition hover:border-coral hover:text-coral md:hidden dark:border-white/10 dark:bg-slate-900 dark:text-white"
            aria-label={mobileMenuOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={mobileMenuOpen}
            aria-controls="mobile-navigation"
            onClick={() => setMobileMenuOpen((isOpen) => !isOpen)}
          >
            <span aria-hidden="true">{mobileMenuOpen ? "×" : "☰"}</span>
          </button>
        </div>
        {mobileMenuOpen ? (
          <nav
            id="mobile-navigation"
            className="absolute left-0 right-0 top-full z-50 grid gap-1 rounded-2xl border border-line bg-white/95 p-2 shadow-soft backdrop-blur md:hidden dark:border-white/10 dark:bg-slate-950/95"
          >
            {navigation.map((item) => (
              <Link
                key={item.href}
                className="rounded-xl px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-100 hover:text-ink dark:text-white/75 dark:hover:bg-white/10 dark:hover:text-white"
                href={item.href}
                onClick={() => setMobileMenuOpen(false)}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        ) : null}
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
