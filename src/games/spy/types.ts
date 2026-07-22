export type SpyPhase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "WAITING_FOR_CONFIRMATION"
  | "DISCUSSION"
  | "SPY_GUESS"
  | "VOTING"
  | "REVOTE"
  | "ROUND_RESULT"
  | "GAME_RESULT";

export type SpyQuestionMode = "free" | "turns";
export type SpyTieMode = "revote" | "no_result" | "host" | "random";
export type SpyCountSetting = "auto" | number;

export type SpyLocation = {
  id: string;
  name: string;
  description: string;
  roles: string[];
  custom?: boolean;
};

export type SpySettings = {
  maxPlayers: number;
  spyCount: SpyCountSetting;
  discussionTimeSec: number;
  votingTimeSec: number;
  totalRounds: number | null;
  randomFirstTurn: boolean;
  useLocationRoles: boolean;
  requireReady: boolean;
  autoStartVoting: boolean;
  allowEarlyVoting: boolean;
  allowSpyGuess: boolean;
  lastChance: boolean;
  showLocationList: boolean;
  questionMode: SpyQuestionMode;
  tieMode: SpyTieMode;
  useScoring: boolean;
  allowRepeatLocations: boolean;
  hideUsedLocations: boolean;
  enabledLocationIds: string[];
  customLocations: SpyLocation[];
};

export type SpyPlayer = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  isBot?: boolean;
  ready: boolean;
  score: number;
};

export type SpyRoundWinReason =
  | "spy_guessed_location"
  | "spy_guess_failed"
  | "spy_not_found"
  | "all_spies_found"
  | "wrong_player_eliminated"
  | "voting_tie"
  | "host_finished_round";

export type SpyWinningSide = "spies" | "civilians";

export type SpyRoundResult = {
  roundNumber: number;
  winningSide: SpyWinningSide;
  reason: SpyRoundWinReason;
  location: SpyLocation;
  spyIds: string[];
  rolesByPlayerId: Record<string, string>;
  votes: Record<string, string>;
  guessedLocationId?: string;
  scoreDeltas: Record<string, number>;
};

export type SpyGuessOrigin = "discussion" | "last_chance";

export type SpyRoundState = {
  locationId: string;
  spyIds: string[];
  rolesByPlayerId: Record<string, string>;
  viewedPlayerIds: string[];
  confirmedPlayerIds: string[];
  currentQuestionerId?: string;
  currentResponderId?: string;
  earlyVotePlayerIds: string[];
  votes: Record<string, string>;
  confirmedVotePlayerIds: string[];
  revoteCandidateIds?: string[];
  revoteCount: number;
  foundSpyIds: string[];
  guessingSpyId?: string;
  guessOrigin?: SpyGuessOrigin;
  guessedLocationId?: string;
  result?: SpyRoundResult;
};

export type SpyChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
  system?: boolean;
};

export type SpyEvent = {
  id: string;
  text: string;
  createdAt: number;
};

export type SpyRoomState = {
  code: string;
  gameId: "spy";
  visibility: "private" | "public";
  hostId?: string;
  hostKey: string;
  phase: SpyPhase;
  players: SpyPlayer[];
  settings: SpySettings;
  currentRound: number;
  usedLocationIds: string[];
  previousSpyIds: string[];
  round?: SpyRoundState;
  roundHistory: SpyRoundResult[];
  chatMessages: SpyChatMessage[];
  eventLog: SpyEvent[];
  createdAt: number;
  lastActivityAt: number;
  deadlineAt?: number;
  devMode?: boolean;
};

export type PublicSpyRoundState = {
  viewedCount: number;
  confirmedCount: number;
  activePlayersCount: number;
  currentQuestionerId?: string;
  currentResponderId?: string;
  earlyVotePlayerIds: string[];
  votesSubmitted: number;
  revoteCandidateIds?: string[];
  foundSpyIds: string[];
  guessingSpyId?: string;
  result?: SpyRoundResult;
};

export type SpyPrivateState = {
  playerId: string;
  isSpy: boolean;
  hasViewedRole: boolean;
  hasConfirmedRole: boolean;
  hasConfirmedVote: boolean;
  selectedVoteId?: string;
  location?: Pick<SpyLocation, "id" | "name" | "description">;
  locationRole?: string;
  availableLocations?: Pick<SpyLocation, "id" | "name">[];
};

export type PublicSpyRoomState = Omit<SpyRoomState, "hostKey" | "round" | "previousSpyIds" | "usedLocationIds"> & {
  ownPlayerId: string;
  round?: PublicSpyRoundState;
  privateState?: SpyPrivateState;
};
