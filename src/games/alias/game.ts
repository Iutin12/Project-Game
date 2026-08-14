import { defaultAliasCategories } from "./categories";
import { defaultAliasSettings } from "./settings";
import type { AliasPlayer, AliasRoomState, AliasTeam, AliasTurnHistory, AliasTurnWordResult, AliasWord } from "./types";
import { aliasWords } from "./words";

const MIN_PLAYERS = 4;
const teamNames = ["Красные", "Синие", "Зеленые", "Золотые"];
const teamColors: AliasTeam["color"][] = ["coral", "ocean", "mint", "amber"];

export function createAliasRoomState(input: { code: string; hostKey: string; visibility?: AliasRoomState["visibility"]; devMode?: boolean }): AliasRoomState {
  const now = Date.now();
  return {
    code: input.code,
    gameId: "alias",
    visibility: input.visibility ?? "private",
    hostKey: input.hostKey,
    phase: "LOBBY",
    players: [],
    teams: createAliasTeams(defaultAliasSettings.teamsCount),
    settings: structuredClone(defaultAliasSettings),
    currentTeamIndex: 0,
    turnNumber: 0,
    teamTurnCounts: {},
    explainerCursorByTeam: {},
    usedWordIds: [],
    turnHistory: [],
    chatMessages: [],
    createdAt: now,
    lastActivityAt: now,
    winnerTeamIds: [],
    devMode: input.devMode
  };
}

export function createAliasTeams(count: number, previous: AliasTeam[] = []) {
  return Array.from({ length: count }, (_, index): AliasTeam => ({
    id: `team-${index + 1}`,
    name: previous[index]?.name ?? teamNames[index],
    color: teamColors[index],
    score: previous[index]?.score ?? 0,
    playerIds: previous[index]?.playerIds ?? []
  }));
}

export function syncAliasTeams(room: AliasRoomState) {
  room.teams = createAliasTeams(room.settings.teamsCount, room.teams);
  const validIds = new Set(room.teams.map((team) => team.id));
  room.players.forEach((player) => {
    if (player.teamId && !validIds.has(player.teamId)) player.teamId = undefined;
  });
  if (room.settings.autoAssignTeams) rebalanceAliasTeams(room);
  else rebuildTeamPlayerIds(room);
}

export function rebalanceAliasTeams(room: AliasRoomState) {
  const eligible = room.players.filter((player) => player.connected || player.isBot);
  eligible.forEach((player, index) => {
    player.teamId = room.teams[index % room.teams.length]?.id;
  });
  room.players.filter((player) => !eligible.includes(player)).forEach((player) => {
    if (!room.teams.some((team) => team.id === player.teamId)) player.teamId = undefined;
  });
  rebuildTeamPlayerIds(room);
}

export function selectAliasTeam(room: AliasRoomState, playerId: string, teamId: string) {
  assertPhase(room, "LOBBY");
  if (room.settings.autoAssignTeams) throw new Error("Включено автоматическое распределение команд.");
  const player = getPlayer(room, playerId);
  if (!room.teams.some((team) => team.id === teamId)) throw new Error("Команда не найдена.");
  player.teamId = teamId;
  rebuildTeamPlayerIds(room);
  touch(room);
}

export function moveAliasPlayer(room: AliasRoomState, playerId: string, teamId: string) {
  assertPhase(room, "LOBBY");
  const player = getPlayer(room, playerId);
  if (!room.teams.some((team) => team.id === teamId)) throw new Error("Команда не найдена.");
  player.teamId = teamId;
  rebuildTeamPlayerIds(room);
  touch(room);
}

export function setAliasPlayerReady(room: AliasRoomState, playerId: string, ready: boolean) {
  assertPhase(room, "LOBBY");
  getPlayer(room, playerId).ready = ready;
  touch(room);
}

export function getAliasStartError(room: AliasRoomState) {
  const active = room.players.filter((player) => player.connected || player.isBot);
  if (room.phase !== "LOBBY") return "Игра уже запущена.";
  if (active.length < MIN_PLAYERS) return `Нужно минимум ${MIN_PLAYERS} игрока.`;
  if (room.settings.autoAssignTeams) rebalanceAliasTeams(room);
  if (active.some((player) => !player.teamId)) return "Распределите всех игроков по командам.";
  if (room.teams.some((team) => !active.some((player) => player.teamId === team.id))) return "В каждой команде должен быть хотя бы один игрок.";
  if (active.some((player) => !player.ready)) return "Не все игроки готовы.";
  if (!getAvailableAliasWords(room).length) return "Для выбранных категорий нет слов.";
  return undefined;
}

export function startAliasGame(room: AliasRoomState) {
  const error = getAliasStartError(room);
  if (error) throw new Error(error);
  room.teams.forEach((team) => { team.score = 0; });
  room.players.forEach((player) => {
    player.ready = false;
    player.explainedWords = 0;
    player.guessedWords = 0;
    player.skippedWords = 0;
  });
  room.currentTeamIndex = 0;
  room.turnNumber = 0;
  room.teamTurnCounts = Object.fromEntries(room.teams.map((team) => [team.id, 0]));
  room.explainerCursorByTeam = Object.fromEntries(room.teams.map((team) => [team.id, 0]));
  room.usedWordIds = [];
  room.previousWordId = undefined;
  room.turnHistory = [];
  room.winnerTeamIds = [];
  prepareAliasTurn(room);
}

export function prepareAliasTurn(room: AliasRoomState) {
  const team = room.teams[room.currentTeamIndex];
  if (!team) throw new Error("Команда для хода не найдена.");
  const members = room.players.filter((player) => player.teamId === team.id);
  if (!members.length) throw new Error("В текущей команде нет игроков.");
  const cursor = room.explainerCursorByTeam[team.id] ?? 0;
  const connected = members.filter((player) => player.connected || player.isBot);
  const candidates = connected.length ? connected : members;
  const explainer = candidates[cursor % candidates.length];
  room.explainerCursorByTeam[team.id] = (cursor + 1) % Math.max(1, candidates.length);
  room.turnNumber += 1;
  room.teamTurnCounts[team.id] = (room.teamTurnCounts[team.id] ?? 0) + 1;
  room.currentTurn = {
    turnNumber: room.turnNumber,
    teamId: team.id,
    explainerPlayerId: explainer.id,
    processedWordIds: [],
    words: [],
    scoreDeltasByTeamId: {},
    scoreApplied: false,
    resultConfirmed: false
  };
  room.phase = "TURN_PREPARE";
  touch(room);
}

export function replaceAliasExplainer(room: AliasRoomState, playerId?: string) {
  assertPhase(room, "TURN_PREPARE");
  const turn = getTurn(room);
  const candidates = room.players.filter((player) => player.teamId === turn.teamId && (player.connected || player.isBot));
  const replacement = playerId ? candidates.find((player) => player.id === playerId) : candidates.find((player) => player.id !== turn.explainerPlayerId);
  if (!replacement) throw new Error("Нет доступного игрока для замены объясняющего.");
  turn.explainerPlayerId = replacement.id;
  touch(room);
}

export function startAliasTurn(room: AliasRoomState, playerId: string, now = Date.now()) {
  assertPhase(room, "TURN_PREPARE");
  const turn = getTurn(room);
  if (turn.explainerPlayerId !== playerId) throw new Error("Начать ход может только текущий объясняющий.");
  const word = pickAliasWord(room);
  turn.currentWordId = word.id;
  turn.startedAt = now;
  turn.deadlineAt = now + room.settings.turnTimeSec * 1000;
  room.phase = "TURN_ACTIVE";
  touch(room);
}

export function processAliasWord(room: AliasRoomState, playerId: string, wordId: string, result: "guessed" | "skipped", now = Date.now()) {
  if (room.phase !== "TURN_ACTIVE") throw new Error("Ход уже завершен.");
  const turn = getTurn(room);
  if (turn.explainerPlayerId !== playerId) throw new Error("Отмечать слова может только объясняющий.");
  if (turn.deadlineAt && now >= turn.deadlineAt) {
    handleAliasDeadline(room, now);
    throw new Error("Время хода закончилось.");
  }
  if (!turn.currentWordId || turn.currentWordId !== wordId || turn.processedWordIds.includes(wordId)) throw new Error("Это слово уже обработано.");
  if (result === "skipped") {
    if (!room.settings.allowSkipWord) throw new Error("Пропуск слов отключен.");
    const skipped = turn.words.filter((entry) => entry.result === "skipped").length;
    if (room.settings.maxSkipsPerTurn !== null && skipped >= room.settings.maxSkipsPerTurn) throw new Error("Лимит пропусков исчерпан.");
  }
  const word = getAliasWord(wordId);
  const points = result === "guessed" ? 1 : room.settings.skipPenalty;
  const entry: AliasTurnWordResult = { id: `${turn.turnNumber}-${turn.words.length + 1}-${word.id}`, wordId: word.id, word: word.word, result, points };
  turn.words.push(entry);
  turn.processedWordIds.push(word.id);
  room.usedWordIds.push(word.id);
  room.previousWordId = word.id;
  turn.currentWordId = pickAliasWord(room).id;
  touch(room);
}

export function handleAliasDeadline(room: AliasRoomState, now = Date.now()) {
  const turn = room.currentTurn;
  if (!turn?.deadlineAt || now < turn.deadlineAt || room.phase !== "TURN_ACTIVE") return false;
  if (room.settings.lastWordMode === "common_guess" && turn.currentWordId) {
    room.phase = "LAST_WORD";
    turn.deadlineAt = undefined;
  } else {
    finishAliasTurn(room);
  }
  touch(room);
  return true;
}

export function resolveAliasLastWord(room: AliasRoomState, playerId: string, winnerTeamId?: string) {
  assertPhase(room, "LAST_WORD");
  const turn = getTurn(room);
  const player = getPlayer(room, playerId);
  if (turn.explainerPlayerId !== player.id && !player.isHost) throw new Error("Результат подтверждает объясняющий или хост.");
  if (winnerTeamId && !room.teams.some((team) => team.id === winnerTeamId)) throw new Error("Команда не найдена.");
  if (turn.currentWordId) {
    const word = getAliasWord(turn.currentWordId);
    turn.processedWordIds.push(word.id);
    room.usedWordIds.push(word.id);
    room.previousWordId = word.id;
    if (winnerTeamId) {
      turn.words.push({ id: `${turn.turnNumber}-last-${word.id}`, wordId: word.id, word: word.word, result: "guessed", points: 1 });
      turn.lastWordWinnerTeamId = winnerTeamId;
    }
  }
  turn.currentWordId = undefined;
  finishAliasTurn(room);
}

export function toggleAliasTurnWord(room: AliasRoomState, playerId: string, entryId: string) {
  assertPhase(room, "TURN_RESULT");
  if (!room.settings.reviewWordsAfterTurn) throw new Error("Проверка слов отключена.");
  const turn = getTurn(room);
  const player = getPlayer(room, playerId);
  if (turn.explainerPlayerId !== player.id && !player.isHost) throw new Error("Исправлять результат может объясняющий или хост.");
  if (turn.scoreApplied) throw new Error("Счет уже зафиксирован.");
  const entry = turn.words.find((item) => item.id === entryId);
  if (!entry || entry.id.includes("-last-")) throw new Error("Слово не найдено.");
  entry.result = entry.result === "guessed" ? "skipped" : "guessed";
  entry.points = entry.result === "guessed" ? 1 : room.settings.skipPenalty;
  recalculateTurnDeltas(room);
  touch(room);
}

export function confirmAliasTurnResult(room: AliasRoomState, playerId: string) {
  assertPhase(room, "TURN_RESULT");
  const turn = getTurn(room);
  const player = getPlayer(room, playerId);
  if (turn.explainerPlayerId !== player.id && !player.isHost) throw new Error("Подтвердить результат может объясняющий или хост.");
  applyAliasTurnScore(room);
  turn.resultConfirmed = true;
  appendTurnHistory(room);
  const explainer = getPlayer(room, turn.explainerPlayerId);
  const reviewedWords = turn.words.filter((entry) => !entry.id.includes("-last-"));
  explainer.explainedWords += 1;
  explainer.guessedWords += reviewedWords.filter((entry) => entry.result === "guessed").length;
  explainer.skippedWords += reviewedWords.filter((entry) => entry.result === "skipped").length;
  if (shouldFinishAliasGame(room)) {
    room.phase = "GAME_OVER";
    room.winnerTeamIds = getLeadingTeams(room).map((team) => team.id);
  } else {
    room.currentTeamIndex = (room.currentTeamIndex + 1) % room.teams.length;
    prepareAliasTurn(room);
  }
  touch(room);
}

export function forceFinishAliasTurn(room: AliasRoomState) {
  if (room.phase === "TURN_ACTIVE") finishAliasTurn(room);
  else if (room.phase === "LAST_WORD") {
    const turn = getTurn(room);
    turn.currentWordId = undefined;
    finishAliasTurn(room);
  } else throw new Error("Сейчас нельзя принудительно завершить ход.");
}

export function resetAliasRoomToLobby(room: AliasRoomState) {
  room.phase = "LOBBY";
  room.currentTurn = undefined;
  room.currentTeamIndex = 0;
  room.turnNumber = 0;
  room.teamTurnCounts = {};
  room.explainerCursorByTeam = {};
  room.usedWordIds = [];
  room.previousWordId = undefined;
  room.turnHistory = [];
  room.winnerTeamIds = [];
  room.teams.forEach((team) => { team.score = 0; });
  room.players.forEach((player) => { player.ready = false; });
  syncAliasTeams(room);
  touch(room);
}

export function getAvailableAliasWords(room: AliasRoomState) {
  const categories = room.settings.wordPoolMode === "selected" ? room.settings.selectedCategories : defaultAliasCategories;
  return aliasWords.filter((word) => categories.includes(word.category) && (room.settings.difficulty === "mixed" || word.difficulty === room.settings.difficulty));
}

export function getCurrentAliasWord(room: AliasRoomState) {
  const id = room.currentTurn?.currentWordId;
  return id ? aliasWords.find((word) => word.id === id) : undefined;
}

function finishAliasTurn(room: AliasRoomState) {
  const turn = getTurn(room);
  turn.currentWordId = undefined;
  turn.deadlineAt = undefined;
  recalculateTurnDeltas(room);
  room.phase = "TURN_RESULT";
  if (!room.settings.reviewWordsAfterTurn) {
    applyAliasTurnScore(room);
  }
  touch(room);
}

function recalculateTurnDeltas(room: AliasRoomState) {
  const turn = getTurn(room);
  const ownDelta = turn.words.filter((entry) => !entry.id.includes("-last-")).reduce((sum, entry) => sum + entry.points, 0);
  turn.scoreDeltasByTeamId = { [turn.teamId]: ownDelta };
  if (turn.lastWordWinnerTeamId) turn.scoreDeltasByTeamId[turn.lastWordWinnerTeamId] = (turn.scoreDeltasByTeamId[turn.lastWordWinnerTeamId] ?? 0) + 1;
}

function applyAliasTurnScore(room: AliasRoomState) {
  const turn = getTurn(room);
  if (turn.scoreApplied) return;
  recalculateTurnDeltas(room);
  room.teams.forEach((team) => {
    team.score = Math.max(0, team.score + (turn.scoreDeltasByTeamId[team.id] ?? 0));
  });
  turn.scoreApplied = true;
}

function appendTurnHistory(room: AliasRoomState) {
  const turn = getTurn(room);
  if (room.turnHistory.some((item) => item.turnNumber === turn.turnNumber)) return;
  const history: AliasTurnHistory = {
    turnNumber: turn.turnNumber,
    teamId: turn.teamId,
    explainerPlayerId: turn.explainerPlayerId,
    guessedWords: turn.words.filter((entry) => entry.result === "guessed").map((entry) => entry.word),
    skippedWords: turn.words.filter((entry) => entry.result === "skipped").map((entry) => entry.word),
    scoreDeltasByTeamId: { ...turn.scoreDeltasByTeamId }
  };
  room.turnHistory.push(history);
}

function shouldFinishAliasGame(room: AliasRoomState) {
  const nextIndex = (room.currentTeamIndex + 1) % room.teams.length;
  const cycleComplete = nextIndex === 0;
  const leaders = getLeadingTeams(room);
  if (leaders.length !== 1) return false;
  if (room.settings.gameEndMode === "rounds") {
    return cycleComplete && room.teams.every((team) => (room.teamTurnCounts[team.id] ?? 0) >= room.settings.roundsCount);
  }
  const targetReached = leaders[0].score >= room.settings.targetScore;
  return targetReached && (!room.settings.equalTurnsAtEnd || cycleComplete);
}

function getLeadingTeams(room: AliasRoomState) {
  const top = Math.max(...room.teams.map((team) => team.score));
  return room.teams.filter((team) => team.score === top);
}

function pickAliasWord(room: AliasRoomState): AliasWord {
  const pool = getAvailableAliasWords(room);
  if (!pool.length) throw new Error("Для выбранных настроек нет слов.");
  const used = new Set(room.usedWordIds);
  let candidates = pool.filter((word) => !used.has(word.id));
  if (!candidates.length) {
    room.usedWordIds = [];
    candidates = pool.filter((word) => word.id !== room.previousWordId);
    if (!candidates.length) candidates = pool;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function rebuildTeamPlayerIds(room: AliasRoomState) {
  room.teams.forEach((team) => {
    team.playerIds = room.players.filter((player) => player.teamId === team.id).map((player) => player.id);
  });
}

function getAliasWord(id: string) {
  const word = aliasWords.find((item) => item.id === id);
  if (!word) throw new Error("Слово не найдено.");
  return word;
}

function getPlayer(room: AliasRoomState, id: string) {
  const player = room.players.find((item) => item.id === id);
  if (!player) throw new Error("Игрок не найден.");
  return player;
}

function getTurn(room: AliasRoomState) {
  if (!room.currentTurn) throw new Error("Текущий ход не найден.");
  return room.currentTurn;
}

function assertPhase(room: AliasRoomState, phase: AliasRoomState["phase"]) {
  if (room.phase !== phase) throw new Error("Действие недоступно в текущей фазе.");
}

function touch(room: AliasRoomState) {
  room.lastActivityAt = Date.now();
}
