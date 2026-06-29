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
        night: "#090b10",
        ember: "#dc2626",
        blood: "#7f1d1d",
        ash: "#d7d7d7"
      },
      boxShadow: {
        glow: "0 0 35px rgba(220, 38, 38, 0.25)"
      }
    }
  },
  plugins: []
};

export default config;
