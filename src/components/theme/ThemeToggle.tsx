"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Theme = "light" | "dark";
type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> };
};

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("theme") as Theme | null;
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
  }, []);

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    const directionClass = nextTheme === "dark" ? "theme-to-dark" : "theme-to-light";
    const viewTransitionDocument = document as ViewTransitionDocument;

    function applyTheme() {
      document.documentElement.dataset.theme = nextTheme;
      window.localStorage.setItem("theme", nextTheme);
      setTheme(nextTheme);
    }

    if (!viewTransitionDocument.startViewTransition) {
      applyTheme();
      return;
    }

    document.documentElement.classList.add(directionClass);
    const transition = viewTransitionDocument.startViewTransition(applyTheme);
    transition.finished.finally(() => {
      document.documentElement.classList.remove(directionClass);
    });
  }

  return (
    <Button type="button" variant="secondary" className="h-11 w-12 px-0 text-lg" onClick={toggleTheme} aria-label="Переключить тему">
      {theme === "dark" ? "☀" : "◐"}
    </Button>
  );
}
