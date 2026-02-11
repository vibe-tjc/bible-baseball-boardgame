export interface I18nMessages {
  gameTitle: string;
  lobby: string;
  waitingForPlayers: string;
  scanToJoin: string;
  startGame: string;
  buzzerReady: string;
  buzz: string;
  timeUp: string;
  correct: string;
  wrong: string;
  strikeout: string;
  single: string;
  double: string;
  triple: string;
  homerun: string;
  walk: string;
  gameOver: string;
  finalScore: string;
  team: string;
  score: string;
  question: string;
  answer: string;
  enterName: string;
  join: string;
  waiting: string;
  yourTurn: string;
  passToOther: string;
  settings: string;
  save: string;
  reset: string;
  language: string;
  totalQuestions: string;
  buzzerTime: string;
  answerTime: string;
  probabilities: string;
  liveQuestion: string;
  questionText: string;
  addAnswer: string;
  markCorrect: string;
  submit: string;
  resume: string;
  newGame: string;
  questionOf: string;
  runs: string;
}

const zh: I18nMessages = {
  gameTitle: '聖經全壘打',
  lobby: '等待大廳',
  waitingForPlayers: '等待玩家加入...',
  scanToJoin: '掃描 QR Code 加入遊戲',
  startGame: '開始遊戲',
  buzzerReady: '準備搶答！',
  buzz: '搶答！',
  timeUp: '時間到！',
  correct: '答對了！',
  wrong: '答錯了！',
  strikeout: '三振！',
  single: '一壘安打！',
  double: '二壘安打！',
  triple: '三壘安打！',
  homerun: '全壘打！',
  walk: '保送！',
  gameOver: '比賽結束',
  finalScore: '最終比分',
  team: '隊伍',
  score: '得分',
  question: '題目',
  answer: '答案',
  enterName: '輸入你的名字',
  join: '加入遊戲',
  waiting: '等待中...',
  yourTurn: '輪到你回答！',
  passToOther: '換另一隊回答！',
  settings: '設定',
  save: '儲存',
  reset: '重設',
  language: '語言',
  totalQuestions: '題目數量',
  buzzerTime: '搶答時間（秒）',
  answerTime: '答題時間（秒）',
  probabilities: '打擊結果機率',
  liveQuestion: '即時出題',
  questionText: '題目內容',
  addAnswer: '新增選項',
  markCorrect: '標記正確',
  submit: '送出題目',
  resume: '繼續遊戲',
  newGame: '新遊戲',
  questionOf: '題',
  runs: '分',
};

const en: I18nMessages = {
  gameTitle: 'Bible Home Run',
  lobby: 'Lobby',
  waitingForPlayers: 'Waiting for players...',
  scanToJoin: 'Scan QR Code to join',
  startGame: 'Start Game',
  buzzerReady: 'Ready to buzz!',
  buzz: 'BUZZ!',
  timeUp: "Time's up!",
  correct: 'Correct!',
  wrong: 'Wrong!',
  strikeout: 'Strikeout!',
  single: 'Single!',
  double: 'Double!',
  triple: 'Triple!',
  homerun: 'Home Run!',
  walk: 'Walk!',
  gameOver: 'Game Over',
  finalScore: 'Final Score',
  team: 'Team',
  score: 'Score',
  question: 'Question',
  answer: 'Answer',
  enterName: 'Enter your name',
  join: 'Join Game',
  waiting: 'Waiting...',
  yourTurn: 'Your turn to answer!',
  passToOther: 'Passed to the other team!',
  settings: 'Settings',
  save: 'Save',
  reset: 'Reset',
  language: 'Language',
  totalQuestions: 'Total Questions',
  buzzerTime: 'Buzzer Time (sec)',
  answerTime: 'Answer Time (sec)',
  probabilities: 'Outcome Probabilities',
  liveQuestion: 'Live Question',
  questionText: 'Question Text',
  addAnswer: 'Add Answer',
  markCorrect: 'Mark Correct',
  submit: 'Submit Question',
  resume: 'Resume Game',
  newGame: 'New Game',
  questionOf: 'of',
  runs: 'runs',
};

export const messages: Record<'zh' | 'en', I18nMessages> = { zh, en };

export function t(lang: 'zh' | 'en', key: keyof I18nMessages): string {
  return messages[lang][key];
}
