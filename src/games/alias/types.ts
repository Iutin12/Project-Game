export type AliasPhase = "LOBBY" | "TURN_PREPARE" | "TURN_ACTIVE" | "LAST_WORD" | "TURN_RESULT" | "GAME_OVER";

export type AliasDifficulty = "easy" | "medium" | "hard" | "mixed";
export type AliasGameEndMode = "score" | "rounds";
export type AliasLastWordMode = "disabled" | "common_guess";
export type AliasWordPoolMode = "all" | "selected";

export type AliasCategory =
  | "animals"
  | "food"
  | "people"
  | "professions"
  | "sports"
  | "movies"
  | "music"
  | "games"
  | "technology"
  | "travel"
  | "household"
  | "nature"
  | "emotions"
  | "actions"
  | "places"
  | "objects"
  | "science"
  | "history"
  | "internet"
  | "adult";

export type AliasWord = {
  id: string;
  word: string;
  category: AliasCategory;
  difficulty: Exclude<AliasDifficulty, "mixed">;
};

export type AliasSettings = {
  maxPlayers: number;
  teamsCount: 2 | 3 | 4 | 5 | 6;
  autoAssignTeams: boolean;
  turnTimeSec: 30 | 45 | 60 | 90 | 120;
  gameEndMode: AliasGameEndMode;
  targetScore: number;
  roundsCount: number;
  equalTurnsAtEnd: boolean;
  difficulty: AliasDifficulty;
  wordPoolMode: AliasWordPoolMode;
  selectedCategories: AliasCategory[];
  allowSkipWord: boolean;
  skipPenalty: 0 | -1;
  lastWordMode: AliasLastWordMode;
  reviewWordsAfterTurn: boolean;
  showPlayedWords: boolean;
};

export type AliasPlayer = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  isBot?: boolean;
  ready: boolean;
  teamId?: string;
  explainedWords: number;
  guessedWords: number;
  skippedWords: number;
};

export type AliasTeam = {
  id: string;
  name: string;
  color: "coral" | "ocean" | "mint" | "amber" | "violet" | "cyan";
  score: number;
  playerIds: string[];
};

export type AliasTurnWordResult = {
  id: string;
  wordId: string;
  word: string;
  result: "guessed" | "skipped";
  points: number;
};

export type AliasTurn = {
  turnNumber: number;
  teamId: string;
  explainerPlayerId: string;
  currentWordId?: string;
  processedWordIds: string[];
  words: AliasTurnWordResult[];
  startedAt?: number;
  deadlineAt?: number;
  lastWordWinnerTeamId?: string;
  lastWordId?: string;
  lastWord?: string;
  scoreDeltasByTeamId: Record<string, number>;
  scoreApplied: boolean;
  resultConfirmed: boolean;
};

export type AliasTurnHistory = {
  turnNumber: number;
  teamId: string;
  explainerPlayerId: string;
  guessedWords: string[];
  skippedWords: string[];
  scoreDeltasByTeamId: Record<string, number>;
};

export type AliasChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
  system?: boolean;
};

export type AliasRoomState = {
  code: string;
  gameId: "alias";
  visibility: "private" | "public";
  hostId?: string;
  hostKey: string;
  phase: AliasPhase;
  players: AliasPlayer[];
  teams: AliasTeam[];
  settings: AliasSettings;
  currentTeamIndex: number;
  turnNumber: number;
  teamTurnCounts: Record<string, number>;
  explainerCursorByTeam: Record<string, number>;
  usedWordIds: string[];
  previousWordId?: string;
  currentTurn?: AliasTurn;
  turnHistory: AliasTurnHistory[];
  chatMessages: AliasChatMessage[];
  createdAt: number;
  lastActivityAt: number;
  winnerTeamIds: string[];
  devMode?: boolean;
};

export type PublicAliasTurn = Omit<AliasTurn, "currentWordId" | "processedWordIds"> & {
  currentWord?: AliasWord;
  guessedCount: number;
  skippedCount: number;
  scoreDelta: number;
  canReviewWords: boolean;
};

export type PublicAliasRoomState = Omit<AliasRoomState, "hostKey" | "usedWordIds" | "previousWordId" | "currentTurn"> & {
  ownPlayerId: string;
  currentTurn?: PublicAliasTurn;
  devSecrets?: {
    currentWord?: AliasWord;
  };
};
