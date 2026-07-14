import type { BunkerPlayer, BunkerTieMode, BunkerVote, BunkerVotingResult } from "./types";

export function resolveBunkerVotes({
  players,
  votes,
  tieMode,
  isRevote = false,
  candidates,
  doubleVotePlayerIds = []
}: {
  players: BunkerPlayer[];
  votes: BunkerVote;
  tieMode: BunkerTieMode;
  isRevote?: boolean;
  candidates?: string[];
  doubleVotePlayerIds?: string[];
}): BunkerVotingResult {
  const aliveIds = new Set(players.filter((player) => player.status === "alive").map((player) => player.id));
  const candidateSet = candidates ? new Set(candidates) : aliveIds;
  const counts = new Map<string, number>();

  const doubleVotes = new Set(doubleVotePlayerIds);
  for (const [voterId, targetId] of Object.entries(votes)) {
    if (!aliveIds.has(targetId) || !candidateSet.has(targetId)) continue;
    counts.set(targetId, (counts.get(targetId) ?? 0) + (doubleVotes.has(voterId) ? 2 : 1));
  }

  const maxVotes = Math.max(0, ...counts.values());
  const leaders = [...counts.entries()].filter(([, count]) => count === maxVotes && count > 0).map(([id]) => id);

  if (leaders.length === 1) return { round: 0, votes: { ...votes }, eliminatedPlayerId: leaders[0], isRevote };
  if (leaders.length === 0) return { round: 0, votes: { ...votes }, noElimination: true, isRevote };
  if (tieMode === "no_elimination") return { round: 0, votes: { ...votes }, tiedPlayerIds: leaders, noElimination: true, isRevote };
  if (tieMode === "random" || isRevote) {
    return { round: 0, votes: { ...votes }, tiedPlayerIds: leaders, eliminatedPlayerId: leaders[Math.floor(Math.random() * leaders.length)], isRevote };
  }
  return { round: 0, votes: { ...votes }, tiedPlayerIds: leaders, isRevote };
}
