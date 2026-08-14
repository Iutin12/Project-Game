import { createServer } from "node:http";
import { Server } from "socket.io";
import { io as createClient, type Socket } from "socket.io-client";
import { createAliasRoom, registerAliasRoomSockets } from "../server/aliasRooms";
import {
  confirmAliasTurnResult,
  forceFinishAliasTurn,
  processAliasWord,
  setAliasPlayerReady,
  startAliasGame,
  startAliasTurn,
  toggleAliasTurnWord
} from "../src/games/alias/game";
import { getPublicAliasState } from "../src/games/alias/public-state";
import { createAliasTestRoom } from "../src/games/alias/simulation";
import type { PublicAliasRoomState } from "../src/games/alias/types";
import { aliasWords } from "../src/games/alias/words";

type Ack = { ok: boolean; error?: string; playerId?: string };

async function main() {
  verifyEngine();
  await verifyRealtimePrivacy();
  console.log(JSON.stringify({ ok: true, words: aliasWords.length, checks: ["engine", "review", "equal-turns", "realtime-secret", "double-click"] }));
}

function verifyEngine() {
  assert(aliasWords.length >= 400, "Word database is too small");
  assert(new Set(aliasWords.map((word) => word.word.toLocaleLowerCase("ru-RU"))).size === aliasWords.length, "Word database contains duplicates");

  const room = createAliasTestRoom(4);
  room.settings.targetScore = 1;
  room.settings.equalTurnsAtEnd = true;
  room.settings.lastWordMode = "disabled";
  room.settings.reviewWordsAfterTurn = true;
  room.players.forEach((player) => setAliasPlayerReady(room, player.id, true));
  startAliasGame(room);

  const firstExplainer = room.currentTurn!.explainerPlayerId;
  startAliasTurn(room, firstExplainer, 1_000);
  const firstWordId = room.currentTurn!.currentWordId!;
  const outsider = room.players.find((player) => player.id !== firstExplainer)!;
  assert(Boolean(getPublicAliasState(room, firstExplainer).currentTurn?.currentWord), "Explainer did not receive the secret word");
  assert(!getPublicAliasState(room, outsider.id).currentTurn?.currentWord, "Secret word leaked to another player");

  processAliasWord(room, firstExplainer, firstWordId, "guessed", 1_001);
  expectError(() => processAliasWord(room, firstExplainer, firstWordId, "guessed", 1_002), "Double click was accepted");
  forceFinishAliasTurn(room);
  const entry = room.currentTurn!.words[0];
  toggleAliasTurnWord(room, firstExplainer, entry.id);
  confirmAliasTurnResult(room, firstExplainer);
  assert(room.teams[0].score === 0, "Reviewed skipped word changed score incorrectly");
  assert(room.players.find((player) => player.id === firstExplainer)?.skippedWords === 1, "Reviewed word did not update player stats");

  const secondExplainer = room.currentTurn!.explainerPlayerId;
  startAliasTurn(room, secondExplainer, 2_000);
  forceFinishAliasTurn(room);
  confirmAliasTurnResult(room, secondExplainer);
  assert(room.phase === "TURN_PREPARE", "Game ended without a unique leader");

  const thirdExplainer = room.currentTurn!.explainerPlayerId;
  startAliasTurn(room, thirdExplainer, 3_000);
  processAliasWord(room, thirdExplainer, room.currentTurn!.currentWordId!, "guessed", 3_001);
  forceFinishAliasTurn(room);
  confirmAliasTurnResult(room, thirdExplainer);
  assert(room.phase === "TURN_PREPARE", "Equal-turn rule did not allow the other team to finish the cycle");

  const fourthExplainer = room.currentTurn!.explainerPlayerId;
  startAliasTurn(room, fourthExplainer, 4_000);
  forceFinishAliasTurn(room);
  confirmAliasTurnResult(room, fourthExplainer);
  const finalPhase: string = room.phase;
  assert(finalPhase === "GAME_OVER", "Score game did not finish after a complete cycle");
}

async function verifyRealtimePrivacy() {
  const httpServer = createServer();
  const io = new Server(httpServer, { path: "/socket.io" });
  registerAliasRoomSockets(io);
  await new Promise<void>((resolve) => httpServer.listen(0, "127.0.0.1", resolve));
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Test server address is unavailable");
  const url = `http://127.0.0.1:${address.port}`;
  const created = createAliasRoom("private");
  const clients = Array.from({ length: 4 }, () => createClient(url, { path: "/socket.io", transports: ["websocket"] }));
  const states = new Map<Socket, PublicAliasRoomState>();

  try {
    clients.forEach((client) => client.on("alias_room_updated", (state: PublicAliasRoomState) => states.set(client, state)));
    await Promise.all(clients.map((client) => waitForConnect(client)));
    const players = await Promise.all(clients.map((client, index) => emitAck(client, "join_alias_room", { code: created.code, name: `Игрок ${index + 1}`, hostKey: index === 0 ? created.hostKey : undefined })));
    players.forEach((ack) => assert(Boolean(ack.playerId), "Join did not return playerId"));
    await Promise.all(clients.map((client) => emitAck(client, "alias:ready", { ready: true })));
    await emitAck(clients[0], "alias:start_game", {});
    await waitFor(() => states.get(clients[0])?.phase === "TURN_PREPARE");
    const prepare = states.get(clients[0])!;
    const explainerIndex = players.findIndex((ack) => ack.playerId === prepare.currentTurn?.explainerPlayerId);
    assert(explainerIndex >= 0, "Current explainer client was not found");
    await emitAck(clients[explainerIndex], "alias:ready_turn", {});
    await waitFor(() => states.get(clients[explainerIndex])?.phase === "TURN_ACTIVE" && Boolean(states.get(clients[explainerIndex])?.currentTurn?.currentWord));
    clients.forEach((client, index) => {
      const hasSecret = Boolean(states.get(client)?.currentTurn?.currentWord);
      assert(hasSecret === (index === explainerIndex), "Realtime secret word visibility is incorrect");
    });
    const wordId = states.get(clients[explainerIndex])!.currentTurn!.currentWord!.id;
    await emitAck(clients[explainerIndex], "alias:word_guessed", { wordId });
    const duplicate = await emitAck(clients[explainerIndex], "alias:word_guessed", { wordId }, false);
    assert(!duplicate.ok, "Realtime duplicate word action was accepted");
  } finally {
    clients.forEach((client) => client.disconnect());
    await new Promise<void>((resolve) => io.close(() => resolve()));
    await new Promise<void>((resolve) => httpServer.close(() => resolve()));
  }
}

function emitAck(socket: Socket, event: string, payload: unknown, requireSuccess = true) {
  return new Promise<Ack>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Ack timeout: ${event}`)), 2_000);
    socket.emit(event, payload, (ack: Ack) => {
      clearTimeout(timeout);
      if (requireSuccess && !ack.ok) reject(new Error(`${event}: ${ack.error}`));
      else resolve(ack);
    });
  });
}

function waitForConnect(socket: Socket) {
  if (socket.connected) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error("Socket connection timeout")), 2_000);
    socket.once("connect", () => { clearTimeout(timeout); resolve(); });
  });
}

async function waitFor(check: () => boolean) {
  const started = Date.now();
  while (!check()) {
    if (Date.now() - started > 2_000) throw new Error("State update timeout");
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
}

function expectError(action: () => void, message: string) {
  try { action(); } catch { return; }
  throw new Error(message);
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
