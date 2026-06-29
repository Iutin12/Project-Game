import { clsx } from "clsx";
import type { ButtonHTMLAttributes } from "react";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
};

export function Button({ className, variant = "primary", ...props }: ButtonProps) {
  return (
    <button
      className={clsx(
        "inline-flex items-center justify-center rounded-md px-5 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-45",
        variant === "primary" && "bg-ember text-white shadow-glow hover:bg-red-500",
        variant === "secondary" && "border border-white/15 bg-white/10 text-white hover:bg-white/15",
        variant === "ghost" && "text-white/75 hover:bg-white/10 hover:text-white",
        className
      )}
      {...props}
    />
  );
}
