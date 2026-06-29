import { AppShell } from "@/components/layout/AppShell";

export default function MafiaRulesPage() {
  return (
    <AppShell>
      <article className="mx-auto max-w-3xl py-12">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Правила</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Мафия</h1>
        <div className="mt-8 space-y-6 rounded-2xl border border-line bg-white p-6 text-slate-600 shadow-soft">
          <p>
            Мирные жители пытаются вычислить мафию днем, а мафия ночью выбирает жертву.
            Комиссар проверяет игроков, доктор может спасти одного игрока от ночного убийства.
          </p>
          <p>
            Мирные побеждают, если среди живых игроков не осталось мафии. Мафия побеждает,
            если живых мафиози осталось столько же или больше, чем остальных игроков.
          </p>
          <p>
            В MVP игра идет в ручном режиме ведущего: хост переводит комнату между фазами,
            запускает голосование и может вернуть всех в лобби.
          </p>
        </div>
      </article>
    </AppShell>
  );
}
