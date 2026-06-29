export type Role = "CIVILIAN" | "MAFIA" | "DETECTIVE" | "DOCTOR";

export type GamePhase =
  | "LOBBY"
  | "ROLE_REVEAL"
  | "NIGHT_MAFIA"
  | "NIGHT_DETECTIVE"
  | "NIGHT_DOCTOR"
  | "DAY_DISCUSSION"
  | "DAY_VOTING"
  | "GAME_OVER";

export type MafiaSettings = {
  mafiaCount: number | "auto";
  hasDetective: boolean;
  hasDoctor: boolean;
  dayTimerSec: number;
  votingTimerSec: number;
  mode: "manual_host";
};

export type NightActions = {
  mafiaTargetId?: string;
  detectiveTargetId?: string;
  doctorTargetId?: string;
};

export type Votes = Record<string, string>;

export type Player = {
  id: string;
  name: string;
  role?: Role;
  alive: boolean;
  connected: boolean;
  isHost: boolean;
};

export type Room = {
  code: string;
  gameId: "mafia";
  hostId?: string;
  hostKey: string;
  phase: GamePhase;
  players: Player[];
  settings: MafiaSettings;
  nightActions: NightActions;
  votes: Votes;
  createdAt: number;
  lastNightKilledId?: string;
  lastVoteEliminatedId?: string;
  detectiveResult?: {
    detectiveId: string;
    targetId: string;
    isMafia: boolean;
  };
  winner?: "CIVILIANS" | "MAFIA";
};

export type PublicPlayer = Omit<Player, "role"> & {
  role?: Role;
};

export type PublicRoom = Omit<Room, "hostKey" | "players" | "nightActions" | "detectiveResult"> & {
  players: PublicPlayer[];
  ownPlayerId: string;
  ownRole?: Role;
  mafiaAllies: PublicPlayer[];
  detectiveResult?: Room["detectiveResult"];
  nightActions?: NightActions;
};
