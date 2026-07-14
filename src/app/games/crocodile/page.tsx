import { GameCreatePage } from "@/components/game-card/GameCreatePage";

export default function CrocodilePage() {
  return (
    <GameCreatePage
      gameId="crocodile"
      title="Крокодил"
      description="Веселая игра для компании: один игрок объясняет слово без слов, а остальные пытаются его угадать. Можно играть каждый сам за себя или командами."
      privateDescription="Войти смогут только игроки с кодом или ссылкой. Хороший вариант для своей компании."
      publicDescription="Комната появится на главном экране, и любой игрок сможет присоединиться."
      stats={[["3-20", "игроков"], ["10-30", "минут"], ["solo/team", "режимы"], ["таймер", "по желанию"]]}
    />
  );
}
