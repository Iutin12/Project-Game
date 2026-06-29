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
        className="hidden rounded-lg border border-line bg-white px-4 py-3 text-sm font-semibold text-ink shadow-sm hover:bg-slate-50 sm:inline-flex"
        onClick={() => setIsOpen(true)}
      >
        Войти по коду
      </button>
    );
  }

  return (
    <form className="hidden items-center gap-2 sm:flex" onSubmit={submitCode}>
      <input
        className="h-11 w-36 rounded-lg border border-line bg-white px-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink shadow-sm outline-none placeholder:normal-case placeholder:tracking-normal focus:border-ocean"
        placeholder="Код комнаты"
        value={code}
        maxLength={8}
        autoFocus
        onChange={(event) => setCode(event.target.value)}
      />
      <button
        type="submit"
        className="h-11 rounded-lg bg-ocean px-4 text-sm font-semibold text-white shadow-soft hover:brightness-95"
      >
        Войти
      </button>
    </form>
  );
}
