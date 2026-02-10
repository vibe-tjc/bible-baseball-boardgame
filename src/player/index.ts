import { messages, type I18nMessages } from '../shared/i18n.js';
import type {
  WsMessage,
  ServerBuzzerOpenMsg,
  ServerBuzzerLockedMsg,
  ServerYourTurnMsg,
  ServerAnswerResultMsg,
  ServerGameOverMsg,
  ServerTimerTickMsg,
  ServerStateSyncMsg,
  ServerWaitMsg,
  ServerErrorMsg,
} from '../shared/protocol.js';
import { createMessage } from '../shared/protocol.js';

// ─── State ───

let ws: WebSocket | null = null;
let lang: 'zh' | 'en' = 'zh';
let gameId = '';
let playerName = '';
let myTeamIndex = -1;
let currentTimerTotal = 0;
let hasBuzzed = false;

// ─── DOM Helpers ───

const $ = (id: string) => document.getElementById(id)!;
const screens = document.querySelectorAll<HTMLElement>('.screen');

function showScreen(screenId: string): void {
  screens.forEach(s => s.classList.remove('active'));
  $(screenId).classList.add('active');
}

function i(key: keyof I18nMessages): string {
  return messages[lang][key];
}

function updateLabels(): void {
  $('game-title').textContent = i('gameTitle');
  ($('player-name') as HTMLInputElement).placeholder = i('enterName');
  $('btn-join').textContent = i('join');
  $('btn-lang').textContent = lang === 'zh' ? 'EN' : '中';
  $('btn-buzz').textContent = i('buzz');
  $('wait-text').textContent = i('waiting');
  $('your-turn-text').textContent = i('yourTurn');
  $('player-gameover-title').textContent = i('gameOver');
}

// ─── WebSocket ───

function connect(): void {
  if (ws) {
    ws.onclose = null;
    ws.close();
    ws = null;
  }

  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  ws = new WebSocket(`${protocol}//${location.host}`);

  ws.onopen = () => {
    if (gameId && playerName) {
      send(createMessage('player:join', { name: playerName, gameId }));
    }
  };

  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data) as WsMessage;
    handleMessage(msg);
  };

  ws.onclose = () => {
    setTimeout(connect, 2000);
  };
}

function send(msg: WsMessage): void {
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

// ─── Message Handlers ───

function handleMessage(msg: WsMessage): void {
  switch (msg.type) {
    case 'server:stateSync':
      handleStateSync(msg as ServerStateSyncMsg);
      break;
    case 'server:buzzerOpen':
      handleBuzzerOpen(msg as ServerBuzzerOpenMsg);
      break;
    case 'server:buzzerLocked':
      handleBuzzerLocked(msg as ServerBuzzerLockedMsg);
      break;
    case 'server:yourTurn':
      handleYourTurn(msg as ServerYourTurnMsg);
      break;
    case 'server:wait':
      handleWait();
      break;
    case 'server:answerResult':
      handleAnswerResult(msg as ServerAnswerResultMsg);
      break;
    case 'server:gameOver':
      handleGameOver(msg as ServerGameOverMsg);
      break;
    case 'server:timerTick':
      handleTimerTick(msg as ServerTimerTickMsg);
      break;
    case 'server:error':
      handleError(msg as ServerErrorMsg);
      break;
  }
}

function handleStateSync(msg: ServerStateSyncMsg): void {
  const snap = msg.payload.snapshot;
  lang = snap.config.language;
  updateLabels();

  for (const team of snap.teams) {
    for (const p of team.players) {
      if (p.name === playerName) {
        myTeamIndex = p.teamIndex;
      }
    }
  }

  $('player-welcome').textContent = `${playerName} - ${i('team')} ${String.fromCharCode(65 + myTeamIndex)}`;
  $('team-info').textContent = `${i('team')} ${String.fromCharCode(65 + myTeamIndex)}`;

  // Route to appropriate screen based on game state
  switch (snap.state) {
    case 'lobby':
      showScreen('waiting-screen');
      break;
    case 'game_over':
      showScreen('player-gameover-screen');
      break;
    default:
      // For any in-progress state, show waiting screen
      // The server will send specific messages (buzzerOpen, yourTurn, etc.)
      showScreen('waiting-screen');
      break;
  }
}

function handleBuzzerOpen(msg: ServerBuzzerOpenMsg): void {
  hasBuzzed = false;
  currentTimerTotal = msg.payload.timeLimit;
  $('buzzer-question').textContent = msg.payload.questionText[lang];
  const buzzBtn = $('btn-buzz') as HTMLButtonElement;
  buzzBtn.disabled = false;
  buzzBtn.classList.add('buzzer-pulse');
  setTimerBar('buzzer-timer-fill', 100);
  showScreen('buzzer-screen');
}

function handleBuzzerLocked(msg: ServerBuzzerLockedMsg): void {
  const buzzBtn = $('btn-buzz') as HTMLButtonElement;
  buzzBtn.disabled = true;
  buzzBtn.classList.remove('buzzer-pulse');
}

function handleYourTurn(msg: ServerYourTurnMsg): void {
  currentTimerTotal = msg.payload.timeLimit;
  const container = $('answer-choices');
  container.innerHTML = '';

  for (const answer of msg.payload.answers) {
    const btn = document.createElement('button');
    btn.className = 'answer-btn';
    btn.textContent = answer.text[lang];
    btn.addEventListener('click', () => {
      container.querySelectorAll('button').forEach(b => {
        (b as HTMLButtonElement).disabled = true;
      });
      btn.classList.add('selected');
      send(createMessage('player:answer', { answerId: answer.id }));
    });
    container.appendChild(btn);
  }

  setTimerBar('answer-timer-fill', 100);
  showScreen('answer-screen');
}

function handleWait(): void {
  $('buzzer-question').textContent = i('passToOther');
  const buzzBtn = $('btn-buzz') as HTMLButtonElement;
  buzzBtn.disabled = true;
  buzzBtn.classList.remove('buzzer-pulse');
  showScreen('buzzer-screen');
}

function handleAnswerResult(msg: ServerAnswerResultMsg): void {
  const { correct, outcome, teamIndex } = msg.payload;
  const icon = $('player-result-icon');
  const text = $('player-result-text');
  const outcomeEl = $('player-outcome-text');

  if (correct && teamIndex === myTeamIndex) {
    icon.textContent = '🎉';
    text.textContent = i('correct');
    text.className = 'result-correct';
  } else if (correct) {
    icon.textContent = '😔';
    text.textContent = `${i('team')} ${String.fromCharCode(65 + (teamIndex ?? 0))} ${i('correct')}`;
    text.className = 'result-wrong';
  } else {
    icon.textContent = '❌';
    text.textContent = i('strikeout');
    text.className = 'result-wrong';
  }

  outcomeEl.textContent = outcome ? (i(outcome as keyof I18nMessages) || outcome) : '';
  showScreen('result-screen');
}

function handleGameOver(msg: ServerGameOverMsg): void {
  const container = $('player-final-scores');
  container.innerHTML = '';

  for (const team of msg.payload.teams) {
    const div = document.createElement('div');
    div.className = 'player-final-team';
    const trophy = msg.payload.winnerTeamIndex === team.index ? ' 🏆' : '';
    div.innerHTML = `<div>${i('team')} ${team.name}${trophy}</div><div class="score">${team.score}</div>`;
    container.appendChild(div);
  }

  showScreen('player-gameover-screen');
}

function handleTimerTick(msg: ServerTimerTickMsg): void {
  const remaining = msg.payload.remaining;
  const pct = currentTimerTotal > 0 ? (remaining / currentTimerTotal) * 100 : 0;
  setTimerBar('buzzer-timer-fill', pct, remaining);
  setTimerBar('answer-timer-fill', pct, remaining);
}

function handleError(msg: ServerErrorMsg): void {
  console.error('[Player] Error:', msg.payload.message);
  // Show error visually and return to join screen
  const errEl = $('join-error');
  errEl.textContent = msg.payload.message;
  errEl.classList.remove('hidden');
  showScreen('join-screen');
}

// ─── Timer Bar ───

function setTimerBar(fillId: string, pct: number, remaining?: number): void {
  const fill = document.getElementById(fillId);
  if (!fill) return;
  fill.style.width = pct + '%';
  if (remaining !== undefined && remaining <= 2) {
    fill.classList.add('timer-urgent');
  } else {
    fill.classList.remove('timer-urgent');
  }
}

// ─── Init ───

function init(): void {
  const params = new URLSearchParams(location.search);
  gameId = params.get('game') || '';

  updateLabels();

  $('btn-lang').addEventListener('click', () => {
    lang = lang === 'zh' ? 'en' : 'zh';
    updateLabels();
  });

  $('btn-join').addEventListener('click', () => {
    const nameInput = $('player-name') as HTMLInputElement;
    playerName = nameInput.value.trim();
    if (!playerName) {
      nameInput.focus();
      return;
    }
    if (!gameId) {
      const errEl = $('join-error');
      errEl.textContent = 'No game ID in URL';
      errEl.classList.remove('hidden');
      return;
    }
    // Clear any previous errors
    $('join-error').classList.add('hidden');
    connect();
    showScreen('waiting-screen');
    $('player-welcome').textContent = playerName;
  });

  $('btn-buzz').addEventListener('click', () => {
    if (hasBuzzed) return;
    hasBuzzed = true;
    ($('btn-buzz') as HTMLButtonElement).disabled = true;
    $('btn-buzz').classList.remove('buzzer-pulse');
    send(createMessage('player:buzz', { clientTimestamp: Date.now() }));
  });

  ($('player-name') as HTMLInputElement).addEventListener('keydown', (e) => {
    if (e.key === 'Enter') $('btn-join').click();
  });
}

init();
