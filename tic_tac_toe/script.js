// win patterns for a 3x3 board
const WINNING_COMBINATIONS = [
  [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
  [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
  [0, 4, 8], [2, 4, 6]            // diagonals
];

// default emoji sets for X and O players
const EMOJI_OPTIONS = {
  X: [
    { emoji: '❌', label: 'X' },
    { emoji: '🔥', label: 'Fire' },
    { emoji: '⭐', label: 'Star' },
    { emoji: '🎯', label: 'Target' }
  ],
  O: [
    { emoji: '⭕', label: 'O' },
    { emoji: '💧', label: 'Water' },
    { emoji: '💎', label: 'Diamond' },
    { emoji: '🎪', label: 'Circus' }
  ]
};

// small helper for audio feedback
class SoundPlayer {
  constructor() {
    this.audioContext = null;
  }

  getContext() {
    if (!this.audioContext) {
      this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    return this.audioContext;
  }

  playClick() {
    const ctx = this.getContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 800;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  }

  playWin() {
    const ctx = this.getContext();
    const frequencies = [523, 659, 784, 1047];
    frequencies.forEach((freq, index) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      oscillator.frequency.value = freq;
      oscillator.type = 'sine';
      const startTime = ctx.currentTime + index * 0.15;
      gainNode.gain.setValueAtTime(0.3, startTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.3);
      oscillator.start(startTime);
      oscillator.stop(startTime + 0.3);
    });
  }

  playDraw() {
    const ctx = this.getContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 200;
    oscillator.type = 'sawtooth';
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  }

  playUndo() {
    const ctx = this.getContext();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.value = 600;
    oscillator.type = 'sine';
    gainNode.gain.setValueAtTime(0.2, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.15);
  }
}

const soundPlayer = new SoundPlayer();

// state of the current session
let gameState = {
  board: Array(9).fill(null),
  currentPlayer: 'X',
  players: {
    X: { name: 'Player 1', emoji: '❌' },
    O: { name: 'Player 2', emoji: '⭕' }
  },
  score: { X: 0, O: 0, draws: 0 },
  moves: [],
  gameOver: false,
  winningLine: null
};

// pull scores from previous sessions (if saved)
function loadScore() {
  const saved = localStorage.getItem('tictactoe-score');
  if (saved) {
    gameState.score = JSON.parse(saved);
  }
}

// store score so it survives page refresh
function saveScore() {
  localStorage.setItem('tictactoe-score', JSON.stringify(gameState.score));
}

// shortcut for grabbing elements by id
const $ = (id) => document.getElementById(id);

// create emoji selection buttons under player fields
function initEmojiOptions() {
  const xContainer = $('x-emojis');
  const oContainer = $('o-emojis');

  EMOJI_OPTIONS.X.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn' + (opt.emoji === '❌' ? ' selected-x' : '');
    btn.textContent = opt.emoji;
    btn.title = opt.label;
    btn.onclick = () => selectEmoji('X', opt.emoji);
    xContainer.appendChild(btn);
  });

  EMOJI_OPTIONS.O.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'emoji-btn' + (opt.emoji === '⭕' ? ' selected-o' : '');
    btn.textContent = opt.emoji;
    btn.title = opt.label;
    btn.onclick = () => selectEmoji('O', opt.emoji);
    oContainer.appendChild(btn);
  });
}

function selectEmoji(player, emoji) {
  gameState.players[player].emoji = emoji;
  $(player === 'X' ? 'x-preview' : 'o-preview').textContent = emoji;

  const container = $(player === 'X' ? 'x-emojis' : 'o-emojis');
  const selectedClass = player === 'X' ? 'selected-x' : 'selected-o';
  container.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.classList.remove(selectedClass);
    if (btn.textContent === emoji) btn.classList.add(selectedClass);
  });
}

// create the 3x3 grid and attach handlers
function initBoard() {
  const board = $('board');
  board.innerHTML = '';

  for (let i = 0; i < 9; i++) {
    const cell = document.createElement('div');
    cell.className = 'cell';
    cell.dataset.index = i;
    cell.onclick = () => handleCellClick(i);
    cell.onmouseenter = () => handleCellHover(i, true);
    cell.onmouseleave = () => handleCellHover(i, false);
    board.appendChild(cell);
  }
}

function handleCellHover(index, entering) {
  if (gameState.gameOver || gameState.board[index]) return;

  const cell = $('board').children[index];
  if (entering) {
    cell.innerHTML = `<span class="preview">${gameState.players[gameState.currentPlayer].emoji}</span>`;
  } else {
    cell.innerHTML = '';
  }
}

function handleCellClick(index) {
  if (gameState.gameOver || gameState.board[index]) return;

  soundPlayer.playClick();

  gameState.board[index] = gameState.currentPlayer;
  gameState.moves.push({
    player: gameState.currentPlayer,
    position: index,
    timestamp: Date.now()
  });

  updateBoard();
  updateHistory();
  updateUndoButton();

  const result = checkWinner();
  if (result) {
    gameState.gameOver = true;
    gameState.winningLine = result.line || null;

    if (result.winner === 'draw') {
      gameState.score.draws++;
      soundPlayer.playDraw();
    } else {
      gameState.score[result.winner]++;
      soundPlayer.playWin();
    }

    saveScore();
    updateScoreboard();
    updateBoard();
    showWinnerModal(result.winner);
  } else {
    gameState.currentPlayer = gameState.currentPlayer === 'X' ? 'O' : 'X';
    updateCurrentTurn();
  }
}

function checkWinner() {
  for (const combo of WINNING_COMBINATIONS) {
    const [a, b, c] = combo;
    if (gameState.board[a] &&
        gameState.board[a] === gameState.board[b] &&
        gameState.board[a] === gameState.board[c]) {
      return { winner: gameState.board[a], line: combo };
    }
  }

  if (gameState.board.every(cell => cell !== null)) {
    return { winner: 'draw' };
  }

  return null;
}

function updateBoard() {
  const cells = $('board').children;
  for (let i = 0; i < 9; i++) {
    const cell = cells[i];
    const value = gameState.board[i];

    cell.innerHTML = value
      ? `<span class="animate-scale-in">${gameState.players[value].emoji}</span>`
      : '';
    cell.classList.toggle('taken', !!value);
    cell.classList.toggle('winning', gameState.winningLine?.includes(i) || false);
  }
}

function updateCurrentTurn() {
  const player = gameState.players[gameState.currentPlayer];
  $('turn-emoji').textContent = player.emoji;
  $('turn-name').textContent = player.name;
}

function updateScoreboard() {
  $('score-x-emoji').textContent = gameState.players.X.emoji;
  $('score-x-name').textContent = gameState.players.X.name;
  $('score-x').textContent = gameState.score.X;

  $('score-o-emoji').textContent = gameState.players.O.emoji;
  $('score-o-name').textContent = gameState.players.O.name;
  $('score-o').textContent = gameState.score.O;

  $('score-draws').textContent = gameState.score.draws;
}

function updateHistory() {
  const list = $('history-list');
  list.innerHTML = '';

  gameState.moves.forEach((move, index) => {
    const row = Math.floor(move.position / 3) + 1;
    const col = (move.position % 3) + 1;

    const item = document.createElement('div');
    item.className = 'history-item';
    item.innerHTML = `
      <span class="move-num">#${index + 1}</span>
      <span>${gameState.players[move.player].emoji}</span>
      <span>${gameState.players[move.player].name}</span>
      <span>→</span>
      <span class="position">R${row}C${col}</span>
    `;
    list.appendChild(item);
  });

  $('history-container').classList.toggle('hidden', gameState.moves.length === 0);
}

function updateUndoButton() {
  $('undo-btn').disabled = gameState.moves.length === 0 || gameState.gameOver;
}

// undo the last move
function undoMove() {
  if (gameState.moves.length === 0 || gameState.gameOver) return;

  soundPlayer.playUndo();
  const lastMove = gameState.moves.pop();
  gameState.board[lastMove.position] = null;
  gameState.currentPlayer = lastMove.player;

  updateBoard();
  updateCurrentTurn();
  updateHistory();
  updateUndoButton();
}

// clear only the current round
function resetRound() {
  gameState.board = Array(9).fill(null);
  gameState.moves = [];
  gameState.gameOver = false;
  gameState.winningLine = null;
  gameState.currentPlayer = 'X';

  updateBoard();
  updateCurrentTurn();
  updateHistory();
  updateUndoButton();
}

// back to name/emoji setup
function newGame() {
  $('game-container').style.display = 'none';
  $('player-setup').style.display = 'block';
  gameState.board = Array(9).fill(null);
  gameState.moves = [];
  gameState.gameOver = false;
  gameState.winningLine = null;
  gameState.currentPlayer = 'X';
}

// show the winner modal
function showWinnerModal(winner) {
  const modal = $('winner-modal');
  const isDraw = winner === 'draw';

  $('modal-trophy').textContent = isDraw ? '✨' : '🏆';
  $('modal-title').textContent = isDraw ? "It's a Draw!" : 'Congratulations!';
  $('modal-emoji').textContent = isDraw ? '' : gameState.players[winner].emoji;
  $('modal-emoji').style.display = isDraw ? 'none' : 'block';
  $('modal-winner').textContent = isDraw
    ? 'Well played by both!'
    : `${gameState.players[winner].name} Wins!`;

  modal.classList.add('show');

  if (!isDraw) {
    createConfetti();
  }
}

function hideWinnerModal() {
  $('winner-modal').classList.remove('show');
  clearConfetti();
}

function createConfetti() {
  for (let i = 0; i < 50; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti';
    confetti.style.left = Math.random() * 100 + '%';
    confetti.style.animationDelay = Math.random() * 2 + 's';
    confetti.style.backgroundColor = `hsl(${Math.random() * 360}, 80%, 60%)`;
    document.body.appendChild(confetti);
  }
}

function clearConfetti() {
  document.querySelectorAll('.confetti').forEach(c => c.remove());
}

// start game button logic
function startGame() {
  const nameX = $('playerX').value.trim();
  const nameO = $('playerO').value.trim();

  if (!nameX || !nameO) {
    alert('Please enter both player names!');
    return;
  }

  gameState.players.X.name = nameX;
  gameState.players.O.name = nameO;

  $('player-setup').style.display = 'none';
  $('game-container').style.display = 'block';

  initBoard();
  resetRound();
  updateScoreboard();
}

// event bindings
$('start-button').onclick = startGame;
$('undo-btn').onclick = undoMove;
$('reset-btn').onclick = resetRound;
$('new-game-btn').onclick = newGame;
$('play-again-btn').onclick = () => { hideWinnerModal(); resetRound(); };
$('modal-new-game-btn').onclick = () => { hideWinnerModal(); newGame(); };

// initial setup
loadScore();
initEmojiOptions();
