"use client";

import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { createBunkerTestRoom, simulateBunkerNextStep, simulateBunkerRevealRound, simulateBunkerUntilGameOver, simulateBunkerVoting } from "@/games/bunker/simulation";
import { startBunkerGame } from "@/games/bunker/logic";
import { bunkerCategoryLabels, bunkerCharacteristicCategories } from "@/games/bunker/settings";
import type { BunkerRoomState } from "@/games/bunker/types";

export default function BunkerTestPage() {
  const [room, setRoom] = useState<BunkerRoomState>(() => createBunkerTestRoom(6));

  function update(action: (room: BunkerRoomState) => BunkerRoomState | void) {
    setRoom((current) => {
      const next = structuredClone(current) as BunkerRoomState;
      action(next);
      return next;
    });
  }

  return (
    <AppShell>
      <section className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-coral">Dev режим</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">Тест Бункера</h1>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button onClick={() => setRoom(createBunkerTestRoom(6))}>Создать тестовую комнату</Button>
          <Button variant="secondary" onClick={() => setRoom(createBunkerTestRoom(6))}>6 ботов</Button>
          <Button variant="secondary" onClick={() => setRoom(createBunkerTestRoom(8))}>8 ботов</Button>
          <Button variant="secondary" onClick={() => setRoom(createBunkerTestRoom(10))}>10 ботов</Button>
          <Button onClick={() => update((next) => { startBunkerGame(next); })}>Запустить игру</Button>
          <Button variant="secondary" onClick={() => update(simulateBunkerRevealRound)}>Раскрыть раунд</Button>
          <Button variant="secondary" onClick={() => update(simulateBunkerVoting)}>Симулировать голосование</Button>
          <Button variant="secondary" onClick={() => update(simulateBunkerNextStep)}>Следующий шаг</Button>
          <Button onClick={() => update(simulateBunkerUntilGameOver)}>Играть до финала</Button>
          <Button variant="ghost" onClick={() => setRoom(createBunkerTestRoom(6))}>Сбросить</Button>
        </div>

        <div className="mt-8 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-3xl font-semibold text-ink">Состояние</h2>
            <p className="mt-3 text-slate-600">Фаза: {room.phase} · Раунд: {room.currentRound} · Мест: {room.bunkerSlots || "-"}</p>
            <p className="mt-2 text-slate-600">Катастрофа: {room.catastrophe?.title ?? "-"}</p>
            <p className="mt-2 text-slate-600">Бункер: {room.shelter?.title ?? "-"}</p>
            <div className="mt-5 grid gap-3">
              {room.players.map((player) => {
                const character = room.characters[player.id];
                return (
                  <article key={player.id} className="rounded-2xl bg-cloud/70 p-4">
                    <h3 className="font-bold text-ink">{player.name} · {player.status}</h3>
                    {character ? (
                      <div className="mt-2 grid gap-1 text-sm text-slate-600">
                        {bunkerCharacteristicCategories.map((category) => (
                          <p key={category}><b>{bunkerCategoryLabels[category]}:</b> {character[category].title}</p>
                        ))}
                        <p><b>Спецкарты:</b> {character.specialCards.map((card) => card.title).join(", ") || "нет"}</p>
                      </div>
                    ) : <p className="mt-2 text-sm text-slate-500">Персонаж еще не создан</p>}
                  </article>
                );
              })}
            </div>
          </section>

          <section className="rounded-2xl border border-line bg-white p-5 shadow-soft">
            <h2 className="font-display text-3xl font-semibold text-ink">JSON</h2>
            <pre className="mt-4 max-h-[48rem] overflow-auto rounded-2xl bg-slate-950 p-4 text-xs text-white">{JSON.stringify(room, null, 2)}</pre>
          </section>
        </div>
      </section>
    </AppShell>
  );
}
