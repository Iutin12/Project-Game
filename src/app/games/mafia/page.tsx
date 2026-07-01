"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";

export default function MafiaPage() {
  const router = useRouter();
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState("");

  async function createRoom(visibility: "private" | "public") {
    setIsCreating(true);
    setError("");

    try {
      const response = await fetch("/api/create-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ visibility })
      });
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
            Создайте закрытую комнату для друзей или открытую комнату, которая появится на главном экране.
            Внутри вас ждет игра с
            автоматической раздачей ролей, ночными действиями, голосованием и проверкой победы.
          </p>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
            <CreateRoomChoice
              title="Закрытая"
              text="Войти смогут только игроки, у которых есть код или ссылка."
              action={isCreating ? "Создаем..." : "Создать по коду"}
              disabled={isCreating}
              onClick={() => createRoom("private")}
            />
            <CreateRoomChoice
              title="Открытая"
              text="Комната появится на главном экране, и любой сможет зайти."
              action={isCreating ? "Создаем..." : "Создать открытую"}
              disabled={isCreating}
              onClick={() => createRoom("public")}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
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

function CreateRoomChoice({
  title,
  text,
  action,
  disabled,
  onClick
}: {
  title: string;
  text: string;
  action: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <article className="rounded-2xl border border-line bg-white/85 p-4 shadow-soft">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 min-h-12 text-sm leading-6 text-slate-500">{text}</p>
      <Button className="mt-4 w-full" disabled={disabled} onClick={onClick}>
        {action}
      </Button>
    </article>
  );
}
