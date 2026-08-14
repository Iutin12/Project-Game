import { defaultAliasCategories } from "./categories";
import type { AliasCategory, AliasSettings } from "./types";

export const defaultAliasSettings: AliasSettings = {
  maxPlayers: 20,
  teamsCount: 2,
  autoAssignTeams: true,
  turnTimeSec: 60,
  gameEndMode: "score",
  targetScore: 30,
  roundsCount: 5,
  equalTurnsAtEnd: true,
  difficulty: "mixed",
  wordPoolMode: "all",
  selectedCategories: [...defaultAliasCategories],
  allowSkipWord: true,
  maxSkipsPerTurn: null,
  skipPenalty: 0,
  lastWordMode: "disabled",
  reviewWordsAfterTurn: true,
  showPlayedWords: true
};

export function sanitizeAliasSettings(input: Partial<AliasSettings>, current: AliasSettings): AliasSettings {
  const teamsCount = input.teamsCount === 3 || input.teamsCount === 4 ? input.teamsCount : input.teamsCount === 2 ? 2 : current.teamsCount;
  const selectedCategories = Array.isArray(input.selectedCategories)
    ? input.selectedCategories.filter(isAliasCategory)
    : current.selectedCategories;
  return {
    maxPlayers: clamp(input.maxPlayers, 4, 20, current.maxPlayers),
    teamsCount,
    autoAssignTeams: typeof input.autoAssignTeams === "boolean" ? input.autoAssignTeams : current.autoAssignTeams,
    turnTimeSec: isTurnTime(input.turnTimeSec) ? input.turnTimeSec : current.turnTimeSec,
    gameEndMode: input.gameEndMode === "rounds" ? "rounds" : input.gameEndMode === "score" ? "score" : current.gameEndMode,
    targetScore: clamp(input.targetScore, 5, 200, current.targetScore),
    roundsCount: clamp(input.roundsCount, 1, 30, current.roundsCount),
    equalTurnsAtEnd: typeof input.equalTurnsAtEnd === "boolean" ? input.equalTurnsAtEnd : current.equalTurnsAtEnd,
    difficulty: input.difficulty === "easy" || input.difficulty === "medium" || input.difficulty === "hard" || input.difficulty === "mixed" ? input.difficulty : current.difficulty,
    wordPoolMode: input.wordPoolMode === "selected" ? "selected" : input.wordPoolMode === "all" ? "all" : current.wordPoolMode,
    selectedCategories: selectedCategories.length ? [...new Set(selectedCategories)] : current.selectedCategories,
    allowSkipWord: typeof input.allowSkipWord === "boolean" ? input.allowSkipWord : current.allowSkipWord,
    maxSkipsPerTurn: input.maxSkipsPerTurn === null ? null : clamp(input.maxSkipsPerTurn, 0, 50, current.maxSkipsPerTurn ?? 3),
    skipPenalty: input.skipPenalty === -1 ? -1 : input.skipPenalty === 0 ? 0 : current.skipPenalty,
    lastWordMode: input.lastWordMode === "common_guess" ? "common_guess" : input.lastWordMode === "disabled" ? "disabled" : current.lastWordMode,
    reviewWordsAfterTurn: typeof input.reviewWordsAfterTurn === "boolean" ? input.reviewWordsAfterTurn : current.reviewWordsAfterTurn,
    showPlayedWords: typeof input.showPlayedWords === "boolean" ? input.showPlayedWords : current.showPlayedWords
  };
}

function isTurnTime(value: unknown): value is AliasSettings["turnTimeSec"] {
  return value === 30 || value === 45 || value === 60 || value === 90 || value === 120;
}

function isAliasCategory(value: unknown): value is AliasCategory {
  return typeof value === "string" && [
    "animals", "food", "people", "professions", "sports", "movies", "music", "games", "technology", "travel",
    "household", "nature", "emotions", "actions", "places", "objects", "science", "history", "internet", "adult"
  ].includes(value);
}

function clamp(value: unknown, min: number, max: number, fallback: number) {
  const number = typeof value === "number" && Number.isFinite(value) ? Math.round(value) : fallback;
  return Math.max(min, Math.min(max, number));
}
