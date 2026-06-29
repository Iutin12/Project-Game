"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/Button";

type Theme = "light" | "dark";

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
    setTheme(nextTheme);
    document.documentElement.dataset.theme = nextTheme;
    window.localStorage.setItem("theme", nextTheme);
  }

  return (
    <Button type="button" variant="secondary" className="h-11 w-12 px-0 text-lg" onClick={toggleTheme} aria-label="Переключить тему">
      {theme === "dark" ? "☀" : "◐"}
    </Button>
  );
}
