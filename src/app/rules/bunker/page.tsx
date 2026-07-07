import { AppShell } from "@/components/layout/AppShell";

const roles = [
  ["Персонаж", "У каждого игрока есть профессия, возраст, здоровье, биология, хобби, фобия, багаж, навык, характер, факт и спецкарта."],
  ["Раскрытие", "В каждом раунде игроки открывают одну характеристику. Остальные карты скрыты и видны только владельцу."],
  ["Обсуждение", "Игроки объясняют, почему их персонаж полезен для выживания именно при этой катастрофе и в этом бункере."],
  ["Голосование", "Живые игроки голосуют против того, кого хотят исключить. Голос можно менять до подсчета."],
  ["Финал", "Игра заканчивается, когда живых игроков осталось столько же, сколько мест в бункере."],
  ["Спецкарты", "Карты позволяют защищаться от голосования, раскрывать дополнительные сведения или вмешиваться в ход игры."]
];

export default function BunkerRulesPage() {
  return (
    <AppShell>
      <article className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Правила</p>
        <h1 className="mt-3 font-display text-5xl font-semibold text-ink">Бункер</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
          Кратко: случилась катастрофа, мест в бункере меньше, чем людей. Раскрывайте карты персонажа, убеждайте группу и голосуйте, кто останется среди выживших.
        </p>
        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          {roles.map(([title, text]) => (
            <section key={title} className="rounded-2xl border border-line bg-white/90 p-5 shadow-soft">
              <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">{text}</p>
            </section>
          ))}
        </section>
        <section className="mt-8 rounded-2xl border border-line bg-white/90 p-5 shadow-soft">
          <h2 className="font-display text-3xl font-semibold text-ink">Ход игры</h2>
          <ol className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
            <li className="rounded-2xl bg-cloud/70 p-3">1. Хост создает комнату, приглашает игроков и настраивает режим.</li>
            <li className="rounded-2xl bg-cloud/70 p-3">2. Система выбирает катастрофу, бункер и генерирует персонажей.</li>
            <li className="rounded-2xl bg-cloud/70 p-3">3. Игроки раскрывают характеристики по раундам и обсуждают состав группы.</li>
            <li className="rounded-2xl bg-cloud/70 p-3">4. После обсуждения проходит голосование на исключение.</li>
            <li className="rounded-2xl bg-cloud/70 p-3">5. Когда живых осталось не больше мест в бункере, эти игроки становятся выжившими.</li>
          </ol>
        </section>
      </article>
    </AppShell>
  );
}
