"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";

type GameCreatePageProps = {
  gameId: "mafia" | "crocodile" | "bunker" | "spy";
  title: string;
  description: string;
  privateDescription: string;
  publicDescription: string;
  stats: Array<[value: string, label: string]>;
};

export function GameCreatePage({
  gameId,
  title,
  description,
  privateDescription,
  publicDescription,
  stats
}: GameCreatePageProps) {
  const router = useRouter();
  const [creatingVisibility, setCreatingVisibility] = useState<"private" | "public" | null>(null);
  const [error, setError] = useState("");

  async function createRoom(visibility: "private" | "public") {
    setCreatingVisibility(visibility);
    setError("");

    try {
      const response = await fetch("/api/create-room", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId, visibility })
      });
      if (!response.ok) throw new Error("Не удалось создать комнату");
      const data = (await response.json()) as { code: string; hostKey: string };
      window.localStorage.setItem(`hostKey:${data.code}`, data.hostKey);
      router.push(`/room/${data.code}`);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Не удалось создать комнату");
    } finally {
      setCreatingVisibility(null);
    }
  }

  return (
    <AppShell>
      <section className="grid flex-1 items-center gap-8 py-8 sm:py-12 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-mint">доступно сейчас</p>
          <h1 className="mt-3 break-words font-display text-5xl font-semibold text-ink sm:text-6xl">{title}</h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">{description}</p>
          <div className="mt-8 grid max-w-2xl gap-3 sm:grid-cols-2">
            <CreateRoomChoice
              title="Закрытая"
              text={privateDescription}
              action={creatingVisibility === "private" ? "Создаем..." : "Создать по коду"}
              disabled={creatingVisibility !== null}
              onClick={() => createRoom("private")}
            />
            <CreateRoomChoice
              title="Открытая"
              text={publicDescription}
              action={creatingVisibility === "public" ? "Создаем..." : "Создать открытую"}
              disabled={creatingVisibility !== null}
              onClick={() => createRoom("public")}
            />
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-ocean/35 hover:bg-slate-50 dark:bg-slate-900 dark:text-white"
              href={`/rules/${gameId}`}
            >
              Правила игры
            </Link>
          </div>
          {error ? <p className="mt-4 text-sm font-semibold text-coral">{error}</p> : null}
        </div>

        <div className="grid min-w-0 gap-3 sm:grid-cols-2">
          {stats.map(([value, label]) => (
            <article key={label} className="min-w-0 rounded-[1.25rem] border border-line bg-white/90 p-5 shadow-soft">
              <p className="break-words font-display text-3xl font-semibold text-ink sm:text-4xl">{value}</p>
              <p className="mt-2 break-words text-xs font-semibold uppercase tracking-[0.14em] text-slate-400 sm:text-sm sm:tracking-[0.16em]">{label}</p>
            </article>
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
    <article className="flex h-full flex-col rounded-[1.5rem] border border-line bg-white/85 p-5 shadow-soft">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <p className="mt-2 flex-1 text-sm leading-6 text-slate-500">{text}</p>
      <Button className="mt-5 w-full" disabled={disabled} onClick={onClick}>
        {action}
      </Button>
    </article>
  );
}
