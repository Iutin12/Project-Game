export type CrocodileGameMode = "solo" | "teams";
export type CrocodileRoundMode = "single_word" | "multiple_words";
export type CrocodileDifficulty = "easy" | "medium" | "hard";
export type CrocodileDifficultyFilter = CrocodileDifficulty | "mixed";
export type CrocodilePhase = "LOBBY" | "ROUND_ACTIVE" | "ROUND_RESULT" | "GAME_OVER";

export type CrocodileCategoryId =
  | "animals"
  | "food"
  | "professions"
  | "sports"
  | "movies"
  | "music"
  | "games"
  | "school"
  | "technology"
  | "nature"
  | "travel"
  | "household"
  | "emotions"
  | "fairy_tales"
  | "actions"
  | "hard_concepts";

export type CrocodileSettings = {
  gameMode: CrocodileGameMode;
  roundMode: CrocodileRoundMode;
  difficulty: CrocodileDifficultyFilter;
  allowPhrases: boolean;
  useTimer: boolean;
  roundTimeSec: number;
  wordPoolMode: "all" | "categories";
  selectedCategories: CrocodileCategoryId[];
  roundsCount: number | null;
  teamsCount: number;
  autoAssignTeams: boolean;
  pointsForGuesser: number;
  pointsForExplainer: number;
  pointsForTeamGuess: number;
  allowSkipWord: boolean;
  maxSkipsPerTurn: number | null;
};

export type CrocodileWord = {
  id: string;
  text: string;
  category: CrocodileCategoryId;
  difficulty: CrocodileDifficulty;
  isPhrase: boolean;
};

export type CrocodilePlayer = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  teamId?: string;
  score: number;
};

export type CrocodileChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
  correct?: boolean;
};

export type CrocodileRound = {
  index: number;
  explainerId: string;
  activeTeamId?: string;
  word?: CrocodileWord;
  guessedWords: CrocodileWord[];
  skipsUsed: number;
  startedAt?: number;
  deadlineAt?: number;
  lastGuesserId?: string;
  lastCorrectWord?: string;
};

export type CrocodileRoom = {
  code: string;
  gameId: "crocodile";
  visibility: "private" | "public";
  hostId?: string;
  hostKey: string;
  phase: CrocodilePhase;
  players: CrocodilePlayer[];
  settings: CrocodileSettings;
  round?: CrocodileRound;
  usedWordIds: string[];
  chatMessages: CrocodileChatMessage[];
  createdAt: number;
  winnerIds?: string[];
  winningTeamId?: string;
};

export type PublicCrocodileRoom = Omit<CrocodileRoom, "hostKey" | "players" | "round"> & {
  players: CrocodilePlayer[];
  ownPlayerId: string;
  round?: Omit<CrocodileRound, "word"> & {
    word?: CrocodileWord;
  };
};
