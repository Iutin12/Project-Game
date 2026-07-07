import { bunkerCharacteristicCategories } from "./settings";
import type { BunkerCardCategory, BunkerCharacter, BunkerRoomState, PublicBunkerCharacter, PublicBunkerRoomState } from "./types";

export function getPublicBunkerState(room: BunkerRoomState, viewerId: string): PublicBunkerRoomState {
  const characters = Object.fromEntries(
    Object.entries(room.characters).map(([playerId, character]) => [playerId, toPublicCharacter(character, playerId === viewerId)])
  );

  return {
    ...room,
    ownPlayerId: viewerId,
    characters
  };
}

function toPublicCharacter(character: BunkerCharacter, isOwn: boolean): PublicBunkerCharacter {
  const revealed = new Set(character.revealedCategories);
  const visible = (category: Exclude<BunkerCardCategory, "special">) =>
    isOwn || revealed.has(category) ? character[category] : { category, hidden: true as const };

  return {
    playerId: character.playerId,
    revealedCategories: character.revealedCategories,
    specialCards: isOwn ? character.specialCards : character.specialCards.filter((card) => card.used),
    ...Object.fromEntries(bunkerCharacteristicCategories.map((category) => [category, visible(category)]))
  } as PublicBunkerCharacter;
}
