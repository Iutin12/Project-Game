import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["selector", '[data-theme="dark"]'],
  content: ["./src/**/*.{ts,tsx}", "./server/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ["var(--font-display)", "Georgia", "serif"],
        body: ["var(--font-body)", "Arial", "sans-serif"]
      },
      colors: {
        ink: "var(--color-ink)",
        cloud: "var(--color-cloud)",
        line: "var(--color-line)",
        mint: "var(--color-mint)",
        ocean: "var(--color-ocean)",
        coral: "var(--color-coral)"
      },
      boxShadow: {
        soft: "var(--shadow-soft)"
      },
      borderRadius: {
        xl: "0.75rem",
        "2xl": "1.25rem",
        "3xl": "1.5rem"
      }
    }
  },
  plugins: []
};

export default config;
