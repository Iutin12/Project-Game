import { spyLocations } from "./locations";
import type { SpySettings } from "./types";

export const defaultSpySettings: SpySettings = {
  maxPlayers: 12,
  spyCount: "auto",
  discussionTimeSec: 7 * 60,
  votingTimeSec: 45,
  totalRounds: 3,
  randomFirstTurn: true,
  useLocationRoles: true,
  requireReady: true,
  autoStartVoting: true,
  allowEarlyVoting: true,
  allowSpyGuess: true,
  lastChance: true,
  showLocationList: true,
  questionMode: "free",
  tieMode: "revote",
  useScoring: true,
  allowRepeatLocations: false,
  hideUsedLocations: true,
  enabledLocationIds: spyLocations.map((location) => location.id),
  customLocations: []
};

export function getSpyCount(playersCount: number, setting: SpySettings["spyCount"]) {
  if (setting !== "auto") return setting;
  return playersCount >= 8 ? 2 : 1;
}

export function sanitizeSpySettings(settings: Partial<SpySettings>, current: SpySettings): SpySettings {
  const spyCount = settings.spyCount === "auto"
    ? "auto"
    : clampNumber(settings.spyCount, 1, 4, current.spyCount === "auto" ? 1 : current.spyCount);
  const customLocations = Array.isArray(settings.customLocations)
    ? settings.customLocations.slice(0, 50).map((location, index) => ({
        id: cleanId(location.id) || `custom-${index + 1}`,
        name: cleanText(location.name, 50) || `Своя локация ${index + 1}`,
        description: cleanText(location.description, 180),
        roles: Array.isArray(location.roles)
          ? location.roles.map((role) => cleanText(role, 40)).filter(Boolean).slice(0, 20)
          : [],
        custom: true as const
      })).filter((location) => location.roles.length >= 3)
    : current.customLocations;
  const knownIds = new Set([...spyLocations.map((location) => location.id), ...customLocations.map((location) => location.id)]);
  const enabledLocationIds = Array.isArray(settings.enabledLocationIds)
    ? settings.enabledLocationIds.filter((id): id is string => typeof id === "string" && knownIds.has(id))
    : current.enabledLocationIds;

  return {
    maxPlayers: clampNumber(settings.maxPlayers, 3, 20, current.maxPlayers),
    spyCount,
    discussionTimeSec: clampNumber(settings.discussionTimeSec, 0, 60 * 60, current.discussionTimeSec),
    votingTimeSec: clampNumber(settings.votingTimeSec, 10, 5 * 60, current.votingTimeSec),
    totalRounds: settings.totalRounds === null ? null : clampNumber(settings.totalRounds, 1, 100, current.totalRounds ?? 3),
    randomFirstTurn: booleanOr(settings.randomFirstTurn, current.randomFirstTurn),
    useLocationRoles: booleanOr(settings.useLocationRoles, current.useLocationRoles),
    requireReady: booleanOr(settings.requireReady, current.requireReady),
    autoStartVoting: booleanOr(settings.autoStartVoting, current.autoStartVoting),
    allowEarlyVoting: booleanOr(settings.allowEarlyVoting, current.allowEarlyVoting),
    allowSpyGuess: booleanOr(settings.allowSpyGuess, current.allowSpyGuess),
    lastChance: booleanOr(settings.lastChance, current.lastChance),
    showLocationList: booleanOr(settings.showLocationList, current.showLocationList),
    questionMode: settings.questionMode === "turns" ? "turns" : settings.questionMode === "free" ? "free" : current.questionMode,
    tieMode: ["revote", "no_result", "host", "random"].includes(settings.tieMode ?? "")
      ? settings.tieMode as SpySettings["tieMode"]
      : current.tieMode,
    useScoring: booleanOr(settings.useScoring, current.useScoring),
    allowRepeatLocations: booleanOr(settings.allowRepeatLocations, current.allowRepeatLocations),
    hideUsedLocations: booleanOr(settings.hideUsedLocations, current.hideUsedLocations),
    enabledLocationIds: enabledLocationIds.length ? [...new Set(enabledLocationIds)] : current.enabledLocationIds,
    customLocations
  };
}

function clampNumber(value: unknown, min: number, max: number, fallback: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, Math.round(value)));
}

function booleanOr(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, maxLength) : "";
}

function cleanId(value: unknown) {
  return cleanText(value, 60).toLocaleLowerCase("ru-RU").replace(/[^a-zа-яё0-9-]+/gi, "-").replace(/^-+|-+$/g, "");
}
