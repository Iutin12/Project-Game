import { randomBytes, timingSafeEqual } from "node:crypto";

const reconnectTokens = new Map<string, string>();

function getKey(gameId: string, roomCode: string, playerId: string) {
  return `${gameId}:${roomCode}:${playerId}`;
}

export function createReconnectToken(gameId: string, roomCode: string, playerId: string) {
  const token = randomBytes(32).toString("base64url");
  reconnectTokens.set(getKey(gameId, roomCode, playerId), token);
  return token;
}

export function verifyReconnectToken(gameId: string, roomCode: string, playerId: string, candidate?: string) {
  if (!candidate || candidate.length > 128) return false;
  const token = reconnectTokens.get(getKey(gameId, roomCode, playerId));
  if (!token || token.length !== candidate.length) return false;
  return timingSafeEqual(Buffer.from(token), Buffer.from(candidate));
}

export function removeRoomSessions(gameId: string, roomCode: string) {
  const prefix = `${gameId}:${roomCode}:`;
  for (const key of reconnectTokens.keys()) {
    if (key.startsWith(prefix)) reconnectTokens.delete(key);
  }
}
