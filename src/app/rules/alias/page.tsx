import { AppShell } from "@/components/layout/AppShell";

const phases = [
  ["1. Подготовка", "Игра выбирает следующую команду и объясняющего. Таймер еще не идет: объясняющий начинает ход, когда готов."],
  ["2. Объяснение", "На экране объясняющего появляется секретное слово. Команда называет варианты вслух, а объясняющий отмечает «Угадали» или пропускает слово."],
  ["3. Последнее слово", "Если режим включен, слово на момент окончания таймера могут угадывать все команды. Объясняющий указывает, кто дал правильный ответ."],
  ["4. Проверка", "После хода можно проверить список слов и исправить случайное нажатие. Затем очки фиксируются, и ход переходит следующей команде."],
  ["5. Финал", "Игра заканчивается после целевого счета или заданного числа раундов. При равенстве лидеров команды играют дополнительные круги до победителя."]
];

export default function AliasRulesPage() {
  return (
    <AppShell>
      <article className="py-10">
        <p className="text-sm font-black uppercase tracking-[0.22em] text-coral">Правила</p>
        <h1 className="mt-3 font-display text-4xl font-semibold text-ink dark:text-white sm:text-6xl">Элиас</h1>
        <p className="mt-5 max-w-3xl text-lg leading-8 text-slate-600 dark:text-white/65">Объясните своей команде как можно больше слов до окончания таймера. Побеждает команда, которая первой достигнет цели или наберет больше очков после всех раундов.</p>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <RulesCard title="Коротко"><p>Разделитесь на 2–4 команды. В каждом ходу один игрок объясняет, остальные участники его команды угадывают. За правильное слово команда получает одно очко.</p></RulesCard>
          <RulesCard title="Главное ограничение"><p>Нельзя произносить само слово, его часть, однокоренные слова или перевод. Разрешены описания, ассоциации, противоположности, ситуации и примеры.</p></RulesCard>
        </section>

        <section className="mt-8 rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/75 sm:p-7">
          <h2 className="font-display text-3xl font-semibold text-ink dark:text-white">Ход игры</h2>
          <div className="mt-5 grid gap-3 md:grid-cols-2">{phases.map(([title, text]) => <div key={title} className="rounded-[1.25rem] bg-cloud/70 p-4 dark:bg-slate-950/55"><h3 className="font-bold text-ink dark:text-white">{title}</h3><p className="mt-2 text-sm leading-6 text-slate-600 dark:text-white/60">{text}</p></div>)}</div>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-3">
          <RulesCard title="Объясняющий"><p>Видит секретное слово только на своем устройстве, объясняет его вслух и отмечает результат. В следующих ходах роль объясняющего переходит по очереди.</p></RulesCard>
          <RulesCard title="Команда"><p>Называет варианты вслух. Игроки других команд не подсказывают, но при включенном «последнем слове» могут перехватить финальный ответ.</p></RulesCard>
          <RulesCard title="Хост"><p>Настраивает команды, таймер, категории, штрафы и условие победы. При необходимости может заменить отключившегося объясняющего или завершить зависший ход.</p></RulesCard>
        </section>

        <section className="mt-8 grid gap-4 lg:grid-cols-2">
          <RulesCard title="Пропуски"><p>Хост может отключить пропуски, ограничить их число или оставить без лимита. За пропуск назначается 0 или −1 очко, при этом общий счет команды не опускается ниже нуля.</p></RulesCard>
          <RulesCard title="Равные ходы"><p>Если включено равное число ходов, достижение целевого счета не завершает игру посреди круга: остальные команды получают свой ход.</p></RulesCard>
          <RulesCard title="Категории"><p>В базе есть обычные темы и отдельная категория 18+, которая выключена по умолчанию. Повторы внутри партии исключаются, пока выбранный набор не закончится.</p></RulesCard>
          <RulesCard title="Проверка результатов"><p>До подтверждения объясняющий или хост может поменять статус слова с угаданного на пропущенное и обратно. После фиксации счет изменить нельзя.</p></RulesCard>
        </section>
      </article>
    </AppShell>
  );
}

function RulesCard({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-[1.5rem] border border-line bg-white/90 p-5 shadow-soft dark:border-white/10 dark:bg-slate-900/75"><h2 className="font-display text-2xl font-semibold text-ink dark:text-white">{title}</h2><div className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/60">{children}</div></section>;
}
