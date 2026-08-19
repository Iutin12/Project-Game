import { Button } from "@/components/ui/Button";

type LeaveGameModalProps = {
  onConfirm: () => void;
  onCancel: () => void;
};

export function LeaveGameModal({ onConfirm, onCancel }: LeaveGameModalProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/70 px-4 backdrop-blur-sm" role="dialog" aria-modal="true">
      <section className="w-full max-w-md rounded-[1.5rem] border border-line bg-white p-5 text-ink shadow-2xl dark:border-white/10 dark:bg-slate-950 dark:text-white">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-coral">Выход из комнаты</p>
        <h2 className="mt-2 font-display text-3xl font-semibold">Точно выйти?</h2>
        <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/65">
          Игра продолжится без вас. Вернуться за того же игрока можно с главной страницы.
        </p>
        <div className="mt-5 grid gap-2 sm:grid-cols-2">
          <Button variant="secondary" onClick={onCancel}>Остаться</Button>
          <Button onClick={onConfirm}>Выйти</Button>
        </div>
      </section>
    </div>
  );
}
