export type BunkerGameMode = "classic" | "quick";
export type BunkerHostMode = "auto" | "manual_host";
export type BunkerVotingMode = "open" | "anonymous";
export type BunkerTieMode = "revote" | "no_elimination" | "random";
export type BunkerRevealMode = "fixed_order" | "free_choice";
export type BunkerSelectionMode = "random" | "select";

export type BunkerCardCategory =
  | "profession"
  | "age"
  | "gender"
  | "health"
  | "biology"
  | "hobby"
  | "phobia"
  | "baggage"
  | "skill"
  | "character"
  | "fact"
  | "special";

export type BunkerPhase =
  | "LOBBY"
  | "SCENARIO_REVEAL"
  | "CHARACTER_PREVIEW"
  | "REVEAL_ROUND"
  | "DISCUSSION"
  | "SPECIAL_ACTIONS"
  | "VOTING"
  | "REVOTE"
  | "VOTING_RESULT"
  | "ELIMINATION"
  | "GAME_OVER";

export type BunkerSettings = {
  gameMode: BunkerGameMode;
  hostMode: BunkerHostMode;
  maxPlayers: number;
  bunkerSlots: number | "auto";
  characteristicsPerPlayer: number;
  revealMode: BunkerRevealMode;
  discussionTimeSec: number;
  votingTimeSec: number;
  useTimer: boolean;
  useSpecialCards: boolean;
  specialCardsPerPlayer: number;
  votingMode: BunkerVotingMode;
  tieMode: BunkerTieMode;
  allowSelfVote: boolean;
  revealProfessionAtStart: boolean;
  showEliminatedCards: boolean;
  catastropheMode: BunkerSelectionMode;
  selectedCatastropheId?: string;
  bunkerMode: BunkerSelectionMode;
  selectedBunkerId?: string;
  enabledCardCategories: BunkerCardCategory[];
};

export type BunkerCatastrophe = {
  id: string;
  title: string;
  shortDescription: string;
  fullDescription: string;
  survivalGoal: string;
  dangerLevel: "medium" | "high" | "critical";
  environmentTags: string[];
};

export type BunkerShelter = {
  id: string;
  title: string;
  description: string;
  capacity: number | "settings";
  durationMonths: number;
  rooms: string[];
  resources: string[];
  problems: string[];
  bonuses: string[];
};

export type BunkerCard = {
  id: string;
  category: BunkerCardCategory;
  title: string;
  description?: string;
  tags?: string[];
};

export type BunkerSpecialCardType =
  | "reveal_extra"
  | "hide_card"
  | "force_reveal"
  | "swap_card"
  | "protect_vote"
  | "protect_player"
  | "reroll_card"
  | "double_vote"
  | "reset_votes"
  | "recover_special"
  | "revote";

export type BunkerSpecialCard = BunkerCard & {
  category: "special";
  type: BunkerSpecialCardType;
  used?: boolean;
};

export type BunkerCharacter = {
  playerId: string;
  profession: BunkerCard;
  age: BunkerCard;
  gender: BunkerCard;
  health: BunkerCard;
  biology: BunkerCard;
  hobby: BunkerCard;
  phobia: BunkerCard;
  baggage: BunkerCard;
  skill: BunkerCard;
  character: BunkerCard;
  fact: BunkerCard;
  specialCards: BunkerSpecialCard[];
  revealedCategories: BunkerCardCategory[];
};

export type BunkerPlayer = {
  id: string;
  name: string;
  connected: boolean;
  isHost: boolean;
  isBot?: boolean;
  status: "alive" | "eliminated";
};

export type BunkerVote = Record<string, string>;

export type BunkerVotingResult = {
  round: number;
  votes: BunkerVote;
  eliminatedPlayerId?: string;
  tiedPlayerIds?: string[];
  noElimination?: boolean;
  isRevote?: boolean;
};

export type BunkerEvent = {
  id: string;
  text: string;
  createdAt: number;
};

export type BunkerChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
  system?: boolean;
};

export type BunkerRoomState = {
  code: string;
  gameId: "bunker";
  visibility: "private" | "public";
  hostId?: string;
  hostKey: string;
  phase: BunkerPhase;
  players: BunkerPlayer[];
  settings: BunkerSettings;
  catastrophe?: BunkerCatastrophe;
  shelter?: BunkerShelter;
  bunkerSlots: number;
  characters: Record<string, BunkerCharacter>;
  currentRound: number;
  revealOrder: BunkerCardCategory[];
  currentRevealCategory?: BunkerCardCategory;
  revealedThisRoundPlayerIds: string[];
  readyPlayerIds: string[];
  votes: BunkerVote;
  revoteCandidateIds?: string[];
  lastVotingResult?: BunkerVotingResult;
  winnerPlayerIds?: string[];
  protectedPlayerIds: string[];
  doubleVotePlayerIds: string[];
  eventLog: BunkerEvent[];
  chatMessages: BunkerChatMessage[];
  createdAt: number;
  deadlineAt?: number;
  devMode?: boolean;
};

export type PublicBunkerCard = BunkerCard | { category: BunkerCardCategory; hidden: true };

export type PublicBunkerCharacter = Omit<BunkerCharacter, "specialCards" | "profession" | "age" | "gender" | "health" | "biology" | "hobby" | "phobia" | "baggage" | "skill" | "character" | "fact"> & {
  profession: PublicBunkerCard;
  age: PublicBunkerCard;
  gender: PublicBunkerCard;
  health: PublicBunkerCard;
  biology: PublicBunkerCard;
  hobby: PublicBunkerCard;
  phobia: PublicBunkerCard;
  baggage: PublicBunkerCard;
  skill: PublicBunkerCard;
  character: PublicBunkerCard;
  fact: PublicBunkerCard;
  specialCards: BunkerSpecialCard[];
};

export type PublicBunkerRoomState = Omit<BunkerRoomState, "hostKey" | "characters"> & {
  ownPlayerId: string;
  characters: Record<string, PublicBunkerCharacter>;
};
