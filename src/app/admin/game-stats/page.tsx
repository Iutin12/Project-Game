"use client";

import { FormEvent, useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";

type Stats = {
  completedGames: number;
  completedPlayerParticipations: number;
  byGame: Record<string, { completedGames: number; completedPlayerParticipations: number }>;
  updatedAt: number;
};

const gameNames: Record<string, string> = {
  mafia: "Мафия",
  crocodile: "Крокодил",
  bunker: "Бункер",
  spy: "Шпион",
  alias: "Элиас"
};

export default function GameStatsPage() {
  const [token, setToken] = useState("");
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedToken = window.sessionStorage.getItem("lumia-admin-stats-token");
    if (savedToken) setToken(savedToken);
  }, []);

  async function loadStats(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/admin/completed-games", { headers: { "x-admin-token": token } });
      if (!response.ok) throw new Error("Неверный токен или статистика ещё не настроена.");
      const nextStats = await response.json() as Stats;
      window.sessionStorage.setItem("lumia-admin-stats-token", token);
      setStats(nextStats);
    } catch (reason) {
      setStats(null);
      setError(reason instanceof Error ? reason.message : "Не удалось загрузить статистику.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto w-full max-w-4xl py-10 sm:py-14">
        <p className="text-xs font-bold uppercase tracking-[0.22em] text-coral">Только для владельца</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">Завершённые игры</h1>
        <p className="mt-4 max-w-2xl leading-7 text-slate-600 dark:text-white/65">Учитываются только доигранные партии и реальные участники. Боты и тестовые комнаты не попадают в статистику.</p>

        <form className="mt-8 flex flex-col gap-3 rounded-2xl border border-line bg-white/80 p-5 shadow-soft sm:flex-row dark:bg-slate-900/75" onSubmit={loadStats}>
          <input
            value={token}
            onChange={(event) => setToken(event.target.value)}
            type="password"
            autoComplete="current-password"
            placeholder="Введите ADMIN_STATS_TOKEN"
            className="min-w-0 flex-1 rounded-xl border border-line bg-white px-4 py-3 text-sm font-semibold text-ink outline-none transition focus:border-coral dark:border-white/10 dark:bg-slate-950 dark:text-white"
          />
          <Button type="submit" disabled={!token || loading}>{loading ? "Загрузка..." : "Показать статистику"}</Button>
        </form>
        {error ? <p className="mt-3 text-sm font-semibold text-coral">{error}</p> : null}

        {stats ? (
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <StatCard label="Завершённых партий" value={stats.completedGames} />
            <StatCard label="Участий игроков" value={stats.completedPlayerParticipations} />
            {Object.entries(stats.byGame).map(([gameId, game]) => (
              <article key={gameId} className="rounded-2xl border border-line bg-white/80 p-5 shadow-soft dark:bg-slate-900/75">
                <h2 className="font-display text-2xl font-semibold text-ink">{gameNames[gameId] ?? gameId}</h2>
                <p className="mt-3 text-3xl font-black text-ocean">{game.completedGames}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-white/65">завершённых партий</p>
                <p className="mt-4 text-sm font-semibold text-ink">{game.completedPlayerParticipations} участий игроков</p>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </AppShell>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <article className="rounded-2xl border border-line bg-white/80 p-5 shadow-soft dark:bg-slate-900/75">
      <p className="text-sm font-semibold text-slate-600 dark:text-white/65">{label}</p>
      <p className="mt-2 font-display text-5xl font-semibold text-ink">{value}</p>
    </article>
  );
}
