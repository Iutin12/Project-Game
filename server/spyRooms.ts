import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import {
  advanceSpyQuestion,
  beginSpyVoting,
  confirmSpyRole,
  confirmSpyVote,
  continueSpyGame,
  createSpyRoomState,
  forceFinishSpyRound,
  forceStartSpyDiscussion,
  getVotingCandidates,
  handleSpyDeadline,
  requestSpyVoting,
  resetSpyRoomToLobby,
  resolveSpyHostTie,
  selectSpyVote,
  setSpyPlayerReady,
  startSpyGame,
  startSpyLocationGuess,
  startSpyRound,
  submitSpyLocationGuess,
  viewSpyRole
} from "../src/games/spy/logic";
import { getPublicSpyState } from "../src/games/spy/public-state";
import { sanitizeSpySettings } from "../src/games/spy/settings";
import type { SpyChatMessage, SpyPlayer, SpyRoomState, SpySettings } from "../src/games/spy/types";

export type PublicSpyLobbyRoom = {
  code: string;
  gameId: "spy";
  phase: SpyRoomState["phase"];
  phaseLabel: string;
  title: string;
  playersCount: number;
  maxPlayers: number;
  hostName?: string;
  createdAt: number;
};

type SocketPlayerRef = { roomCode: string; playerId: string };
type ActionResult = { ok: boolean; error?: string; [key: string]: unknown };

const rooms = new Map<string, SpyRoomState>();
const socketPlayers = new Map<string, SocketPlayerRef>();
const hostDisconnectedAt = new Map<string, number>();
let totalRoomsCreatedToday = 0;
let statsDay = new Date().toDateString();
let roomWatcher: ReturnType<typeof setInterval> | undefined;

export function createSpyRoom(visibility: SpyRoomState["visibility"] = "private") {
  refreshStatsDay();
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  const room = createSpyRoomState({ code, hostKey: randomUUID(), visibility });
  rooms.set(code, room);
  totalRoomsCreatedToday += 1;
  return { code, hostKey: room.hostKey };
}

export function createDevSpyRoom(playersCount = 6) {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  const room = createSpyRoomState({ code, hostKey: randomUUID(), visibility: "private", devMode: true });
  room.players = Array.from({ length: Math.max(3, Math.min(12, playersCount)) }, (_, index): SpyPlayer => ({
    id: randomUUID(),
    name: index === 0 ? "Тестовый хост" : `Бот ${index}`,
    connected: true,
    isHost: index === 0,
    isBot: index !== 0,
    ready: false,
    score: 0
  }));
  room.hostId = room.players[0]?.id;
  rooms.set(code, room);
  return { code, hostKey: room.hostKey, playerId: room.players[0]?.id };
}

export function getSpyRoom(code: string) {
  return rooms.get(code.toUpperCase());
}

export function getSpyRoomInfo(code: string) {
  const room = getSpyRoom(code);
  return room ? { code: room.code, gameId: room.gameId, phase: room.phase } : undefined;
}

export function getSpyStats() {
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

export function registerSpyRoomSockets(io: Server) {
  if (!roomWatcher) {
    roomWatcher = setInterval(() => {
      const now = Date.now();
      for (const room of rooms.values()) {
        if (handleSpyDeadline(room, now)) {
          autoProgressBots(room);
          emitRoom(io, room.code);
        }
        transferDisconnectedHost(room, now);
        if (shouldDeleteRoom(room, now)) rooms.delete(room.code);
      }
    }, 500);
    roomWatcher.unref();
  }

  io.on("connection", (socket) => {
    socket.on("join_spy_room", (payload: { code: string; name: string; hostKey?: string; playerId?: string }, ack) => {
      const room = getSpyRoom(payload.code);
      const name = cleanName(payload.name);
      if (!room) return ack?.({ ok: false, error: "Комната не найдена" });

      const existingPlayer = payload.playerId ? room.players.find((player) => player.id === payload.playerId && !player.isBot) : undefined;
      if (existingPlayer) {
        existingPlayer.connected = true;
        if (payload.hostKey === room.hostKey) assignHost(room, existingPlayer.id);
        room.lastActivityAt = Date.now();
        socketPlayers.set(socket.id, { roomCode: room.code, playerId: existingPlayer.id });
        socket.join(room.code);
        ack?.({ ok: true, playerId: existingPlayer.id });
        emitRoom(io, room.code);
        return;
      }

      if (room.phase !== "LOBBY") return ack?.({ ok: false, error: "Игра уже началась. Вернуться можно только за прежнего игрока." });
      if (!name) return ack?.({ ok: false, error: "Введите никнейм" });
      if (hasDuplicatePlayerName(room, name)) return ack?.({ ok: false, error: "Игрок с таким никнеймом уже есть в комнате" });
      if (room.players.filter((player) => !player.isBot).length >= room.settings.maxPlayers) return ack?.({ ok: false, error: "Комната заполнена" });

      const player: SpyPlayer = {
        id: randomUUID(),
        name,
        connected: true,
        isHost: payload.hostKey === room.hostKey || !room.hostId,
        ready: false,
        score: 0
      };
      if (player.isHost) assignHost(room, player.id);
      room.players.push(player);
      room.lastActivityAt = Date.now();
      socketPlayers.set(socket.id, { roomCode: room.code, playerId: player.id });
      socket.join(room.code);
      ack?.({ ok: true, playerId: player.id });
      emitRoom(io, room.code);
    });

    socket.on("spy:update_settings", (payload: Partial<SpySettings>, ack) => {
      const result = withHostRoom(socket, (room) => {
        if (room.phase !== "LOBBY") throw new Error("Настройки можно менять только в лобби.");
        room.settings = sanitizeSpySettings(payload, room.settings);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:ready", (payload: { ready?: boolean }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => setSpyPlayerReady(room, player.id, payload?.ready ?? !player.ready));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:start_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        startSpyGame(room);
        autoProgressBots(room);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:view_role", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        viewSpyRole(room, player.id);
        autoProgressBots(room);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:confirm_role", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        confirmSpyRole(room, player.id);
        autoProgressBots(room);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:force_discussion", (_, ack) => {
      const result = withHostRoom(socket, (room) => forceStartSpyDiscussion(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:question_answered", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => advanceSpyQuestion(room, player.id));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:request_voting", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => requestSpyVoting(room, player.id));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:begin_voting", (_, ack) => {
      const result = withHostRoom(socket, (room) => beginSpyVoting(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:start_guess", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => startSpyLocationGuess(room, player.id));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:guess_location", (payload: { locationId: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => submitSpyLocationGuess(room, player.id, payload.locationId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:select_vote", (payload: { targetId: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => selectSpyVote(room, player.id, payload.targetId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:confirm_vote", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        confirmSpyVote(room, player.id);
        autoProgressBots(room);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:resolve_host_tie", (payload: { targetId: string }, ack) => {
      const result = withHostRoom(socket, (room, player) => resolveSpyHostTie(room, player.id, payload.targetId));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:continue_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        continueSpyGame(room);
        autoProgressBots(room);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:force_finish_round", (payload: { winner?: "spies" | "civilians" }, ack) => {
      const result = withHostRoom(socket, (room) => forceFinishSpyRound(room, payload?.winner));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:return_to_lobby", (_, ack) => {
      const result = withHostRoom(socket, (room) => resetSpyRoomToLobby(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:transfer_host", (payload: { playerId: string }, ack) => {
      const result = withHostRoom(socket, (room) => {
        if (!room.players.some((player) => player.id === payload.playerId && player.connected)) throw new Error("Игрок не найден или не в сети.");
        assignHost(room, payload.playerId);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:kick_player", (payload: { playerId: string }, ack) => {
      const result = withHostRoom(socket, (room, host) => {
        if (host.id === payload.playerId) throw new Error("Нельзя удалить себя.");
        if (room.phase !== "LOBBY") throw new Error("Удалять игроков можно только в лобби.");
        room.players = room.players.filter((player) => player.id !== payload.playerId);
        disconnectPlayerSockets(io, room.code, payload.playerId);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("send_spy_chat_message", (payload: { text: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        const text = payload.text?.trim().slice(0, 280);
        if (!text) throw new Error("Введите сообщение.");
        const message: SpyChatMessage = { id: randomUUID(), playerId: player.id, playerName: player.name, text, createdAt: Date.now() };
        room.chatMessages = [...room.chatMessages.slice(-99), message];
        room.lastActivityAt = Date.now();
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:leave_room", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        leaveSpyRoom(io, socket, room, player);
      });
      ack?.(result);
    });

    socket.on("spy:dev_add_bot", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        assertDevRoom(room);
        if (room.phase !== "LOBBY") throw new Error("Ботов можно добавлять только в лобби.");
        if (room.players.length >= room.settings.maxPlayers) throw new Error("Комната заполнена.");
        const botNumber = room.players.filter((player) => player.isBot).length + 1;
        room.players.push({ id: randomUUID(), name: `Бот ${botNumber}`, connected: true, isHost: false, isBot: true, ready: false, score: 0 });
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:dev_remove_bot", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        assertDevRoom(room);
        if (room.phase !== "LOBBY") throw new Error("Ботов можно удалять только в лобби.");
        const botIndex = room.players.findLastIndex((player) => player.isBot);
        if (botIndex < 0) throw new Error("В комнате нет ботов.");
        room.players.splice(botIndex, 1);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:dev_restart_round", (payload: { locationId?: string; spyIds?: string[] }, ack) => {
      const result = withHostRoom(socket, (room) => {
        assertDevRoom(room);
        if (room.currentRound < 1) room.currentRound = 1;
        startSpyRound(room, { locationId: payload?.locationId, spyIds: payload?.spyIds });
        autoProgressBots(room);
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:dev_toggle_connection", (payload: { playerId: string }, ack) => {
      const result = withHostRoom(socket, (room) => {
        assertDevRoom(room);
        const bot = room.players.find((player) => player.id === payload.playerId && player.isBot);
        if (!bot) throw new Error("Бот не найден.");
        bot.connected = !bot.connected;
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:dev_advance", (payload: { correctGuess?: boolean }, ack) => {
      const result = withHostRoom(socket, (room) => simulateNextDevPhase(room, payload?.correctGuess));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:dev_simulate_round", (_, ack) => {
      const result = withHostRoom(socket, (room) => simulateDevRound(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("spy:dev_simulate_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => simulateDevGame(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("disconnect", () => {
      const ref = socketPlayers.get(socket.id);
      if (!ref) return;
      socketPlayers.delete(socket.id);
      const room = rooms.get(ref.roomCode);
      const player = room?.players.find((item) => item.id === ref.playerId);
      if (player) player.connected = hasActiveSocketForPlayer(ref.roomCode, ref.playerId);
      if (room && room.hostId === ref.playerId && !player?.connected) hostDisconnectedAt.set(room.code, Date.now());
      if (room) emitRoom(io, room.code);
    });
  });
}

function withPlayerRoom(socket: Socket, action: (room: SpyRoomState, player: SpyPlayer) => void): ActionResult {
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

function withHostRoom(socket: Socket, action: (room: SpyRoomState, player: SpyPlayer) => void): ActionResult {
  return withPlayerRoom(socket, (room, player) => {
    if (!player.isHost) throw new Error("Действие доступно только ведущему.");
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
  for (const socket of io.sockets.sockets.values()) {
    const ref = socketPlayers.get(socket.id);
    if (ref?.roomCode === roomCode) socket.emit("spy_room_updated", getPublicSpyState(room, ref.playerId));
  }
}

function autoProgressBots(room: SpyRoomState) {
  if (!room.round) return;
  const bots = room.players.filter((player) => player.isBot && player.connected);
  if (room.phase === "ROLE_REVEAL") bots.forEach((bot) => viewSpyRole(room, bot.id));
  if (room.phase === "WAITING_FOR_CONFIRMATION") bots.forEach((bot) => {
    if (!room.round!.confirmedPlayerIds.includes(bot.id)) confirmSpyRole(room, bot.id);
  });
  if (room.phase === "VOTING" || room.phase === "REVOTE") bots.forEach((bot) => {
    if (room.phase !== "VOTING" && room.phase !== "REVOTE") return;
    if (room.round!.confirmedVotePlayerIds.includes(bot.id) || room.round!.foundSpyIds.includes(bot.id)) return;
    const candidates = getVotingCandidates(room).filter((candidate) => candidate.id !== bot.id);
    if (!candidates.length) return;
    selectSpyVote(room, bot.id, randomItem(candidates).id);
    confirmSpyVote(room, bot.id);
  });
}

function simulateNextDevPhase(room: SpyRoomState, correctGuess = false) {
  assertDevRoom(room);
  if (room.phase === "LOBBY") {
    room.players.forEach((player) => setSpyPlayerReady(room, player.id, true));
    startSpyGame(room);
  } else if (room.phase === "ROLE_REVEAL") {
    room.players.forEach((player) => viewSpyRole(room, player.id));
  } else if (room.phase === "WAITING_FOR_CONFIRMATION") {
    room.players.forEach((player) => confirmSpyRole(room, player.id));
  } else if (room.phase === "DISCUSSION") {
    beginSpyVoting(room);
  } else if (room.phase === "VOTING" || room.phase === "REVOTE") {
    simulateAllVotes(room);
  } else if (room.phase === "SPY_GUESS") {
    const round = room.round!;
    const alternatives = room.settings.enabledLocationIds.filter((id) => id !== round.locationId);
    submitSpyLocationGuess(room, round.guessingSpyId!, correctGuess ? round.locationId : randomItem(alternatives));
  } else if (room.phase === "ROUND_RESULT" || room.phase === "GAME_RESULT") {
    continueSpyGame(room);
  }
  autoProgressBots(room);
}

function simulateDevRound(room: SpyRoomState) {
  assertDevRoom(room);
  let guard = 0;
  while (room.phase !== "ROUND_RESULT" && room.phase !== "GAME_RESULT" && guard < 20) {
    simulateNextDevPhase(room, false);
    guard += 1;
  }
}

function simulateDevGame(room: SpyRoomState) {
  assertDevRoom(room);
  let guard = 0;
  while (room.phase !== "GAME_RESULT" && guard < 200) {
    if (room.phase === "ROUND_RESULT") continueSpyGame(room);
    else simulateNextDevPhase(room, false);
    guard += 1;
    if (room.settings.totalRounds === null && room.roundHistory.length >= 5 && room.phase === "ROUND_RESULT") {
      room.settings.totalRounds = room.currentRound;
    }
  }
}

function simulateAllVotes(room: SpyRoomState) {
  const round = room.round!;
  const voters = room.players.filter((player) => player.connected && !round.foundSpyIds.includes(player.id));
  for (const voter of voters) {
    if (room.phase !== "VOTING" && room.phase !== "REVOTE") break;
    const candidates = getVotingCandidates(room).filter((candidate) => candidate.id !== voter.id);
    if (!candidates.length) continue;
    selectSpyVote(room, voter.id, randomItem(candidates).id);
    confirmSpyVote(room, voter.id);
  }
}

function leaveSpyRoom(io: Server, socket: Socket, room: SpyRoomState, player: SpyPlayer) {
  socketPlayers.delete(socket.id);
  socket.leave(room.code);
  if (room.phase === "LOBBY") room.players = room.players.filter((item) => item.id !== player.id);
  else player.connected = false;
  if (room.hostId === player.id) transferHostNow(room);
  emitRoom(io, room.code);
}

function transferDisconnectedHost(room: SpyRoomState, now: number) {
  const disconnectedAt = hostDisconnectedAt.get(room.code);
  if (!disconnectedAt || now - disconnectedAt < 15_000) return;
  const host = room.players.find((player) => player.id === room.hostId);
  if (host?.connected) {
    hostDisconnectedAt.delete(room.code);
    return;
  }
  transferHostNow(room);
}

function transferHostNow(room: SpyRoomState) {
  const nextHost = room.players.find((player) => player.connected && !player.isBot) ?? room.players.find((player) => player.connected);
  room.players.forEach((player) => {
    player.isHost = player.id === nextHost?.id;
  });
  room.hostId = nextHost?.id;
  hostDisconnectedAt.delete(room.code);
}

function assignHost(room: SpyRoomState, playerId: string) {
  room.players.forEach((player) => {
    player.isHost = player.id === playerId;
  });
  const player = room.players.find((item) => item.id === playerId);
  if (player) player.isHost = true;
  room.hostId = playerId;
  hostDisconnectedAt.delete(room.code);
}

function disconnectPlayerSockets(io: Server, roomCode: string, playerId: string) {
  for (const [socketId, ref] of socketPlayers) {
    if (ref.roomCode !== roomCode || ref.playerId !== playerId) continue;
    socketPlayers.delete(socketId);
    io.sockets.sockets.get(socketId)?.leave(roomCode);
    io.sockets.sockets.get(socketId)?.emit("spy:kicked");
  }
}

function shouldDeleteRoom(room: SpyRoomState, now: number) {
  const hasHumanOnline = room.players.some((player) => player.connected && !player.isBot);
  if (hasHumanOnline) return false;
  return now - room.lastActivityAt > 30 * 60 * 1000;
}

function hasDuplicatePlayerName(room: SpyRoomState, name: string) {
  const normalizedName = normalizeName(name);
  return room.players.some((player) => normalizeName(player.name) === normalizedName);
}

function cleanName(name: unknown) {
  return typeof name === "string" ? name.trim().replace(/\s+/g, " ").slice(0, 24) : "";
}

function normalizeName(name: string) {
  return cleanName(name).toLocaleLowerCase("ru-RU");
}

function hasActiveSocketForPlayer(roomCode: string, playerId: string) {
  return [...socketPlayers.values()].some((ref) => ref.roomCode === roomCode && ref.playerId === playerId);
}

function toPublicLobbyRoom(room: SpyRoomState): PublicSpyLobbyRoom {
  const connectedPlayers = room.players.filter((player) => player.connected && !player.isBot);
  const host = room.players.find((player) => player.id === room.hostId);
  return {
    code: room.code,
    gameId: room.gameId,
    phase: room.phase,
    phaseLabel: getPhaseLabel(room.phase),
    title: "Шпион",
    playersCount: connectedPlayers.length,
    maxPlayers: room.settings.maxPlayers,
    hostName: host?.name,
    createdAt: room.createdAt
  };
}

function getPhaseLabel(phase: SpyRoomState["phase"]) {
  if (phase === "LOBBY") return "Лобби";
  if (phase === "ROLE_REVEAL" || phase === "WAITING_FOR_CONFIRMATION") return "Роли";
  if (phase === "DISCUSSION") return "Обсуждение";
  if (phase === "SPY_GUESS") return "Попытка шпиона";
  if (phase === "VOTING" || phase === "REVOTE") return "Голосование";
  if (phase === "ROUND_RESULT") return "Итоги раунда";
  return "Финал";
}

function assertDevRoom(room: SpyRoomState) {
  if (!room.devMode) throw new Error("Комната не находится в dev-режиме.");
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function randomItem<T>(items: T[]) {
  if (!items.length) throw new Error("Список вариантов пуст.");
  return items[Math.floor(Math.random() * items.length)];
}

function refreshStatsDay() {
  const today = new Date().toDateString();
  if (today === statsDay) return;
  statsDay = today;
  totalRoomsCreatedToday = 0;
}
