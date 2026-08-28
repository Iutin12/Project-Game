import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { dirname } from "node:path";

const reportsFile = process.env.GAME_REPORTS_FILE ?? "/app/data/game-reports.ndjson";
const allowedGames = new Set(["mafia", "crocodile", "bunker", "spy", "alias"]);

export function saveGameReport(input: { gameId: string; phase?: string; message: string }) {
  if (!allowedGames.has(input.gameId)) throw new Error("Unknown game");
  const message = input.message.trim();
  if (message.length < 8 || message.length > 700) throw new Error("Invalid message");
  const entry = { createdAt: new Date().toISOString(), gameId: input.gameId, phase: typeof input.phase === "string" ? input.phase.slice(0, 64) : undefined, message };
  mkdirSync(dirname(reportsFile), { recursive: true });
  appendFileSync(reportsFile, `${JSON.stringify(entry)}\n`, "utf8");
}

export type GameReport = { createdAt: string; gameId: string; phase?: string; message: string };

export function getRecentGameReports(limit = 30): GameReport[] {
  try {
    return readFileSync(reportsFile, "utf8")
      .trim()
      .split("\n")
      .filter(Boolean)
      .slice(-limit)
      .reverse()
      .flatMap((line) => {
        try {
          const entry = JSON.parse(line) as GameReport;
          return typeof entry?.message === "string" ? [entry] : [];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}
