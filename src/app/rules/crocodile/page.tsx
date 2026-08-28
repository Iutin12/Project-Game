import { AppShell } from "@/components/layout/AppShell";

const rules = [
  "Хост создает комнату, выбирает режим, таймер, сложность, темы слов и количество раундов.",
  "В каждом раунде один игрок становится объясняющим. Система показывает слово только ему.",
  "Объясняющий показывает слово жестами, мимикой и действиями. Нельзя называть слово, его части и однокоренные формы.",
  "Остальные игроки отправляют варианты в чат. Точное совпадение с загаданным словом засчитывается автоматически.",
  "В режиме «Одно слово» раунд заканчивается после правильного ответа. В режиме «Много слов» появляется следующее слово до окончания времени.",
  "Пропуск доступен только объясняющему и может быть безлимитным или ограниченным настройкой комнаты.",
  "С таймером раунд завершается автоматически. Без таймера его может закончить объясняющий или хост.",
  "После установленного числа раундов побеждает игрок или команда с наибольшим количеством очков. При режиме без лимита хост завершает раунды вручную."
];

export default function CrocodileRulesPage() {
  return (
    <AppShell>
      <article className="py-10">
        <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Правила</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-5xl">Крокодил</h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-slate-600">
          Крокодил — игра на объяснение слов без прямого называния. Один игрок показывает слово, остальные
          присылают догадки в чат. Подходит для игры в одной комнате или в видеозвонке.
        </p>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <RulesBlock title="Кратко">
            <p>Объясняющий видит слово, остальные угадывают его в чате. За точный ответ система начисляет очки автоматически.</p>
          </RulesBlock>
          <RulesBlock title="Раунд">
            <p>
              В режиме одного слова раунд заканчивается после первого правильного ответа. В режиме нескольких слов
              объясняющий получает новое слово после каждого угадывания до конца таймера или ручного завершения.
            </p>
          </RulesBlock>
          <RulesBlock title="Каждый сам за себя">
            <p>
              Игроки по очереди становятся объясняющими. За правильный ответ очки получает угадавший игрок и,
              при включенной настройке, объясняющий.
            </p>
          </RulesBlock>
          <RulesBlock title="Команды">
            <p>
              Команды ходят по очереди. Один игрок активной команды объясняет слово, угадывать могут только игроки
              этой команды. Командный режим доступен от четырех игроков.
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
