import { phaseOrder } from "./phases";
import type { GamePhase, NightActions, Player, Role, Room, Votes } from "./types";

export const defaultMafiaSettings = {
  mafiaCount: "auto",
  hasDetective: true,
  hasDoctor: true,
  hasDon: false,
  hasMistress: false,
  dayTimerSec: 300,
  votingTimerSec: 60,
  mode: "manual_host"
} as const;

export function getMafiaCount(playerCount: number, setting: number | "auto") {
  return setting === "auto" ? Math.max(1, Math.floor(playerCount / 4)) : setting;
}

export function assignRoles(players: Player[], room: Room): Player[] {
  const activePlayers = players.filter((player) => !player.isSpectator);
  const mafiaCount = getMafiaCount(activePlayers.length, room.settings.mafiaCount);
  const mafiaKillerRoles: Role[] = room.settings.hasDon ? ["DON"] : [];

  while (mafiaKillerRoles.length < mafiaCount) {
    mafiaKillerRoles.push("MAFIA");
  }

  const roles: Role[] = [
    ...mafiaKillerRoles,
    ...(room.settings.hasMistress ? (["MISTRESS"] as Role[]) : []),
    ...(room.settings.hasDetective ? (["DETECTIVE"] as Role[]) : []),
    ...(room.settings.hasDoctor ? (["DOCTOR"] as Role[]) : [])
  ];

  while (roles.length < activePlayers.length) {
    roles.push("CIVILIAN");
  }

  const shuffledRoles = shuffle(roles).slice(0, activePlayers.length);
  const roleByPlayerId = new Map(
    shuffle(activePlayers).map((player, index) => [player.id, shuffledRoles[index]])
  );

  return players.map((player) => ({
    ...player,
    alive: true,
    role: player.isSpectator ? undefined : roleByPlayerId.get(player.id)
  }));
}

export function getNextPhase(room: Room): GamePhase {
  if (room.phase === "LOBBY") return "ROLE_REVEAL";
  if (room.phase === "GAME_OVER") return "GAME_OVER";

  const currentIndex = phaseOrder.indexOf(room.phase);
  if (currentIndex === -1) return "NIGHT_MAFIA";
  if (room.phase === "DAY_VOTING") return getNextEnabledPhase(room, "NIGHT_MAFIA");

  return getNextEnabledPhase(room, phaseOrder[currentIndex + 1] ?? "NIGHT_MAFIA");
}

export function resolveNight(players: Player[], actions: NightActions) {
  let killedId: string | undefined;
  const mafiaTarget = actions.mafiaTargetId;

  if (mafiaTarget && mafiaTarget !== actions.doctorTargetId) {
    killedId = mafiaTarget;
  }

  return {
    killedId,
    players: players.map((player) => (player.id === killedId ? { ...player, alive: false } : player))
  };
}

export function resolveVotes(players: Player[], votes: Votes) {
  const tally = new Map<string, number>();
  const activePlayerIds = new Set(players.filter((player) => player.alive && !player.isSpectator).map((player) => player.id));

  for (const [voterId, targetId] of Object.entries(votes)) {
    if (!activePlayerIds.has(voterId) || !activePlayerIds.has(targetId)) continue;
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }

  const sorted = [...tally.entries()].sort((a, b) => b[1] - a[1]);
  const [leader, runnerUp] = sorted;
  const eliminatedId = leader && (!runnerUp || leader[1] > runnerUp[1]) ? leader[0] : undefined;

  return {
    eliminatedId,
    players: players.map((player) => (player.id === eliminatedId ? { ...player, alive: false } : player))
  };
}

export function checkWinner(players: Player[]) {
  const alive = players.filter((player) => player.alive && !player.isSpectator);
  const aliveMafiaCount = alive.filter((player) => isMafiaRole(player.role)).length;
  const aliveNonMafiaCount = alive.length - aliveMafiaCount;

  if (aliveMafiaCount === 0) return "CIVILIANS";
  if (aliveMafiaCount >= aliveNonMafiaCount) return "MAFIA";
  return undefined;
}

export function isMafiaRole(role?: Role) {
  return role === "MAFIA" || role === "DON" || role === "MISTRESS";
}

function getNextEnabledPhase(room: Room, phase: GamePhase): GamePhase {
  const nextIndex = phaseOrder.indexOf(phase);
  const orderedPhases = nextIndex === -1 ? phaseOrder : phaseOrder.slice(nextIndex);

  for (const nextPhase of orderedPhases) {
    if (nextPhase === "NIGHT_DETECTIVE" && !room.settings.hasDetective) continue;
    if (nextPhase === "NIGHT_DOCTOR" && !room.settings.hasDoctor) continue;
    return nextPhase;
  }

  return "NIGHT_MAFIA";
}

function shuffle<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}
