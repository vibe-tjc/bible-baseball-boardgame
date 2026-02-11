export interface OutcomeProbabilities {
  single: number;
  double: number;
  triple: number;
  homerun: number;
  walk: number;
}

export interface GameConfig {
  teamsCount: number;
  playersPerTeam: number;
  totalQuestions: number;
  buzzerTimeLimit: number;  // seconds
  answerTimeLimit: number;  // seconds
  language: 'zh' | 'en';
  correctOutcomes: OutcomeProbabilities;
}

export const DEFAULT_CONFIG: GameConfig = {
  teamsCount: 2,
  playersPerTeam: 1,
  totalQuestions: 20,
  buzzerTimeLimit: 5,
  answerTimeLimit: 10,
  language: 'zh',
  correctOutcomes: {
    single: 0.40,
    double: 0.25,
    triple: 0.10,
    homerun: 0.10,
    walk: 0.15,
  },
};
