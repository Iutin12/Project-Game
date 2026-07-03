import { crocodileWords } from "./words";
import type { CrocodilePlayer, CrocodileRoom, CrocodileSettings, CrocodileWord } from "./types";

export const defaultCrocodileSettings: CrocodileSettings = {
  gameMode: "solo",
  roundMode: "single_word",
  difficulty: "mixed",
  allowPhrases: true,
  useTimer: true,
  roundTimeSec: 90,
  wordPoolMode: "all",
  selectedCategories: [],
  roundsCount: null,
  teamsCount: 2,
  autoAssignTeams: true,
  pointsForGuesser: 1,
  pointsForExplainer: 1,
  pointsForTeamGuess: 1,
  allowSkipWord: true,
  maxSkipsPerTurn: null
};

export function getAvailableWords(settings: CrocodileSettings, usedWordIds: string[]) {
  const usedIds = new Set(usedWordIds);
  const selectedCategories = new Set(settings.selectedCategories);
  const words = crocodileWords.filter((word) => {
    if (usedIds.has(word.id)) return false;
    if (!settings.allowPhrases && word.isPhrase) return false;
    if (settings.difficulty !== "mixed" && word.difficulty !== settings.difficulty) return false;
    if (settings.wordPoolMode === "categories" && selectedCategories.size > 0 && !selectedCategories.has(word.category)) return false;
    return true;
  });

  return words.length > 0 ? words : crocodileWords.filter((word) => !usedIds.has(word.id));
}

export function pickWord(settings: CrocodileSettings, usedWordIds: string[]) {
  const words = getAvailableWords(settings, usedWordIds);
  return words[Math.floor(Math.random() * words.length)];
}

export function normalizeGuess(value: string) {
  return value
    .trim()
    .toLocaleLowerCase("ru-RU")
    .replace(/ё/g, "е")
    .replace(/[^а-яa-z0-9\s-]/giu, "")
    .replace(/[\s-]+/g, " ")
    .trim();
}

export function isCorrectGuess(guess: string, word?: CrocodileWord) {
  if (!word) return false;
  return normalizeGuess(guess) === normalizeGuess(word.text);
}

export function getNextExplainer(players: CrocodilePlayer[], previousExplainerId?: string) {
  const connectedPlayers = players.filter((player) => player.connected);
  if (connectedPlayers.length === 0) return players[0];
  if (!previousExplainerId) return connectedPlayers[0];
  const previousIndex = connectedPlayers.findIndex((player) => player.id === previousExplainerId);
  return connectedPlayers[(previousIndex + 1 + connectedPlayers.length) % connectedPlayers.length] ?? connectedPlayers[0];
}

export function assignTeams(players: CrocodilePlayer[], teamsCount: number) {
  return players.map((player, index) => ({
    ...player,
    teamId: `team_${(index % teamsCount) + 1}`
  }));
}

export function getTeamScore(room: CrocodileRoom, teamId: string) {
  return room.players.filter((player) => player.teamId === teamId).reduce((total, player) => total + player.score, 0);
}

export function getWinnerIds(players: CrocodilePlayer[]) {
  const maxScore = Math.max(0, ...players.map((player) => player.score));
  return players.filter((player) => player.score === maxScore).map((player) => player.id);
}

export function getWinningTeamId(room: CrocodileRoom) {
  const teamIds = [...new Set(room.players.map((player) => player.teamId).filter(Boolean))] as string[];
  const sorted = teamIds
    .map((teamId) => ({ teamId, score: getTeamScore(room, teamId) }))
    .sort((first, second) => second.score - first.score);
  return sorted[0]?.teamId;
}
