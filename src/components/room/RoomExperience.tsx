"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";

type GameId = "mafia" | "crocodile" | "bunker" | "spy" | "alias";

type Preferences = {
  soundEnabled: boolean;
  motionEnabled: boolean;
};

const STORAGE_KEY = "lumia-room-experience";
const defaultPreferences: Preferences = { soundEnabled: false, motionEnabled: true };

export function useRoomExperience(gameId: GameId, phase?: string) {
  const previousPhase = useRef<string | undefined>();
  const [motionEnabled, setMotionEnabled] = useState(true);

  useEffect(() => {
    const preferences = readPreferences();
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    setMotionEnabled(preferences.motionEnabled && !reducedMotion);
  }, []);

  useEffect(() => {
    if (!phase) return;
    const previous = previousPhase.current;
    previousPhase.current = phase;
    if (!previous || previous === phase) return;

    void trackProductEvent("phase_changed", gameId, phase);
    if (readPreferences().soundEnabled) playPhaseSound();
  }, [gameId, phase]);

  return { phaseClassName: motionEnabled ? "room-phase-transition" : "" };
}

export function RoomExperienceTools({ gameId, phase }: { gameId: GameId; phase: string }) {
  const [preferences, setPreferences] = useState<Preferences>(defaultPreferences);
  const [expanded, setExpanded] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [report, setReport] = useState("");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "sent" | "error">("idle");

  useEffect(() => setPreferences(readPreferences()), []);

  function updatePreferences(patch: Partial<Preferences>) {
    const next = { ...preferences, ...patch };
    setPreferences(next);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  async function sendReport() {
    const message = report.trim();
    if (message.length < 8) return;
    setReportStatus("sending");
    try {
      const response = await fetch("/api/report", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ gameId, phase, message })
      });
      if (!response.ok) throw new Error("request_failed");
      setReportStatus("sent");
      setReport("");
      void trackProductEvent("report_sent", gameId, phase);
    } catch {
      setReportStatus("error");
    }
  }

  return (
    <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line/70 pt-3 text-sm dark:border-white/10">
      <button
        type="button"
        className="min-h-11 rounded-xl px-3 font-bold text-slate-500 transition hover:bg-slate-100 hover:text-ink dark:text-white/55 dark:hover:bg-white/10 dark:hover:text-white"
        onClick={() => setExpanded((value) => !value)}
        aria-expanded={expanded}
      >
        {expanded ? "Скрыть настройки" : "Настройки опыта"}
      </button>
      <button
        type="button"
        className="min-h-11 rounded-xl px-3 font-bold text-slate-500 transition hover:bg-coral/10 hover:text-coral dark:text-white/55"
        onClick={() => { setReportOpen(true); void trackProductEvent("report_opened", gameId, phase); }}
      >
        Сообщить об ошибке
      </button>
      {expanded ? (
        <div className="grid w-full gap-2 rounded-xl border border-line bg-cloud/60 p-3 sm:grid-cols-2 dark:border-white/10 dark:bg-white/5">
          <PreferenceSwitch label="Звук смены фаз" checked={preferences.soundEnabled} onChange={(value) => updatePreferences({ soundEnabled: value })} />
          <PreferenceSwitch label="Мягкая анимация фаз" checked={preferences.motionEnabled} onChange={(value) => updatePreferences({ motionEnabled: value })} />
          <p className="sm:col-span-2 text-xs leading-5 text-slate-500 dark:text-white/50">Звук выключен по умолчанию. Настройки сохраняются только на этом устройстве.</p>
        </div>
      ) : null}
      {reportOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-slate-950/65 p-3 backdrop-blur-sm sm:items-center sm:p-5" role="dialog" aria-modal="true" onClick={() => setReportOpen(false)}>
          <section className="w-full max-w-lg rounded-2xl border border-line bg-white p-5 text-ink shadow-2xl dark:border-white/10 dark:bg-slate-950 dark:text-white" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4"><div><p className="text-xs font-black uppercase tracking-[0.18em] text-coral">Обратная связь</p><h2 className="mt-1 font-display text-3xl font-semibold">Сообщить о проблеме</h2></div><button type="button" className="h-10 w-10 rounded-full bg-slate-100 text-xl dark:bg-white/10" onClick={() => setReportOpen(false)} aria-label="Закрыть">×</button></div>
            <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-white/60">Опишите, что произошло. Мы отправим только текст, игру и текущую фазу, без имени и личных данных.</p>
            <textarea className="mt-4 min-h-32 w-full resize-y rounded-xl border border-line bg-white p-3 text-sm outline-none focus:border-coral focus:ring-2 focus:ring-coral/15 dark:border-white/10 dark:bg-slate-900" value={report} maxLength={700} placeholder="Например: после голосования кнопка не появилась..." onChange={(event) => { setReport(event.target.value); setReportStatus("idle"); }} />
            {reportStatus === "sent" ? <p className="mt-2 text-sm font-bold text-mint">Спасибо, репорт отправлен.</p> : null}
            {reportStatus === "error" ? <p className="mt-2 text-sm font-bold text-coral">Не удалось отправить репорт. Попробуйте чуть позже.</p> : null}
            <div className="mt-4 flex flex-wrap justify-end gap-2"><Button variant="secondary" onClick={() => setReportOpen(false)}>Отмена</Button><Button disabled={report.trim().length < 8 || reportStatus === "sending"} onClick={sendReport}>{reportStatus === "sending" ? "Отправляем..." : "Отправить"}</Button></div>
          </section>
        </div>
      ) : null}
    </div>
  );
}

function PreferenceSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return <label className="flex min-h-12 cursor-pointer items-center justify-between gap-3 rounded-xl border border-line bg-white px-3 py-2 text-sm font-bold dark:border-white/10 dark:bg-slate-950/40"><span>{label}</span><input className="peer sr-only" type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="relative h-6 w-11 shrink-0 rounded-full bg-slate-300 transition peer-checked:bg-coral dark:bg-slate-700"><span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${checked ? "left-6" : "left-1"}`} /></span></label>;
}

function readPreferences(): Preferences {
  if (typeof window === "undefined") return defaultPreferences;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}") as Partial<Preferences>;
    return { soundEnabled: parsed.soundEnabled === true, motionEnabled: parsed.motionEnabled !== false };
  } catch {
    return defaultPreferences;
  }
}

async function trackProductEvent(event: string, gameId: GameId, phase?: string) {
  try {
    const width = window.innerWidth;
    const device = width < 640 ? "mobile" : width < 1024 ? "tablet" : "desktop";
    await fetch("/api/track-event", { method: "POST", headers: { "content-type": "application/json" }, keepalive: true, body: JSON.stringify({ event, gameId, phase, device }) });
  } catch {
    // Product analytics must never affect the game.
  }
}

function playPhaseSound() {
  try {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(660, context.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(880, context.currentTime + 0.14);
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.09, context.currentTime + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.2);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.22);
    window.setTimeout(() => void context.close(), 350);
  } catch {
    // Audio is optional and may be blocked by the browser.
  }
}

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
  }
}
