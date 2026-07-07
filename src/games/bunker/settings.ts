import type { BunkerCardCategory, BunkerSettings } from "./types";

export const bunkerCharacteristicCategories: Exclude<BunkerCardCategory, "special">[] = [
  "profession",
  "age",
  "gender",
  "health",
  "biology",
  "hobby",
  "phobia",
  "baggage",
  "skill",
  "character",
  "fact"
];

export const bunkerCategoryLabels: Record<BunkerCardCategory, string> = {
  profession: "Профессия",
  age: "Возраст",
  gender: "Пол",
  health: "Здоровье",
  biology: "Биология",
  hobby: "Хобби",
  phobia: "Фобия",
  baggage: "Багаж",
  skill: "Навык",
  character: "Характер",
  fact: "Факт",
  special: "Спецкарта"
};

export const defaultBunkerSettings: BunkerSettings = {
  gameMode: "classic",
  hostMode: "auto",
  maxPlayers: 12,
  bunkerSlots: "auto",
  characteristicsPerPlayer: 9,
  revealMode: "fixed_order",
  discussionTimeSec: 120,
  votingTimeSec: 60,
  useTimer: true,
  useSpecialCards: true,
  specialCardsPerPlayer: 1,
  votingMode: "open",
  tieMode: "revote",
  allowSelfVote: false,
  revealProfessionAtStart: true,
  showEliminatedCards: true,
  catastropheMode: "random",
  bunkerMode: "random",
  enabledCardCategories: [...bunkerCharacteristicCategories, "special"]
};

export function getAutoBunkerSlots(playersCount: number) {
  return Math.ceil(playersCount / 2);
}
