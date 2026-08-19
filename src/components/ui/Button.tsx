import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      type={props.type ?? "button"}
      className={clsx(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-5 py-3 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ocean/35 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" && "bg-ocean text-white shadow-soft hover:-translate-y-0.5 hover:brightness-95 active:translate-y-0",
        variant === "secondary" && "border border-line bg-white text-ink shadow-sm hover:-translate-y-0.5 hover:border-ocean/35 hover:bg-slate-50 active:translate-y-0 dark:bg-slate-900 dark:text-white",
        variant === "ghost" && "text-slate-600 hover:bg-slate-100 hover:text-ink dark:text-white/70 dark:hover:bg-white/10 dark:hover:text-white",
        className
      )}
      {...props}
    />
  );
}
