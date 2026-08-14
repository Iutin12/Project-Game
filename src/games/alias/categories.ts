import type { AliasCategory } from "./types";

export const aliasCategoryLabels: Record<AliasCategory, string> = {
  animals: "Животные",
  food: "Еда",
  people: "Люди",
  professions: "Профессии",
  sports: "Спорт",
  movies: "Кино",
  music: "Музыка",
  games: "Игры",
  technology: "Технологии",
  travel: "Путешествия",
  household: "Дом",
  nature: "Природа",
  emotions: "Эмоции",
  actions: "Действия",
  places: "Места",
  objects: "Предметы",
  science: "Наука",
  history: "История",
  internet: "Интернет",
  adult: "Для взрослых"
};

export const aliasCategories = Object.keys(aliasCategoryLabels) as AliasCategory[];
export const defaultAliasCategories = aliasCategories.filter((category) => category !== "adult");
