import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type CompletedGameId = "mafia" | "crocodile" | "bunker" | "spy" | "alias";

type CompletionStats = {
  completedGames: number;
  completedPlayerParticipations: number;
  uniqueVisitors: number;
  byGame: Record<CompletedGameId, { completedGames: number; completedPlayerParticipations: number }>;
  updatedAt: number;
  visitorHashes: string[];
};

const statsFile = process.env.GAME_STATS_FILE ?? "/app/data/completion-stats.json";
const finalPhases = new WeakSet<object>();
let stats = loadStats();
let visitorHashes = new Set(stats.visitorHashes);

export function trackUniqueVisitor(visitorId: string) {
  const visitorHash = createHash("sha256").update(visitorId).digest("hex");
  if (visitorHashes.has(visitorHash)) return false;

  visitorHashes.add(visitorHash);
  stats.uniqueVisitors = visitorHashes.size;
  stats.visitorHashes = [...visitorHashes];
  stats.updatedAt = Date.now();
  saveStats();
  return true;
}

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
  const { visitorHashes: _, ...publicStats } = stats;
  return structuredClone(publicStats);
}

function loadStats(): CompletionStats {
  try {
    const parsed = JSON.parse(readFileSync(statsFile, "utf8")) as Partial<CompletionStats>;
    return {
      completedGames: Number.isFinite(parsed.completedGames) ? Number(parsed.completedGames) : 0,
      completedPlayerParticipations: Number.isFinite(parsed.completedPlayerParticipations) ? Number(parsed.completedPlayerParticipations) : 0,
      uniqueVisitors: Number.isFinite(parsed.uniqueVisitors) ? Number(parsed.uniqueVisitors) : 0,
      byGame: {
        mafia: normalizeGameStats(parsed.byGame?.mafia),
        crocodile: normalizeGameStats(parsed.byGame?.crocodile),
        bunker: normalizeGameStats(parsed.byGame?.bunker),
        spy: normalizeGameStats(parsed.byGame?.spy),
        alias: normalizeGameStats(parsed.byGame?.alias)
      },
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : 0,
      visitorHashes: Array.isArray(parsed.visitorHashes) ? parsed.visitorHashes.filter((value): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) : []
    };
  } catch {
    return createEmptyStats();
  }
}

function createEmptyStats(): CompletionStats {
  return {
    completedGames: 0,
    completedPlayerParticipations: 0,
    uniqueVisitors: 0,
    byGame: {
      mafia: { completedGames: 0, completedPlayerParticipations: 0 },
      crocodile: { completedGames: 0, completedPlayerParticipations: 0 },
      bunker: { completedGames: 0, completedPlayerParticipations: 0 },
      spy: { completedGames: 0, completedPlayerParticipations: 0 },
      alias: { completedGames: 0, completedPlayerParticipations: 0 }
    },
    updatedAt: 0,
    visitorHashes: []
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
