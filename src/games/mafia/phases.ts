import type { GamePhase } from "./types";

export const phaseLabels: Record<GamePhase, string> = {
  LOBBY: "Лобби",
  ROLE_REVEAL: "Роли раскрыты",
  NIGHT_MAFIA: "Ночь: ход мафии",
  NIGHT_DETECTIVE: "Ночь: ход комиссара",
  NIGHT_DOCTOR: "Ночь: ход доктора",
  DAY_DISCUSSION: "День: обсуждение",
  DAY_VOTING: "День: голосование",
  DAY_REVOTE: "День: переголосование",
  GAME_OVER: "Игра окончена"
};

export const phaseOrder: GamePhase[] = [
  "ROLE_REVEAL",
  "NIGHT_MAFIA",
  "NIGHT_DETECTIVE",
  "NIGHT_DOCTOR",
  "DAY_DISCUSSION",
  "DAY_VOTING",
  "DAY_REVOTE"
];
