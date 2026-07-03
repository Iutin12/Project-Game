import { randomUUID } from "node:crypto";
import type { Server, Socket } from "socket.io";
import {
  assignTeams,
  defaultCrocodileSettings,
  getNextExplainer,
  getWinnerIds,
  getWinningTeamId,
  isCorrectGuess,
  pickWord
} from "../src/games/crocodile/logic";
import type {
  CrocodileChatMessage,
  CrocodilePlayer,
  CrocodileRoom,
  CrocodileSettings,
  PublicCrocodileRoom
} from "../src/games/crocodile/types";

export type PublicCrocodileLobbyRoom = {
  code: string;
  gameId: "crocodile";
  phase: CrocodileRoom["phase"];
  phaseLabel: string;
  title: string;
  playersCount: number;
  maxPlayers: number;
  hostName?: string;
  createdAt: number;
};

const rooms = new Map<string, CrocodileRoom>();
const socketPlayers = new Map<string, { roomCode: string; playerId: string }>();
const roundTimers = new Map<string, NodeJS.Timeout>();
let socketServer: Server | undefined;
let totalRoomsCreatedToday = 0;
let statsDay = new Date().toDateString();

export function createCrocodileRoom(visibility: CrocodileRoom["visibility"] = "private") {
  refreshStatsDay();
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();

  const room: CrocodileRoom = {
    code,
    gameId: "crocodile",
    visibility,
    hostKey: randomUUID(),
    phase: "LOBBY",
    players: [],
    settings: { ...defaultCrocodileSettings },
    usedWordIds: [],
    chatMessages: [],
    createdAt: Date.now()
  };

  rooms.set(code, room);
  totalRoomsCreatedToday += 1;
  return { code, hostKey: room.hostKey };
}

export function getCrocodileRoom(code: string) {
  return rooms.get(code.toUpperCase());
}

export function getCrocodileRoomInfo(code: string) {
  const room = getCrocodileRoom(code);
  return room ? { code: room.code, gameId: room.gameId, phase: room.phase } : undefined;
}

export function getCrocodileStats() {
  refreshStatsDay();
  const gameRooms = [...rooms.values()];
  const publicRooms = gameRooms.filter((room) => {
    const connectedPlayers = room.players.filter((player) => player.connected);
    return room.visibility === "public" && room.phase === "LOBBY" && connectedPlayers.length > 0;
  });

  return {
    roomsCreatedToday: totalRoomsCreatedToday,
    activeRooms: gameRooms.length,
    onlinePlayers: gameRooms.reduce((total, room) => total + room.players.filter((player) => player.connected).length, 0),
    publicRooms: publicRooms.map(toPublicLobbyRoom)
  };
}

export function registerCrocodileRoomSockets(io: Server) {
  socketServer = io;
  io.on("connection", (socket) => {
    socket.on("join_crocodile_room", (payload: { code: string; name: string; hostKey?: string; playerId?: string }, ack) => {
      const room = getCrocodileRoom(payload.code);
      const name = payload.name?.trim().slice(0, 24);

      if (!room) return ack?.({ ok: false, error: "Комната не найдена" });

      const existingPlayer = payload.playerId ? room.players.find((player) => player.id === payload.playerId) : undefined;
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
      if (room.players.length >= 20) return ack?.({ ok: false, error: "Комната заполнена" });

      const player: CrocodilePlayer = {
        id: randomUUID(),
        name,
        connected: true,
        isHost: payload.hostKey === room.hostKey || (!room.hostId && room.players.length === 0),
        score: 0
      };

      if (player.isHost) room.hostId = player.id;
      room.players.push(player);
      socketPlayers.set(socket.id, { roomCode: room.code, playerId: player.id });
      socket.join(room.code);
      ack?.({ ok: true, playerId: player.id });
      emitRoom(io, room.code);
    });

    socket.on("update_crocodile_settings", (payload: Partial<CrocodileSettings>, ack) => {
      const result = withHostRoom(socket, (room) => {
        if (room.phase !== "LOBBY") return { ok: false, error: "Настройки можно менять только в лобби" };
        room.settings = { ...room.settings, ...sanitizeSettings(payload) };
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("start_crocodile_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => startGame(io, room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("send_crocodile_guess", (payload: { text: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        const text = payload.text?.trim().slice(0, 280);
        if (!text) return { ok: false, error: "Введите ответ" };
        if (room.phase !== "ROUND_ACTIVE" || !room.round) return { ok: false, error: "Сейчас нет активного раунда" };
        if (player.id === room.round.explainerId) return { ok: false, error: "Объясняющий не угадывает свое слово" };
        if (room.settings.gameMode === "teams" && player.teamId !== room.round.activeTeamId) {
          return { ok: false, error: "Сейчас угадывает другая команда" };
        }

        const correct = isCorrectGuess(text, room.round.word);
        const message: CrocodileChatMessage = {
          id: randomUUID(),
          playerId: player.id,
          playerName: player.name,
          text,
          correct,
          createdAt: Date.now()
        };
        room.chatMessages = [...room.chatMessages.slice(-99), message];

        if (correct) handleCorrectGuess(room, player);
        return { ok: true, correct };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("skip_crocodile_word", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        if (room.phase !== "ROUND_ACTIVE" || !room.round) return { ok: false, error: "Сейчас нет активного раунда" };
        if (player.id !== room.round.explainerId) return { ok: false, error: "Пропускать слово может только объясняющий" };
        if (!room.settings.allowSkipWord) return { ok: false, error: "Пропуск слов выключен" };
        if (room.settings.maxSkipsPerTurn !== null && room.round.skipsUsed >= room.settings.maxSkipsPerTurn) {
          return { ok: false, error: "Лимит пропусков исчерпан" };
        }
        room.round.skipsUsed += 1;
        setNextWord(room);
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("end_crocodile_round", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        if (room.phase !== "ROUND_ACTIVE" || !room.round) return { ok: false, error: "Сейчас нет активного раунда" };
        if (!player.isHost && player.id !== room.round.explainerId) return { ok: false, error: "Завершить раунд может хост или объясняющий" };
        finishRound(room);
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("next_crocodile_round", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        if (room.phase !== "ROUND_RESULT") return { ok: false, error: "Следующий раунд пока недоступен" };
        startNextRound(socketServer, room);
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("restart_crocodile_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        clearRoundTimer(room.code);
        room.phase = "LOBBY";
        room.players = room.players.map((player) => ({ ...player, score: 0, teamId: undefined }));
        room.round = undefined;
        room.usedWordIds = [];
        room.chatMessages = [];
        room.winnerIds = undefined;
        room.winningTeamId = undefined;
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

function startGame(io: Server | undefined, room: CrocodileRoom) {
  if (room.phase !== "LOBBY") return { ok: false, error: "Игра уже запущена" };
  const connectedPlayers = room.players.filter((player) => player.connected);
  if (connectedPlayers.length < 3) return { ok: false, error: "Для Крокодила нужно минимум 3 игрока" };
  if (room.settings.gameMode === "teams" && connectedPlayers.length < 4) {
    return { ok: false, error: "Командный режим доступен минимум для 4 игроков" };
  }
  room.players = room.players.map((player) => ({ ...player, score: 0 }));
  const hasTeams = room.players.some((player) => player.teamId);
  if (room.settings.gameMode === "teams" && (room.settings.autoAssignTeams || !hasTeams)) {
    room.players = assignTeams(room.players, room.settings.teamsCount);
  }
  room.usedWordIds = [];
  room.chatMessages = [];
  room.winnerIds = undefined;
  room.winningTeamId = undefined;
  startNextRound(io, room);
  return { ok: true };
}

function startNextRound(io: Server | undefined, room: CrocodileRoom) {
  clearRoundTimer(room.code);
  const previousExplainerId = room.round?.explainerId;
  const explainer = getNextExplainer(room.players, previousExplainerId);
  if (!explainer) return;
  const word = pickWord(room.settings, room.usedWordIds);
  room.usedWordIds = [...room.usedWordIds, word.id];
  const nextIndex = (room.round?.index ?? 0) + 1;
  room.phase = "ROUND_ACTIVE";
  room.round = {
    index: nextIndex,
    explainerId: explainer.id,
    activeTeamId: room.settings.gameMode === "teams" ? explainer.teamId : undefined,
    word,
    guessedWords: [],
    skipsUsed: 0,
    startedAt: Date.now(),
    deadlineAt: room.settings.useTimer ? Date.now() + room.settings.roundTimeSec * 1000 : undefined
  };
  if (room.settings.useTimer && io) {
    roundTimers.set(
      room.code,
      setTimeout(() => {
        const currentRoom = rooms.get(room.code);
        if (!currentRoom || currentRoom.phase !== "ROUND_ACTIVE") return;
        finishRound(currentRoom);
        emitRoom(io, currentRoom.code);
      }, room.settings.roundTimeSec * 1000)
    );
  }
}

function handleCorrectGuess(room: CrocodileRoom, guesser: CrocodilePlayer) {
  if (!room.round?.word) return;
  const explainerId = room.round.explainerId;
  room.round.lastGuesserId = guesser.id;
  room.round.lastCorrectWord = room.round.word.text;
  room.round.guessedWords = [...room.round.guessedWords, room.round.word];

  if (room.settings.gameMode === "teams") {
    room.players = room.players.map((player) =>
      player.id === guesser.id ? { ...player, score: player.score + room.settings.pointsForTeamGuess } : player
    );
  } else {
    room.players = room.players.map((player) => {
      if (player.id === guesser.id) return { ...player, score: player.score + room.settings.pointsForGuesser };
      if (player.id === explainerId) return { ...player, score: player.score + room.settings.pointsForExplainer };
      return player;
    });
  }

  if (room.settings.roundMode === "single_word") {
    finishRound(room);
  } else {
    setNextWord(room);
  }
}

function setNextWord(room: CrocodileRoom) {
  if (!room.round) return;
  const word = pickWord(room.settings, room.usedWordIds);
  room.usedWordIds = [...room.usedWordIds, word.id];
  room.round.word = word;
}

function finishRound(room: CrocodileRoom) {
  clearRoundTimer(room.code);
  if (room.round && room.settings.roundsCount !== null && room.round.index >= room.settings.roundsCount) {
    room.phase = "GAME_OVER";
    room.winnerIds = room.settings.gameMode === "solo" ? getWinnerIds(room.players) : undefined;
    room.winningTeamId = room.settings.gameMode === "teams" ? getWinningTeamId(room) : undefined;
    return;
  }
  room.phase = "ROUND_RESULT";
}

function withPlayerRoom(
  socket: Socket,
  action: (room: CrocodileRoom, player: CrocodilePlayer) => { ok: boolean; error?: string; correct?: boolean }
) {
  const ref = socketPlayers.get(socket.id);
  const room = ref ? rooms.get(ref.roomCode) : undefined;
  const player = ref ? room?.players.find((item) => item.id === ref.playerId) : undefined;
  if (!room || !player) return { ok: false, error: "Игрок не найден в комнате" };
  return action(room, player);
}

function withHostRoom(socket: Socket, action: (room: CrocodileRoom) => { ok: boolean; error?: string }) {
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
    if (ref?.roomCode === roomCode) socket.emit("crocodile_room_updated", toPublicRoom(room, ref.playerId));
  }
}

function toPublicRoom(room: CrocodileRoom, ownPlayerId: string): PublicCrocodileRoom {
  const ownPlayer = room.players.find((player) => player.id === ownPlayerId);
  const isExplainer = ownPlayer?.id === room.round?.explainerId;
  const showWord = isExplainer || room.phase !== "ROUND_ACTIVE";
  return {
    ...room,
    ownPlayerId,
    round: room.round
      ? {
          ...room.round,
          word: showWord ? room.round.word : undefined
        }
      : undefined
  };
}

function sanitizeSettings(settings: Partial<CrocodileSettings>) {
  const sanitized: Partial<CrocodileSettings> = {};
  if (settings.gameMode === "solo" || settings.gameMode === "teams") sanitized.gameMode = settings.gameMode;
  if (settings.roundMode === "single_word" || settings.roundMode === "multiple_words") sanitized.roundMode = settings.roundMode;
  if (
    settings.difficulty === "easy" ||
    settings.difficulty === "medium" ||
    settings.difficulty === "hard" ||
    settings.difficulty === "mixed"
  ) {
    sanitized.difficulty = settings.difficulty;
  }
  if (typeof settings.allowPhrases === "boolean") sanitized.allowPhrases = settings.allowPhrases;
  if (typeof settings.useTimer === "boolean") sanitized.useTimer = settings.useTimer;
  if (typeof settings.roundTimeSec === "number") sanitized.roundTimeSec = clamp(settings.roundTimeSec, 30, 180);
  if (settings.wordPoolMode === "all" || settings.wordPoolMode === "categories") sanitized.wordPoolMode = settings.wordPoolMode;
  if (Array.isArray(settings.selectedCategories)) sanitized.selectedCategories = settings.selectedCategories;
  if (sanitized.wordPoolMode === "all") sanitized.selectedCategories = [];
  if (settings.roundsCount === null) sanitized.roundsCount = null;
  if (typeof settings.roundsCount === "number") sanitized.roundsCount = clamp(settings.roundsCount, 1, 30);
  if (typeof settings.teamsCount === "number") sanitized.teamsCount = clamp(settings.teamsCount, 2, 4);
  if (typeof settings.autoAssignTeams === "boolean") sanitized.autoAssignTeams = settings.autoAssignTeams;
  if (typeof settings.pointsForGuesser === "number") sanitized.pointsForGuesser = clamp(settings.pointsForGuesser, 0, 10);
  if (typeof settings.pointsForExplainer === "number") sanitized.pointsForExplainer = clamp(settings.pointsForExplainer, 0, 10);
  if (typeof settings.pointsForTeamGuess === "number") sanitized.pointsForTeamGuess = clamp(settings.pointsForTeamGuess, 0, 10);
  if (typeof settings.allowSkipWord === "boolean") sanitized.allowSkipWord = settings.allowSkipWord;
  if (settings.maxSkipsPerTurn === null) sanitized.maxSkipsPerTurn = null;
  if (typeof settings.maxSkipsPerTurn === "number") sanitized.maxSkipsPerTurn = clamp(settings.maxSkipsPerTurn, 0, 10);
  return sanitized;
}

function hasDuplicatePlayerName(room: CrocodileRoom, name: string) {
  const normalizedName = normalizePlayerName(name);
  return room.players.some((player) => normalizePlayerName(player.name) === normalizedName);
}

function normalizePlayerName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru-RU");
}

function hasActiveSocketForPlayer(roomCode: string, playerId: string) {
  return [...socketPlayers.values()].some((ref) => ref.roomCode === roomCode && ref.playerId === playerId);
}

function toPublicLobbyRoom(room: CrocodileRoom): PublicCrocodileLobbyRoom {
  const connectedPlayers = room.players.filter((player) => player.connected);
  const host = room.players.find((player) => player.id === room.hostId);
  return {
    code: room.code,
    gameId: room.gameId,
    phase: room.phase,
    phaseLabel: getPhaseLabel(room.phase),
    title: "Крокодил",
    playersCount: connectedPlayers.length,
    maxPlayers: 20,
    hostName: host?.name,
    createdAt: room.createdAt
  };
}

function getPhaseLabel(phase: CrocodileRoom["phase"]) {
  if (phase === "LOBBY") return "Лобби";
  if (phase === "ROUND_ACTIVE") return "Раунд идет";
  if (phase === "ROUND_RESULT") return "Итоги раунда";
  return "Игра завершена";
}

function clearRoundTimer(roomCode: string) {
  const timer = roundTimers.get(roomCode);
  if (timer) clearTimeout(timer);
  roundTimers.delete(roomCode);
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
