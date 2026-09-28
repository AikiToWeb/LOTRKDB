export type Card = {
  code: string;
  name: string;
  type_code: string;
  type_name: string;
  sphere_code: string;
  sphere_name: string;
  pack_code: string;
  pack_name: string;
  traits?: string;
  text?: string;
  flavor?: string;
  cost?: number | string;
  threat?: number;
  willpower?: number;
  attack?: number;
  defense?: number;
  health?: number;
  deck_limit?: number;
  is_unique?: boolean;
  has_errata?: boolean;
  imagesrc?: string;
  packs?: { pack_code: string; pack_name: string; quantity: number }[];
};
export type Pack = {
  code: string;
  name: string;
  cycle_code?: string;
  position?: number;
};
export type Scenario = {
  id: string;
  name: string;
  pack: string;
  difficulty?: number;
  description?: string;
  source?: string;
  encounters?: string[];
};
export type Deck = {
  id: string;
  name: string;
  notes: string;
  slots: Record<string, number>;
  updatedAt: string;
};
export type Play = {
  id: string;
  scenarioId: string;
  campaignId?: string;
  deckId: string;
  deckName: string;
  date: string;
  result: "win" | "loss" | "playing";
  mode: string;
  players: number;
  rounds: number;
  threat: number;
  damage: number;
  deadThreat: number;
  victory: number;
  notes: string;
};
export type Campaign = {
  id: string;
  name: string;
  notes: string;
  scenarioIds: string[];
  boons: string;
  burdens: string;
};
export type State = {
  decks: Deck[];
  plays: Play[];
  owned: string[];
  campaigns: Campaign[];
};
export type Catalog = {
  cards: Card[];
  packs: Pack[];
  scenarios: Scenario[];
  syncedAt: string;
};
