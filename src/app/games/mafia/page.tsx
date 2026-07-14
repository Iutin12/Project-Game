import { GameCreatePage } from "@/components/game-card/GameCreatePage";

export default function MafiaPage() {
  return (
    <GameCreatePage
      gameId="mafia"
      title="Мафия"
      description="Создайте закрытую комнату для друзей или открытую комнату, которая появится на главном экране. Внутри вас ждет игра с автоматической раздачей ролей, ночными действиями, голосованием и проверкой победы."
      privateDescription="Войти смогут только игроки, у которых есть код или ссылка."
      publicDescription="Комната появится на главном экране, и любой сможет зайти."
      stats={[["5-15", "игроков"], ["4", "роли"], ["real-time", "лобби"], ["manual", "режим ведущего"]]}
    />
  );
}
