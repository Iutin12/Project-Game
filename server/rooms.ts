import type { Server, Socket } from "socket.io";
import { randomUUID } from "node:crypto";
import {
  assignRoles,
  checkWinner,
  defaultMafiaSettings,
  getNextPhase,
  resolveNight,
  resolveVotes
} from "../src/games/mafia/logic";
import type { NightActions, Player, PublicRoom, Room, Votes } from "../src/games/mafia/types";

const rooms = new Map<string, Room>();
const socketPlayers = new Map<string, { roomCode: string; playerId: string }>();

export function createRoom() {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();

  const room: Room = {
    code,
    gameId: "mafia",
    hostKey: randomUUID(),
    phase: "LOBBY",
    players: [],
    settings: { ...defaultMafiaSettings },
    nightActions: {},
    votes: {},
    createdAt: Date.now()
  };

  rooms.set(code, room);
  return { code, hostKey: room.hostKey };
}

export function getRoom(code: string) {
  return rooms.get(code.toUpperCase());
}

export function registerRoomSockets(io: Server) {
  io.on("connection", (socket) => {
    socket.on("join_room", (payload: { code: string; name: string; hostKey?: string }, ack) => {
      const room = getRoom(payload.code);
      const name = payload.name?.trim().slice(0, 24);

      if (!room) return ack?.({ ok: false, error: "Комната не найдена" });
      if (!name) return ack?.({ ok: false, error: "Введите никнейм" });
      if (room.players.length >= 15) return ack?.({ ok: false, error: "Комната заполнена" });

      const player: Player = {
        id: randomUUID(),
        name,
        alive: true,
        connected: true,
        isHost: payload.hostKey === room.hostKey || (!room.hostId && room.players.length === 0)
      };

      if (player.isHost) room.hostId = player.id;
      room.players.push(player);
      socketPlayers.set(socket.id, { roomCode: room.code, playerId: player.id });
      socket.join(room.code);
      ack?.({ ok: true, playerId: player.id });
      emitRoom(io, room.code);
    });

    socket.on("start_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        const connectedPlayers = room.players.filter((player) => player.connected);
        if (connectedPlayers.length < 5) {
          return { ok: false, error: "Для старта нужно минимум 5 игроков" };
        }

        room.players = assignRoles(room.players, room);
        room.phase = "ROLE_REVEAL";
        room.nightActions = {};
        room.votes = {};
        room.winner = undefined;
        room.lastNightKilledId = undefined;
        room.lastVoteEliminatedId = undefined;
        room.detectiveResult = undefined;
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("next_phase", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        if (room.phase === "NIGHT_DOCTOR") {
          const resolved = resolveNight(room.players, room.nightActions);
          room.players = resolved.players;
          room.lastNightKilledId = resolved.killedId;
          const winner = checkWinner(room.players);
          if (winner) {
            room.winner = winner;
            room.phase = "GAME_OVER";
            return { ok: true };
          }
        }

        if (room.phase === "DAY_VOTING") {
          const resolved = resolveVotes(room.players, room.votes);
          room.players = resolved.players;
          room.lastVoteEliminatedId = resolved.eliminatedId;
          const winner = checkWinner(room.players);
          if (winner) {
            room.winner = winner;
            room.phase = "GAME_OVER";
            return { ok: true };
          }
          room.votes = {};
          room.nightActions = {};
          room.detectiveResult = undefined;
        }

        room.phase = getNextPhase(room);
        return { ok: true };
      });
      ack?.(result);
      emitOwnRoom(io, socket);
    });

    socket.on("mafia_choose_target", (payload: { targetId: string }, ack) => {
      ack?.(
        withPlayerRoom(socket, (room, player) => {
          if (room.phase !== "NIGHT_MAFIA" || player.role !== "MAFIA" || !player.alive) {
            return { ok: false, error: "Сейчас нельзя выбрать жертву" };
          }
          room.nightActions.mafiaTargetId = payload.targetId;
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
          const target = room.players.find((item) => item.id === payload.targetId);
          if (!target) return { ok: false, error: "Игрок не найден" };
          room.nightActions.detectiveTargetId = payload.targetId;
          room.detectiveResult = {
            detectiveId: player.id,
            targetId: target.id,
            isMafia: target.role === "MAFIA"
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
          room.nightActions.doctorTargetId = payload.targetId;
          return { ok: true };
        })
      );
      emitOwnRoom(io, socket);
    });

    socket.on("cast_vote", (payload: { targetId: string }, ack) => {
      ack?.(
        withPlayerRoom(socket, (room, player) => {
          if (room.phase !== "DAY_VOTING" || !player.alive) {
            return { ok: false, error: "Сейчас нельзя голосовать" };
          }
          room.votes[player.id] = payload.targetId;
          return { ok: true };
        })
      );
      emitOwnRoom(io, socket);
    });

    socket.on("restart_game", (_, ack) => {
      const result = withHostRoom(socket, (room) => {
        room.phase = "LOBBY";
        room.players = room.players.map((player) => ({ ...player, alive: true, role: undefined }));
        room.nightActions = {};
        room.votes = {};
        room.winner = undefined;
        room.lastNightKilledId = undefined;
        room.lastVoteEliminatedId = undefined;
        room.detectiveResult = undefined;
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
      if (player) player.connected = false;
      socketPlayers.delete(socket.id);
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
  const isHost = Boolean(ownPlayer?.isHost);
  const ownRole = ownPlayer?.role;

  return {
    code: room.code,
    gameId: room.gameId,
    hostId: room.hostId,
    phase: room.phase,
    players: room.players.map((player) => ({
      id: player.id,
      name: player.name,
      alive: player.alive,
      connected: player.connected,
      isHost: player.isHost,
      role: isHost || player.id === ownPlayerId ? player.role : undefined
    })),
    settings: room.settings,
    votes: sanitizeVotes(room.votes, isHost),
    createdAt: room.createdAt,
    ownPlayerId,
    ownRole,
    mafiaAllies:
      ownRole === "MAFIA" || isHost
        ? room.players
            .filter((player) => player.role === "MAFIA")
            .map((player) => ({
              id: player.id,
              name: player.name,
              alive: player.alive,
              connected: player.connected,
              isHost: player.isHost,
              role: player.role
            }))
        : [],
    nightActions: isHost ? room.nightActions : undefined,
    detectiveResult:
      room.detectiveResult?.detectiveId === ownPlayerId || isHost ? room.detectiveResult : undefined,
    lastNightKilledId: room.lastNightKilledId,
    lastVoteEliminatedId: room.lastVoteEliminatedId,
    winner: room.winner
  };
}

function sanitizeVotes(votes: Votes, isHost: boolean) {
  return isHost ? votes : {};
}

function makeRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}
