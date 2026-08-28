"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";

export default function CrocodileTestPage() {
  const router = useRouter();
  const [playersCount, setPlayersCount] = useState(6);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function createTestRoom() {
    setCreating(true);
    setError("");
    try {
      const response = await fetch("/api/dev/create-crocodile-test-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ playersCount })
      });
      const payload = await response.json().catch(() => null) as { code?: string; hostKey?: string; playerId?: string; error?: string } | null;
      if (!response.ok || !payload?.code || !payload.hostKey || !payload.playerId) {
        throw new Error(payload?.error ?? "Не удалось создать тестовую комнату");
      }
      window.localStorage.setItem(`hostKey:${payload.code}`, payload.hostKey);
      window.localStorage.setItem(`playerId:${payload.code}`, payload.playerId);
      router.push(`/room/${payload.code}`);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Не удалось создать тестовую комнату");
      setCreating(false);
    }
  }

  return (
    <AppShell>
      <section className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center py-12">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-coral">Dev / test</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-6xl">Тест игры «Крокодил»</h1>
        <p className="mt-4 text-slate-600 dark:text-white/60">
          Создайте закрытую комнату с ботами, настройте правила и проверьте объяснение слов, пропуски, команды, таймер и подсчет очков.
        </p>
        <label className="mt-8 text-sm font-bold">
          Игроков с ботами
          <input
            type="number"
            min={3}
            max={20}
            value={playersCount}
            onChange={(event) => setPlayersCount(Math.min(20, Math.max(3, Number(event.target.value) || 3)))}
            className="mt-2 block w-full rounded-xl border border-line bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900"
          />
        </label>
        <Button className="mt-4" disabled={creating} onClick={createTestRoom}>
          {creating ? "Создаем..." : "Создать тестовую комнату"}
        </Button>
        {error ? <p className="mt-4 text-sm font-bold text-coral">{error}</p> : null}
      </section>
    </AppShell>
  );
}
