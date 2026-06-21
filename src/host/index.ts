import { messages, type I18nMessages } from '../shared/i18n.js';
import { DEFAULT_CONFIG, type GameConfig } from '../shared/game-config.js';
import type {
  WsMessage,
  TeamState,
  QuestionData,
  ServerGameCreatedMsg,
  ServerPlayerJoinedMsg,
  ServerQuestionMsg,
  ServerBuzzWinnerMsg,
  ServerAnswerResultMsg,
  ServerPassToOtherMsg,
  ServerGameOverMsg,
  ServerTimerTickMsg,
  ServerErrorMsg,
  ServerSavedGamesMsg,
  ServerHostJoinedMsg,
} from '../shared/protocol.js';
import { createMessage } from '../shared/protocol.js';
import { BaseballFieldRenderer } from './renderer/baseball-field.js';
import { AnimationController } from './renderer/animations.js';

// ─── State ───

let ws: WebSocket | null = null;
let lang: 'zh' | 'en' = 'zh';
let config: GameConfig = { ...DEFAULT_CONFIG };
let gameId = '';
let teams: TeamState[] = [];
let currentTimerTotal = 0;
let fieldRenderer: BaseballFieldRenderer | null = null;
let animController: AnimationController | null = null;
let liveQuestionCounter = 0;

// Host-as-player state
let hostPlayerId: string | null = null;
let hostTeamIndex = -1;
let isParticipant = false;
let canAnswer = false;

// ─── DOM ───

const $ = (id: string) => document.getElementById(id)!;
const screens = document.querySelectorAll<HTMLElement>('.screen');

function showScreen(id: string): void {
  screens.forEach(s => s.classList.remove('active'));
  $(id).classList.add('active');
}

function show(id: string): void { $(id).classList.remove('hidden'); }
function hide(id: string): void { $(id).classList.add('hidden'); }

function i(key: keyof I18nMessages): string {
  return messages[lang][key];
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
    if (gameId) {
      // Reconnecting to an existing game
      send(createMessage('host:rejoin', { gameId }));
    } else {
      // Create a new game
      send(createMessage('host:create', { config }));
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
    case 'server:gameCreated':
      handleGameCreated(msg as ServerGameCreatedMsg);
      break;
    case 'server:playerJoined':
      handlePlayerJoined(msg as ServerPlayerJoinedMsg);
      break;
    case 'server:question':
      handleQuestion(msg as ServerQuestionMsg);
      break;
    case 'server:buzzWinner':
      handleBuzzWinner(msg as ServerBuzzWinnerMsg);
      break;
    case 'server:answerResult':
      handleAnswerResult(msg as ServerAnswerResultMsg);
      break;
    case 'server:passToOther':
      handlePassToOther(msg as ServerPassToOtherMsg);
      break;
    case 'server:gameOver':
      handleGameOver(msg as ServerGameOverMsg);
      break;
    case 'server:timerTick':
      handleTimerTick(msg as ServerTimerTickMsg);
      break;
    case 'server:savedGames':
      handleSavedGames(msg as ServerSavedGamesMsg);
      break;
    case 'server:hostJoined':
      handleHostJoined(msg as ServerHostJoinedMsg);
      break;
    case 'server:error':
      console.error('[Host]', (msg as ServerErrorMsg).payload.message);
      break;
  }
}

function handleGameCreated(msg: ServerGameCreatedMsg): void {
  gameId = msg.payload.gameId;
  const qrImg = $('qr-code') as HTMLImageElement;
  qrImg.src = msg.payload.qrDataUrl;
  $('join-url').textContent = msg.payload.joinUrl;
  showScreen('lobby-screen');
}

function handlePlayerJoined(msg: ServerPlayerJoinedMsg): void {
  teams = msg.payload.teams;
  renderTeams();
  // Enable start button if we have at least 2 players
  const totalPlayers = teams.reduce((sum, t) => sum + t.players.length, 0);
  ($('btn-start') as HTMLButtonElement).disabled = totalPlayers < 2;
}

function handleQuestion(msg: ServerQuestionMsg): void {
  const { question, questionNumber, totalQuestions, timeLimit } = msg.payload;
  currentTimerTotal = timeLimit;

  showScreen('game-screen');
  show('question-overlay');
  hide('result-overlay');
  hide('btn-next');

  // Update question counter
  $('question-counter').textContent = `${questionNumber} / ${totalQuestions} ${i('questionOf')}`;

  // Display question
  $('question-text').textContent = question.text[lang];

  // Display answer choices
  const container = $('answer-choices');
  container.innerHTML = '';
  for (const ans of question.answers) {
    const div = document.createElement('div');
    div.className = 'answer-choice';
    div.dataset.answerId = String(ans.id);
    div.textContent = ans.text[lang];
    div.addEventListener('click', () => {
      if (!canAnswer) return;
      canAnswer = false;
      container.querySelectorAll('.answer-choice').forEach(el => el.classList.remove('answerable'));
      div.classList.add('selected');
      send(createMessage('player:answer', { answerId: ans.id }));
    });
    container.appendChild(div);
  }

  // Host-as-player: reset interaction, open buzzer for this question
  canAnswer = false;
  if (isParticipant) {
    show('btn-host-buzz');
    ($('btn-host-buzz') as HTMLButtonElement).disabled = false;
  } else {
    hide('btn-host-buzz');
  }

  // Reset timer
  $('timer-fill').style.width = '100%';
  $('timer-fill').classList.remove('urgent');

  // Ensure canvas is sized correctly then draw
  if (fieldRenderer) fieldRenderer.resize();
  if (animController) animController.resize();
  drawField();
}

function handleBuzzWinner(msg: ServerBuzzWinnerMsg): void {
  const { playerId, playerName, teamIndex } = msg.payload;
  $('question-text').textContent =
    `${playerName} (${i('team')} ${String.fromCharCode(65 + teamIndex)}) ${i('buzzerReady')}`;

  // Buzzer is now locked; hide the host buzz button.
  hide('btn-host-buzz');
  // If the host won the buzz, let them answer on the big screen.
  if (isParticipant && playerId === hostPlayerId) {
    enableHostAnswering();
  }
}

function handleAnswerResult(msg: ServerAnswerResultMsg): void {
  const { correct, correctAnswerId, outcome, teamIndex } = msg.payload;

  // Stop any host buzz/answer interaction for this question.
  disableHostInteraction();

  // Capture old teams before updating for animation
  const oldTeams = teams.map(t => ({ ...t, runners: [...t.runners] as [boolean, boolean, boolean] }));
  teams = msg.payload.teams;

  // Highlight correct answer
  const choices = $('answer-choices').querySelectorAll('.answer-choice');
  choices.forEach(el => {
    const id = parseInt((el as HTMLElement).dataset.answerId || '0');
    if (id === correctAnswerId) {
      el.classList.add('correct');
    }
  });

  // Show result
  hide('question-overlay');
  show('result-overlay');

  const resultText = $('result-text');
  const outcomeText = $('outcome-text');

  if (correct && teamIndex !== null) {
    resultText.textContent = `${i('team')} ${String.fromCharCode(65 + teamIndex)} ${i('correct')}`;
    outcomeText.textContent = outcome ? i(outcome as keyof I18nMessages) : '';
    outcomeText.className = outcome ? `outcome-${outcome}` : '';
  } else {
    resultText.textContent = i('strikeout');
    outcomeText.textContent = i('strikeout');
    outcomeText.className = 'outcome-strikeout';
  }

  // Play animation
  if (outcome && animController && fieldRenderer) {
    animController.resize();
    animController.play({
      outcome,
      teamIndex: teamIndex ?? null,
      oldTeams,
      newTeams: teams,
      positions: fieldRenderer.fieldPositions,
    }, () => {
      show('btn-next');
      updateScoreboard();
      drawField();
    });
  } else {
    show('btn-next');
    updateScoreboard();
    drawField();
  }
}

function handlePassToOther(msg: ServerPassToOtherMsg): void {
  currentTimerTotal = msg.payload.timeLimit;
  $('question-text').textContent =
    `${i('passToOther')} ${i('team')} ${String.fromCharCode(65 + msg.payload.teamIndex)}`;
  $('timer-fill').style.width = '100%';
  $('timer-fill').classList.remove('urgent');

  // If it was passed to the host's team, let them answer.
  if (isParticipant && msg.payload.teamIndex === hostTeamIndex) {
    enableHostAnswering();
  } else {
    canAnswer = false;
  }
}

function handleGameOver(msg: ServerGameOverMsg): void {
  const { teams: finalTeams, winnerTeamIndex } = msg.payload;

  const container = $('final-scores');
  container.innerHTML = '';

  for (const team of finalTeams) {
    const div = document.createElement('div');
    div.className = 'final-team' + (winnerTeamIndex === team.index ? ' winner' : '');
    div.innerHTML = `
      <div class="team-name">${i('team')} ${team.name}</div>
      <div class="final-score">${team.score}</div>
    `;
    container.appendChild(div);
  }

  $('gameover-title').textContent = i('gameOver');
  showScreen('gameover-screen');
}

function handleTimerTick(msg: ServerTimerTickMsg): void {
  const remaining = msg.payload.remaining;
  const pct = currentTimerTotal > 0 ? (remaining / currentTimerTotal) * 100 : 0;
  const fill = $('timer-fill');
  fill.style.width = pct + '%';
  if (remaining <= 2) {
    fill.classList.add('urgent');
  } else {
    fill.classList.remove('urgent');
  }
}

function handleSavedGames(_msg: ServerSavedGamesMsg): void {
  // Could show a resume dialog, for now just log
}

function handleHostJoined(msg: ServerHostJoinedMsg): void {
  const player = msg.payload.player;
  const checkbox = $('cfg-host-play') as HTMLInputElement;
  if (player) {
    hostPlayerId = player.id;
    hostTeamIndex = player.teamIndex;
    isParticipant = true;
  } else {
    hostPlayerId = null;
    hostTeamIndex = -1;
    isParticipant = false;
    // Join may have failed (game full / started) — reflect that in the checkbox
    checkbox.checked = false;
  }
}

/** Enable host answer-choice clicking when it's the host player's turn. */
function enableHostAnswering(): void {
  canAnswer = true;
  $('answer-choices').querySelectorAll('.answer-choice').forEach(el => {
    el.classList.add('answerable');
  });
}

/** Disable all host buzz/answer interaction (e.g. on result). */
function disableHostInteraction(): void {
  canAnswer = false;
  hide('btn-host-buzz');
  $('answer-choices').querySelectorAll('.answer-choice').forEach(el => {
    el.classList.remove('answerable');
  });
}

// ─── Rendering ───

function drawField(): void {
  if (!fieldRenderer) return;
  fieldRenderer.drawField();
  if (teams.length > 0) {
    fieldRenderer.drawAllRunners(teams);
  }
}

function updateScoreboard(): void {
  const sb = $('scoreboard');
  sb.innerHTML = teams.map((t, idx) => {
    const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71'];
    return `<div class="team-score">
      <span class="team-name" style="color:${colors[idx % colors.length]}">${i('team')} ${t.name}</span>
      <span class="score-value">${t.score}</span>
    </div>`;
  }).join('');
}

function renderTeams(): void {
  const container = $('teams-container');
  container.innerHTML = '';
  const colors = ['#e74c3c', '#3498db', '#f1c40f', '#2ecc71'];

  for (const team of teams) {
    const col = document.createElement('div');
    col.className = 'team-column';
    col.innerHTML = `<h4 style="color:${colors[team.index % colors.length]}">${i('team')} ${team.name}</h4>`;
    for (const p of team.players) {
      const div = document.createElement('div');
      div.className = 'player-name';
      div.textContent = p.name;
      if (p.isHost) {
        div.classList.add('is-host');
        const badge = document.createElement('span');
        badge.className = 'host-badge';
        badge.textContent = '👑';
        div.prepend(badge);
      }
      col.appendChild(div);
    }
    container.appendChild(col);
  }
}

// ─── Settings Panel ───

function loadConfigToUI(): void {
  ($('cfg-total-questions') as HTMLInputElement).value = String(config.totalQuestions);
  ($('cfg-buzzer-time') as HTMLInputElement).value = String(config.buzzerTimeLimit);
  ($('cfg-answer-time') as HTMLInputElement).value = String(config.answerTimeLimit);
  ($('cfg-players-per-team') as HTMLInputElement).value = String(config.playersPerTeam);
  ($('cfg-prob-single') as HTMLInputElement).value = String(config.correctOutcomes.single);
  ($('cfg-prob-double') as HTMLInputElement).value = String(config.correctOutcomes.double);
  ($('cfg-prob-triple') as HTMLInputElement).value = String(config.correctOutcomes.triple);
  ($('cfg-prob-homerun') as HTMLInputElement).value = String(config.correctOutcomes.homerun);
  ($('cfg-prob-walk') as HTMLInputElement).value = String(config.correctOutcomes.walk);
}

function readConfigFromUI(): void {
  config.totalQuestions = parseInt(($('cfg-total-questions') as HTMLInputElement).value) || 20;
  config.buzzerTimeLimit = parseInt(($('cfg-buzzer-time') as HTMLInputElement).value) || 5;
  config.answerTimeLimit = parseInt(($('cfg-answer-time') as HTMLInputElement).value) || 10;
  config.playersPerTeam = parseInt(($('cfg-players-per-team') as HTMLInputElement).value) || 1;
  config.correctOutcomes = {
    single: parseFloat(($('cfg-prob-single') as HTMLInputElement).value) || 0.40,
    double: parseFloat(($('cfg-prob-double') as HTMLInputElement).value) || 0.25,
    triple: parseFloat(($('cfg-prob-triple') as HTMLInputElement).value) || 0.10,
    homerun: parseFloat(($('cfg-prob-homerun') as HTMLInputElement).value) || 0.10,
    walk: parseFloat(($('cfg-prob-walk') as HTMLInputElement).value) || 0.15,
  };

  // Send update to server
  send(createMessage('host:updateConfig', { config }));
}

// ─── Live Question ───

function submitLiveQuestion(): void {
  const zhText = ($('live-q-zh') as HTMLInputElement).value.trim();
  const enText = ($('live-q-en') as HTMLInputElement).value.trim();
  if (!zhText && !enText) return;

  const rows = document.querySelectorAll('.live-answer-row');
  const correctIndex = parseInt(
    (document.querySelector('input[name="correct-ans"]:checked') as HTMLInputElement)?.value || '0'
  );

  const answers = Array.from(rows).map((row, idx) => {
    const zhInput = row.querySelector('.live-ans-zh') as HTMLInputElement;
    const enInput = row.querySelector('.live-ans-en') as HTMLInputElement;
    return {
      id: idx + 1,
      text: { zh: zhInput.value.trim() || zhText, en: enInput.value.trim() || enText },
      correct: idx === correctIndex,
    };
  });

  liveQuestionCounter++;
  const question: QuestionData = {
    id: `live-${liveQuestionCounter}`,
    text: { zh: zhText || enText, en: enText || zhText },
    answers,
  };

  send(createMessage('host:liveQuestion', { question }));
  hide('live-question-panel');

  // Clear form
  ($('live-q-zh') as HTMLInputElement).value = '';
  ($('live-q-en') as HTMLInputElement).value = '';
  rows.forEach(row => {
    (row.querySelector('.live-ans-zh') as HTMLInputElement).value = '';
    (row.querySelector('.live-ans-en') as HTMLInputElement).value = '';
  });
}

// ─── Init ───

function init(): void {
  // Initialize canvas renderers
  const fieldCanvas = $('baseball-field') as HTMLCanvasElement;
  const animCanvas = $('animation-layer') as HTMLCanvasElement;

  fieldRenderer = new BaseballFieldRenderer(fieldCanvas);
  animController = new AnimationController(animCanvas);
  animController.setLanguage(lang);

  // Handle window resize
  const onResize = () => {
    if (fieldRenderer) {
      fieldRenderer.resize();
      drawField();
    }
    if (animController && !animController.isAnimating) {
      animController.resize();
    }
  };
  window.addEventListener('resize', onResize);
  // Initial resize after layout settles
  requestAnimationFrame(onResize);

  loadConfigToUI();

  // Language toggles
  const toggleLang = () => {
    lang = lang === 'zh' ? 'en' : 'zh';
    config.language = lang;
    if (animController) animController.setLanguage(lang);
    updateAllLabels();
    send(createMessage('host:updateConfig', { config: { language: lang } }));
  };
  $('btn-lang-toggle').addEventListener('click', toggleLang);
  $('btn-lang-toggle-game').addEventListener('click', toggleLang);

  // Host-as-player toggle
  const hostPlayCheckbox = $('cfg-host-play') as HTMLInputElement;
  hostPlayCheckbox.addEventListener('change', () => {
    if (hostPlayCheckbox.checked) {
      const nameInput = $('host-player-name') as HTMLInputElement;
      const name = nameInput.value.trim() || i('host');
      send(createMessage('host:joinAsPlayer', { name }));
    } else {
      send(createMessage('host:leaveAsPlayer', {}));
    }
  });

  // Start game
  $('btn-start').addEventListener('click', () => {
    readConfigFromUI();
    // Lock host participation once the game is underway.
    hostPlayCheckbox.disabled = true;
    ($('host-player-name') as HTMLInputElement).disabled = true;
    send(createMessage('host:start', {}));
  });

  // Host buzzes in from the big screen
  $('btn-host-buzz').addEventListener('click', () => {
    if (!isParticipant) return;
    ($('btn-host-buzz') as HTMLButtonElement).disabled = true;
    send(createMessage('player:buzz', { clientTimestamp: Date.now() }));
  });

  // Next question / advance
  $('btn-next').addEventListener('click', () => {
    send(createMessage('host:advance', {}));
  });

  // New game
  $('btn-new-game').addEventListener('click', () => {
    config = { ...DEFAULT_CONFIG, language: lang };
    loadConfigToUI();
    teams = [];
    gameId = '';
    // Reset host participation for the fresh game.
    hostPlayerId = null;
    hostTeamIndex = -1;
    isParticipant = false;
    canAnswer = false;
    (hostPlayCheckbox as HTMLInputElement).checked = false;
    hostPlayCheckbox.disabled = false;
    const hostNameInput = $('host-player-name') as HTMLInputElement;
    hostNameInput.disabled = false;
    connect();
  });

  // Settings panel
  $('btn-settings').addEventListener('click', () => show('settings-panel'));
  $('btn-close-settings').addEventListener('click', () => {
    readConfigFromUI();
    hide('settings-panel');
  });
  $('btn-save-config').addEventListener('click', () => {
    readConfigFromUI();
    send(createMessage('host:saveConfig', {}));
    hide('settings-panel');
  });
  $('btn-reset-config').addEventListener('click', () => {
    config = { ...DEFAULT_CONFIG, language: lang };
    loadConfigToUI();
    send(createMessage('host:updateConfig', { config }));
  });

  // Live question panel
  $('btn-submit-live-q').addEventListener('click', submitLiveQuestion);
  $('btn-close-live-q').addEventListener('click', () => hide('live-question-panel'));

  updateAllLabels();
  connect();
}

function updateAllLabels(): void {
  $('game-title').textContent = i('gameTitle');
  $('scan-text').textContent = i('scanToJoin');
  $('waiting-text').textContent = i('waitingForPlayers');
  $('btn-start').textContent = i('startGame');
  $('btn-settings').textContent = i('settings');
  $('btn-lang-toggle').textContent = lang === 'zh' ? 'EN' : '中';
  $('btn-lang-toggle-game').textContent = lang === 'zh' ? 'EN' : '中';
  $('gameover-title').textContent = i('gameOver');
  $('btn-new-game').textContent = i('newGame');
  $('btn-next').textContent = lang === 'zh' ? '下一題' : 'Next';
  $('host-play-text').textContent = i('hostJoinAsPlayer');
  ($('host-player-name') as HTMLInputElement).placeholder = i('host');
  $('btn-host-buzz').textContent = i('buzz');
  $('settings-title').textContent = i('settings');
  $('btn-save-config').textContent = i('save');
  $('btn-reset-config').textContent = i('reset');
  $('live-q-title').textContent = i('liveQuestion');
  $('btn-submit-live-q').textContent = i('submit');

  // Re-render teams with updated labels
  if (teams.length > 0) {
    renderTeams();
    updateScoreboard();
  }
}

init();
