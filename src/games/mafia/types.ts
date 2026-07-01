export type Role = "CIVILIAN" | "MAFIA" | "DON" | "MISTRESS" | "DETECTIVE" | "DOCTOR";

export type GamePhase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "NIGHT_MAFIA"
  | "NIGHT_DON"
  | "NIGHT_DETECTIVE"
  | "NIGHT_DOCTOR"
  | "DAY_DISCUSSION"
  | "DAY_VOTING"
  | "DAY_REVOTE"
  | "GAME_OVER";

export type MafiaSettings = {
  mafiaCount: number | "auto";
  hasDetective: boolean;
  hasDoctor: boolean;
  hasDon: boolean;
  hasMistress: boolean;
  mafiaTimerSec: number;
  donTimerSec: number;
  detectiveTimerSec: number;
  doctorTimerSec: number;
  dayTimerSec: number;
  votingTimerSec: number;
  voteTieMode: "revote" | "skip";
  voteVisibility: "public" | "anonymous";
  mode: "manual" | "timed";
};

export type NightActions = {
  mafiaTargetId?: string;
  mafiaVotes?: Votes;
  mafiaVoteDeadlineAt?: number;
  donCheckTargetId?: string;
  mistressTargetId?: string;
  detectiveTargetId?: string;
  doctorTargetId?: string;
};

export type Votes = Record<string, string>;

export type ChatMessage = {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  createdAt: number;
};

export type Player = {
  id: string;
  name: string;
  role?: Role;
  alive: boolean;
  connected: boolean;
  isHost: boolean;
  isBot?: boolean;
  isSpectator?: boolean;
};

export type Room = {
  code: string;
  gameId: "mafia";
  visibility: "private" | "public";
  hostId?: string;
  hostKey: string;
  phase: GamePhase;
  players: Player[];
  settings: MafiaSettings;
  nightActions: NightActions;
  votes: Votes;
  roleReady: Record<string, boolean>;
  discussionReady: Record<string, boolean>;
  runoffCandidateIds?: string[];
  chatMessages: ChatMessage[];
  createdAt: number;
  phaseDeadlineAt?: number;
  devMode?: boolean;
  lastNightKilledId?: string;
  lastVoteEliminatedId?: string;
  lastVoteEliminatedIds?: string[];
  detectiveResult?: {
    detectiveId: string;
    targetId: string;
    isMafia: boolean;
  };
  donCheckResult?: {
    donId: string;
    targetId: string;
    isDetective: boolean;
  };
  winner?: "CIVILIANS" | "MAFIA";
};

export type PublicPlayer = Omit<Player, "role"> & {
  role?: Role;
};

export type PublicRoom = Omit<Room, "hostKey" | "players" | "nightActions" | "detectiveResult" | "donCheckResult"> & {
  players: PublicPlayer[];
  ownPlayerId: string;
  ownRole?: Role;
  mafiaAllies: PublicPlayer[];
  detectiveResult?: Room["detectiveResult"];
  donCheckResult?: Room["donCheckResult"];
  nightActions?: NightActions;
};
