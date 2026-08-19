import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type CompletedGameId = "mafia" | "crocodile" | "bunker" | "spy" | "alias";

type CompletionStats = {
  completedGames: number;
  completedPlayerParticipations: number;
  byGame: Record<CompletedGameId, { completedGames: number; completedPlayerParticipations: number }>;
  updatedAt: number;
};

const statsFile = process.env.GAME_STATS_FILE ?? "/app/data/completion-stats.json";
const finalPhases = new WeakSet<object>();
let stats = loadStats();

export function trackCompletedGame(room: { gameId: CompletedGameId; phase: string; players: object[] }) {
  const roomRef = room as object;
  const isFinished = room.phase === "GAME_OVER" || room.phase === "GAME_RESULT";

  if (!isFinished) {
    finalPhases.delete(roomRef);
    return;
  }
  if (finalPhases.has(roomRef)) return;

  finalPhases.add(roomRef);
  const completedPlayerParticipations = room.players.filter((player) => !(player as { isBot?: boolean }).isBot).length;
  stats.completedGames += 1;
  stats.completedPlayerParticipations += completedPlayerParticipations;
  stats.byGame[room.gameId].completedGames += 1;
  stats.byGame[room.gameId].completedPlayerParticipations += completedPlayerParticipations;
  stats.updatedAt = Date.now();
  saveStats();
}

export function getCompletionStats() {
  return structuredClone(stats);
}

function loadStats(): CompletionStats {
  try {
    const parsed = JSON.parse(readFileSync(statsFile, "utf8")) as Partial<CompletionStats>;
    return {
      completedGames: Number.isFinite(parsed.completedGames) ? Number(parsed.completedGames) : 0,
      completedPlayerParticipations: Number.isFinite(parsed.completedPlayerParticipations) ? Number(parsed.completedPlayerParticipations) : 0,
      byGame: {
        mafia: normalizeGameStats(parsed.byGame?.mafia),
        crocodile: normalizeGameStats(parsed.byGame?.crocodile),
        bunker: normalizeGameStats(parsed.byGame?.bunker),
        spy: normalizeGameStats(parsed.byGame?.spy),
        alias: normalizeGameStats(parsed.byGame?.alias)
      },
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : 0
    };
  } catch {
    return createEmptyStats();
  }
}

function createEmptyStats(): CompletionStats {
  return {
    completedGames: 0,
    completedPlayerParticipations: 0,
    byGame: {
      mafia: { completedGames: 0, completedPlayerParticipations: 0 },
      crocodile: { completedGames: 0, completedPlayerParticipations: 0 },
      bunker: { completedGames: 0, completedPlayerParticipations: 0 },
      spy: { completedGames: 0, completedPlayerParticipations: 0 },
      alias: { completedGames: 0, completedPlayerParticipations: 0 }
    },
    updatedAt: 0
  };
}

function normalizeGameStats(value: unknown) {
  const game = value as { completedGames?: unknown; completedPlayerParticipations?: unknown } | undefined;
  return {
    completedGames: Number.isFinite(game?.completedGames) ? Number(game?.completedGames) : 0,
    completedPlayerParticipations: Number.isFinite(game?.completedPlayerParticipations) ? Number(game?.completedPlayerParticipations) : 0
  };
}

function saveStats() {
  mkdirSync(dirname(statsFile), { recursive: true });
  const temporaryFile = `${statsFile}.tmp`;
  writeFileSync(temporaryFile, JSON.stringify(stats), "utf8");
  renameSync(temporaryFile, statsFile);
}
