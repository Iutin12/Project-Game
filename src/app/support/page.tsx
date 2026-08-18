import { AppShell } from "@/components/layout/AppShell";

const email = "iutinalex1@yandex.ru";

const topics = [
  {
    number: "01",
    title: "Сообщить об ошибке",
    description: "Опишите, что произошло, в какой игре и на каком устройстве. Скриншот поможет найти причину быстрее.",
    subject: "Ошибка в Project Game"
  },
  {
    number: "02",
    title: "Предложить игру или идею",
    description: "Расскажите, какую игру или улучшение вы хотите видеть на платформе. Все предложения читаем.",
    subject: "Идея для Project Game"
  },
  {
    number: "03",
    title: "Вопрос по комнате",
    description: "Если возникла проблема с игрой, ролями, настройками или приглашением друзей, напишите нам.",
    subject: "Вопрос по Project Game"
  }
];

export default function SupportPage() {
  return (
    <AppShell>
      <section className="py-10 sm:py-14">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-[0.22em] text-ocean">Поддержка</p>
          <h1 className="mt-3 font-display text-4xl font-semibold text-ink sm:text-6xl">Поможем сделать игру лучше</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-slate-600 dark:text-white/65 sm:text-lg">
            Сообщайте об ошибках, делитесь идеями и задавайте вопросы. Мы читаем каждое письмо и используем обратную связь для развития Project Game.
          </p>
        </div>

        <div className="mt-9 grid gap-4 md:grid-cols-3">
          {topics.map((topic) => (
            <article key={topic.number} className="flex min-h-64 flex-col rounded-[1.5rem] border border-line bg-white/90 p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/80">
              <span className="text-sm font-black tracking-[0.18em] text-ocean">{topic.number}</span>
              <h2 className="mt-6 font-display text-2xl font-semibold text-ink">{topic.title}</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/65">{topic.description}</p>
              <a
                className="mt-auto inline-flex min-h-11 items-center justify-center rounded-xl bg-ocean px-5 py-3 text-sm font-bold text-white shadow-soft transition hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0"
                href={`mailto:${email}?subject=${encodeURIComponent(topic.subject)}`}
              >
                Написать письмо
              </a>
            </article>
          ))}
        </div>

        <section className="mt-5 grid gap-5 rounded-[1.5rem] border border-line bg-slate-900 p-6 text-white shadow-soft md:grid-cols-[1.25fr_0.75fr] md:p-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-coral">Связь</p>
            <h2 className="mt-3 font-display text-3xl font-semibold">Один адрес для всех вопросов</h2>
            <p className="mt-3 max-w-xl text-sm leading-6 text-white/70 sm:text-base">
              Для поддержки, предложений и сообщений об ошибках используйте почту. Укажите название игры и номер комнаты, если вопрос связан с конкретной партией.
            </p>
          </div>
          <div className="flex flex-col justify-center rounded-2xl border border-white/10 bg-white/5 p-5">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/50">Email поддержки</p>
            <a className="mt-2 break-all text-lg font-bold text-white hover:text-coral sm:text-xl" href={`mailto:${email}`}>
              {email}
            </a>
          </div>
        </section>

        <section className="mt-5 rounded-[1.5rem] border border-line bg-white/90 p-6 shadow-soft dark:border-white/10 dark:bg-slate-900/80 sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-ocean">Поддержать проект</p>
          <h2 className="mt-3 font-display text-3xl font-semibold text-ink">Хотите помочь развитию Project Game?</h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-white/65 sm:text-base">
            Не публикуем банковские реквизиты на сайте, чтобы защитить вас и проект от мошенничества. Напишите нам на почту - обсудим удобный и безопасный способ поддержки через платежный сервис.
          </p>
          <a
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-ink shadow-sm transition hover:-translate-y-0.5 hover:border-ocean/35 hover:bg-slate-50 dark:border-white/10 dark:bg-slate-900 dark:text-white dark:hover:bg-white/10"
            href={`mailto:${email}?subject=${encodeURIComponent("Поддержка Project Game")}`}
          >
            Связаться по поводу поддержки
          </a>
        </section>
      </section>
    </AppShell>
  );
}
