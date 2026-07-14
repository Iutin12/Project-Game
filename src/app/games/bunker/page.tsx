import { GameCreatePage } from "@/components/game-card/GameCreatePage";

export default function BunkerPage() {
  return (
    <GameCreatePage
      gameId="bunker"
      title="Бункер"
      description="Мир пережил катастрофу. Мест в убежище меньше, чем людей. Получите персонажа, раскрывайте характеристики, убеждайте остальных и голосуйте, кто достоин попасть в бункер."
      privateDescription="Войти смогут только игроки с кодом или ссылкой."
      publicDescription="Комната появится на главном экране для свободного входа."
      stats={[["4-16", "игроков"], ["20-60", "минут"], ["персонажи", "автоматически"], ["голосование", "на исключение"]]}
    />
  );
}
