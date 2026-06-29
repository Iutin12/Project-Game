import type { Config } from "tailwindcss";

const config: Config = {
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
      }
    }
  },
  plugins: []
};

export default config;
