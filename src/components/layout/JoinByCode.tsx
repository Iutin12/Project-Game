"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function JoinByCode() {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [code, setCode] = useState("");

  function submitCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedCode = code.trim().toUpperCase();
    if (!normalizedCode) {
      setIsOpen(true);
      return;
    }

    router.push(`/room/${normalizedCode}`);
  }

  if (!isOpen) {
    return (
      <button
        type="button"
        className="inline-flex shrink-0 whitespace-nowrap rounded-lg bg-ocean px-3 py-3 text-sm font-semibold text-white shadow-soft hover:brightness-95 sm:px-4"
        onClick={() => setIsOpen(true)}
      >
        <span className="sm:hidden">Код</span>
        <span className="hidden sm:inline">Войти по коду</span>
      </button>
    );
  }

  return (
    <form className="flex min-w-0 items-center gap-2" onSubmit={submitCode}>
      <input
        className="h-11 w-24 min-w-0 rounded-lg border border-line bg-white px-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink shadow-sm outline-none placeholder:normal-case placeholder:tracking-normal focus:border-ocean sm:w-36"
        placeholder="Код комнаты"
        value={code}
        maxLength={8}
        autoFocus
        onChange={(event) => setCode(event.target.value)}
      />
      <button
        type="submit"
        className="h-11 shrink-0 rounded-lg bg-ocean px-3 text-sm font-semibold text-white shadow-soft hover:brightness-95 sm:px-4"
      >
        <span className="sm:hidden">→</span>
        <span className="hidden sm:inline">Войти</span>
      </button>
    </form>
  );
}
