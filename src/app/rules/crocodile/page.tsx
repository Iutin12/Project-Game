import { AppShell } from "@/components/layout/AppShell";

const rules = [
  "Один игрок становится объясняющим и видит слово или словосочетание.",
  "Объясняющий не должен писать слово в чат и не должен использовать однокоренные слова.",
  "В классической версии слово объясняют жестами, мимикой или действиями.",
  "Остальные игроки пишут варианты ответа в чат.",
  "Если ответ совпал со словом, система засчитывает правильный ответ и начисляет очки.",
  "Раунд может закончиться после первого угаданного слова или продолжаться до конца таймера.",
  "Побеждает игрок или команда с наибольшим количеством очков."
];

export default function CrocodileRulesPage() {
  return (
    <AppShell>
      <article className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Правила</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">Крокодил</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
          Крокодил — игра на объяснение слов без прямого называния. Один игрок показывает или объясняет,
          остальные пытаются угадать как можно быстрее.
        </p>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <RulesBlock title="Кратко">
            <p>Объясняющий видит слово, остальные пишут догадки в чат. Кто угадал — получает очки.</p>
          </RulesBlock>
          <RulesBlock title="Раунд">
            <p>
              В режиме одного слова раунд заканчивается после первого правильного ответа. В режиме нескольких слов
              объясняющий получает новое слово после каждого угадывания, пока не истечет таймер.
            </p>
          </RulesBlock>
          <RulesBlock title="Каждый сам за себя">
            <p>
              Игроки по очереди становятся объясняющими. Очки получает угадавший игрок, а объясняющий получает
              очки, если слово было угадано.
            </p>
          </RulesBlock>
          <RulesBlock title="Команды">
            <p>
              Команды ходят по очереди. Один игрок активной команды объясняет слово, угадывать могут только игроки
              этой команды. За правильный ответ команда получает очки.
            </p>
          </RulesBlock>
        </section>

        <section className="mt-8 rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft">
          <h2 className="font-display text-3xl font-semibold text-ink">Основные правила</h2>
          <ul className="mt-5 grid gap-3 text-sm leading-6 text-slate-600">
            {rules.map((rule) => (
              <li key={rule} className="rounded-2xl bg-cloud/70 p-3">{rule}</li>
            ))}
          </ul>
        </section>
      </article>
    </AppShell>
  );
}

function RulesBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft">
      <h2 className="font-display text-2xl font-semibold text-ink">{title}</h2>
      <div className="mt-3 text-sm leading-6 text-slate-600">{children}</div>
    </section>
  );
}
