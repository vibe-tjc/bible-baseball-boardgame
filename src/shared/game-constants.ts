/** Positive outcomes when a player answers correctly */
export const POSITIVE_OUTCOMES = ['single', 'double', 'triple', 'homerun', 'walk'] as const;
export type PositiveOutcome = typeof POSITIVE_OUTCOMES[number];

/** Negative outcomes (strikeout displayed when both teams fail) */
export const NEGATIVE_OUTCOMES = ['strikeout'] as const;
export type NegativeOutcome = typeof NEGATIVE_OUTCOMES[number];

export type BaseballOutcome = PositiveOutcome | NegativeOutcome;

/** Game state machine states */
export const GAME_STATES = [
  'lobby',
  'question',
  'buzz_wait',
  'answering',
  'pass_to_other',
  'result',
  'animation',
  'game_over',
] as const;
export type GameState = typeof GAME_STATES[number];

/** How many bases each hit type advances runners */
export const HIT_ADVANCE: Record<PositiveOutcome, number> = {
  single: 1,
  double: 2,
  triple: 3,
  homerun: 4,
  walk: 0, // special handling: forced advance only
};
