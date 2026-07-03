"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { RoomClient as MafiaRoomClient } from "./room-client";
import { CrocodileRoomClient } from "./crocodile-room-client";

type RoomInfo = {
  code: string;
  gameId: "mafia" | "crocodile";
  phase: string;
};

const LAST_LEFT_ROOM_KEY = "project-game:last-left-room";

export function RoomRouterClient({ code }: { code: string }) {
  const [roomInfo, setRoomInfo] = useState<RoomInfo | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let mounted = true;

    async function loadRoomInfo() {
      const response = await fetch(`/api/room-info?code=${encodeURIComponent(code)}`, { cache: "no-store" });
      if (!mounted) return;

      if (!response.ok) {
        clearRememberedRoom(code);
        setError("Комната не найдена");
        return;
      }

      setRoomInfo((await response.json()) as RoomInfo);
    }

    loadRoomInfo();
    return () => {
      mounted = false;
    };
  }, [code]);

  if (error) {
    return (
      <AppShell>
        <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-coral">Ошибка входа</p>
          <h1 className="mt-3 font-display text-5xl font-semibold text-ink">{error}</h1>
          <p className="mt-4 text-slate-500">Проверьте код комнаты или попросите хоста создать новую.</p>
        </section>
      </AppShell>
    );
  }

  if (!roomInfo) {
    return (
      <AppShell>
        <section className="mx-auto flex min-h-[70vh] w-full max-w-md flex-col justify-center py-12 text-slate-600">
          Ищем комнату...
        </section>
      </AppShell>
    );
  }

  if (roomInfo.gameId === "crocodile") return <CrocodileRoomClient code={code} />;
  return <MafiaRoomClient code={code} />;
}

function clearRememberedRoom(code: string) {
  const raw = window.localStorage.getItem(LAST_LEFT_ROOM_KEY);
  if (!raw) return;

  try {
    const remembered = JSON.parse(raw) as { code?: string };
    if (remembered.code === code) window.localStorage.removeItem(LAST_LEFT_ROOM_KEY);
  } catch {
    window.localStorage.removeItem(LAST_LEFT_ROOM_KEY);
  }
}
