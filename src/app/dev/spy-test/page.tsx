"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";

export default function SpyTestPage() {
  const router = useRouter();
  const [playersCount, setPlayersCount] = useState(6);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState("");

  async function createTestRoom() {
    setCreating(true); setError("");
    try {
      const response = await fetch("/api/dev/create-spy-test-room", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ playersCount }) });
      if (!response.ok) {
        const payload = await response.json().catch(() => null) as { error?: string } | null;
        throw new Error(payload?.error ?? "Не удалось создать тестовую комнату");
      }
      const data = await response.json() as { code: string; hostKey: string; playerId: string };
      window.localStorage.setItem(`hostKey:${data.code}`, data.hostKey);
      window.localStorage.setItem(`playerId:${data.code}`, data.playerId);
      router.push(`/room/${data.code}`);
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Не удалось создать комнату"); setCreating(false); }
  }

  return <AppShell><section className="mx-auto flex min-h-[70vh] w-full max-w-2xl flex-col justify-center py-12"><p className="text-sm font-black uppercase tracking-[0.22em] text-coral">Dev / test</p><h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-6xl">Тест игры «Шпион»</h1><p className="mt-4 text-slate-600 dark:text-white/60">Создайте закрытую комнату с ботами. Внутри появятся инструменты для просмотра секретов, переключения фаз и симуляции партии.</p><label className="mt-8 text-sm font-bold">Игроков с ботами<input type="number" min={3} max={12} value={playersCount} onChange={(event) => setPlayersCount(Number(event.target.value))} className="mt-2 block w-full rounded-xl border border-line bg-white px-4 py-3 dark:border-white/10 dark:bg-slate-900" /></label><Button className="mt-4" disabled={creating} onClick={createTestRoom}>{creating ? "Создаем..." : "Создать тестовую комнату"}</Button>{error ? <p className="mt-4 text-sm font-bold text-coral">{error}</p> : null}</section></AppShell>;
}
