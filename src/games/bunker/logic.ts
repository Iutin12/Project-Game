import { bunkerCatastrophes } from "./catastrophes";
import { generateBunkerCharacter } from "./characters";
import { bunkerCards } from "./cards";
import { bunkerCharacteristicCategories, defaultBunkerSettings, getAutoBunkerSlots } from "./settings";
import { bunkerShelters } from "./shelters";
import { resolveBunkerVotes } from "./voting";
import type { BunkerCardCategory, BunkerPlayer, BunkerRoomState, BunkerSettings } from "./types";

export { defaultBunkerSettings, getAutoBunkerSlots };

export function createEmptyBunkerRoom(code: string, hostKey: string, visibility: BunkerRoomState["visibility"], devMode = false): BunkerRoomState {
  return {
    code,
    gameId: "bunker",
    visibility,
    hostKey,
    phase: "LOBBY",
    players: [],
    settings: { ...defaultBunkerSettings },
    bunkerSlots: 0,
    characters: {},
    currentRound: 0,
    revealOrder: [],
    revealedThisRoundPlayerIds: [],
    readyPlayerIds: [],
    votes: {},
    protectedPlayerIds: [],
    eventLog: [],
    chatMessages: [],
    createdAt: Date.now(),
    devMode
  };
}

export function startBunkerGame(room: BunkerRoomState) {
  if (room.phase !== "LOBBY") return { ok: false, error: "Игра уже запущена" };
  const activePlayers = room.players.filter((player) => player.connected && !player.isBot ? player.status !== "eliminated" : player.status !== "eliminated");
  if (activePlayers.length < 4) return { ok: false, error: "Для Бункера нужно минимум 4 игрока" };

  const settings = room.settings.gameMode === "quick" ? { ...room.settings, characteristicsPerPlayer: 6, discussionTimeSec: 60, votingTimeSec: 45 } : room.settings;
  const usedCardIds = new Set<string>();
  const playerIds = activePlayers.map((player) => player.id);

  room.settings = settings;
  room.players = room.players.map((player) => ({ ...player, status: player.connected || player.isBot ? "alive" : "eliminated" }));
  room.catastrophe = pickScenario(settings.selectedCatastropheId, settings.catastropheMode, bunkerCatastrophes);
  room.shelter = pickScenario(settings.selectedBunkerId, settings.bunkerMode, bunkerShelters);
  room.bunkerSlots = settings.bunkerSlots === "auto" ? getAutoBunkerSlots(playerIds.length) : settings.bunkerSlots;
  room.characters = Object.fromEntries(playerIds.map((playerId) => [playerId, generateBunkerCharacter(playerId, usedCardIds, settings)]));
  room.currentRound = 1;
  room.revealOrder = buildRevealOrder(settings);
  room.currentRevealCategory = room.revealOrder[0];
  room.revealedThisRoundPlayerIds = [];
  room.readyPlayerIds = [];
  room.votes = {};
  room.protectedPlayerIds = [];
  room.phase = "SCENARIO_REVEAL";
  addEvent(room, "Сценарий выбран. Игроки получили персонажей.");
  return { ok: true };
}

export function revealBunkerCard(room: BunkerRoomState, playerId: string, category: BunkerCardCategory) {
  const player = room.players.find((item) => item.id === playerId);
  const character = room.characters[playerId];
  if (!player || player.status !== "alive" || !character) return { ok: false, error: "Игрок не найден" };
  if (category === "special") return { ok: false, error: "Спецкарты раскрываются через действие" };
  if (!room.settings.enabledCardCategories.includes(category)) return { ok: false, error: "Категория выключена" };
  if (character.revealedCategories.includes(category)) return { ok: false, error: "Эта характеристика уже раскрыта" };
  if (room.phase === "REVEAL_ROUND" && room.revealedThisRoundPlayerIds.includes(playerId)) {
    return { ok: false, error: "В этом раунде можно раскрыть только одну характеристику" };
  }
  character.revealedCategories = [...character.revealedCategories, category];
  if (room.phase === "REVEAL_ROUND") room.revealedThisRoundPlayerIds = [...new Set([...room.revealedThisRoundPlayerIds, playerId])];
  addEvent(room, `${player.name} раскрыл(а): ${category}`);
  return { ok: true };
}

export function markBunkerReady(room: BunkerRoomState, playerId: string) {
  if (room.phase === "REVEAL_ROUND" && !room.revealedThisRoundPlayerIds.includes(playerId)) {
    return { ok: false, error: "Сначала раскройте характеристику" };
  }
  if (!room.readyPlayerIds.includes(playerId)) room.readyPlayerIds = [...room.readyPlayerIds, playerId];
  return { ok: true };
}

export function allAliveReady(room: BunkerRoomState) {
  const ready = new Set(room.readyPlayerIds);
  return room.players
    .filter((player) => player.status === "alive" && (player.connected || player.isBot))
    .every((player) => ready.has(player.id) || player.isBot);
}

export function allActivePlayersRevealed(room: BunkerRoomState) {
  const revealed = new Set(room.revealedThisRoundPlayerIds);
  return room.players
    .filter((player) => player.status === "alive" && player.connected && !player.isBot)
    .every((player) => revealed.has(player.id));
}

export function advanceBunkerPhase(room: BunkerRoomState) {
  if (room.phase === "REVEAL_ROUND" && !allActivePlayersRevealed(room)) {
    return { ok: false, error: "Все игроки должны раскрыть характеристику" };
  }
  if (room.phase === "REVEAL_ROUND" && !allAliveReady(room)) {
    return { ok: false, error: "Все игроки должны подтвердить выбор" };
  }
  room.readyPlayerIds = [];
  room.deadlineAt = undefined;
  if (room.phase === "SCENARIO_REVEAL") room.phase = "REVEAL_ROUND";
  else if (room.phase === "CHARACTER_PREVIEW") room.phase = "REVEAL_ROUND";
  else if (room.phase === "REVEAL_ROUND") setTimedPhase(room, "VOTING", room.settings.votingTimeSec);
  else if (room.phase === "DISCUSSION") setTimedPhase(room, "VOTING", room.settings.votingTimeSec);
  else if (room.phase === "SPECIAL_ACTIONS") setTimedPhase(room, "VOTING", room.settings.votingTimeSec);
  else if (room.phase === "VOTING" || room.phase === "REVOTE") resolveVoting(room);
  else if (room.phase === "VOTING_RESULT" || room.phase === "ELIMINATION") nextRoundOrFinish(room);
  return { ok: true };
}

export function castBunkerVote(room: BunkerRoomState, voterId: string, targetId: string) {
  const voter = room.players.find((player) => player.id === voterId);
  const target = room.players.find((player) => player.id === targetId);
  if (!voter || voter.status !== "alive") return { ok: false, error: "Вы не можете голосовать" };
  if (!target || target.status !== "alive") return { ok: false, error: "Игрок недоступен" };
  if (!room.settings.allowSelfVote && voterId === targetId) return { ok: false, error: "Нельзя голосовать за себя" };
  if (room.protectedPlayerIds.includes(targetId)) return { ok: false, error: "Игрок защищен спецкартой" };
  if (room.phase === "REVOTE" && room.revoteCandidateIds && !room.revoteCandidateIds.includes(targetId)) {
    return { ok: false, error: "Можно голосовать только за кандидатов переголосования" };
  }
  room.votes = { ...room.votes, [voterId]: targetId };
  return { ok: true };
}

export function useBunkerSpecialCard(room: BunkerRoomState, playerId: string, cardId: string, targetPlayerId?: string, category?: BunkerCardCategory) {
  const player = room.players.find((item) => item.id === playerId);
  const character = room.characters[playerId];
  const card = character?.specialCards.find((item) => item.id === cardId && !item.used);
  if (!player || player.status !== "alive" || !character || !card) return { ok: false, error: "Спецкарта недоступна" };
  card.used = true;

  if (card.type === "protect_vote") room.protectedPlayerIds = [...new Set([...room.protectedPlayerIds, playerId])];
  if (card.type === "reveal_extra") {
    const hidden = bunkerCharacteristicCategories.find((item) => !character.revealedCategories.includes(item));
    if (hidden) character.revealedCategories = [...character.revealedCategories, hidden];
  }
  if (card.type === "hide_card") {
    const hideable = character.revealedCategories.find((item) => item !== "profession");
    if (hideable) character.revealedCategories = character.revealedCategories.filter((item) => item !== hideable);
  }
  if (card.type === "force_reveal") {
    const targetId = targetPlayerId ?? room.players.find((item) => item.status === "alive" && item.id !== playerId)?.id;
    const targetCharacter = targetId ? room.characters[targetId] : undefined;
    const revealCategory =
      category && category !== "special"
        ? category
        : bunkerCharacteristicCategories.find((item) => targetCharacter && !targetCharacter.revealedCategories.includes(item));
    if (targetId && targetCharacter && revealCategory && !targetCharacter.revealedCategories.includes(revealCategory)) {
      targetCharacter.revealedCategories = [...targetCharacter.revealedCategories, revealCategory];
    }
  }
  if (card.type === "swap_card") {
    const fresh = bunkerCards.fact[Math.floor(Math.random() * bunkerCards.fact.length)];
    character.fact = fresh;
    character.revealedCategories = character.revealedCategories.filter((item) => item !== "fact");
  }
  if (card.type === "revote" && room.lastVotingResult?.tiedPlayerIds?.length) {
    room.revoteCandidateIds = room.lastVotingResult.tiedPlayerIds;
    room.phase = "REVOTE";
    room.votes = {};
  }
  addEvent(room, `${player.name} использовал(а) спецкарту: ${card.title}`);
  return { ok: true };
}

export function resolveVoting(room: BunkerRoomState) {
  const result = resolveBunkerVotes({
    players: room.players,
    votes: room.votes,
    tieMode: room.settings.tieMode,
    isRevote: room.phase === "REVOTE",
    candidates: room.phase === "REVOTE" ? room.revoteCandidateIds : undefined
  });
  result.round = room.currentRound;
  room.lastVotingResult = result;
  room.votes = {};
  room.protectedPlayerIds = [];

  if (result.tiedPlayerIds?.length && !result.eliminatedPlayerId && !result.noElimination) {
    room.revoteCandidateIds = result.tiedPlayerIds;
    room.phase = "REVOTE";
    addEvent(room, "Голоса разделились. Начинается переголосование.");
    return;
  }
  if (result.eliminatedPlayerId) eliminateBunkerPlayer(room, result.eliminatedPlayerId, "Голосование");
  else addEvent(room, "Голосование завершилось без исключения.");
  room.phase = shouldFinishBunkerGame(room) ? "GAME_OVER" : "VOTING_RESULT";
  if (room.phase === "GAME_OVER") finishBunkerGame(room);
}

export function eliminateBunkerPlayer(room: BunkerRoomState, playerId: string, reason: string) {
  const player = room.players.find((item) => item.id === playerId);
  const character = room.characters[playerId];
  if (!player) return;
  player.status = "eliminated";
  if (character && room.settings.showEliminatedCards) character.revealedCategories = [...bunkerCharacteristicCategories];
  addEvent(room, `${player.name} исключен(а). Причина: ${reason}.`);
}

export function shouldFinishBunkerGame(room: BunkerRoomState) {
  return room.players.filter((player) => player.status === "alive").length <= room.bunkerSlots;
}

export function finishBunkerGame(room: BunkerRoomState) {
  room.winnerPlayerIds = room.players.filter((player) => player.status === "alive").map((player) => player.id);
  room.phase = "GAME_OVER";
  room.deadlineAt = undefined;
  addEvent(room, "Бункер закрыт. Финальный состав выживших определен.");
}

export function restartBunkerGame(room: BunkerRoomState) {
  room.phase = "LOBBY";
  room.players = room.players.map((player) => ({ ...player, status: "alive" }));
  room.catastrophe = undefined;
  room.shelter = undefined;
  room.bunkerSlots = 0;
  room.characters = {};
  room.currentRound = 0;
  room.currentRevealCategory = undefined;
  room.revealedThisRoundPlayerIds = [];
  room.readyPlayerIds = [];
  room.votes = {};
  room.revoteCandidateIds = undefined;
  room.lastVotingResult = undefined;
  room.winnerPlayerIds = undefined;
  room.protectedPlayerIds = [];
  room.eventLog = [];
  room.deadlineAt = undefined;
  return { ok: true };
}

function nextRoundOrFinish(room: BunkerRoomState) {
  if (shouldFinishBunkerGame(room)) {
    finishBunkerGame(room);
    return;
  }
  room.currentRound += 1;
  room.currentRevealCategory = room.settings.revealMode === "fixed_order" ? room.revealOrder[(room.currentRound - 1) % room.revealOrder.length] : undefined;
  room.revealedThisRoundPlayerIds = [];
  room.phase = "REVEAL_ROUND";
}

function setTimedPhase(room: BunkerRoomState, phase: BunkerRoomState["phase"], seconds: number) {
  room.phase = phase;
  room.deadlineAt = room.settings.useTimer ? Date.now() + seconds * 1000 : undefined;
}

function buildRevealOrder(settings: BunkerSettings) {
  const enabled = bunkerCharacteristicCategories.filter((category) => settings.enabledCardCategories.includes(category));
  const order = settings.revealProfessionAtStart ? enabled.filter((category) => category !== "profession") : enabled;
  return order.slice(0, Math.max(1, settings.characteristicsPerPlayer));
}

function pickScenario<T extends { id: string }>(id: string | undefined, mode: "random" | "select", items: T[]) {
  if (mode === "select" && id) return items.find((item) => item.id === id) ?? items[0];
  return items[Math.floor(Math.random() * items.length)];
}

function addEvent(room: BunkerRoomState, text: string) {
  room.eventLog = [...room.eventLog.slice(-79), { id: `event_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, text, createdAt: Date.now() }];
}
