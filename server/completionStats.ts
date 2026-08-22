import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export type CompletedGameId = "mafia" | "crocodile" | "bunker" | "spy" | "alias";

type CompletionStats = {
  roomsCreated: number;
  completedGames: number;
  completedPlayerParticipations: number;
  uniqueVisitors: number;
  byGame: Record<CompletedGameId, { roomsCreated: number; completedGames: number; completedPlayerParticipations: number }>;
  daily: DailyStats;
  updatedAt: number;
  visitorHashes: string[];
};

type DailyStats = {
  date: string;
  roomsCreated: number;
  completedGames: number;
  completedPlayerParticipations: number;
  uniqueVisitors: number;
  byGame: Record<CompletedGameId, { roomsCreated: number; completedGames: number; completedPlayerParticipations: number }>;
  visitorHashes: string[];
};

const statsFile = process.env.GAME_STATS_FILE ?? "/app/data/completion-stats.json";
const finalPhases = new WeakSet<object>();
let stats = loadStats();
let visitorHashes = new Set(stats.visitorHashes);
let dailyVisitorHashes = new Set(stats.daily.visitorHashes);

export function trackUniqueVisitor(visitorId: string) {
  ensureCurrentDay();
  const visitorHash = createHash("sha256").update(visitorId).digest("hex");
  const isNewVisitor = !visitorHashes.has(visitorHash);
  const isNewToday = !dailyVisitorHashes.has(visitorHash);

  if (isNewVisitor) {
    visitorHashes.add(visitorHash);
    stats.uniqueVisitors = visitorHashes.size;
    stats.visitorHashes = [...visitorHashes];
  }
  if (isNewToday) {
    dailyVisitorHashes.add(visitorHash);
    stats.daily.uniqueVisitors = dailyVisitorHashes.size;
    stats.daily.visitorHashes = [...dailyVisitorHashes];
  }

  if (!isNewVisitor && !isNewToday) return false;
  stats.updatedAt = Date.now();
  saveStats();
  return isNewVisitor;
}

export function trackRoomCreated(gameId: CompletedGameId) {
  ensureCurrentDay();
  stats.roomsCreated += 1;
  stats.byGame[gameId].roomsCreated += 1;
  stats.daily.roomsCreated += 1;
  stats.daily.byGame[gameId].roomsCreated += 1;
  stats.updatedAt = Date.now();
  saveStats();
}

export function trackCompletedGame(room: { gameId: CompletedGameId; phase: string; players: object[] }) {
  ensureCurrentDay();
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
  stats.daily.completedGames += 1;
  stats.daily.completedPlayerParticipations += completedPlayerParticipations;
  stats.daily.byGame[room.gameId].completedGames += 1;
  stats.daily.byGame[room.gameId].completedPlayerParticipations += completedPlayerParticipations;
  stats.updatedAt = Date.now();
  saveStats();
}

export function getCompletionStats() {
  ensureCurrentDay();
  const { visitorHashes: _, daily, ...publicStats } = stats;
  const { visitorHashes: __, ...publicDailyStats } = daily;
  return structuredClone({ ...publicStats, daily: publicDailyStats });
}

function loadStats(): CompletionStats {
  try {
    const parsed = JSON.parse(readFileSync(statsFile, "utf8")) as Partial<CompletionStats>;
    return {
      roomsCreated: Number.isFinite(parsed.roomsCreated) ? Number(parsed.roomsCreated) : 0,
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
      daily: normalizeDailyStats(parsed.daily),
      updatedAt: Number.isFinite(parsed.updatedAt) ? Number(parsed.updatedAt) : 0,
      visitorHashes: Array.isArray(parsed.visitorHashes) ? parsed.visitorHashes.filter((value): value is string => typeof value === "string" && /^[a-f0-9]{64}$/.test(value)) : []
    };
  } catch {
    return createEmptyStats();
  }
}

function createEmptyStats(): CompletionStats {
  return {
    roomsCreated: 0,
    completedGames: 0,
    completedPlayerParticipations: 0,
    uniqueVisitors: 0,
    byGame: {
      mafia: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 },
      crocodile: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 },
      bunker: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 },
      spy: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 },
      alias: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 }
    },
    daily: createEmptyDailyStats(),
    updatedAt: 0,
    visitorHashes: []
  };
}

function normalizeDailyStats(value: unknown): DailyStats {
  const daily = value as Partial<DailyStats> | undefined;
  const today = getDayKey();
  if (daily?.date !== today) return createEmptyDailyStats(today);

  return {
    date: today,
    roomsCreated: Number.isFinite(daily.roomsCreated) ? Number(daily.roomsCreated) : 0,
    completedGames: Number.isFinite(daily.completedGames) ? Number(daily.completedGames) : 0,
    completedPlayerParticipations: Number.isFinite(daily.completedPlayerParticipations) ? Number(daily.completedPlayerParticipations) : 0,
    uniqueVisitors: Number.isFinite(daily.uniqueVisitors) ? Number(daily.uniqueVisitors) : 0,
    byGame: {
      mafia: normalizeDailyGameStats(daily.byGame?.mafia),
      crocodile: normalizeDailyGameStats(daily.byGame?.crocodile),
      bunker: normalizeDailyGameStats(daily.byGame?.bunker),
      spy: normalizeDailyGameStats(daily.byGame?.spy),
      alias: normalizeDailyGameStats(daily.byGame?.alias)
    },
    visitorHashes: Array.isArray(daily.visitorHashes) ? daily.visitorHashes.filter(isVisitorHash) : []
  };
}

function createEmptyDailyStats(date = getDayKey()): DailyStats {
  return {
    date,
    roomsCreated: 0,
    completedGames: 0,
    completedPlayerParticipations: 0,
    uniqueVisitors: 0,
    byGame: {
      mafia: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 },
      crocodile: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 },
      bunker: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 },
      spy: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 },
      alias: { roomsCreated: 0, completedGames: 0, completedPlayerParticipations: 0 }
    },
    visitorHashes: []
  };
}

function normalizeGameStats(value: unknown) {
  const game = value as { roomsCreated?: unknown; completedGames?: unknown; completedPlayerParticipations?: unknown } | undefined;
  return {
    roomsCreated: Number.isFinite(game?.roomsCreated) ? Number(game?.roomsCreated) : 0,
    completedGames: Number.isFinite(game?.completedGames) ? Number(game?.completedGames) : 0,
    completedPlayerParticipations: Number.isFinite(game?.completedPlayerParticipations) ? Number(game?.completedPlayerParticipations) : 0
  };
}

function normalizeDailyGameStats(value: unknown) {
  const game = value as { roomsCreated?: unknown; completedGames?: unknown; completedPlayerParticipations?: unknown } | undefined;
  return {
    roomsCreated: Number.isFinite(game?.roomsCreated) ? Number(game?.roomsCreated) : 0,
    completedGames: Number.isFinite(game?.completedGames) ? Number(game?.completedGames) : 0,
    completedPlayerParticipations: Number.isFinite(game?.completedPlayerParticipations) ? Number(game?.completedPlayerParticipations) : 0
  };
}

function ensureCurrentDay() {
  const today = getDayKey();
  if (stats.daily.date === today) return;
  stats.daily = createEmptyDailyStats(today);
  dailyVisitorHashes = new Set();
  stats.updatedAt = Date.now();
  saveStats();
}

function getDayKey() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.STATS_TIME_ZONE ?? "Asia/Yekaterinburg",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts();
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

function isVisitorHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function saveStats() {
  try {
    mkdirSync(dirname(statsFile), { recursive: true });
    const temporaryFile = `${statsFile}.tmp`;
    writeFileSync(temporaryFile, JSON.stringify(stats), "utf8");
    renameSync(temporaryFile, statsFile);
  } catch (error) {
    // Statistics must never prevent players from creating or finishing a game.
    console.error("Unable to persist platform statistics", error);
  }
}
