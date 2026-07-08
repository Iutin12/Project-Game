import { createEmptyBunkerRoom, advanceBunkerPhase, castBunkerVote, markBunkerReady, revealBunkerCard, resolveVoting, startBunkerGame } from "./logic";
import { bunkerCharacteristicCategories } from "./settings";
import type { BunkerRoomState } from "./types";

export function createBunkerTestRoom(playersCount = 6): BunkerRoomState {
  const room = createEmptyBunkerRoom("DEVBNK", "dev-host", "private", true);
  room.players = Array.from({ length: playersCount }, (_, index) => ({
    id: `bot_${index + 1}`,
    name: index === 0 ? "Тестовый хост" : `Бот ${index}`,
    connected: true,
    isHost: index === 0,
    isBot: index !== 0,
    status: "alive" as const
  }));
  room.hostId = room.players[0]?.id;
  return room;
}

export function simulateBunkerRevealRound(room: BunkerRoomState): BunkerRoomState {
  const category = room.currentRevealCategory ?? bunkerCharacteristicCategories.find((item) => item !== "profession") ?? "health";
  for (const player of room.players.filter((item) => item.status === "alive")) {
    revealBunkerCard(room, player.id, category);
  }
  return room;
}

export function simulateBunkerVoting(room: BunkerRoomState): BunkerRoomState {
  if (room.phase !== "VOTING" && room.phase !== "REVOTE") room.phase = "VOTING";
  const alive = room.players.filter((player) => player.status === "alive");
  const candidates = room.phase === "REVOTE" && room.revoteCandidateIds?.length
    ? alive.filter((player) => room.revoteCandidateIds?.includes(player.id))
    : alive;

  alive.forEach((player, index) => {
    const target = candidates[(index + 1) % candidates.length];
    if (target) castBunkerVote(room, player.id, target.id);
  });
  resolveVoting(room);
  return room;
}

export function simulateBunkerNextStep(room: BunkerRoomState): BunkerRoomState {
  if (room.phase === "LOBBY") startBunkerGame(room);
  else if (room.phase === "SCENARIO_REVEAL" || room.phase === "CHARACTER_PREVIEW") advanceBunkerPhase(room);
  else if (room.phase === "REVEAL_ROUND") {
    simulateBunkerRevealRound(room);
    for (const player of room.players.filter((item) => item.status === "alive" && !item.isBot)) {
      markBunkerReady(room, player.id);
    }
    advanceBunkerPhase(room);
  } else if (room.phase === "DISCUSSION" || room.phase === "SPECIAL_ACTIONS") advanceBunkerPhase(room);
  else if (room.phase === "VOTING" || room.phase === "REVOTE") simulateBunkerVoting(room);
  else if (room.phase === "VOTING_RESULT" || room.phase === "ELIMINATION") advanceBunkerPhase(room);
  return room;
}

export function simulateBunkerUntilGameOver(room: BunkerRoomState): BunkerRoomState {
  for (let step = 0; step < 80 && room.phase !== "GAME_OVER"; step += 1) {
    simulateBunkerNextStep(room);
  }
  return room;
}
