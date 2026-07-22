import { getEnabledLocations } from "./logic";
import type { PublicSpyRoomState, PublicSpyRoundState, SpyPrivateState, SpyRoomState } from "./types";

export function getPublicSpyState(room: SpyRoomState, viewerId: string): PublicSpyRoomState {
  const { hostKey: _hostKey, round, previousSpyIds: _previousSpyIds, usedLocationIds: _usedLocationIds, ...publicRoom } = room;
  void _hostKey;
  void _previousSpyIds;
  void _usedLocationIds;
  const publicRound = round ? toPublicRound(room) : undefined;
  const privateState = round ? toPrivateState(room, viewerId) : undefined;
  return {
    ...publicRoom,
    ownPlayerId: viewerId,
    round: publicRound,
    privateState,
    devSecrets: room.devMode && room.players.find((player) => player.id === viewerId)?.isHost
      ? {
          location: round ? getEnabledLocations(room).find((location) => location.id === round.locationId) : undefined,
          spyIds: round ? [...round.spyIds] : [],
          rolesByPlayerId: round ? { ...round.rolesByPlayerId } : {}
        }
      : undefined
  };
}

function toPublicRound(room: SpyRoomState): PublicSpyRoundState {
  const round = room.round!;
  const participantIds = [...new Set([...round.spyIds, ...Object.keys(round.rolesByPlayerId)])];
  const activeCount = room.players.filter((player) => participantIds.includes(player.id) && (player.connected || player.isBot)).length;
  return {
    viewedCount: round.viewedPlayerIds.filter((id) => participantIds.includes(id)).length,
    confirmedCount: round.confirmedPlayerIds.filter((id) => participantIds.includes(id)).length,
    activePlayersCount: activeCount,
    currentQuestionerId: round.currentQuestionerId,
    currentResponderId: round.currentResponderId,
    earlyVotePlayerIds: [...round.earlyVotePlayerIds],
    votesSubmitted: round.confirmedVotePlayerIds.length,
    revoteCandidateIds: round.revoteCandidateIds ? [...round.revoteCandidateIds] : undefined,
    foundSpyIds: [...round.foundSpyIds],
    guessingSpyId: round.guessingSpyId,
    result: round.result
  };
}

function toPrivateState(room: SpyRoomState, viewerId: string): SpyPrivateState | undefined {
  const round = room.round!;
  const isSpy = round.spyIds.includes(viewerId);
  if (!isSpy && round.rolesByPlayerId[viewerId] === undefined) return undefined;
  const revealSecrets = room.phase === "ROUND_RESULT" || room.phase === "GAME_RESULT";
  const location = getEnabledLocations(room).find((item) => item.id === round.locationId);
  const canGuess = room.phase === "SPY_GUESS" && round.guessingSpyId === viewerId;
  return {
    playerId: viewerId,
    isSpy,
    hasViewedRole: round.viewedPlayerIds.includes(viewerId),
    hasConfirmedRole: round.confirmedPlayerIds.includes(viewerId),
    hasConfirmedVote: round.confirmedVotePlayerIds.includes(viewerId),
    selectedVoteId: round.votes[viewerId],
    location: !isSpy || revealSecrets
      ? location && { id: location.id, name: location.name, description: location.description }
      : undefined,
    locationRole: !isSpy || revealSecrets ? round.rolesByPlayerId[viewerId] : undefined,
    availableLocations: canGuess || (isSpy && room.settings.showLocationList)
      ? getEnabledLocations(room)
          .filter((item) => !room.settings.hideUsedLocations || item.id === round.locationId || !room.usedLocationIds.includes(item.id))
          .map(({ id, name }) => ({ id, name }))
      : undefined
  };
}
