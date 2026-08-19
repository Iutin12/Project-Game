export type GameConfig = {
  id: string;
  title: string;
  description: string;
  status: "available" | "coming_soon";
  minPlayers: number;
  maxPlayers: number;
  route: string;
  illustration: string;
  duration: string;
};

// Changing this revision forces browsers to replace an outdated cached game cover.
const GAME_CARD_ASSET_REVISION = "20260819";
const gameCard = (name: string) => `/game-cards/${name}.png?v=${GAME_CARD_ASSET_REVISION}`;

export const games: GameConfig[] = [
  {
    id: "mafia",
    title: "Мафия",
    description: "Классическая игра с мирными жителями, мафией, комиссаром и доктором.",
    status: "available",
    minPlayers: 5,
    maxPlayers: 15,
    route: "/games/mafia",
    illustration: gameCard("mafia"),
    duration: "10-30 мин"
  },
  {
    id: "bunker",
    title: "Бункер",
    description: "Игра на выживание, аргументацию и голосование.",
    status: "available",
    minPlayers: 4,
    maxPlayers: 16,
    route: "/games/bunker",
    illustration: gameCard("bunker"),
    duration: "15-30 мин"
  },
  {
    id: "spy",
    title: "Шпион",
    description: "Один игрок не знает локацию и должен не выдать себя.",
    status: "available",
    minPlayers: 3,
    maxPlayers: 12,
    route: "/games/spy",
    illustration: gameCard("spy"),
    duration: "10-20 мин"
  },
  {
    id: "alias",
    title: "Элиас",
    description: "Объясняйте слова своей команде на время, не называя однокоренные подсказки.",
    status: "available",
    minPlayers: 4,
    maxPlayers: 20,
    route: "/games/alias",
    illustration: gameCard("alias"),
    duration: "15-40 мин"
  },
  {
    id: "whoami",
    title: "Кто я?",
    description: "Угадывайте персонажа по вопросам, на которые можно отвечать только да или нет.",
    status: "coming_soon",
    minPlayers: 3,
    maxPlayers: 12,
    route: "/games/whoami",
    illustration: gameCard("whoami"),
    duration: "10-15 мин"
  },
  {
    id: "crocodile",
    title: "Крокодил",
    description: "Объясняйте слова жестами, мимикой и действиями, чтобы друзья их угадали.",
    status: "available",
    minPlayers: 3,
    maxPlayers: 20,
    route: "/games/crocodile",
    illustration: gameCard("crocodile"),
    duration: "10-30 мин"
  }
];

export const gamesByAvailability = [...games].sort((first, second) => {
  if (first.status === second.status) return 0;
  return first.status === "available" ? -1 : 1;
});
