import type { Server, Socket } from "socket.io";
import { randomUUID } from "node:crypto";
import {
  assignRoles,
  checkWinner,
  defaultMafiaSettings,
  getNextPhase,
  isMafiaRole,
  resolveNight,
  resolveRunoffVotes,
  resolveVotes
} from "../src/games/mafia/logic";
import type { ChatMessage, NightActions, Player, PublicRoom, Room, TieChallengeTask, Votes } from "../src/games/mafia/types";

export type PublicLobbyRoom = {
  code: string;
  gameId: "mafia";
  phase: Room["phase"];
  playersCount: number;
  maxPlayers: number;
  hostName?: string;
  createdAt: number;
};

const rooms = new Map<string, Room>();
const socketPlayers = new Map<string, { roomCode: string; playerId: string }>();
const mafiaVoteTimers = new Map<string, NodeJS.Timeout>();
const phaseTimers = new Map<string, NodeJS.Timeout>();
const MAFIA_REVOTE_TIMEOUT_MS = 40_000;
const TIE_CHALLENGE_TIMEOUT_SEC = 30;
let totalRoomsCreatedToday = 0;
let statsDay = new Date().toDateString();

export function createRoom(visibility: Room["visibility"] = "private") {
  return createMafiaRoom(false, visibility);
}

export function createDevRoom() {
  return createMafiaRoom(true, "private");
}

function createMafiaRoom(devMode: boolean, visibility: Room["visibility"]) {
  refreshStatsDay();
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();

  const room: Room = {
    code,
    gameId: "mafia",
    visibility,
    hostKey: randomUUID(),
    phase: "LOBBY",
    players: [],
    settings: { ...defaultMafiaSettings },
    nightActions: {},
    votes: {},
    roleReady: {},
    discussionReady: {},
    chatMessages: [],
    createdAt: Date.now(),
    devMode
  };

  rooms.set(code, room);
  if (!devMode) totalRoomsCreatedToday += 1;
  return { code, hostKey: room.hostKey };
}

export function getRoom(code: string) {
  return rooms.get(code.toUpperCase());
}

export function getStats() {
  refreshStatsDay();
  const gameRooms = [...rooms.values()].filter((room) => !room.devMode);
  const publicRooms = gameRooms.filter((room) => {
    const connectedPlayers = room.players.filter((player) => player.connected && !player.isBot && !player.isSpectator);
    return room.visibility === "public" && room.phase === "LOBBY" && connectedPlayers.length > 0;
  });

  return {
    roomsCreatedToday: totalRoomsCreatedToday,
    activeRooms: gameRooms.length,
    onlinePlayers: gameRooms.reduce(
      (total, room) => total + room.players.filter((player) => player.connected && !player.isBot && !player.isSpectator).length,
      0
    ),
    publicRooms: publicRooms.map(toPublicLobbyRoom)
  };
}

export function registerRoomSockets(io: Server) {
  io.on("connection", (socket) => {
    socket.on("join_room", (payload: { code: string; name: string; hostKey?: string; playerId?: string }, ack) => {
      const room = getRoom(payload.code);
      const name = payload.name?.trim().slice(0, 24);

      if (!room) return ack?.({ ok: false, error: "Комната не найдена" });

      const existingPlayer = payload.playerId
        ? room.players.find((player) => player.id === payload.playerId && !player.isBot)
        : undefined;

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
      if (room.players.length >= 15) return ack?.({ ok: false, error: "Комната заполнена" });

      const player: Player = {
        id: randomUUID(),
        name,
        alive: true,
        connected: true,
        isHost: payload.hostKey === room.hostKey || (!room.hostId && room.players.length === 0),
        isSpectator: false
      };

      if (player.isHost) room.hostId = player.id;
      room.players.push(player);
      socketPlayers.set(socket.id, { roomCode: room.code, playerId: player.id });
      socket.join(room.code);
      ack?.({ ok: true, playerId: player.id });
      emitRoom(io, room.code);
    });

    socket.on("send_chat_message", (payload: { text: string }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        const text = payload.text?.trim().slice(0, 280);
        if (!text) return { ok: false, error: "Введите сообщение" };

        const message: ChatMessage = {
          id: randomUUID(),
          playerId: player.id,
          playerName: player.name,
          text,
          createdAt: Date.now()
        };
        room.chatMessages = [...room.chatMessages.slice(-79), message];
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("set_host_participation", (payload: { participates: boolean }, ack) => {
      const result = withHostRoom(socket, (room) => {
        if (room.phase !== "LOBBY") return { ok: false, error: "Режим ведущего можно менять только в лобби" };
        const ref = socketPlayers.get(socket.id);
        const player = ref ? room.players.find((item) => item.id === ref.playerId) : undefined;
        if (!player) return { ok: false, error: "Игрок не найден" };
        player.isSpectator = !payload.participates;
        player.role = undefined;
        player.alive = true;
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_add_bot", (_, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        if (room.phase !== "LOBBY") return { ok: false, error: "Ботов можно добавлять только в лобби" };
        if (room.players.length >= 15) return { ok: false, error: "Комната заполнена" };
        room.players.push({
          id: randomUUID(),
          name: `Бот ${room.players.filter((player) => player.isBot).length + 1}`,
          alive: true,
          connected: true,
          isHost: false,
          isBot: true
        });
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_fill_bots", (_, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        if (room.phase !== "LOBBY") return { ok: false, error: "Ботов можно добавлять только в лобби" };
        while (room.players.length < 5) {
          room.players.push({
            id: randomUUID(),
            name: `Бот ${room.players.filter((player) => player.isBot).length + 1}`,
            alive: true,
            connected: true,
            isHost: false,
            isBot: true
          });
        }
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_simulate_phase", (_, ack) => {
      const result = withDevHostRoom(socket, (room) => simulateCurrentPhase(room));
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_simulate_round", (_, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        const initialPhase = room.phase;
        for (let step = 0; step < 8 && room.phase !== "GAME_OVER"; step += 1) {
          const phaseBefore = room.phase;
          simulateCurrentPhase(room);
          if (
            (phaseBefore === "DAY_VOTING" && room.phase === "NIGHT_MAFIA") ||
            (initialPhase === "LOBBY" && phaseBefore === "DAY_VOTING")
          ) {
            break;
          }
        }
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_play_to_win", (_, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        for (let step = 0; step < 40 && room.phase !== "GAME_OVER"; step += 1) {
          simulateCurrentPhase(room);
        }
        return room.phase === "GAME_OVER" ? { ok: true } : { ok: false, error: "Победа не наступила за 40 шагов" };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("update_settings", (payload: Partial<Room["settings"]>, ack) => {
      const result = withHostRoom(socket, (room) => {
        if (room.phase !== "LOBBY") return { ok: false, error: "Настройки можно менять только в лобби" };
        const nextSettings = {
          ...room.settings,
          ...sanitizeSettings(payload)
        };
        const validationError = getSettingsConfigError(nextSettings);
        if (validationError) return { ok: false, error: validationError };
        room.settings = nextSettings;
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_mafia_choose_target", (payload: { targetId: string; voterId?: string }, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        if (room.phase !== "NIGHT_MAFIA") return { ok: false, error: "Сейчас не ход мафии" };
        const target = findAlivePlayer(room, payload.targetId);
        if (!target) return { ok: false, error: "Цель не найдена или уже выбыла" };
        if (isMafiaRole(target.role)) return { ok: false, error: "Мафия не выбирает своего союзника" };
        const mafiaKiller =
          getAliveMafiaKillers(room).find((player) => player.id === payload.voterId) ?? getAliveMafiaKillers(room)[0];
        if (!mafiaKiller) return { ok: false, error: "В игре нет живой мафии, которая может убивать" };
        registerMafiaVote(io, room, mafiaKiller, target.id);
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_don_check_detective", (payload: { targetId: string }, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        if (room.phase !== "NIGHT_DON") return { ok: false, error: "Сейчас не ход Дона" };
        const don = room.players.find((player) => player.alive && player.role === "DON");
        const target = findAlivePlayer(room, payload.targetId);
        if (!don) return { ok: false, error: "В игре нет живого Дона" };
        if (!target) return { ok: false, error: "Цель не найдена или уже выбыла" };
        if (isMafiaRole(target.role)) return { ok: false, error: "Дон не проверяет союзника мафии" };
        room.nightActions.donCheckTargetId = target.id;
        room.donCheckResult = {
          donId: don.id,
          targetId: target.id,
          isDetective: target.role === "DETECTIVE"
        };
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_detective_check_player", (payload: { targetId: string }, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        if (room.phase !== "NIGHT_DETECTIVE") return { ok: false, error: "Сейчас не ход комиссара" };
        const detective = room.players.find((player) => player.alive && player.role === "DETECTIVE");
        const target = findAlivePlayer(room, payload.targetId);
        if (!detective) return { ok: false, error: "В игре нет живого комиссара" };
        if (!target) return { ok: false, error: "Цель не найдена или уже выбыла" };
        if (target.id === detective.id) return { ok: false, error: "Комиссар не проверяет сам себя" };
        room.nightActions.detectiveTargetId = target.id;
        room.detectiveResult = {
          detectiveId: detective.id,
          targetId: target.id,
          isMafia: isMafiaRole(target.role)
        };
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_doctor_save_player", (payload: { targetId: string }, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        if (room.phase !== "NIGHT_DOCTOR") return { ok: false, error: "Сейчас не ход доктора" };
        const doctor = room.players.find((player) => player.alive && player.role === "DOCTOR");
        const target = findAlivePlayer(room, payload.targetId);
        if (!doctor) return { ok: false, error: "В игре нет живого доктора" };
        if (!target) return { ok: false, error: "Цель не найдена или уже выбыла" };
        room.nightActions.doctorTargetId = target.id;
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_mistress_distract_player", (payload: { targetId: string }, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        if (room.phase !== "NIGHT_MAFIA") return { ok: false, error: "Любовница ходит ночью вместе с мафией" };
        const mistress = room.players.find((player) => player.alive && player.role === "MISTRESS");
        const target = findAlivePlayer(room, payload.targetId);
        if (!mistress) return { ok: false, error: "В игре нет живой любовницы" };
        if (!target) return { ok: false, error: "Цель не найдена или уже выбыла" };
        if (isMafiaRole(target.role)) return { ok: false, error: "Любовница не отвлекает союзника мафии" };
        room.nightActions.mistressTargetId = target.id;
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_cast_vote", (payload: { voterId: string; targetId: string }, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        if (room.phase !== "DAY_VOTING" && room.phase !== "DAY_REVOTE") return { ok: false, error: "Сейчас не голосование" };
        const voter = findAlivePlayer(room, payload.voterId);
        const target = findVotingTarget(room, payload.targetId);
        if (!voter) return { ok: false, error: "Голосующий не найден или выбыл" };
        if (!target) return { ok: false, error: "Цель голосования не найдена или выбыла" };
        if (voter.id === target.id) return { ok: false, error: "Нельзя голосовать против себя" };
        if (voter.id === room.nightActions.mistressTargetId) {
          return { ok: false, error: "Этот игрок отвлечен любовницей и пропускает голосование" };
        }
        room.votes[voter.id] = target.id;
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("dev_cast_all_votes", (payload: { targetId: string }, ack) => {
      const result = withDevHostRoom(socket, (room) => {
        if (room.phase !== "DAY_VOTING" && room.phase !== "DAY_REVOTE") return { ok: false, error: "Сейчас не голосование" };
        const target = findVotingTarget(room, payload.targetId);
        if (!target) return { ok: false, error: "Цель голосования не найдена или выбыла" };
        room.votes = {};
        for (const voter of room.players.filter(
          (player) => player.alive && player.id !== target.id && player.id !== room.nightActions.mistressTargetId
        )) {
          room.votes[voter.id] = target.id;
        }
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("start_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        const connectedPlayers = room.players.filter((player) => player.connected && !player.isSpectator);
        if (connectedPlayers.length < 5) {
          return { ok: false, error: "Для старта нужно минимум 5 игроков" };
        }
        const validationError = getSettingsError(connectedPlayers.length, room.settings);
        if (validationError) return { ok: false, error: validationError };

        room.players = assignRoles(room.players, room);
        room.phase = "ROLE_REVEAL";
        room.nightActions = {};
        room.votes = {};
        room.roleReady = {};
        room.discussionReady = {};
        room.runoffCandidateIds = undefined;
        room.tieChallenge = undefined;
        room.phaseDeadlineAt = undefined;
        room.winner = undefined;
        room.lastNightKilledId = undefined;
        room.lastVoteEliminatedId = undefined;
        room.lastVoteEliminatedIds = undefined;
        room.detectiveResult = undefined;
        room.donCheckResult = undefined;
        clearPhaseTimer(room.code);
        scheduleMafiaVoteTimer(io, room);
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("next_phase", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        if (!canPlayerAdvancePhase(room, player)) {
          return { ok: false, error: "Фазу пока нельзя завершить" };
        }
        advanceRoomPhase(io, room);
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("acknowledge_role", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        if (room.phase !== "ROLE_REVEAL" || !player.alive || player.isSpectator) {
          return { ok: false, error: "Сейчас нельзя подтвердить роль" };
        }
        room.roleReady[player.id] = true;
        if (areRolePlayersReady(room)) {
          advanceRoomPhase(io, room);
        }
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("ready_for_voting", (_, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        if (room.phase !== "DAY_DISCUSSION" || !player.alive || player.isSpectator) {
          return { ok: false, error: "Сейчас нельзя перейти к голосованию" };
        }
        room.discussionReady[player.id] = true;
        if (areDiscussionPlayersReady(room)) {
          advanceRoomPhase(io, room);
        }
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("mafia_choose_target", (payload: { targetId: string }, ack) => {
      ack?.(
        withPlayerRoom(socket, (room, player) => {
          if (room.phase !== "NIGHT_MAFIA" || (player.role !== "MAFIA" && player.role !== "DON") || !player.alive) {
            return { ok: false, error: "Сейчас нельзя выбрать жертву" };
          }
          const target = findAlivePlayer(room, payload.targetId);
          if (!target) return { ok: false, error: "Игрок не найден" };
          if (isMafiaRole(target.role)) return { ok: false, error: "Нельзя выбрать союзника мафии" };
          registerMafiaVote(io, room, player, target.id);
          return { ok: true };
        })
      );
      emitOwnRoom(io, socket);
    });

    socket.on("mistress_distract_player", (payload: { targetId: string }, ack) => {
      ack?.(
        withPlayerRoom(socket, (room, player) => {
          if (room.phase !== "NIGHT_MAFIA" || player.role !== "MISTRESS" || !player.alive) {
            return { ok: false, error: "Сейчас нельзя отвлечь игрока" };
          }
          if (room.nightActions.mistressTargetId) {
            return { ok: false, error: "Любовница уже выбрала цель этой ночью" };
          }
          const target = findAlivePlayer(room, payload.targetId);
          if (!target) return { ok: false, error: "Игрок не найден" };
          if (isMafiaRole(target.role)) return { ok: false, error: "Нельзя отвлечь союзника мафии" };
          room.nightActions.mistressTargetId = target.id;
          return { ok: true };
        })
      );
      emitOwnRoom(io, socket);
    });

    socket.on("don_check_detective", (payload: { targetId: string }, ack) => {
      ack?.(
        withPlayerRoom(socket, (room, player) => {
          if (room.phase !== "NIGHT_DON" || player.role !== "DON" || !player.alive) {
            return { ok: false, error: "Сейчас нельзя искать комиссара" };
          }
          if (room.nightActions.donCheckTargetId) {
            return { ok: false, error: "Дон уже сделал проверку этой ночью" };
          }
          const target = findAlivePlayer(room, payload.targetId);
          if (!target) return { ok: false, error: "Игрок не найден" };
          if (isMafiaRole(target.role)) return { ok: false, error: "Нельзя проверять союзника мафии" };
          room.nightActions.donCheckTargetId = target.id;
          room.donCheckResult = {
            donId: player.id,
            targetId: target.id,
            isDetective: target.role === "DETECTIVE"
          };
          return { ok: true };
        })
      );
      emitOwnRoom(io, socket);
    });

    socket.on("detective_check_player", (payload: { targetId: string }, ack) => {
      ack?.(
        withPlayerRoom(socket, (room, player) => {
          if (room.phase !== "NIGHT_DETECTIVE" || player.role !== "DETECTIVE" || !player.alive) {
            return { ok: false, error: "Сейчас нельзя проверить игрока" };
          }
          if (room.nightActions.detectiveTargetId) {
            return { ok: false, error: "Комиссар уже сделал проверку этой ночью" };
          }
          const target = findAlivePlayer(room, payload.targetId);
          if (!target) return { ok: false, error: "Игрок не найден" };
          room.nightActions.detectiveTargetId = target.id;
          room.detectiveResult = {
            detectiveId: player.id,
            targetId: target.id,
            isMafia: isMafiaRole(target.role)
          };
          return { ok: true };
        })
      );
      emitOwnRoom(io, socket);
    });

    socket.on("doctor_save_player", (payload: { targetId: string }, ack) => {
      ack?.(
        withPlayerRoom(socket, (room, player) => {
          if (room.phase !== "NIGHT_DOCTOR" || player.role !== "DOCTOR" || !player.alive) {
            return { ok: false, error: "Сейчас нельзя лечить игрока" };
          }
          if (room.nightActions.doctorTargetId) {
            return { ok: false, error: "Доктор уже выбрал пациента этой ночью" };
          }
          const target = findAlivePlayer(room, payload.targetId);
          if (!target) return { ok: false, error: "Игрок не найден" };
          room.nightActions.doctorTargetId = target.id;
          return { ok: true };
        })
      );
      emitOwnRoom(io, socket);
    });

    socket.on("cast_vote", (payload: { targetId: string }, ack) => {
      ack?.(
        withPlayerRoom(socket, (room, player) => {
          if ((room.phase !== "DAY_VOTING" && room.phase !== "DAY_REVOTE") || !player.alive || player.isSpectator) {
            return { ok: false, error: "Сейчас нельзя голосовать" };
          }
          if (player.id === room.nightActions.mistressTargetId) {
            return { ok: false, error: "Вы отвлечены любовницей и пропускаете голосование" };
          }
          if (room.votes[player.id]) {
            return { ok: false, error: "Вы уже проголосовали" };
          }
          const target = findVotingTarget(room, payload.targetId);
          if (!target || target.id === player.id) return { ok: false, error: "Игрок не найден" };
          room.votes[player.id] = target.id;
          return { ok: true };
        })
      );
      emitOwnRoom(io, socket);
    });

    socket.on("answer_tie_challenge", (payload: { optionIndex: number }, ack) => {
      const result = withPlayerRoom(socket, (room, player) => {
        if (room.phase !== "DAY_TIE_CHALLENGE" || !room.tieChallenge || !player.alive || player.isSpectator) {
          return { ok: false, error: "Сейчас нет испытания" };
        }
        if (!room.tieChallenge.candidateIds.includes(player.id)) {
          return { ok: false, error: "Испытание только для претендентов на вылет" };
        }
        if (Date.now() >= room.tieChallenge.deadlineAt) {
          resolveTieChallenge(io, room);
          return { ok: true };
        }

        const progress = room.tieChallenge.progress[player.id];
        if (!progress) return { ok: false, error: "Задание не найдено" };

        if (!Number.isInteger(payload.optionIndex) || !progress.task.options[payload.optionIndex]) {
          return { ok: false, error: "Такого варианта ответа нет" };
        }

        const answeredAt = Date.now();
        const correct = payload.optionIndex === progress.task.correctOptionIndex;
        progress.lastAnswerCorrect = correct;
        progress.lastAnsweredAt = answeredAt;

        if (correct) {
          progress.score += 1;
          progress.task = createTieChallengeTask();
        }

        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("restart_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        room.phase = "LOBBY";
        room.players = room.players.map((player) => ({ ...player, alive: true, role: undefined }));
        room.nightActions = {};
        room.votes = {};
        room.roleReady = {};
        room.discussionReady = {};
        room.runoffCandidateIds = undefined;
        room.tieChallenge = undefined;
        room.winner = undefined;
        room.lastNightKilledId = undefined;
        room.lastVoteEliminatedId = undefined;
        room.lastVoteEliminatedIds = undefined;
        room.detectiveResult = undefined;
        room.donCheckResult = undefined;
        clearMafiaVoteTimer(room.code);
        clearPhaseTimer(room.code);
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
      if (player) {
        player.connected = hasActiveSocketForPlayer(ref.roomCode, ref.playerId);
      }
      if (room?.phase === "ROLE_REVEAL" && areRolePlayersReady(room)) {
        advanceRoomPhase(io, room);
      }
      if (room) emitRoom(io, room.code);
    });
  });
}

function withPlayerRoom(
  socket: Socket,
  action: (room: Room, player: Player) => { ok: boolean; error?: string }
) {
  const ref = socketPlayers.get(socket.id);
  const room = ref ? rooms.get(ref.roomCode) : undefined;
  const player = ref ? room?.players.find((item) => item.id === ref.playerId) : undefined;
  if (!room || !player) return { ok: false, error: "Игрок не найден в комнате" };
  return action(room, player);
}

function withHostRoom(socket: Socket, action: (room: Room) => { ok: boolean; error?: string }) {
  return withPlayerRoom(socket, (room, player) => {
    if (!player.isHost) return { ok: false, error: "Действие доступно только хосту" };
    return action(room);
  });
}

function hasActiveSocketForPlayer(roomCode: string, playerId: string) {
  return [...socketPlayers.values()].some((ref) => ref.roomCode === roomCode && ref.playerId === playerId);
}

function withDevHostRoom(socket: Socket, action: (room: Room) => { ok: boolean; error?: string }) {
  return withHostRoom(socket, (room) => {
    if (!room.devMode) return { ok: false, error: "Dev-действие доступно только в тестовой комнате" };
    return action(room);
  });
}

function findAlivePlayer(room: Room, playerId?: string) {
  return room.players.find((player) => player.id === playerId && player.alive && !player.isSpectator);
}

function findVotingTarget(room: Room, playerId?: string) {
  const target = findAlivePlayer(room, playerId);
  if (!target) return undefined;
  if (room.phase === "DAY_REVOTE" && !room.runoffCandidateIds?.includes(target.id)) return undefined;
  return target;
}

function getAliveMafiaKillers(room: Room) {
  return room.players.filter((player) => player.alive && !player.isSpectator && (player.role === "MAFIA" || player.role === "DON"));
}

function getAliveDon(room: Room) {
  return room.players.find((player) => player.alive && !player.isSpectator && player.role === "DON");
}

function registerMafiaVote(io: Server, room: Room, voter: Player, targetId: string) {
  room.nightActions.mafiaVotes = {
    ...(room.nightActions.mafiaVotes ?? {}),
    [voter.id]: targetId
  };
  resolveMafiaVote(room, false);

  const killers = getAliveMafiaKillers(room);
  if (!getAliveDon(room) && killers.length > 1 && killers.every((player) => room.nightActions.mafiaVotes?.[player.id])) {
    const uniqueTargets = new Set(killers.map((player) => room.nightActions.mafiaVotes?.[player.id]));
    if (uniqueTargets.size === 1) {
      room.nightActions.mafiaVoteDeadlineAt = undefined;
      clearMafiaVoteTimer(room.code);
    } else if (!room.nightActions.mafiaVoteDeadlineAt) {
      scheduleMafiaVoteTimer(io, room);
    }
  }

  emitRoom(io, room.code);
}

function resolveMafiaVote(room: Room, forcePickTiedTarget: boolean) {
  const votes = room.nightActions.mafiaVotes ?? {};
  const validTargets = new Set(
    room.players.filter((player) => player.alive && !player.isSpectator && !isMafiaRole(player.role)).map((player) => player.id)
  );
  const tally = new Map<string, number>();

  for (const targetId of Object.values(votes)) {
    if (!validTargets.has(targetId)) continue;
    tally.set(targetId, (tally.get(targetId) ?? 0) + 1);
  }

  const leaders = getVoteLeaders(tally);
  if (leaders.length === 0) {
    room.nightActions.mafiaTargetId = undefined;
    return;
  }

  if (leaders.length === 1) {
    room.nightActions.mafiaTargetId = leaders[0];
    return;
  }

  const don = getAliveDon(room);
  const donVote = don ? votes[don.id] : undefined;
  if (donVote && leaders.includes(donVote)) {
    room.nightActions.mafiaTargetId = donVote;
    return;
  }

  if (forcePickTiedTarget) {
    room.nightActions.mafiaTargetId = leaders[Math.floor(Math.random() * leaders.length)];
    return;
  }

  room.nightActions.mafiaTargetId = undefined;
}

function getVoteLeaders(tally: Map<string, number>) {
  const maxVotes = Math.max(0, ...tally.values());
  if (maxVotes === 0) return [];
  return [...tally.entries()].filter(([, count]) => count === maxVotes).map(([targetId]) => targetId);
}

function scheduleMafiaVoteTimer(io: Server, room: Room) {
  clearMafiaVoteTimer(room.code);
  if (room.phase !== "NIGHT_MAFIA") return;

  const killers = getAliveMafiaKillers(room);
  if (killers.length <= 1 || getAliveDon(room)) return;

  room.nightActions.mafiaVoteDeadlineAt = Date.now() + MAFIA_REVOTE_TIMEOUT_MS;
  mafiaVoteTimers.set(
    room.code,
    setTimeout(() => {
      const currentRoom = rooms.get(room.code);
      if (!currentRoom || currentRoom.phase !== "NIGHT_MAFIA") return;
      resolveMafiaVote(currentRoom, true);
      currentRoom.nightActions.mafiaVoteDeadlineAt = undefined;
      clearMafiaVoteTimer(currentRoom.code);
      emitRoom(io, currentRoom.code);
    }, MAFIA_REVOTE_TIMEOUT_MS)
  );
}

function scheduleMafiaVoteTimerIfNeeded(io: Server | undefined, room: Room) {
  if (io) scheduleMafiaVoteTimer(io, room);
}

function schedulePhaseTimerIfNeeded(io: Server | undefined, room: Room) {
  clearPhaseTimer(room.code);
  room.phaseDeadlineAt = undefined;

  if (!io) return;
  if (room.settings.mode !== "timed" && room.phase !== "DAY_TIE_CHALLENGE") return;
  const timerSec = getPhaseTimerSec(room);
  if (!timerSec) return;

  room.phaseDeadlineAt = Date.now() + timerSec * 1000;
  phaseTimers.set(
    room.code,
    setTimeout(() => {
      const currentRoom = rooms.get(room.code);
      if (!currentRoom || currentRoom.phase === "GAME_OVER") return;
      advanceRoomPhase(io, currentRoom, true);
      emitRoom(io, currentRoom.code);
    }, timerSec * 1000)
  );
}

function getPhaseTimerSec(room: Room) {
  if (room.phase === "DAY_TIE_CHALLENGE") return TIE_CHALLENGE_TIMEOUT_SEC;
  if (room.phase === "NIGHT_MAFIA") return room.settings.mafiaTimerSec;
  if (room.phase === "NIGHT_DON") return room.settings.donTimerSec;
  if (room.phase === "NIGHT_DETECTIVE") return room.settings.detectiveTimerSec;
  if (room.phase === "NIGHT_DOCTOR") return room.settings.doctorTimerSec;
  if (room.phase === "DAY_DISCUSSION") return room.settings.dayTimerSec;
  if (room.phase === "DAY_VOTING") return room.settings.votingTimerSec;
  if (room.phase === "DAY_REVOTE") return room.settings.votingTimerSec;
  return undefined;
}

function clearPhaseTimer(roomCode: string) {
  const timer = phaseTimers.get(roomCode);
  if (timer) clearTimeout(timer);
  phaseTimers.delete(roomCode);
}

function clearMafiaVoteTimer(roomCode: string) {
  const timer = mafiaVoteTimers.get(roomCode);
  if (timer) clearTimeout(timer);
  mafiaVoteTimers.delete(roomCode);
}

function sanitizeSettings(settings: Partial<Room["settings"]>) {
  const sanitized: Partial<Room["settings"]> = {};
  if (settings.mafiaCount === "auto" || typeof settings.mafiaCount === "number") {
    sanitized.mafiaCount = settings.mafiaCount;
  }
  if (typeof settings.hasDetective === "boolean") sanitized.hasDetective = settings.hasDetective;
  if (typeof settings.hasDoctor === "boolean") sanitized.hasDoctor = settings.hasDoctor;
  if (typeof settings.hasDon === "boolean") sanitized.hasDon = settings.hasDon;
  if (typeof settings.hasMistress === "boolean") sanitized.hasMistress = settings.hasMistress;
  if (settings.mode === "manual" || settings.mode === "timed") sanitized.mode = settings.mode;
  if (typeof settings.mafiaTimerSec === "number") sanitized.mafiaTimerSec = settings.mafiaTimerSec;
  if (typeof settings.donTimerSec === "number") sanitized.donTimerSec = settings.donTimerSec;
  if (typeof settings.detectiveTimerSec === "number") sanitized.detectiveTimerSec = settings.detectiveTimerSec;
  if (typeof settings.doctorTimerSec === "number") sanitized.doctorTimerSec = settings.doctorTimerSec;
  if (typeof settings.dayTimerSec === "number") sanitized.dayTimerSec = settings.dayTimerSec;
  if (typeof settings.votingTimerSec === "number") sanitized.votingTimerSec = settings.votingTimerSec;
  if (settings.voteTieMode === "revote" || settings.voteTieMode === "skip" || settings.voteTieMode === "challenge") {
    sanitized.voteTieMode = settings.voteTieMode;
  }
  if (settings.voteVisibility === "public" || settings.voteVisibility === "anonymous") {
    sanitized.voteVisibility = settings.voteVisibility;
  }
  return sanitized;
}

function getSettingsError(playerCount: number, settings: Room["settings"]) {
  const mafiaCount =
    settings.mafiaCount === "auto" ? Math.max(1, Math.floor(playerCount / 4)) : settings.mafiaCount;
  const extraRolesCount =
    Number(settings.hasMistress) + Number(settings.hasDetective) + Number(settings.hasDoctor);

  if (mafiaCount < 1) return "Нужна хотя бы одна мафия";
  if (mafiaCount > Math.max(1, playerCount - 1)) return "Мафии не может быть столько же, сколько всех игроков";
  if (mafiaCount + extraRolesCount > playerCount) return "Ролей больше, чем игроков";
  return undefined;
}

function getSettingsConfigError(settings: Room["settings"]) {
  if (typeof settings.mafiaCount === "number" && (settings.mafiaCount < 1 || settings.mafiaCount > 10)) {
    return "Количество убийц мафии должно быть от 1 до 10";
  }
  for (const timerValue of [
    settings.mafiaTimerSec,
    settings.donTimerSec,
    settings.detectiveTimerSec,
    settings.doctorTimerSec,
    settings.dayTimerSec,
    settings.votingTimerSec
  ]) {
    if (!Number.isFinite(timerValue) || timerValue < 10 || timerValue > 1800) {
      return "Таймеры должны быть от 10 до 1800 секунд";
    }
  }
  return undefined;
}

function simulateCurrentPhase(room: Room) {
  if (room.phase === "LOBBY") {
    while (room.players.length < 5) {
      room.players.push({
        id: randomUUID(),
        name: `Бот ${room.players.filter((player) => player.isBot).length + 1}`,
        alive: true,
        connected: true,
        isHost: false,
        isBot: true
      });
    }
    room.players = assignRoles(room.players, room);
    room.phase = "ROLE_REVEAL";
    room.nightActions = {};
    room.votes = {};
    room.discussionReady = {};
    room.winner = undefined;
    room.lastNightKilledId = undefined;
    room.lastVoteEliminatedId = undefined;
    room.lastVoteEliminatedIds = undefined;
    room.runoffCandidateIds = undefined;
    room.detectiveResult = undefined;
    room.donCheckResult = undefined;
    return { ok: true };
  }

  if (room.phase === "NIGHT_MAFIA") {
    const target = room.players.find((player) => player.alive && !player.isSpectator && !isMafiaRole(player.role));
    const mafiaKillers = getAliveMafiaKillers(room);
    if (target) {
      room.nightActions.mafiaVotes = Object.fromEntries(mafiaKillers.map((player) => [player.id, target.id]));
      resolveMafiaVote(room, true);
    }
    const mistressTarget = room.players.find(
      (player) => player.alive && !player.isSpectator && !isMafiaRole(player.role) && player.id !== target?.id
    );
    if (mistressTarget) room.nightActions.mistressTargetId = mistressTarget.id;
  }

  if (room.phase === "NIGHT_DON") {
    const don = room.players.find((player) => player.alive && !player.isSpectator && player.role === "DON");
    const target = room.players.find((player) => player.alive && !player.isSpectator && !isMafiaRole(player.role));
    if (don && target) {
      room.nightActions.donCheckTargetId = target.id;
      room.donCheckResult = {
        donId: don.id,
        targetId: target.id,
        isDetective: target.role === "DETECTIVE"
      };
    }
  }

  if (room.phase === "NIGHT_DETECTIVE") {
    const detective = room.players.find((player) => player.alive && player.role === "DETECTIVE");
    const target = room.players.find((player) => player.alive && !player.isSpectator && player.id !== detective?.id);
    if (detective && target) {
      room.nightActions.detectiveTargetId = target.id;
      room.detectiveResult = {
        detectiveId: detective.id,
        targetId: target.id,
        isMafia: isMafiaRole(target.role)
      };
    }
  }

  if (room.phase === "NIGHT_DOCTOR") {
    const doctor = room.players.find((player) => player.alive && player.role === "DOCTOR");
    if (doctor) room.nightActions.doctorTargetId = doctor.id;
  }

  if (room.phase === "DAY_VOTING" || room.phase === "DAY_REVOTE") {
    const alivePlayers = room.players.filter((player) => player.alive && !player.isSpectator);
    const votingTargets =
      room.phase === "DAY_REVOTE" ? alivePlayers.filter((player) => room.runoffCandidateIds?.includes(player.id)) : alivePlayers;
    const preferredTarget =
      votingTargets.find((player) => isMafiaRole(player.role)) ??
      votingTargets.find((player) => !isMafiaRole(player.role)) ??
      votingTargets[0];

    room.votes = {};
    for (const voter of alivePlayers) {
      if (voter.id === room.nightActions.mistressTargetId) continue;
      const fallbackTarget = votingTargets.find((player) => player.id !== voter.id);
      const target = preferredTarget?.id === voter.id ? fallbackTarget : preferredTarget;
      if (target) room.votes[voter.id] = target.id;
    }
  }

  if (room.phase === "DAY_TIE_CHALLENGE" && room.tieChallenge) {
    const firstCandidate = room.tieChallenge.candidateIds[0];
    const progress = firstCandidate ? room.tieChallenge.progress[firstCandidate] : undefined;
    if (progress) {
      progress.score = 2;
      progress.lastAnswerCorrect = true;
      progress.lastAnsweredAt = Date.now();
    }
  }

  advanceRoomPhase(undefined, room);
  return { ok: true };
}

function advanceRoomPhase(io: Server | undefined, room: Room, timedOut = false) {
  clearPhaseTimer(room.code);
  if (timedOut) fillMissingPhaseAction(room);
  const previousPhase = room.phase;

  if (shouldResolveNightAfterPhase(room)) {
    const resolved = resolveNight(room.players, room.nightActions);
    room.players = resolved.players;
    room.lastNightKilledId = resolved.killedId;
    const winner = checkWinner(room.players);
    if (winner) {
      room.winner = winner;
      room.phase = "GAME_OVER";
      clearMafiaVoteTimer(room.code);
      room.phaseDeadlineAt = undefined;
      room.detectiveResult = undefined;
      room.donCheckResult = undefined;
      return;
    }
  }

  if (room.phase === "DAY_TIE_CHALLENGE") {
    resolveTieChallenge(io, room);
    return;
  }

  if (room.phase === "DAY_VOTING" || room.phase === "DAY_REVOTE") {
    const resolved =
      room.phase === "DAY_REVOTE"
        ? resolveRunoffVotes(room.players, room.votes, room.runoffCandidateIds ?? [])
        : resolveVotes(room.players, room.votes);

    if (
      room.phase === "DAY_VOTING" &&
      (room.settings.voteTieMode === "revote" || room.settings.voteTieMode === "challenge") &&
      resolved.tiedIds.length > 1
    ) {
      room.phase = "DAY_REVOTE";
      room.runoffCandidateIds = resolved.tiedIds;
      room.votes = {};
      schedulePhaseTimerIfNeeded(io, room);
      return;
    }

    if (room.phase === "DAY_REVOTE" && room.settings.voteTieMode === "challenge" && resolved.tiedIds.length > 1) {
      startTieChallenge(io, room, resolved.tiedIds);
      return;
    }

    room.players = resolved.players;
    room.lastVoteEliminatedId = resolved.eliminatedIds.length > 1 ? undefined : resolved.eliminatedId;
    room.lastVoteEliminatedIds = resolved.eliminatedIds;
    const winner = checkWinner(room.players);
    if (winner) {
      room.winner = winner;
      room.phase = "GAME_OVER";
      clearMafiaVoteTimer(room.code);
      room.phaseDeadlineAt = undefined;
      room.detectiveResult = undefined;
      room.donCheckResult = undefined;
      return;
    }
    room.votes = {};
    room.discussionReady = {};
    room.runoffCandidateIds = undefined;
    room.tieChallenge = undefined;
    room.nightActions = {};
    room.detectiveResult = undefined;
    room.donCheckResult = undefined;
  }

  if (previousPhase === "NIGHT_DETECTIVE") {
    room.detectiveResult = undefined;
  }
  if (previousPhase === "NIGHT_DON") {
    room.donCheckResult = undefined;
  }
  room.phase = getNextPhase(room);
  if (room.phase === "DAY_DISCUSSION") {
    room.discussionReady = {};
  }
  scheduleMafiaVoteTimerIfNeeded(io, room);
  schedulePhaseTimerIfNeeded(io, room);
}

function shouldResolveNightAfterPhase(room: Room) {
  const hasDonCheckPhase = room.settings.hasDon && room.settings.hasDetective;
  if (room.phase === "NIGHT_DOCTOR") return true;
  if (room.phase === "NIGHT_DETECTIVE") return !room.settings.hasDoctor;
  if (room.phase === "NIGHT_DON") return !room.settings.hasDetective && !room.settings.hasDoctor;
  if (room.phase === "NIGHT_MAFIA") return !hasDonCheckPhase && !room.settings.hasDetective && !room.settings.hasDoctor;
  return false;
}

function canPlayerAdvancePhase(room: Room, player: Player) {
  if (player.isHost && room.devMode) return true;
  if (player.isHost && player.isSpectator && room.phase !== "DAY_DISCUSSION") return true;
  if (room.settings.mode !== "manual") return false;
  if (!player.alive || player.isSpectator) return false;

  if (room.phase === "NIGHT_MAFIA" && isMafiaRole(player.role)) {
    return isNightMafiaReadyToAdvance(room);
  }
  if (room.phase === "NIGHT_DON" && player.role === "DON") {
    return Boolean(room.nightActions.donCheckTargetId);
  }
  if (room.phase === "NIGHT_DETECTIVE" && player.role === "DETECTIVE") {
    return Boolean(room.nightActions.detectiveTargetId);
  }
  if (room.phase === "NIGHT_DOCTOR" && player.role === "DOCTOR") {
    return Boolean(room.nightActions.doctorTargetId);
  }
  if (room.phase === "DAY_VOTING" || room.phase === "DAY_REVOTE") {
    return areVotesReady(room);
  }

  return false;
}

function areRolePlayersReady(room: Room) {
  const rolePlayers = room.players.filter((player) => player.alive && player.connected && !player.isSpectator);
  return rolePlayers.length > 0 && rolePlayers.every((player) => room.roleReady[player.id]);
}

function areDiscussionPlayersReady(room: Room) {
  const alivePlayers = room.players.filter((player) => player.alive && !player.isSpectator);
  return alivePlayers.length > 0 && alivePlayers.every((player) => room.discussionReady[player.id]);
}

function isNightMafiaReadyToAdvance(room: Room) {
  const mistress = room.players.find((player) => player.alive && !player.isSpectator && player.role === "MISTRESS");
  return isMafiaKillReady(room) && (!mistress || Boolean(room.nightActions.mistressTargetId));
}

function isMafiaKillReady(room: Room) {
  const killers = getAliveMafiaKillers(room);
  if (killers.length === 0) return false;
  const votes = room.nightActions.mafiaVotes ?? {};
  const firstVote = votes[killers[0].id];
  const allVoted = killers.every((player) => votes[player.id]);
  const allSameTarget = Boolean(firstVote) && killers.every((player) => votes[player.id] === firstVote);
  const resolvedAfterTimerOrDon = allVoted && Boolean(room.nightActions.mafiaTargetId) && !room.nightActions.mafiaVoteDeadlineAt;
  return allSameTarget || resolvedAfterTimerOrDon;
}

function areVotesReady(room: Room) {
  const eligibleVoters = room.players.filter(
    (player) => player.alive && !player.isSpectator && player.id !== room.nightActions.mistressTargetId
  );
  return eligibleVoters.length > 0 && eligibleVoters.every((player) => room.votes[player.id]);
}

function startTieChallenge(io: Server | undefined, room: Room, candidateIds: string[]) {
  room.phase = "DAY_TIE_CHALLENGE";
  room.runoffCandidateIds = candidateIds;
  room.votes = {};
  room.tieChallenge = {
    candidateIds,
    progress: Object.fromEntries(
      candidateIds.map((playerId) => [
        playerId,
        {
          task: createTieChallengeTask(),
          score: 0
        }
      ])
    ),
    startedAt: Date.now(),
    deadlineAt: Date.now() + TIE_CHALLENGE_TIMEOUT_SEC * 1000
  };
  schedulePhaseTimerIfNeeded(io, room);
}

function resolveTieChallenge(io: Server | undefined, room: Room) {
  clearPhaseTimer(room.code);
  const challenge = room.tieChallenge;
  if (!challenge) return;

  const leaders = challenge.candidateIds
    .map((playerId) => ({
      playerId,
      score: challenge.progress[playerId]?.score ?? 0,
      lastAnsweredAt: challenge.progress[playerId]?.lastAnsweredAt ?? Number.POSITIVE_INFINITY
    }))
    .sort((first, second) => second.score - first.score || first.lastAnsweredAt - second.lastAnsweredAt);
  const bestScore = leaders[0]?.score ?? 0;
  const topScorers = leaders.filter((item) => item.score === bestScore);
  const survivorId = topScorers.length === 1 ? topScorers[0].playerId : undefined;
  const eliminatedIds = challenge.candidateIds.filter((playerId) => playerId !== survivorId);

  room.players = room.players.map((player) => (eliminatedIds.includes(player.id) ? { ...player, alive: false } : player));
  room.lastVoteEliminatedId = eliminatedIds.length === 1 ? eliminatedIds[0] : undefined;
  room.lastVoteEliminatedIds = eliminatedIds;

  const winner = checkWinner(room.players);
  if (winner) {
    room.winner = winner;
    room.phase = "GAME_OVER";
    room.phaseDeadlineAt = undefined;
    room.tieChallenge = undefined;
    room.runoffCandidateIds = undefined;
    clearMafiaVoteTimer(room.code);
    return;
  }

  room.votes = {};
  room.discussionReady = {};
  room.runoffCandidateIds = undefined;
  room.tieChallenge = undefined;
  room.nightActions = {};
  room.detectiveResult = undefined;
  room.donCheckResult = undefined;
  room.phaseDeadlineAt = undefined;
  room.phase = getNextPhase(room);
  scheduleMafiaVoteTimerIfNeeded(io, room);
  schedulePhaseTimerIfNeeded(io, room);
}

function createTieChallengeTask(): TieChallengeTask {
  return Math.random() < 0.6 ? createMathChallengeTask() : createAttentionChallengeTask();
}

function createMathChallengeTask(): TieChallengeTask {
  const first = randomInt(6, 29);
  const second = randomInt(3, 18);
  const third = randomInt(2, 12);
  const multiplierA = randomInt(3, 9);
  const multiplierB = randomInt(3, 9);
  const templates = [
    {
      prompt: `Сколько будет ${first} + ${second} - ${third}?`,
      answer: first + second - third
    },
    {
      prompt: `Сколько будет ${first} - ${second} + ${third}?`,
      answer: first - second + third
    },
    {
      prompt: `Сколько будет ${multiplierA} x ${multiplierB} + ${third}?`,
      answer: multiplierA * multiplierB + third
    }
  ];
  const picked = templates[randomInt(0, templates.length - 1)];
  const { options, correctOptionIndex } = makeNumericOptions(picked.answer);

  return {
    id: randomUUID(),
    type: "math",
    title: "Быстрый пример",
    prompt: picked.prompt,
    options,
    correctOptionIndex
  };
}

function createAttentionChallengeTask(): TieChallengeTask {
  const pools = [
    ["кот", "луна", "мост", "лес", "река", "огонь", "камень", "ключ", "снег", "сова"],
    ["7", "2", "9", "4", "6", "1", "8", "3", "5", "0"],
    ["◆", "▲", "●", "■", "★", "✦", "◇", "○", "▣", "△"]
  ];
  const pool = shuffleList(pools[randomInt(0, pools.length - 1)]);
  const sequence = pool.slice(0, 5);
  const targetIndex = randomInt(0, sequence.length - 1);
  const positionLabels = ["первым", "вторым", "третьим", "четвертым", "пятым"];
  const correct = sequence[targetIndex];
  const options = shuffleList([correct, ...pool.slice(5, 8)]).slice(0, 4);

  return {
    id: randomUUID(),
    type: "quick_memory",
    title: "Проверка внимания",
    prompt: `Запомни ряд: ${sequence.join(", ")}. Что было ${positionLabels[targetIndex]}?`,
    options,
    correctOptionIndex: options.indexOf(correct)
  };
}

function makeNumericOptions(answer: number) {
  const values = new Set([answer]);
  while (values.size < 4) {
    const offset = randomInt(-8, 8);
    if (offset !== 0) values.add(answer + offset);
  }
  const options = shuffleList([...values]).map(String);
  return {
    options,
    correctOptionIndex: options.indexOf(String(answer))
  };
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffleList<T>(items: T[]) {
  return [...items].sort(() => Math.random() - 0.5);
}

function fillMissingPhaseAction(room: Room) {
  if (room.phase === "NIGHT_MAFIA" && !room.nightActions.mafiaTargetId) {
    const target = room.players.find((player) => player.alive && !player.isSpectator && !isMafiaRole(player.role));
    if (target) {
      room.nightActions.mafiaVotes = {
        ...(room.nightActions.mafiaVotes ?? {}),
        ...Object.fromEntries(getAliveMafiaKillers(room).map((player) => [player.id, target.id]))
      };
      resolveMafiaVote(room, true);
    }
  }

  if (room.phase === "NIGHT_DETECTIVE" && !room.nightActions.detectiveTargetId) {
    const detective = room.players.find((player) => player.alive && player.role === "DETECTIVE");
    const target = room.players.find((player) => player.alive && !player.isSpectator && player.id !== detective?.id);
    if (detective && target) {
      room.nightActions.detectiveTargetId = target.id;
      room.detectiveResult = {
        detectiveId: detective.id,
        targetId: target.id,
        isMafia: isMafiaRole(target.role)
      };
    }
  }

  if (room.phase === "NIGHT_DON" && !room.nightActions.donCheckTargetId) {
    const don = room.players.find((player) => player.alive && player.role === "DON");
    const target = room.players.find((player) => player.alive && !player.isSpectator && !isMafiaRole(player.role));
    if (don && target) {
      room.nightActions.donCheckTargetId = target.id;
      room.donCheckResult = {
        donId: don.id,
        targetId: target.id,
        isDetective: target.role === "DETECTIVE"
      };
    }
  }

  if (room.phase === "NIGHT_DOCTOR" && !room.nightActions.doctorTargetId) {
    const doctor = room.players.find((player) => player.alive && player.role === "DOCTOR");
    if (doctor) room.nightActions.doctorTargetId = doctor.id;
  }

  if ((room.phase === "DAY_VOTING" || room.phase === "DAY_REVOTE") && !areVotesReady(room)) {
    const alivePlayers = room.players.filter((player) => player.alive && !player.isSpectator);
    for (const voter of alivePlayers) {
      if (voter.id === room.nightActions.mistressTargetId || room.votes[voter.id]) continue;
      const availableTargets =
        room.phase === "DAY_REVOTE"
          ? alivePlayers.filter((player) => room.runoffCandidateIds?.includes(player.id))
          : alivePlayers;
      const target = availableTargets.find((player) => player.id !== voter.id);
      if (target) room.votes[voter.id] = target.id;
    }
  }
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
    if (ref?.roomCode === roomCode) {
      socket.emit("room_updated", toPublicRoom(room, ref.playerId));
    }
  }
}

function toPublicRoom(room: Room, ownPlayerId: string): PublicRoom {
  const ownPlayer = room.players.find((player) => player.id === ownPlayerId);
  const canSeeAllRoles = Boolean(ownPlayer?.isHost && (ownPlayer.isSpectator || room.devMode));
  const ownRole = ownPlayer?.role;

  return {
    code: room.code,
    gameId: room.gameId,
    visibility: room.visibility,
    hostId: room.hostId,
    phase: room.phase,
    phaseDeadlineAt: room.phaseDeadlineAt,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      alive: player.alive,
      connected: player.connected,
      isHost: player.isHost,
      isSpectator: player.isSpectator,
      role: canSeeAllRoles || player.id === ownPlayerId ? player.role : undefined
    })),
    settings: room.settings,
    votes: sanitizeVotes(room.votes, canSeeAllRoles, room.phase, room.settings.voteVisibility, ownPlayerId),
    roleReady: room.roleReady,
    discussionReady: room.discussionReady,
    runoffCandidateIds: room.runoffCandidateIds,
    chatMessages: room.chatMessages,
    tieChallenge: sanitizeTieChallenge(room, canSeeAllRoles, ownPlayerId),
    createdAt: room.createdAt,
    ownPlayerId,
    ownRole,
    mafiaAllies:
      isMafiaRole(ownRole) || canSeeAllRoles
        ? room.players
            .filter((player) => !player.isSpectator && isMafiaRole(player.role))
            .map((player) => ({
              id: player.id,
              name: player.name,
              alive: player.alive,
              connected: player.connected,
              isHost: player.isHost,
              isSpectator: player.isSpectator,
              role: player.role
            }))
        : [],
    nightActions: sanitizeNightActions(room.nightActions, canSeeAllRoles, ownRole),
    detectiveResult:
      room.phase === "NIGHT_DETECTIVE" && (room.detectiveResult?.detectiveId === ownPlayerId || canSeeAllRoles)
        ? room.detectiveResult
        : undefined,
    donCheckResult:
      room.phase === "NIGHT_DON" && (room.donCheckResult?.donId === ownPlayerId || canSeeAllRoles)
        ? room.donCheckResult
        : undefined,
    lastNightKilledId: room.lastNightKilledId,
    lastVoteEliminatedId: room.lastVoteEliminatedId,
    lastVoteEliminatedIds: room.lastVoteEliminatedIds,
    winner: room.winner
  };
}

function toPublicLobbyRoom(room: Room): PublicLobbyRoom {
  const connectedPlayers = room.players.filter((player) => player.connected && !player.isBot && !player.isSpectator);
  const host = room.players.find((player) => player.id === room.hostId);

  return {
    code: room.code,
    gameId: room.gameId,
    phase: room.phase,
    playersCount: connectedPlayers.length,
    maxPlayers: 15,
    hostName: host?.name,
    createdAt: room.createdAt
  };
}

function sanitizeVotes(
  votes: Votes,
  canSeeAllVotes: boolean,
  phase: Room["phase"],
  voteVisibility: Room["settings"]["voteVisibility"],
  ownPlayerId: string
) {
  if (canSeeAllVotes) return votes;
  if (phase !== "DAY_VOTING" && phase !== "DAY_REVOTE") return {};
  if (voteVisibility === "public") return votes;
  return votes[ownPlayerId] ? { [ownPlayerId]: votes[ownPlayerId] } : {};
}

function sanitizeTieChallenge(room: Room, canSeeAllAnswers: boolean, ownPlayerId: string): PublicRoom["tieChallenge"] {
  if (!room.tieChallenge) return undefined;
  const progressEntries = Object.entries(room.tieChallenge.progress).filter(
    ([playerId]) => canSeeAllAnswers || playerId === ownPlayerId
  );
  const progress = Object.fromEntries(
    progressEntries.map(([playerId, item]) => {
      const { correctOptionIndex, ...task } = item.task;
      return [playerId, { ...item, task }];
    })
  );
  return {
    ...room.tieChallenge,
    progress
  };
}

function sanitizeNightActions(nightActions: NightActions, canSeeAllRoles: boolean, ownRole?: Player["role"]) {
  if (canSeeAllRoles) return nightActions;
  if (ownRole === "DETECTIVE") {
    return { detectiveTargetId: nightActions.detectiveTargetId };
  }
  if (ownRole === "DOCTOR") {
    return { doctorTargetId: nightActions.doctorTargetId };
  }
  if (ownRole === "DON") {
    return {
      mafiaTargetId: nightActions.mafiaTargetId,
      mafiaVotes: nightActions.mafiaVotes,
      mafiaVoteDeadlineAt: nightActions.mafiaVoteDeadlineAt,
      donCheckTargetId: nightActions.donCheckTargetId,
      mistressTargetId: nightActions.mistressTargetId
    };
  }
  if (!isMafiaRole(ownRole)) return undefined;

  return {
    mafiaTargetId: nightActions.mafiaTargetId,
    mafiaVotes: nightActions.mafiaVotes,
    mafiaVoteDeadlineAt: nightActions.mafiaVoteDeadlineAt,
    mistressTargetId: nightActions.mistressTargetId
  };
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function refreshStatsDay() {
  const today = new Date().toDateString();
  if (today === statsDay) return;

  statsDay = today;
  totalRoomsCreatedToday = 0;
}
