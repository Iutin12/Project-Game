import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import {
  advanceBunkerPhase,
  allAliveReady,
  castBunkerVote,
  createEmptyBunkerRoom,
  finishBunkerGame,
  markBunkerReady,
  restartBunkerGame,
  revealBunkerCard,
  startBunkerGame,
  useBunkerSpecialCard
} from "../src/games/bunker/logic";
import { getPublicBunkerState } from "../src/games/bunker/public-state";
import { defaultBunkerSettings } from "../src/games/bunker/settings";
import type { BunkerCardCategory, BunkerChatMessage, BunkerPlayer, BunkerRoomState, BunkerSettings } from "../src/games/bunker/types";

export type PublicBunkerLobbyRoom = {
  code: string;
  gameId: "bunker";
  phase: BunkerRoomState["phase"];
  phaseLabel: string;
  title: string;
  playersCount: number;
  maxPlayers: number;
  hostName?: string;
  createdAt: number;
};

const rooms = new Map<string, BunkerRoomState>();
const socketPlayers = new Map<string, { roomCode: string; playerId: string }>();
let totalRoomsCreatedToday = 0;
let statsDay = new Date().toDateString();

export function createBunkerRoom(visibility: BunkerRoomState["visibility"] = "private") {
  refreshStatsDay();
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  const room = createEmptyBunkerRoom(code, randomUUID(), visibility);
  rooms.set(code, room);
  totalRoomsCreatedToday += 1;
  return { code, hostKey: room.hostKey };
}

export function createDevBunkerRoom(playersCount = 6) {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  const room = createEmptyBunkerRoom(code, randomUUID(), "private", true);
  room.players = Array.from({ length: playersCount }, (_, index) => ({
    id: randomUUID(),
    name: index === 0 ? "Тестовый хост" : `Бот ${index}`,
    connected: true,
    isHost: index === 0,
    isBot: index !== 0,
    status: "alive"
  }));
  room.hostId = room.players[0]?.id;
  rooms.set(code, room);
  return { code, hostKey: room.hostKey };
}

export function getBunkerRoom(code: string) {
  return rooms.get(code.toUpperCase());
}

export function getBunkerRoomInfo(code: string) {
  const room = getBunkerRoom(code);
  return room ? { code: room.code, gameId: room.gameId, phase: room.phase } : undefined;
}

export function getBunkerStats() {
  refreshStatsDay();
  const gameRooms = [...rooms.values()].filter((room) => !room.devMode);
  const publicRooms = gameRooms.filter((room) => {
    const connectedPlayers = room.players.filter((player) => player.connected && !player.isBot);
    return room.visibility === "public" && room.phase === "LOBBY" && connectedPlayers.length > 0;
  });
  return {
    roomsCreatedToday: totalRoomsCreatedToday,
    activeRooms: gameRooms.length,
    onlinePlayers: gameRooms.reduce((total, room) => total + room.players.filter((player) => player.connected && !player.isBot).length, 0),
    publicRooms: publicRooms.map(toPublicLobbyRoom)
  };
}

export function registerBunkerRoomSockets(io: Server) {
  io.on("connection", (socket) => {
    socket.on("join_bunker_room", (payload: { code: string; name: string; hostKey?: string; playerId?: string }, ack) => {
      const room = getBunkerRoom(payload.code);
      const name = payload.name?.trim().slice(0, 24);
      if (!room) return ack?.({ ok: false, error: "Комната не найдена" });

      const existingPlayer = payload.playerId ? room.players.find((player) => player.id === payload.playerId && !player.isBot) : undefined;
      if (existingPlayer) {
        existingPlayer.connected = true;
        if (payload.hostKey === room.hostKey) {
          existingPlayer.isHost = true;
          room.hostId = existingPlayer.id;
        }
        socketPlayers.set(socket.id, { roomCode: room.code, playerId: existingPlayer.id });
        socket.join(room.code);
        ack?.({ ok: true, playerId: existingPlayer.id });
        emitRoom(io, room.code);
        return;
      }

      if (!name) return ack?.({ ok: false, error: "Введите никнейм" });
      if (hasDuplicatePlayerName(room, name)) return ack?.({ ok: false, error: "Игрок с таким никнеймом уже есть в комнате" });
      if (room.players.length >= room.settings.maxPlayers) return ack?.({ ok: false, error: "Комната заполнена" });

      const player: BunkerPlayer = {
        id: randomUUID(),
        name,
        connected: true,
        isHost: payload.hostKey === room.hostKey || (!room.hostId && room.players.length === 0),
        status: "alive"
      };
      if (player.isHost) room.hostId = player.id;
      room.players.push(player);
      socketPlayers.set(socket.id, { roomCode: room.code, playerId: player.id });
      socket.join(room.code);
      ack?.({ ok: true, playerId: player.id });
      emitRoom(io, room.code);
    });

    socket.on("bunker:update_settings", (payload: Partial<BunkerSettings>, ack) => {
      const result = withHostRoom(socket, (room) => {
        if (room.phase !== "LOBBY") return { ok: false, error: "Настройки можно менять только в лобби" };
        room.settings = { ...room.settings, ...sanitizeSettings(payload) };
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("bunker:start_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => startBunkerGame(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("bunker:ready", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        markBunkerReady(room, player.id);
        if (allAliveReady(room)) advanceBunkerPhase(room);
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("bunker:next_phase", (_, ack) => {
      const result = withHostRoom(socket, (room) => advanceBunkerPhase(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("bunker:reveal_card", (payload: { category: BunkerCardCategory }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => revealBunkerCard(room, player.id, payload.category));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("bunker:cast_vote", (payload: { targetId: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => castBunkerVote(room, player.id, payload.targetId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("bunker:use_special_card", (payload: { cardId: string; targetPlayerId?: string; category?: BunkerCardCategory }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => useBunkerSpecialCard(room, player.id, payload.cardId, payload.targetPlayerId, payload.category));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("bunker:finish_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        finishBunkerGame(room);
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("bunker:restart_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => restartBunkerGame(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("send_bunker_chat_message", (payload: { text: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        const text = payload.text?.trim().slice(0, 280);
        if (!text) return { ok: false, error: "Введите сообщение" };
        const message: BunkerChatMessage = { id: randomUUID(), playerId: player.id, playerName: player.name, text, createdAt: Date.now() };
        room.chatMessages = [...room.chatMessages.slice(-79), message];
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("disconnect", () => {
      const ref = socketPlayers.get(socket.id);
      if (!ref) return;
      const room = rooms.get(ref.roomCode);
      const player = room?.players.find((item) => item.id === ref.playerId);
      socketPlayers.delete(socket.id);
      if (player) player.connected = hasActiveSocketForPlayer(ref.roomCode, ref.playerId);
      if (room) emitRoom(io, room.code);
    });
  });
}

function withPlayerRoom(socket: Socket, action: (room: BunkerRoomState, player: BunkerPlayer) => { ok: boolean; error?: string }) {
  const ref = socketPlayers.get(socket.id);
  const room = ref ? rooms.get(ref.roomCode) : undefined;
  const player = ref ? room?.players.find((item) => item.id === ref.playerId) : undefined;
  if (!room || !player) return { ok: false, error: "Игрок не найден в комнате" };
  return action(room, player);
}

function withHostRoom(socket: Socket, action: (room: BunkerRoomState) => { ok: boolean; error?: string }) {
  return withPlayerRoom(socket, (room, player) => {
    if (!player.isHost) return { ok: false, error: "Действие доступно только хосту" };
    return action(room);
  });
}

function emitOwnRoom(io: Server, socket: Socket) {
  const ref = socketPlayers.get(socket.id);
  if (ref) emitRoom(io, ref.roomCode);
}

function emitRoom(io: Server, roomCode: string) {
  const room = rooms.get(roomCode);
  if (!room) return;
  for (const socket of io.sockets.sockets.values()) {
    const ref = socketPlayers.get(socket.id);
    if (ref?.roomCode === roomCode) socket.emit("bunker_room_updated", getPublicBunkerState(room, ref.playerId));
  }
}

function sanitizeSettings(settings: Partial<BunkerSettings>) {
  const sanitized: Partial<BunkerSettings> = {};
  if (settings.gameMode === "classic" || settings.gameMode === "quick") sanitized.gameMode = settings.gameMode;
  if (settings.hostMode === "auto" || settings.hostMode === "manual_host") sanitized.hostMode = settings.hostMode;
  if (typeof settings.maxPlayers === "number") sanitized.maxPlayers = clamp(settings.maxPlayers, 4, 16);
  if (settings.bunkerSlots === "auto") sanitized.bunkerSlots = "auto";
  if (typeof settings.bunkerSlots === "number") sanitized.bunkerSlots = clamp(settings.bunkerSlots, 1, 16);
  if (typeof settings.characteristicsPerPlayer === "number") sanitized.characteristicsPerPlayer = clamp(settings.characteristicsPerPlayer, 4, 11);
  if (settings.revealMode === "fixed_order" || settings.revealMode === "free_choice") sanitized.revealMode = settings.revealMode;
  if (typeof settings.discussionTimeSec === "number") sanitized.discussionTimeSec = clamp(settings.discussionTimeSec, 30, 600);
  if (typeof settings.votingTimeSec === "number") sanitized.votingTimeSec = clamp(settings.votingTimeSec, 20, 300);
  if (typeof settings.useTimer === "boolean") sanitized.useTimer = settings.useTimer;
  if (typeof settings.useSpecialCards === "boolean") sanitized.useSpecialCards = settings.useSpecialCards;
  if (typeof settings.specialCardsPerPlayer === "number") sanitized.specialCardsPerPlayer = clamp(settings.specialCardsPerPlayer, 0, 3);
  if (settings.votingMode === "open" || settings.votingMode === "anonymous") sanitized.votingMode = settings.votingMode;
  if (settings.tieMode === "revote" || settings.tieMode === "no_elimination" || settings.tieMode === "random") sanitized.tieMode = settings.tieMode;
  if (typeof settings.allowSelfVote === "boolean") sanitized.allowSelfVote = settings.allowSelfVote;
  if (typeof settings.revealProfessionAtStart === "boolean") sanitized.revealProfessionAtStart = settings.revealProfessionAtStart;
  if (typeof settings.showEliminatedCards === "boolean") sanitized.showEliminatedCards = settings.showEliminatedCards;
  if (settings.catastropheMode === "random" || settings.catastropheMode === "select") sanitized.catastropheMode = settings.catastropheMode;
  if (typeof settings.selectedCatastropheId === "string") sanitized.selectedCatastropheId = settings.selectedCatastropheId;
  if (settings.bunkerMode === "random" || settings.bunkerMode === "select") sanitized.bunkerMode = settings.bunkerMode;
  if (typeof settings.selectedBunkerId === "string") sanitized.selectedBunkerId = settings.selectedBunkerId;
  if (Array.isArray(settings.enabledCardCategories)) sanitized.enabledCardCategories = settings.enabledCardCategories;
  return sanitized;
}

function hasDuplicatePlayerName(room: BunkerRoomState, name: string) {
  const normalizedName = normalizePlayerName(name);
  return room.players.some((player) => normalizePlayerName(player.name) === normalizedName);
}

function normalizePlayerName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

function hasActiveSocketForPlayer(roomCode: string, playerId: string) {
  return [...socketPlayers.values()].some((ref) => ref.roomCode === roomCode && ref.playerId === playerId);
}

function toPublicLobbyRoom(room: BunkerRoomState): PublicBunkerLobbyRoom {
  const connectedPlayers = room.players.filter((player) => player.connected && !player.isBot);
  const host = room.players.find((player) => player.id === room.hostId);
  return {
    code: room.code,
    gameId: room.gameId,
    phase: room.phase,
    phaseLabel: getPhaseLabel(room.phase),
    title: "Бункер",
    playersCount: connectedPlayers.length,
    maxPlayers: room.settings.maxPlayers,
    hostName: host?.name,
    createdAt: room.createdAt
  };
}

function getPhaseLabel(phase: BunkerRoomState["phase"]) {
  if (phase === "LOBBY") return "Лобби";
  if (phase === "SCENARIO_REVEAL") return "Сценарий";
  if (phase === "REVEAL_ROUND") return "Раскрытие";
  if (phase === "DISCUSSION") return "Обсуждение";
  if (phase === "VOTING" || phase === "REVOTE") return "Голосование";
  if (phase === "GAME_OVER") return "Финал";
  return "Игра идет";
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.round(value)));
}

function refreshStatsDay() {
  const today = new Date().toDateString();
  if (today === statsDay) return;
  statsDay = today;
  totalRoomsCreatedToday = 0;
}
