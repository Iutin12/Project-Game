import type { CrocodileWord } from "./types";
import { generatedCrocodileWords } from "./generatedWords";

const baseCrocodileWords: CrocodileWord[] = [
  { id: "animal_1", text: "Крокодил", category: "animals", difficulty: "easy", isPhrase: false },
  { id: "animal_2", text: "Кошка", category: "animals", difficulty: "easy", isPhrase: false },
  { id: "animal_3", text: "Собака", category: "animals", difficulty: "easy", isPhrase: false },
  { id: "animal_4", text: "Жираф", category: "animals", difficulty: "easy", isPhrase: false },
  { id: "animal_5", text: "Пингвин", category: "animals", difficulty: "easy", isPhrase: false },
  { id: "animal_6", text: "Летучая мышь", category: "animals", difficulty: "medium", isPhrase: true },
  { id: "animal_7", text: "Морской котик", category: "animals", difficulty: "medium", isPhrase: true },
  { id: "animal_8", text: "Богомол", category: "animals", difficulty: "hard", isPhrase: false },
  { id: "food_1", text: "Пицца", category: "food", difficulty: "easy", isPhrase: false },
  { id: "food_2", text: "Мороженое", category: "food", difficulty: "easy", isPhrase: false },
  { id: "food_3", text: "Суши", category: "food", difficulty: "easy", isPhrase: false },
  { id: "food_4", text: "Кофе", category: "food", difficulty: "easy", isPhrase: false },
  { id: "food_5", text: "Горячий шоколад", category: "food", difficulty: "medium", isPhrase: true },
  { id: "food_6", text: "Острый перец", category: "food", difficulty: "medium", isPhrase: true },
  { id: "food_7", text: "Фондю", category: "food", difficulty: "hard", isPhrase: false },
  { id: "profession_1", text: "Врач", category: "professions", difficulty: "easy", isPhrase: false },
  { id: "profession_2", text: "Учитель", category: "professions", difficulty: "easy", isPhrase: false },
  { id: "profession_3", text: "Повар", category: "professions", difficulty: "easy", isPhrase: false },
  { id: "profession_4", text: "Пожарный", category: "professions", difficulty: "easy", isPhrase: false },
  { id: "profession_5", text: "Космонавт", category: "professions", difficulty: "medium", isPhrase: false },
  { id: "profession_6", text: "Дрессировщик", category: "professions", difficulty: "medium", isPhrase: false },
  { id: "profession_7", text: "Археолог", category: "professions", difficulty: "hard", isPhrase: false },
  { id: "sport_1", text: "Футбол", category: "sports", difficulty: "easy", isPhrase: false },
  { id: "sport_2", text: "Баскетбол", category: "sports", difficulty: "easy", isPhrase: false },
  { id: "sport_3", text: "Плавание", category: "sports", difficulty: "easy", isPhrase: false },
  { id: "sport_4", text: "Бокс", category: "sports", difficulty: "easy", isPhrase: false },
  { id: "sport_5", text: "Фигурное катание", category: "sports", difficulty: "medium", isPhrase: true },
  { id: "sport_6", text: "Прыжок с шестом", category: "sports", difficulty: "medium", isPhrase: true },
  { id: "sport_7", text: "Керлинг", category: "sports", difficulty: "hard", isPhrase: false },
  { id: "movie_1", text: "Супергерой", category: "movies", difficulty: "easy", isPhrase: false },
  { id: "movie_2", text: "Зомби", category: "movies", difficulty: "easy", isPhrase: false },
  { id: "movie_3", text: "Детектив", category: "movies", difficulty: "medium", isPhrase: false },
  { id: "movie_4", text: "Романтическая комедия", category: "movies", difficulty: "medium", isPhrase: true },
  { id: "movie_5", text: "Машина времени", category: "movies", difficulty: "medium", isPhrase: true },
  { id: "movie_6", text: "Финальная сцена", category: "movies", difficulty: "hard", isPhrase: true },
  { id: "music_1", text: "Гитара", category: "music", difficulty: "easy", isPhrase: false },
  { id: "music_2", text: "Барабан", category: "music", difficulty: "easy", isPhrase: false },
  { id: "music_3", text: "Певец", category: "music", difficulty: "easy", isPhrase: false },
  { id: "music_4", text: "Дирижер", category: "music", difficulty: "medium", isPhrase: false },
  { id: "music_5", text: "Воздушная гитара", category: "music", difficulty: "medium", isPhrase: true },
  { id: "music_6", text: "Оперный певец", category: "music", difficulty: "hard", isPhrase: true },
  { id: "game_1", text: "Шахматы", category: "games", difficulty: "easy", isPhrase: false },
  { id: "game_2", text: "Прятки", category: "games", difficulty: "easy", isPhrase: false },
  { id: "game_3", text: "Мафия", category: "games", difficulty: "easy", isPhrase: false },
  { id: "game_4", text: "Крестики-нолики", category: "games", difficulty: "medium", isPhrase: true },
  { id: "game_5", text: "Настольная игра", category: "games", difficulty: "medium", isPhrase: true },
  { id: "game_6", text: "Босс последнего уровня", category: "games", difficulty: "hard", isPhrase: true },
  { id: "school_1", text: "Учебник", category: "school", difficulty: "easy", isPhrase: false },
  { id: "school_2", text: "Контрольная", category: "school", difficulty: "easy", isPhrase: false },
  { id: "school_3", text: "Доска", category: "school", difficulty: "easy", isPhrase: false },
  { id: "school_4", text: "Домашнее задание", category: "school", difficulty: "medium", isPhrase: true },
  { id: "school_5", text: "Последняя парта", category: "school", difficulty: "medium", isPhrase: true },
  { id: "school_6", text: "Теорема", category: "school", difficulty: "hard", isPhrase: false },
  { id: "tech_1", text: "Телефон", category: "technology", difficulty: "easy", isPhrase: false },
  { id: "tech_2", text: "Компьютер", category: "technology", difficulty: "easy", isPhrase: false },
  { id: "tech_3", text: "Робот", category: "technology", difficulty: "easy", isPhrase: false },
  { id: "tech_4", text: "Виртуальная реальность", category: "technology", difficulty: "medium", isPhrase: true },
  { id: "tech_5", text: "Искусственный интеллект", category: "technology", difficulty: "hard", isPhrase: true },
  { id: "tech_6", text: "Квантовый компьютер", category: "technology", difficulty: "hard", isPhrase: true },
  { id: "nature_1", text: "Дождь", category: "nature", difficulty: "easy", isPhrase: false },
  { id: "nature_2", text: "Ветер", category: "nature", difficulty: "easy", isPhrase: false },
  { id: "nature_3", text: "Гроза", category: "nature", difficulty: "easy", isPhrase: false },
  { id: "nature_4", text: "Северное сияние", category: "nature", difficulty: "medium", isPhrase: true },
  { id: "nature_5", text: "Извержение вулкана", category: "nature", difficulty: "medium", isPhrase: true },
  { id: "nature_6", text: "Прилив", category: "nature", difficulty: "hard", isPhrase: false },
  { id: "travel_1", text: "Чемодан", category: "travel", difficulty: "easy", isPhrase: false },
  { id: "travel_2", text: "Самолет", category: "travel", difficulty: "easy", isPhrase: false },
  { id: "travel_3", text: "Паспорт", category: "travel", difficulty: "easy", isPhrase: false },
  { id: "travel_4", text: "Потерянный багаж", category: "travel", difficulty: "medium", isPhrase: true },
  { id: "travel_5", text: "Экскурсовод", category: "travel", difficulty: "medium", isPhrase: false },
  { id: "travel_6", text: "Кругосветное путешествие", category: "travel", difficulty: "hard", isPhrase: true },
  { id: "house_1", text: "Зеркало", category: "household", difficulty: "easy", isPhrase: false },
  { id: "house_2", text: "Пылесос", category: "household", difficulty: "easy", isPhrase: false },
  { id: "house_3", text: "Подушка", category: "household", difficulty: "easy", isPhrase: false },
  { id: "emotion_1", text: "Радость", category: "emotions", difficulty: "easy", isPhrase: false },
  { id: "emotion_2", text: "Удивление", category: "emotions", difficulty: "easy", isPhrase: false },
  { id: "emotion_3", text: "Смущение", category: "emotions", difficulty: "medium", isPhrase: false },
  { id: "fairy_1", text: "Дракон", category: "fairy_tales", difficulty: "easy", isPhrase: false },
  { id: "fairy_2", text: "Золушка", category: "fairy_tales", difficulty: "easy", isPhrase: false },
  { id: "fairy_3", text: "Волшебная палочка", category: "fairy_tales", difficulty: "medium", isPhrase: true },
  { id: "action_1", text: "Прыгать", category: "actions", difficulty: "easy", isPhrase: false },
  { id: "action_2", text: "Шептать", category: "actions", difficulty: "easy", isPhrase: false },
  { id: "action_3", text: "Искать сокровища", category: "actions", difficulty: "medium", isPhrase: true },
  { id: "concept_1", text: "Время", category: "hard_concepts", difficulty: "hard", isPhrase: false },
  { id: "concept_2", text: "Свобода", category: "hard_concepts", difficulty: "hard", isPhrase: false },
  { id: "concept_3", text: "Парадокс", category: "hard_concepts", difficulty: "hard", isPhrase: false }
];

export const crocodileWords: CrocodileWord[] = mergeUniqueWords(baseCrocodileWords, generatedCrocodileWords);

function mergeUniqueWords(...groups: CrocodileWord[][]) {
  const seen = new Set<string>();
  const words: CrocodileWord[] = [];

  for (const group of groups) {
    for (const word of group) {
      const key = word.text.toLocaleLowerCase("ru-RU").replace(/\s+/g, " ").trim();
      if (seen.has(key)) continue;
      seen.add(key);
      words.push(word);
    }
  }

  return words;
}
