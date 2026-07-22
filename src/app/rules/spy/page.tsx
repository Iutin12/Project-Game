import { AppShell } from "@/components/layout/AppShell";

const phases = [
  ["1. Секретная роль", "Обычные игроки видят общую локацию и, если включено, свою роль внутри нее. Шпион видит только сообщение о том, что он шпион."],
  ["2. Подтверждение", "Каждый закрывает карточку и подтверждает готовность. Обсуждение начинается только после подтверждения всех активных игроков."],
  ["3. Обсуждение", "Игроки задают вопросы и отвечают. Вопрос должен помочь найти шпиона, но не раскрыть локацию слишком явно."],
  ["4. Попытка шпиона", "Шпион может в любой момент обсуждения попытаться угадать локацию. Верная догадка сразу приносит победу шпионам, ошибка — обычным игрокам."],
  ["5. Голосование", "Каждый тайно выбирает подозреваемого и подтверждает голос. За себя голосовать нельзя. При ничьей действует выбранное в настройках правило."],
  ["6. Итоги", "Открываются локация, шпионы, роли, голоса и очки. После этого ведущий запускает следующий раунд."]
];

export default function SpyRulesPage() {
  return (
    <AppShell>
      <article className="py-10">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-coral">Правила</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-6xl">Шпион</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-white/65">Найдите игрока, который не знает локацию, прежде чем он догадается, где находится вся компания.</p>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <RulesCard title="Коротко">
            <p>Все обычные игроки получают одну локацию, а один или несколько шпионов ее не знают. Задавайте друг другу вопросы, ищите слишком расплывчатые ответы и голосуйте за подозреваемого.</p>
          </RulesCard>
          <RulesCard title="Главное ограничение">
            <p>Нельзя прямо называть локацию или задавать вопрос, ответ на который мгновенно ее раскрывает. Обычным игрокам важно одновременно проверить собеседника и сохранить место в секрете.</p>
          </RulesCard>
        </section>

        <section className="mt-8 rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/75 sm:p-7">
          <h2 className="font-display text-3xl font-semibold text-ink dark:text-white">Ход раунда</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{phases.map(([title, text]) => <div key={title} className="rounded-[1.25rem] bg-cloud/70 p-4 dark:bg-slate-950/55"><h3 className="font-bold text-ink dark:text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-white/60">{text}</p></div>)}</div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <RulesCard title="Обычный игрок"><p>Знает локацию и может получить тематическую роль. Побеждает, если группа найдет всех шпионов или шпион ошибется при попытке угадать место.</p></RulesCard>
          <RulesCard title="Шпион"><p>Не знает локацию и роль. Слушает вопросы, отвечает правдоподобно и пытается определить место. При нескольких шпионах они побеждают одной командой.</p></RulesCard>
          <RulesCard title="Ведущий"><p>Настраивает комнату, запускает игру и следующие раунды. В специальном режиме ничьей может выбрать одного из кандидатов.</p></RulesCard>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <RulesCard title="Несколько шпионов"><p>Обычным игрокам нужно найти всех шпионов. Найденный шпион больше не участвует в последующих голосованиях, но при включенной настройке получает последнюю попытку угадать локацию.</p></RulesCard>
          <RulesCard title="Очки"><ul className="space-y-2"><li>Обычный игрок: +2 за победу команды, еще +1 за голос против шпиона.</li><li>Шпион: +4 за верную локацию, +2 если группа выгнала обычного игрока, +1 если время вышло.</li></ul></RulesCard>
          <RulesCard title="Свободные вопросы"><p>Любой участник может спросить любого. Этот режим подходит знакомой компании и живому разговору.</p></RulesCard>
          <RulesCard title="Вопросы по очереди"><p>Интерфейс назначает спрашивающего и отвечающего. После ответа один из них нажимает «Ответ получен», и ход переходит дальше.</p></RulesCard>
        </section>

        <section className="mt-8 rounded-[1.5rem] border border-coral/25 bg-coral/8 p-5 sm:p-7">
          <h2 className="font-display text-3xl font-semibold text-ink dark:text-white">Пример хорошего вопроса</h2>
          <p className="mt-3 text-slate-600 dark:text-white/65">Вместо «Здесь есть самолеты?» спросите «Как долго вы обычно здесь задерживаетесь?». Обычный игрок сможет ответить осмысленно, а шпиону придется импровизировать.</p>
        </section>
      </article>
    </AppShell>
  );
}

function RulesCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/75"><h2 className="font-display text-2xl font-semibold text-ink dark:text-white">{title}</h2><div className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/60">{children}</div></section>;
}
