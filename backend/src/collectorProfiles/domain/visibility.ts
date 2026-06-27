export type ProfileVisibility = "public" | "unlisted" | "private";
export type CardVisibility = "public" | "unlisted" | "private";

export function isProfilePubliclyAccessible(
  visibility: ProfileVisibility,
  status: string
): boolean {
  if (status !== "active") return false;
  return visibility === "public" || visibility === "unlisted";
}

export function isProfileDiscoverable(
  visibility: ProfileVisibility,
  status: string,
  searchVisible: boolean
): boolean {
  return visibility === "public" && status === "active" && searchVisible;
}

export function effectiveCardVisibility(
  cardVisibility: CardVisibility,
  profileVisibility: ProfileVisibility
): CardVisibility {
  if (profileVisibility === "private") return "private";
  if (profileVisibility === "unlisted" && cardVisibility === "public") return "unlisted";
  return cardVisibility;
}

export function canAnonymousViewCard(
  cardVisibility: CardVisibility,
  profileVisibility: ProfileVisibility,
  profileStatus: string,
  cardStatus: string
): boolean {
  if (cardStatus !== "active") return false;
  const effective = effectiveCardVisibility(cardVisibility, profileVisibility);
  if (effective === "private") return false;
  return isProfilePubliclyAccessible(profileVisibility, profileStatus);
}

export function shouldNoIndex(
  profileVisibility: ProfileVisibility,
  searchEngineIndexing: boolean
): boolean {
  return profileVisibility !== "public" || !searchEngineIndexing;
}
