import { confirmSpyRole, createSpyRoomState, setSpyPlayerReady, startSpyGame, viewSpyRole } from "./logic";
import type { SpyPlayer, SpyRoomState } from "./types";

export function createSpyTestRoom(botCount = 5): SpyRoomState {
  const room = createSpyRoomState({ code: "SPYDEV", hostKey: "spy-dev-host", visibility: "private", devMode: true });
  room.players = Array.from({ length: Math.max(3, botCount) }, (_, index): SpyPlayer => ({
    id: `spy-bot-${index + 1}`,
    name: index === 0 ? "Вы" : `Бот ${index}`,
    connected: true,
    isHost: index === 0,
    isBot: index > 0,
    ready: false,
    score: 0
  }));
  room.hostId = room.players[0].id;
  return room;
}

export function autoStartSpyTestRoom(room: SpyRoomState) {
  room.players.forEach((player) => setSpyPlayerReady(room, player.id, true));
  startSpyGame(room);
}

export function autoConfirmSpyRoles(room: SpyRoomState) {
  room.players.filter((player) => player.connected || player.isBot).forEach((player) => viewSpyRole(room, player.id));
  room.players.filter((player) => player.connected || player.isBot).forEach((player) => confirmSpyRole(room, player.id));
}
