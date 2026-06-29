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
        ink: "#172033",
        cloud: "#f7f8fb",
        line: "#dfe6ef",
        mint: "#2f9e7e",
        ocean: "#2563eb",
        coral: "#f9735b"
      },
      boxShadow: {
        soft: "0 18px 45px rgba(29, 55, 91, 0.1)"
      }
    }
  },
  plugins: []
};

export default config;
