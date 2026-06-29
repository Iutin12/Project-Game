export type GameConfig = {
  id: string;
  title: string;
  description: string;
  status: "available" | "coming_soon";
  minPlayers: number;
  maxPlayers: number;
  route: string;
};

export const games: GameConfig[] = [
  {
    id: "mafia",
    title: "Мафия",
    description: "Классическая игра с мирными жителями, мафией, комиссаром и доктором.",
    status: "available",
    minPlayers: 5,
    maxPlayers: 15,
    route: "/games/mafia"
  },
  {
    id: "bunker",
    title: "Бункер",
    description: "Игра на выживание, аргументацию и голосование.",
    status: "coming_soon",
    minPlayers: 4,
    maxPlayers: 16,
    route: "/games/bunker"
  },
  {
    id: "spy",
    title: "Шпион",
    description: "Один игрок не знает локацию и должен не выдать себя.",
    status: "coming_soon",
    minPlayers: 3,
    maxPlayers: 12,
    route: "/games/spy"
  },
  {
    id: "whoami",
    title: "Кто я?",
    description: "Угадывайте персонажа по вопросам, на которые можно отвечать только да или нет.",
    status: "coming_soon",
    minPlayers: 3,
    maxPlayers: 12,
    route: "/games/whoami"
  }
];
