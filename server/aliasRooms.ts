import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import { createReconnectToken, removeRoomSessions, verifyReconnectToken } from "./playerSessions";
import { trackCompletedGame } from "./completionStats";
import {
  confirmAliasTurnResult,
  createAliasRoomState,
  forceFinishAliasTurn,
  getAliasStartError,
  handleAliasDeadline,
  moveAliasPlayer,
  processAliasWord,
  rebalanceAliasTeams,
  reassignAliasLastWord,
  replaceAliasExplainer,
  resetAliasRoomToLobby,
  resolveAliasLastWord,
  selectAliasTeam,
  setAliasPlayerReady,
  startAliasGame,
  startAliasTurn,
  syncAliasTeams,
  toggleAliasTurnWord
} from "../src/games/alias/game";
import { getPublicAliasState } from "../src/games/alias/public-state";
import { sanitizeAliasSettings } from "../src/games/alias/settings";
import { createAliasTestRoom } from "../src/games/alias/simulation";
import type { AliasChatMessage, AliasPlayer, AliasRoomState, AliasSettings } from "../src/games/alias/types";

export type PublicAliasLobbyRoom = {
  code: string;
  gameId: "alias";
  phase: AliasRoomState["phase"];
  phaseLabel: string;
  title: string;
  playersCount: number;
  maxPlayers: number;
  hostName?: string;
  createdAt: number;
};

type SocketPlayerRef = { roomCode: string; playerId: string };
type ActionResult = { ok: boolean; error?: string; [key: string]: unknown };

const rooms = new Map<string, AliasRoomState>();
const socketPlayers = new Map<string, SocketPlayerRef>();
const hostDisconnectedAt = new Map<string, number>();
let totalRoomsCreatedToday = 0;
let statsDay = new Date().toDateString();
let roomWatcher: ReturnType<typeof setInterval> | undefined;

export function createAliasRoom(visibility: AliasRoomState["visibility"] = "private") {
  refreshStatsDay();
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  const room = createRoom(code, randomUUID(), visibility);
  rooms.set(code, room);
  totalRoomsCreatedToday += 1;
  return { code, hostKey: room.hostKey };
}

export function createDevAliasRoom(playersCount = 6) {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  const room = createAliasTestRoom(playersCount);
  room.code = code;
  room.hostKey = randomUUID();
  rooms.set(code, room);
  return { code, hostKey: room.hostKey, playerId: room.players[0]?.id };
}

export function getAliasRoom(code: string) {
  return rooms.get(code.toUpperCase());
}

export function getAliasRoomCount() {
  return rooms.size;
}

export function getAliasRoomInfo(code: string) {
  const room = getAliasRoom(code);
  return room ? { code: room.code, gameId: room.gameId, phase: room.phase } : undefined;
}

export function getAliasStats() {
  refreshStatsDay();
  const gameRooms = [...rooms.values()].filter((room) => !room.devMode);
  const publicRooms = gameRooms.filter((room) => room.visibility === "public" && room.phase === "LOBBY" && room.players.some((player) => player.connected && !player.isBot));
  return {
    roomsCreatedToday: totalRoomsCreatedToday,
    activeRooms: gameRooms.length,
    onlinePlayers: gameRooms.reduce((sum, room) => sum + room.players.filter((player) => player.connected && !player.isBot).length, 0),
    publicRooms: publicRooms.map(toPublicLobbyRoom)
  };
}

export function registerAliasRoomSockets(io: Server) {
  if (!roomWatcher) {
    roomWatcher = setInterval(() => {
      const now = Date.now();
      for (const room of rooms.values()) {
        if (handleAliasDeadline(room, now)) emitRoom(io, room.code);
        transferDisconnectedHost(room, now);
        if (shouldDeleteRoom(room, now)) deleteRoom(room.code);
      }
    }, 250);
    roomWatcher.unref();
  }

  io.on("connection", (socket) => {
    socket.on("join_alias_room", (payload: { code: string; name: string; hostKey?: string; playerId?: string; reconnectToken?: string }, ack) => {
      const room = getAliasRoom(payload.code);
      const name = cleanName(payload.name);
      if (!room) return ack?.({ ok: false, error: "Комната не найдена" });

      const existing = payload.playerId ? room.players.find((player) => player.id === payload.playerId && !player.isBot) : undefined;
      if (existing && verifyReconnectToken("alias", room.code, existing.id, payload.reconnectToken)) {
        existing.connected = true;
        room.lastActivityAt = Date.now();
        socketPlayers.set(socket.id, { roomCode: room.code, playerId: existing.id });
        socket.join(room.code);
        ack?.({ ok: true, playerId: existing.id, reconnectToken: createReconnectToken("alias", room.code, existing.id) });
        emitRoom(io, room.code);
        return;
      }

      if (existing) return ack?.({ ok: false, error: "Не удалось подтвердить сессию игрока. Войдите под новым никнеймом." });

      if (room.phase !== "LOBBY") return ack?.({ ok: false, error: "Игра уже началась. Вернуться можно только за прежнего игрока." });
      if (!name) return ack?.({ ok: false, error: "Введите никнейм" });
      if (hasDuplicatePlayerName(room, name)) return ack?.({ ok: false, error: "Игрок с таким никнеймом уже есть в комнате" });
      if (room.players.filter((player) => !player.isBot).length >= room.settings.maxPlayers) return ack?.({ ok: false, error: "Комната заполнена" });

      const player: AliasPlayer = {
        id: randomUUID(),
        name,
        connected: true,
        isHost: payload.hostKey === room.hostKey || !room.hostId,
        ready: false,
        explainedWords: 0,
        guessedWords: 0,
        skippedWords: 0
      };
      if (player.isHost) assignHost(room, player.id);
      room.players.push(player);
      if (room.settings.autoAssignTeams) rebalanceAliasTeams(room);
      room.lastActivityAt = Date.now();
      socketPlayers.set(socket.id, { roomCode: room.code, playerId: player.id });
      socket.join(room.code);
      ack?.({ ok: true, playerId: player.id, reconnectToken: createReconnectToken("alias", room.code, player.id) });
      emitRoom(io, room.code);
    });

    socket.on("alias:update_settings", (payload: Partial<AliasSettings>, ack) => {
      const result = withHostRoom(socket, (room) => {
        assertLobby(room);
        room.settings = sanitizeAliasSettings(payload, room.settings);
        syncAliasTeams(room);
        room.players.forEach((player) => { player.ready = false; });
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:ready", (payload: { ready?: boolean }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => setAliasPlayerReady(room, player.id, payload?.ready ?? !player.ready));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:select_team", (payload: { teamId: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => selectAliasTeam(room, player.id, payload.teamId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:move_player", (payload: { playerId: string; teamId: string }, ack) => {
      const result = withHostRoom(socket, (room) => moveAliasPlayer(room, payload.playerId, payload.teamId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:start_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => startAliasGame(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:ready_turn", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => startAliasTurn(room, player.id));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:word_guessed", (payload: { wordId: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => processAliasWord(room, player.id, payload.wordId, "guessed"));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:word_skipped", (payload: { wordId: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => processAliasWord(room, player.id, payload.wordId, "skipped"));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:last_word_result", (payload: { teamId?: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => resolveAliasLastWord(room, player.id, payload.teamId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:reassign_last_word", (payload: { teamId?: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => reassignAliasLastWord(room, player.id, payload.teamId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:toggle_turn_word", (payload: { entryId: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => toggleAliasTurnWord(room, player.id, payload.entryId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:confirm_turn_result", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => confirmAliasTurnResult(room, player.id));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:force_finish_turn", (_, ack) => {
      const result = withHostRoom(socket, (room) => forceFinishAliasTurn(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:replace_explainer", (payload: { playerId?: string }, ack) => {
      const result = withHostRoom(socket, (room) => replaceAliasExplainer(room, payload.playerId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:return_to_lobby", (_, ack) => {
      const result = withHostRoom(socket, (room) => resetAliasRoomToLobby(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:transfer_host", (payload: { playerId: string }, ack) => {
      const result = withHostRoom(socket, (room) => {
        if (!room.players.some((player) => player.id === payload.playerId && player.connected)) throw new Error("Игрок не найден или не в сети.");
        assignHost(room, payload.playerId);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:kick_player", (payload: { playerId: string }, ack) => {
      const result = withHostRoom(socket, (room, host) => {
        assertLobby(room);
        if (host.id === payload.playerId) throw new Error("Нельзя удалить себя.");
        room.players = room.players.filter((player) => player.id !== payload.playerId);
        syncAliasTeams(room);
        disconnectPlayerSockets(io, room.code, payload.playerId);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("send_alias_chat_message", (payload: { text: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        const text = payload.text?.trim().slice(0, 280);
        if (!text) throw new Error("Введите сообщение.");
        const message: AliasChatMessage = { id: randomUUID(), playerId: player.id, playerName: player.name, text, createdAt: Date.now() };
        room.chatMessages = [...room.chatMessages.slice(-99), message];
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:leave_room", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => leaveAliasRoom(io, socket, room, player));
      ack?.(result);
    });

    socket.on("alias:dev_add_bot", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        assertDevRoom(room);
        assertLobby(room);
        if (room.players.length >= room.settings.maxPlayers) throw new Error("Комната заполнена.");
        room.players.push(createBot(room));
        syncAliasTeams(room);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:dev_remove_bot", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        assertDevRoom(room);
        assertLobby(room);
        const index = room.players.findLastIndex((player) => player.isBot);
        if (index < 0) throw new Error("Ботов больше нет.");
        room.players.splice(index, 1);
        syncAliasTeams(room);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:dev_next", (_, ack) => {
      const result = withHostRoom(socket, (room) => simulateNextDevPhase(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:dev_guess", (_, ack) => {
      const result = withHostRoom(socket, (room) => simulateDevWord(room, "guessed"));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:dev_skip", (_, ack) => {
      const result = withHostRoom(socket, (room) => simulateDevWord(room, "skipped"));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:dev_expire", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        assertDevRoom(room);
        if (room.phase !== "TURN_ACTIVE" || !room.currentTurn?.deadlineAt) throw new Error("Активного таймера нет.");
        handleAliasDeadline(room, room.currentTurn.deadlineAt + 1);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("alias:dev_finish_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => simulateDevGame(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("disconnect", () => {
      const ref = socketPlayers.get(socket.id);
      socketPlayers.delete(socket.id);
      if (!ref || hasActiveSocketForPlayer(ref.roomCode, ref.playerId)) return;
      const room = rooms.get(ref.roomCode);
      const player = room?.players.find((item) => item.id === ref.playerId);
      if (!room || !player) return;
      player.connected = false;
      room.lastActivityAt = Date.now();
      if (player.isHost) hostDisconnectedAt.set(room.code, Date.now());
      emitRoom(io, room.code);
    });
  });
}

function createRoom(code: string, hostKey: string, visibility: AliasRoomState["visibility"]) {
  return createAliasRoomState({ code, hostKey, visibility });
}

function withPlayerRoom(socket: Socket, action: (room: AliasRoomState, player: AliasPlayer) => void): ActionResult {
  const ref = socketPlayers.get(socket.id);
  const room = ref ? rooms.get(ref.roomCode) : undefined;
  const player = ref ? room?.players.find((item) => item.id === ref.playerId) : undefined;
  if (!room || !player) return { ok: false, error: "Игрок не найден в комнате" };
  try {
    action(room, player);
    room.lastActivityAt = Date.now();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Не удалось выполнить действие" };
  }
}

function withHostRoom(socket: Socket, action: (room: AliasRoomState, player: AliasPlayer) => void): ActionResult {
  return withPlayerRoom(socket, (room, player) => {
    if (!player.isHost) throw new Error("Действие доступно только хосту.");
    action(room, player);
  });
}

function emitOwnRoom(io: Server, socket: Socket) {
  const ref = socketPlayers.get(socket.id);
  if (ref) emitRoom(io, ref.roomCode);
}

function emitRoom(io: Server, roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  if (!room.devMode) trackCompletedGame(room);
  for (const socketId of io.sockets.adapter.rooms.get(roomCode) ?? []) {
    const socket = io.sockets.sockets.get(socketId);
    if (!socket) continue;
    const ref = socketPlayers.get(socket.id);
    if (ref?.roomCode === roomCode) socket.emit("alias_room_updated", getPublicAliasState(room, ref.playerId));
  }
}

function leaveAliasRoom(io: Server, socket: Socket, room: AliasRoomState, player: AliasPlayer) {
  socketPlayers.delete(socket.id);
  socket.leave(room.code);
  if (room.phase === "LOBBY") {
    room.players = room.players.filter((item) => item.id !== player.id);
    syncAliasTeams(room);
  } else {
    player.connected = false;
  }
  if (room.hostId === player.id) transferHostNow(room);
  room.lastActivityAt = Date.now();
  emitRoom(io, room.code);
}

function transferDisconnectedHost(room: AliasRoomState, now: number) {
  const disconnectedAt = hostDisconnectedAt.get(room.code);
  if (!disconnectedAt || now - disconnectedAt < 15_000) return;
  const host = room.players.find((player) => player.id === room.hostId);
  if (host?.connected) {
    hostDisconnectedAt.delete(room.code);
    return;
  }
  transferHostNow(room);
}

function transferHostNow(room: AliasRoomState) {
  const nextHost = room.players.find((player) => player.connected && !player.isBot) ?? room.players.find((player) => player.connected);
  room.players.forEach((player) => { player.isHost = player.id === nextHost?.id; });
  room.hostId = nextHost?.id;
  hostDisconnectedAt.delete(room.code);
}

function assignHost(room: AliasRoomState, playerId: string) {
  room.players.forEach((player) => { player.isHost = player.id === playerId; });
  room.hostId = playerId;
  hostDisconnectedAt.delete(room.code);
}

function disconnectPlayerSockets(io: Server, roomCode: string, playerId: string) {
  for (const [socketId, ref] of socketPlayers) {
    if (ref.roomCode !== roomCode || ref.playerId !== playerId) continue;
    socketPlayers.delete(socketId);
    io.sockets.sockets.get(socketId)?.leave(roomCode);
    io.sockets.sockets.get(socketId)?.emit("alias:kicked");
  }
}

function simulateNextDevPhase(room: AliasRoomState) {
  assertDevRoom(room);
  if (room.phase === "LOBBY") {
    room.players.forEach((player) => setAliasPlayerReady(room, player.id, true));
    const error = getAliasStartError(room);
    if (error) throw new Error(error);
    startAliasGame(room);
  } else if (room.phase === "TURN_PREPARE") {
    startAliasTurn(room, room.currentTurn!.explainerPlayerId);
  } else if (room.phase === "TURN_ACTIVE") {
    simulateDevWord(room, "guessed");
  } else if (room.phase === "LAST_WORD") {
    resolveAliasLastWord(room, room.currentTurn!.explainerPlayerId);
  } else if (room.phase === "TURN_RESULT") {
    confirmAliasTurnResult(room, room.currentTurn!.explainerPlayerId);
  } else if (room.phase === "GAME_OVER") {
    resetAliasRoomToLobby(room);
  }
}

function simulateDevWord(room: AliasRoomState, result: "guessed" | "skipped") {
  assertDevRoom(room);
  if (room.phase !== "TURN_ACTIVE") throw new Error("Сейчас нет активного слова.");
  const turn = room.currentTurn!;
  processAliasWord(room, turn.explainerPlayerId, turn.currentWordId!, result);
}

function simulateDevGame(room: AliasRoomState) {
  assertDevRoom(room);
  if (room.phase === "LOBBY") {
    room.settings.gameEndMode = "score";
    room.settings.targetScore = 2;
    room.settings.equalTurnsAtEnd = true;
    room.settings.reviewWordsAfterTurn = false;
    room.settings.lastWordMode = "disabled";
    room.players.forEach((player) => setAliasPlayerReady(room, player.id, true));
    startAliasGame(room);
  }
  let guard = 0;
  while (room.phase !== "GAME_OVER" && guard < 100) {
    if (room.phase === "TURN_PREPARE") startAliasTurn(room, room.currentTurn!.explainerPlayerId);
    else if (room.phase === "TURN_ACTIVE") {
      const isFirstTeam = room.currentTurn!.teamId === room.teams[0].id;
      if (isFirstTeam) {
        simulateDevWord(room, "guessed");
        simulateDevWord(room, "guessed");
      }
      forceFinishAliasTurn(room);
    } else if (room.phase === "LAST_WORD") resolveAliasLastWord(room, room.currentTurn!.explainerPlayerId);
    else if (room.phase === "TURN_RESULT") confirmAliasTurnResult(room, room.currentTurn!.explainerPlayerId);
    guard += 1;
  }
  if (room.phase !== "GAME_OVER") throw new Error("Не удалось завершить тестовую игру.");
}

function createBot(room: AliasRoomState): AliasPlayer {
  const number = room.players.filter((player) => player.isBot).length + 1;
  return { id: randomUUID(), name: `Бот ${number}`, connected: true, isHost: false, isBot: true, ready: false, explainedWords: 0, guessedWords: 0, skippedWords: 0 };
}

function shouldDeleteRoom(room: AliasRoomState, now: number) {
  if (room.players.some((player) => player.connected && !player.isBot)) return false;
  return now - room.lastActivityAt > 30 * 60 * 1000;
}

function deleteRoom(code: string) {
  rooms.delete(code);
  removeRoomSessions("alias", code);
  hostDisconnectedAt.delete(code);
  for (const [socketId, ref] of socketPlayers) if (ref.roomCode === code) socketPlayers.delete(socketId);
}

function hasDuplicatePlayerName(room: AliasRoomState, name: string) {
  const normalized = normalizeName(name);
  return room.players.some((player) => normalizeName(player.name) === normalized);
}

function cleanName(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 24) : "";
}

function normalizeName(name: string) {
  return cleanName(name).toLocaleLowerCase("ru-RU");
}

function hasActiveSocketForPlayer(roomCode: string, playerId: string) {
  return [...socketPlayers.values()].some((ref) => ref.roomCode === roomCode && ref.playerId === playerId);
}

function toPublicLobbyRoom(room: AliasRoomState): PublicAliasLobbyRoom {
  const connected = room.players.filter((player) => player.connected && !player.isBot);
  const host = room.players.find((player) => player.id === room.hostId);
  return { code: room.code, gameId: room.gameId, phase: room.phase, phaseLabel: getPhaseLabel(room.phase), title: "Элиас", playersCount: connected.length, maxPlayers: room.settings.maxPlayers, hostName: host?.name, createdAt: room.createdAt };
}

function getPhaseLabel(phase: AliasRoomState["phase"]) {
  if (phase === "LOBBY") return "Лобби";
  if (phase === "TURN_PREPARE") return "Подготовка";
  if (phase === "TURN_ACTIVE") return "Ход идет";
  if (phase === "LAST_WORD") return "Последнее слово";
  if (phase === "TURN_RESULT") return "Итоги хода";
  return "Финал";
}

function assertLobby(room: AliasRoomState) {
  if (room.phase !== "LOBBY") throw new Error("Действие доступно только в лобби.");
}

function assertDevRoom(room: AliasRoomState) {
  if (!room.devMode) throw new Error("Комната не находится в dev-режиме.");
}

function makeRoomCode() {
  return randomUUID().replaceAll("-", "").slice(0, 12).toUpperCase();
}

function refreshStatsDay() {
  const today = new Date().toDateString();
  if (today === statsDay) return;
  statsDay = today;
  totalRoomsCreatedToday = 0;
}
