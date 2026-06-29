import type { Role } from "./types";

export const roleLabels: Record<Role, string> = {
  CIVILIAN: "Мирный житель",
  MAFIA: "Мафия",
  DETECTIVE: "Комиссар",
  DOCTOR: "Доктор"
};

export const roleDescriptions: Record<Role, string> = {
  CIVILIAN: "Днем обсуждает и голосует. Ночью ждет утра.",
  MAFIA: "Ночью выбирает жертву и побеждает, когда мафии не меньше остальных.",
  DETECTIVE: "Ночью проверяет одного игрока и узнает, мафия он или нет.",
  DOCTOR: "Ночью выбирает игрока, которого пытается спасти."
};
