"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";

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
      <Button
        type="button"
        className="shrink-0 whitespace-nowrap px-3 sm:px-4"
        onClick={() => setIsOpen(true)}
      >
        <span className="sm:hidden">Код</span>
        <span className="hidden sm:inline">Войти по коду</span>
      </Button>
    );
  }

  return (
    <form className="flex min-w-0 items-center gap-2" onSubmit={submitCode}>
      <input
        className="h-11 w-24 min-w-0 rounded-xl border border-line bg-white px-3 text-sm font-semibold uppercase tracking-[0.12em] text-ink shadow-sm outline-none placeholder:normal-case placeholder:tracking-normal focus:border-ocean focus:ring-2 focus:ring-ocean/15 dark:bg-slate-900 dark:text-white sm:w-36"
        placeholder="Код комнаты"
        value={code}
        maxLength={8}
        autoFocus
        onChange={(event) => setCode(event.target.value)}
      />
      <Button
        type="submit"
        className="h-11 min-h-11 shrink-0 px-3 sm:px-4"
      >
        <span className="sm:hidden">→</span>
        <span className="hidden sm:inline">Войти</span>
      </Button>
    </form>
  );
}
