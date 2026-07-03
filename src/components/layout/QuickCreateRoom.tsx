"use client";

import { useRouter } from "next/navigation";

type QuickCreateRoomProps = {
  label?: string;
  variant?: "header" | "hero";
};

export function QuickCreateRoom({ label = "+ Создать", variant = "header" }: QuickCreateRoomProps) {
  const router = useRouter();

  return (
    <button
      className={
        variant === "hero"
          ? "min-w-44 shrink-0 whitespace-nowrap rounded-md border border-line bg-white px-5 py-3 text-sm font-bold text-ink shadow-soft transition hover:-translate-y-0.5 hover:border-ocean/40 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-slate-900 dark:text-white"
          : "shrink-0 whitespace-nowrap rounded-lg bg-ocean px-3 py-3 text-sm font-semibold text-white shadow-soft transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50 sm:px-4"
      }
      onClick={() => router.push("/games")}
      type="button"
    >
      {label}
      {variant === "header" ? <span className="hidden sm:inline"> комнату</span> : null}
    </button>
  );
}
