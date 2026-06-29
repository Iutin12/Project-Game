"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";

export default function MafiaPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function createRoom() {
    setIsCreating(true);
    setError("");

    try {
      const response = await fetch("/api/create-room", { method: "POST" });
      if (!response.ok) throw new Error("Не удалось создать комнату");
      const data = (await response.json()) as { code: string; hostKey: string };
      window.localStorage.setItem(`hostKey:${data.code}`, data.hostKey);
      router.push(`/room/${data.code}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось создать комнату");
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <AppShell>
      <section className="grid flex-1 items-center gap-8 py-12 lg:grid-cols-[0.9fr_1.1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-mint">доступно сейчас</p>
          <h1 className="mt-3 font-display text-6xl font-semibold text-ink">Мафия</h1>
          <p className="mt-6 max-w-xl text-lg leading-8 text-slate-600">
            Создайте приватную комнату, пригласите друзей по ссылке и проведите игру с
            автоматической раздачей ролей, ночными действиями, голосованием и проверкой победы.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button onClick={createRoom} disabled={isCreating}>
              {isCreating ? "Создаем..." : "Создать комнату"}
            </Button>
            <a href="/rules/mafia">
              <Button variant="secondary">Правила</Button>
            </a>
          </div>
          {error ? <p className="mt-4 text-sm text-coral">{error}</p> : null}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {[
            ["5-15", "игроков"],
            ["4", "роли"],
            ["real-time", "лобби"],
            ["manual", "режим ведущего"]
          ].map(([value, label]) => (
            <div key={label} className="rounded-xl border border-line bg-white p-5 shadow-soft">
              <p className="font-display text-4xl font-semibold text-ink">{value}</p>
              <p className="mt-2 text-sm font-semibold uppercase tracking-[0.16em] text-slate-400">{label}</p>
            </div>
          ))}
        </div>
      </section>
    </AppShell>
  );
}
