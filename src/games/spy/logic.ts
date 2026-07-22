import { getAllSpyLocations } from "./locations";
import { defaultSpySettings, getSpyCount } from "./settings";
import type {
  SpyLocation,
  SpyPlayer,
  SpyRoomState,
  SpyRoundResult,
  SpyRoundState,
  SpyRoundWinReason,
  SpySettings,
  SpyWinningSide
} from "./types";

const MIN_PLAYERS = 3;
const MAX_REVOTES = 2;

export function createSpyRoomState(input: {
  code: string;
  hostKey: string;
  visibility?: SpyRoomState["visibility"];
  devMode?: boolean;
}): SpyRoomState {
  const now = Date.now();
  return {
    code: input.code,
    gameId: "spy",
    visibility: input.visibility ?? "private",
    hostKey: input.hostKey,
    phase: "LOBBY",
    players: [],
    settings: structuredClone(defaultSpySettings),
    currentRound: 0,
    usedLocationIds: [],
    previousSpyIds: [],
    roundHistory: [],
    chatMessages: [],
    eventLog: [],
    createdAt: now,
    lastActivityAt: now,
    devMode: input.devMode
  };
}

export function getSpyStartError(room: SpyRoomState) {
  const players = getLobbyPlayers(room);
  const spyCount = getSpyCount(players.length, room.settings.spyCount);
  if (room.phase !== "LOBBY") return "Игра уже запущена.";
  if (players.length < MIN_PLAYERS) return `Нужно минимум ${MIN_PLAYERS} игрока.`;
  if (spyCount < 1 || spyCount >= players.length) return "Количество шпионов должно быть меньше количества обычных игроков.";
  if (room.settings.requireReady && players.some((player) => !player.ready)) return "Не все игроки готовы.";
  if (!getEnabledLocations(room).length) return "Включите хотя бы одну локацию.";
  return undefined;
}

export function setSpyPlayerReady(room: SpyRoomState, playerId: string, ready: boolean) {
  assertPhase(room, "LOBBY");
  const player = getPlayer(room, playerId);
  player.ready = ready;
  touch(room);
}

export function startSpyGame(room: SpyRoomState) {
  const error = getSpyStartError(room);
  if (error) throw new Error(error);
  room.currentRound = 1;
  room.usedLocationIds = [];
  room.previousSpyIds = [];
  room.roundHistory = [];
  room.players.forEach((player) => {
    player.score = 0;
    player.ready = false;
  });
  startSpyRound(room);
}

export function startSpyRound(room: SpyRoomState, forced?: { locationId?: string; spyIds?: string[] }) {
  const players = getLobbyPlayers(room);
  if (players.length < MIN_PLAYERS) throw new Error(`Нужно минимум ${MIN_PLAYERS} подключенных игрока.`);
  const locations = getEnabledLocations(room);
  if (!locations.length) throw new Error("Нет доступных локаций.");
  const location = forced?.locationId
    ? locations.find((item) => item.id === forced.locationId)
    : pickRoundLocation(room, locations);
  if (!location) throw new Error("Выбранная локация недоступна.");
  const spyCount = getSpyCount(players.length, room.settings.spyCount);
  const spyIds = forced?.spyIds?.length
    ? forced.spyIds.filter((id) => players.some((player) => player.id === id)).slice(0, spyCount)
    : pickSpies(players, spyCount, room.previousSpyIds);
  if (spyIds.length !== spyCount) throw new Error("Не удалось назначить нужное количество шпионов.");

  const rolesByPlayerId: Record<string, string> = {};
  const roles = shuffle(location.roles);
  players.forEach((player, index) => {
    if (!spyIds.includes(player.id)) rolesByPlayerId[player.id] = room.settings.useLocationRoles ? roles[index % roles.length] : "Обычный игрок";
  });

  const firstPlayer = room.settings.randomFirstTurn ? pick(players) : players[0];
  const responder = nextPlayer(players, firstPlayer.id);
  room.round = {
    locationId: location.id,
    spyIds,
    rolesByPlayerId,
    viewedPlayerIds: [],
    confirmedPlayerIds: [],
    currentQuestionerId: firstPlayer.id,
    currentResponderId: responder?.id,
    earlyVotePlayerIds: [],
    votes: {},
    confirmedVotePlayerIds: [],
    revoteCount: 0,
    foundSpyIds: []
  };
  room.phase = "ROLE_REVEAL";
  room.deadlineAt = undefined;
  room.usedLocationIds = [...new Set([...room.usedLocationIds, location.id])];
  room.previousSpyIds = spyIds;
  addEvent(room, `Раунд ${room.currentRound} начался.`);
  touch(room);
}

export function viewSpyRole(room: SpyRoomState, playerId: string) {
  if (room.phase !== "ROLE_REVEAL" && room.phase !== "WAITING_FOR_CONFIRMATION") throw new Error("Сейчас нельзя открыть роль.");
  const round = getRound(room);
  assertRoundParticipant(room, playerId);
  round.viewedPlayerIds = addUnique(round.viewedPlayerIds, playerId);
  if (allActiveRoundPlayers(room).every((player) => round.viewedPlayerIds.includes(player.id))) {
    room.phase = "WAITING_FOR_CONFIRMATION";
  }
  touch(room);
}

export function confirmSpyRole(room: SpyRoomState, playerId: string) {
  assertPhase(room, "WAITING_FOR_CONFIRMATION");
  const round = getRound(room);
  assertRoundParticipant(room, playerId);
  if (!round.viewedPlayerIds.includes(playerId)) throw new Error("Сначала посмотрите свою роль.");
  round.confirmedPlayerIds = addUnique(round.confirmedPlayerIds, playerId);
  if (allActiveRoundPlayers(room).every((player) => round.confirmedPlayerIds.includes(player.id))) beginSpyDiscussion(room);
  touch(room);
}

export function forceStartSpyDiscussion(room: SpyRoomState) {
  if (room.phase !== "ROLE_REVEAL" && room.phase !== "WAITING_FOR_CONFIRMATION") throw new Error("Обсуждение сейчас нельзя начать.");
  beginSpyDiscussion(room);
}

export function beginSpyDiscussion(room: SpyRoomState) {
  const round = getRound(room);
  room.phase = "DISCUSSION";
  round.earlyVotePlayerIds = [];
  room.deadlineAt = room.settings.discussionTimeSec > 0 ? Date.now() + room.settings.discussionTimeSec * 1000 : undefined;
  addEvent(room, "Началось обсуждение.");
  touch(room);
}

export function advanceSpyQuestion(room: SpyRoomState, playerId: string) {
  assertPhase(room, "DISCUSSION");
  if (room.settings.questionMode !== "turns") throw new Error("Пошаговый режим вопросов выключен.");
  const round = getRound(room);
  if (round.currentResponderId !== playerId && round.currentQuestionerId !== playerId) throw new Error("Сейчас ход другого игрока.");
  const players = allActiveRoundPlayers(room).filter((player) => !round.foundSpyIds.includes(player.id));
  const nextQuestioner = nextPlayer(players, round.currentQuestionerId ?? players[0]?.id);
  const nextResponder = nextQuestioner ? nextPlayer(players, nextQuestioner.id) : undefined;
  round.currentQuestionerId = nextQuestioner?.id;
  round.currentResponderId = nextResponder?.id;
  touch(room);
}

export function requestSpyVoting(room: SpyRoomState, playerId: string) {
  assertPhase(room, "DISCUSSION");
  if (!room.settings.allowEarlyVoting) throw new Error("Досрочное голосование выключено.");
  const round = getRound(room);
  assertRoundParticipant(room, playerId);
  round.earlyVotePlayerIds = addUnique(round.earlyVotePlayerIds, playerId);
  const activePlayers = allActiveRoundPlayers(room).filter((player) => !round.foundSpyIds.includes(player.id));
  if (round.earlyVotePlayerIds.filter((id) => activePlayers.some((player) => player.id === id)).length > activePlayers.length / 2) {
    beginSpyVoting(room);
  }
  touch(room);
}

export function beginSpyVoting(room: SpyRoomState, candidates?: string[]) {
  const round = getRound(room);
  room.phase = candidates ? "REVOTE" : "VOTING";
  round.votes = {};
  round.confirmedVotePlayerIds = [];
  round.revoteCandidateIds = candidates;
  room.deadlineAt = Date.now() + room.settings.votingTimeSec * 1000;
  addEvent(room, candidates ? "Началось переголосование." : "Началось голосование.");
  touch(room);
}

export function selectSpyVote(room: SpyRoomState, voterId: string, targetId: string) {
  if (room.phase !== "VOTING" && room.phase !== "REVOTE") throw new Error("Сейчас голосование не идет.");
  const round = getRound(room);
  assertEligibleVoter(room, voterId);
  if (round.confirmedVotePlayerIds.includes(voterId)) throw new Error("Голос уже подтвержден.");
  if (voterId === targetId) throw new Error("Нельзя голосовать за себя.");
  const candidates = getVotingCandidates(room);
  if (!candidates.some((player) => player.id === targetId)) throw new Error("Этот игрок не участвует в голосовании.");
  round.votes[voterId] = targetId;
  touch(room);
}

export function confirmSpyVote(room: SpyRoomState, voterId: string) {
  if (room.phase !== "VOTING" && room.phase !== "REVOTE") throw new Error("Сейчас голосование не идет.");
  const round = getRound(room);
  assertEligibleVoter(room, voterId);
  if (!round.votes[voterId]) throw new Error("Сначала выберите игрока.");
  round.confirmedVotePlayerIds = addUnique(round.confirmedVotePlayerIds, voterId);
  if (allEligibleVoters(room).every((player) => round.confirmedVotePlayerIds.includes(player.id))) resolveSpyVoting(room);
  touch(room);
}

export function resolveSpyVoting(room: SpyRoomState) {
  if (room.phase !== "VOTING" && room.phase !== "REVOTE") throw new Error("Сейчас голосование не идет.");
  const round = getRound(room);
  const confirmedVotes = Object.fromEntries(Object.entries(round.votes).filter(([voterId]) => round.confirmedVotePlayerIds.includes(voterId)));
  const counts = new Map<string, number>();
  Object.values(confirmedVotes).forEach((targetId) => counts.set(targetId, (counts.get(targetId) ?? 0) + 1));
  const highest = Math.max(0, ...counts.values());
  const tiedIds = [...counts.entries()].filter(([, count]) => count === highest && highest > 0).map(([id]) => id);

  if (tiedIds.length !== 1) {
    resolveVotingTie(room, tiedIds);
    return;
  }
  resolveSelectedPlayer(room, tiedIds[0]);
}

export function resolveSpyHostTie(room: SpyRoomState, hostId: string, targetId: string) {
  if (room.settings.tieMode !== "host") throw new Error("Решение ведущего не включено.");
  if (room.hostId !== hostId) throw new Error("Только ведущий может решить ничью.");
  const round = getRound(room);
  if (room.phase !== "REVOTE" || !round.revoteCandidateIds?.includes(targetId)) throw new Error("Игрок не входит в список кандидатов.");
  resolveSelectedPlayer(room, targetId);
}

export function startSpyLocationGuess(room: SpyRoomState, playerId: string) {
  assertPhase(room, "DISCUSSION");
  if (!room.settings.allowSpyGuess) throw new Error("Попытка угадать локацию выключена.");
  const round = getRound(room);
  if (!round.spyIds.includes(playerId) || round.foundSpyIds.includes(playerId)) throw new Error("Только активный шпион может угадывать локацию.");
  room.phase = "SPY_GUESS";
  round.guessingSpyId = playerId;
  round.guessOrigin = "discussion";
  room.deadlineAt = Date.now() + room.settings.votingTimeSec * 1000;
  touch(room);
}

export function submitSpyLocationGuess(room: SpyRoomState, playerId: string, locationId: string) {
  assertPhase(room, "SPY_GUESS");
  const round = getRound(room);
  if (round.guessingSpyId !== playerId) throw new Error("Сейчас угадывает другой игрок.");
  if (!getEnabledLocations(room).some((location) => location.id === locationId)) throw new Error("Такой локации нет в игре.");
  round.guessedLocationId = locationId;
  if (locationId === round.locationId) {
    finishSpyRound(room, "spies", "spy_guessed_location");
    return;
  }
  if (round.guessOrigin === "last_chance" && !allSpiesFound(round)) {
    round.guessingSpyId = undefined;
    round.guessOrigin = undefined;
    beginSpyVoting(room);
    return;
  }
  finishSpyRound(room, "civilians", "spy_guess_failed");
}

export function forceFinishSpyRound(room: SpyRoomState, winner: SpyWinningSide = "spies") {
  if (!room.round) throw new Error("Раунд еще не начался.");
  finishSpyRound(room, winner, "host_finished_round");
}

export function continueSpyGame(room: SpyRoomState) {
  if (room.phase === "ROUND_RESULT") {
    if (room.settings.totalRounds !== null && room.currentRound >= room.settings.totalRounds) {
      room.phase = "GAME_RESULT";
      room.deadlineAt = undefined;
      touch(room);
      return;
    }
    room.currentRound += 1;
    startSpyRound(room);
    return;
  }
  if (room.phase === "GAME_RESULT") resetSpyRoomToLobby(room);
  else throw new Error("Сейчас продолжить игру нельзя.");
}

export function resetSpyRoomToLobby(room: SpyRoomState) {
  room.phase = "LOBBY";
  room.round = undefined;
  room.currentRound = 0;
  room.deadlineAt = undefined;
  room.players.forEach((player) => {
    player.ready = false;
  });
  addEvent(room, "Комната вернулась в лобби.");
  touch(room);
}

export function handleSpyDeadline(room: SpyRoomState, now = Date.now()) {
  if (!room.deadlineAt || room.deadlineAt > now || !room.round) return false;
  if (room.phase === "DISCUSSION") {
    if (room.settings.autoStartVoting) beginSpyVoting(room);
    else finishSpyRound(room, "spies", "spy_not_found");
    return true;
  }
  if (room.phase === "VOTING" || room.phase === "REVOTE") {
    const round = getRound(room);
    Object.keys(round.votes).forEach((voterId) => {
      if (!round.confirmedVotePlayerIds.includes(voterId)) round.confirmedVotePlayerIds.push(voterId);
    });
    resolveSpyVoting(room);
    return true;
  }
  if (room.phase === "SPY_GUESS") {
    if (room.round.guessOrigin === "last_chance" && !allSpiesFound(room.round)) beginSpyVoting(room);
    else finishSpyRound(room, "civilians", "spy_guess_failed");
    return true;
  }
  return false;
}

export function getEnabledLocations(room: SpyRoomState): SpyLocation[] {
  const enabled = new Set(room.settings.enabledLocationIds);
  return getAllSpyLocations(room.settings.customLocations).filter((location) => enabled.has(location.id));
}

export function getVotingCandidates(room: SpyRoomState) {
  const round = getRound(room);
  const allowed = round.revoteCandidateIds ? new Set(round.revoteCandidateIds) : undefined;
  return room.players.filter((player) => round.rolesByPlayerId[player.id] !== undefined || round.spyIds.includes(player.id))
    .filter((player) => !round.foundSpyIds.includes(player.id))
    .filter((player) => !allowed || allowed.has(player.id));
}

function resolveVotingTie(room: SpyRoomState, tiedIds: string[]) {
  const round = getRound(room);
  if (!tiedIds.length) {
    finishSpyRound(room, "spies", "voting_tie");
    return;
  }
  if (room.settings.tieMode === "random") {
    resolveSelectedPlayer(room, pick(tiedIds));
    return;
  }
  if (room.settings.tieMode === "no_result" || round.revoteCount >= MAX_REVOTES) {
    finishSpyRound(room, "spies", "voting_tie");
    return;
  }
  round.revoteCount += 1;
  beginSpyVoting(room, tiedIds);
}

function resolveSelectedPlayer(room: SpyRoomState, selectedId: string) {
  const round = getRound(room);
  if (!round.spyIds.includes(selectedId)) {
    finishSpyRound(room, "spies", "wrong_player_eliminated");
    return;
  }
  round.foundSpyIds = addUnique(round.foundSpyIds, selectedId);
  if (room.settings.lastChance) {
    room.phase = "SPY_GUESS";
    round.guessingSpyId = selectedId;
    round.guessOrigin = "last_chance";
    room.deadlineAt = Date.now() + room.settings.votingTimeSec * 1000;
    addEvent(room, "Найденный шпион получает последнюю попытку.");
    touch(room);
    return;
  }
  if (allSpiesFound(round)) finishSpyRound(room, "civilians", "all_spies_found");
  else beginSpyVoting(room);
}

function finishSpyRound(room: SpyRoomState, winningSide: SpyWinningSide, reason: SpyRoundWinReason) {
  const round = getRound(room);
  const location = getAllSpyLocations(room.settings.customLocations).find((item) => item.id === round.locationId);
  if (!location) throw new Error("Локация раунда не найдена.");
  const scoreDeltas = calculateScoreDeltas(room, winningSide, reason);
  if (room.settings.useScoring) {
    room.players.forEach((player) => {
      player.score += scoreDeltas[player.id] ?? 0;
    });
  }
  const result: SpyRoundResult = {
    roundNumber: room.currentRound,
    winningSide,
    reason,
    location,
    spyIds: [...round.spyIds],
    rolesByPlayerId: { ...round.rolesByPlayerId },
    votes: { ...round.votes },
    guessedLocationId: round.guessedLocationId,
    scoreDeltas
  };
  round.result = result;
  room.roundHistory.push(result);
  room.phase = "ROUND_RESULT";
  room.deadlineAt = undefined;
  addEvent(room, winningSide === "spies" ? "Раунд выиграли шпионы." : "Раунд выиграли обычные игроки.");
  touch(room);
}

function calculateScoreDeltas(room: SpyRoomState, winningSide: SpyWinningSide, reason: SpyRoundWinReason) {
  const round = getRound(room);
  const deltas: Record<string, number> = {};
  const participants = roundParticipantIds(round);
  participants.forEach((id) => {
    deltas[id] = 0;
  });
  if (winningSide === "civilians") {
    participants.filter((id) => !round.spyIds.includes(id)).forEach((id) => {
      deltas[id] += 2;
      if (round.spyIds.includes(round.votes[id])) deltas[id] += 1;
    });
  } else {
    round.spyIds.forEach((id) => {
      if (reason === "spy_guessed_location") deltas[id] += 4;
      else if (reason === "wrong_player_eliminated") deltas[id] += 2;
      else if (reason === "spy_not_found" || reason === "voting_tie") deltas[id] += 1;
    });
  }
  return deltas;
}

function getLobbyPlayers(room: SpyRoomState) {
  return room.players.filter((player) => player.connected || player.isBot);
}

function allActiveRoundPlayers(room: SpyRoomState) {
  const round = getRound(room);
  const ids = new Set(roundParticipantIds(round));
  return room.players.filter((player) => ids.has(player.id) && (player.connected || player.isBot));
}

function allEligibleVoters(room: SpyRoomState) {
  const round = getRound(room);
  return allActiveRoundPlayers(room).filter((player) => !round.foundSpyIds.includes(player.id));
}

function assertEligibleVoter(room: SpyRoomState, playerId: string) {
  if (!allEligibleVoters(room).some((player) => player.id === playerId)) throw new Error("Вы не участвуете в этом голосовании.");
}

function assertRoundParticipant(room: SpyRoomState, playerId: string) {
  if (!roundParticipantIds(getRound(room)).includes(playerId)) throw new Error("Игрок не участвует в этом раунде.");
}

function roundParticipantIds(round: SpyRoundState) {
  return [...new Set([...round.spyIds, ...Object.keys(round.rolesByPlayerId)])];
}

function allSpiesFound(round: SpyRoundState) {
  return round.spyIds.every((id) => round.foundSpyIds.includes(id));
}

function pickRoundLocation(room: SpyRoomState, locations: SpyLocation[]) {
  let pool = locations;
  if (!room.settings.allowRepeatLocations) {
    const unused = locations.filter((location) => !room.usedLocationIds.includes(location.id));
    if (unused.length) pool = unused;
  }
  return pick(pool);
}

function pickSpies(players: SpyPlayer[], count: number, previousSpyIds: string[]) {
  const fresh = shuffle(players.filter((player) => !previousSpyIds.includes(player.id)));
  const previous = shuffle(players.filter((player) => previousSpyIds.includes(player.id)));
  return [...fresh, ...previous].slice(0, count).map((player) => player.id);
}

function nextPlayer(players: SpyPlayer[], currentId: string) {
  if (!players.length) return undefined;
  const index = players.findIndex((player) => player.id === currentId);
  return players[(index + 1 + players.length) % players.length];
}

function getRound(room: SpyRoomState) {
  if (!room.round) throw new Error("Раунд еще не начался.");
  return room.round;
}

function getPlayer(room: SpyRoomState, playerId: string) {
  const player = room.players.find((item) => item.id === playerId);
  if (!player) throw new Error("Игрок не найден.");
  return player;
}

function assertPhase(room: SpyRoomState, phase: SpyRoomState["phase"]) {
  if (room.phase !== phase) throw new Error("Действие недоступно на текущем этапе.");
}

function addEvent(room: SpyRoomState, text: string) {
  room.eventLog.push({ id: createId(), text, createdAt: Date.now() });
  room.eventLog = room.eventLog.slice(-100);
}

function touch(room: SpyRoomState) {
  room.lastActivityAt = Date.now();
}

function addUnique(values: string[], value: string) {
  return values.includes(value) ? values : [...values, value];
}

function shuffle<T>(values: T[]) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function pick<T>(values: T[]): T {
  if (!values.length) throw new Error("Невозможно выбрать элемент из пустого списка.");
  return values[Math.floor(Math.random() * values.length)];
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
