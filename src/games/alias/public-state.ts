import { getCurrentAliasWord } from "./game";
import type { AliasRoomState, PublicAliasRoomState, PublicAliasTurn } from "./types";

export function getPublicAliasState(room: AliasRoomState, viewerId: string): PublicAliasRoomState {
  const { hostKey: _hostKey, usedWordIds: _usedWordIds, previousWordId: _previousWordId, currentTurn, ...publicRoom } = room;
  void _hostKey;
  void _usedWordIds;
  void _previousWordId;
  const viewer = room.players.find((player) => player.id === viewerId);
  const currentWord = currentTurn && currentTurn.explainerPlayerId === viewerId && (room.phase === "TURN_ACTIVE" || room.phase === "LAST_WORD")
    ? getCurrentAliasWord(room)
    : undefined;
  const publicTurn: PublicAliasTurn | undefined = currentTurn ? {
    turnNumber: currentTurn.turnNumber,
    teamId: currentTurn.teamId,
    explainerPlayerId: currentTurn.explainerPlayerId,
    words: room.phase === "TURN_RESULT" || room.phase === "GAME_OVER" || viewer?.isHost || currentTurn.explainerPlayerId === viewerId
      ? currentTurn.words.map((entry) => ({ ...entry }))
      : [],
    startedAt: currentTurn.startedAt,
    deadlineAt: currentTurn.deadlineAt,
    lastWordWinnerTeamId: currentTurn.lastWordWinnerTeamId,
    scoreDeltasByTeamId: { ...currentTurn.scoreDeltasByTeamId },
    scoreApplied: currentTurn.scoreApplied,
    resultConfirmed: currentTurn.resultConfirmed,
    currentWord,
    guessedCount: currentTurn.words.filter((entry) => entry.result === "guessed" && !entry.id.includes("-last-")).length,
    skippedCount: currentTurn.words.filter((entry) => entry.result === "skipped").length,
    scoreDelta: currentTurn.words.filter((entry) => !entry.id.includes("-last-")).reduce((sum, entry) => sum + entry.points, 0),
    canReviewWords: Boolean(viewer?.isHost || currentTurn.explainerPlayerId === viewerId)
  } : undefined;
  return {
    ...publicRoom,
    ownPlayerId: viewerId,
    currentTurn: publicTurn,
    devSecrets: room.devMode && viewer?.isHost ? { currentWord: getCurrentAliasWord(room) } : undefined
  };
}
