import type { GamePhase } from "./types";

export const phaseLabels: Record<GamePhase, string> = {
  LOBBY: "Лобби",
  ROLE_REVEAL: "Роли раскрыты",
  NIGHT_MAFIA: "Ночь: ход мафии",
  NIGHT_DON: "Ночь: ход Дона",
  NIGHT_DETECTIVE: "Ночь: ход комиссара",
  NIGHT_DOCTOR: "Ночь: ход доктора",
  DAY_DISCUSSION: "День: обсуждение",
  DAY_VOTING: "День: голосование",
  DAY_REVOTE: "День: переголосование",
  DAY_TIE_CHALLENGE: "День: испытание",
  GAME_OVER: "Игра окончена"
};

export const phaseOrder: GamePhase[] = [
  "ROLE_REVEAL",
  "NIGHT_MAFIA",
  "NIGHT_DON",
  "NIGHT_DETECTIVE",
  "NIGHT_DOCTOR",
  "DAY_DISCUSSION",
  "DAY_VOTING",
  "DAY_REVOTE",
  "DAY_TIE_CHALLENGE"
];
