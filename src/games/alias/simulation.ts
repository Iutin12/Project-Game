import { randomUUID } from "node:crypto";
import { createAliasRoomState, rebalanceAliasTeams } from "./game";
import type { AliasPlayer } from "./types";

export function createAliasTestRoom(playersCount = 6) {
  const room = createAliasRoomState({ code: "ALIDEV", hostKey: "alias-dev-host", visibility: "private", devMode: true });
  room.players = Array.from({ length: Math.max(4, Math.min(20, playersCount)) }, (_, index): AliasPlayer => ({
    id: randomUUID(),
    name: index === 0 ? "Тестовый хост" : `Бот ${index}`,
    connected: true,
    isHost: index === 0,
    isBot: index !== 0,
    ready: false,
    explainedWords: 0,
    guessedWords: 0,
    skippedWords: 0
  }));
  room.hostId = room.players[0]?.id;
  rebalanceAliasTeams(room);
  return room;
}
