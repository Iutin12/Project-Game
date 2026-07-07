import { bunkerCards, bunkerSpecialCards } from "./cards";
import { bunkerCharacteristicCategories } from "./settings";
import type { BunkerCard, BunkerCardCategory, BunkerCharacter, BunkerSettings, BunkerSpecialCard } from "./types";

export function generateBunkerCharacter(playerId: string, usedCardIds: Set<string>, settings: BunkerSettings): BunkerCharacter {
  const character = Object.fromEntries(
    bunkerCharacteristicCategories.map((category) => [category, pickUniqueCard(bunkerCards[category], usedCardIds)])
  ) as Record<Exclude<BunkerCardCategory, "special">, BunkerCard>;

  const specialCards = settings.useSpecialCards
    ? Array.from({ length: settings.specialCardsPerPlayer }, () => pickSpecialCard())
    : [];

  const revealedCategories: BunkerCardCategory[] = settings.revealProfessionAtStart ? ["profession"] : [];

  return {
    playerId,
    ...character,
    specialCards,
    revealedCategories
  };
}

function pickUniqueCard(cards: BunkerCard[], usedCardIds: Set<string>) {
  const availableCards = cards.filter((card) => !usedCardIds.has(card.id));
  const pool = availableCards.length > 0 ? availableCards : cards;
  const card = pool[Math.floor(Math.random() * pool.length)];
  usedCardIds.add(card.id);
  return card;
}

function pickSpecialCard(): BunkerSpecialCard {
  const card = bunkerSpecialCards[Math.floor(Math.random() * bunkerSpecialCards.length)];
  return { ...card, id: `${card.id}_${Math.random().toString(36).slice(2, 8)}` };
}
