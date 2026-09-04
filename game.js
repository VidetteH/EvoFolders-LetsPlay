const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const carryEl = document.getElementById('carry');
const dataPointsEl = document.getElementById('data-points');
const folderTargetEl = document.getElementById('folder-target');
const levelEl = document.getElementById('level');
const bestScoreEl = document.getElementById('best-score');
const livesEl = document.getElementById('lives');
const overlay = document.getElementById('overlay');
const menuActions = document.getElementById('menuActions');
const topStartButton = document.getElementById('topStartButton');
const topTutorialButton = document.getElementById('topTutorialButton');
const topBar = document.querySelector('.top-bar');

const MAX_LIVES = 3;

let audioCtx = null;
let musicTimer = null;
let musicStep = 0;
let levelIntroTimer = null;

const retroNotes = [
  262, 330, 392, 523,
  392, 330, 294, 349,
  440, 349, 330, 262,
  294, 330, 392, 294
];

function playTone(frequency, duration, type = 'sine', volume = 0.04) {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;

    if (!audioCtx || audioCtx.state === 'closed') {
      audioCtx = new AudioCtor();
    }

    const startTone = () => {
      const oscillator = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      const startTime = audioCtx.currentTime;
      oscillator.type = type;
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(volume, startTime);
      oscillator.connect(gain);
      gain.connect(audioCtx.destination);
      oscillator.start(startTime);
      oscillator.stop(startTime + duration);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    };

    if (audioCtx.state === 'suspended') {
      audioCtx.resume().then(startTone).catch(() => {});
      return;
    }

    startTone();
  } catch (error) {
    // Ignore audio failures silently in browsers that block audio until interaction.
  }
}

function stopBackgroundMusic() {
  if (musicTimer) {
    clearInterval(musicTimer);
    musicTimer = null;
  }
}

function startBackgroundMusic() {
  stopBackgroundMusic();
  musicStep = 0;
  musicTimer = setInterval(() => {
    if (state.gameOver || state.dying) {
      return;
    }
    playTone(retroNotes[musicStep % retroNotes.length], 0.11, 'square', 0.018);
    musicStep += 1;
  }, 230);
}

const countryStages = [
  {
    name: 'New Zealand',
    skyTop: '#7bd3ff',
    skyBottom: '#dff6ff',
    ground: '#5f9f5c',
    mountain: '#2d5d4d',
    accent: '#f7d6a2',
    hazardSummary: 'rocks, volcanoes, and All Blacks rugby players',
    hazards: ['rock', 'volcano', 'rugby'],
    challenge: 'Volcanic winds are building'
  },
  {
    name: 'Australia',
    skyTop: '#f3a54a',
    skyBottom: '#ffe8a8',
    ground: '#d77f3b',
    mountain: '#8f432f',
    accent: '#ffd8b1',
    hazardSummary: 'kangaroos and rocks',
    hazards: ['rock', 'kangaroo'],
    challenge: 'Cross the red-dirt heat'
  },
  {
    name: 'Canada',
    skyTop: '#8cc5ff',
    skyBottom: '#edf6ff',
    ground: '#6fa26e',
    mountain: '#4e6d8e',
    accent: '#dce7ff',
    hazardSummary: 'maple trees and Canadian flags',
    hazards: ['maple', 'flag'],
    challenge: 'Snow is closing in'
  },
  {
    name: 'South Africa',
    skyTop: '#4db7ed',
    skyBottom: '#d8f3ff',
    ground: '#5f9f52',
    mountain: '#7f4b32',
    accent: '#f4d35e',
    hazardSummary: 'the Big Five, giraffes, and Springbok players',
    hazards: ['lion', 'elephant', 'buffalo', 'leopard', 'rhino', 'giraffe', 'springbok'],
    challenge: 'Race across the wild savanna'
  }
];

const groundY = canvas.height - 84;

const state = {
  running: false,
  gameOver: false,
  paused: false,
  score: 0,
  carry: 0,
  carryValue: 0,
  folderTarget: 20,
  delivered: 0,
  best: Number(localStorage.getItem('geo-collector-best') || 0),
  leaderboard: JSON.parse(localStorage.getItem('geo-collector-scores') || '[]'),
  introTime: 0,
  level: 1,
  wind: 0,
  stageIndex: 0,
  difficulty: 0,
  lives: MAX_LIVES,
  elapsed: 0,
  lastTime: 0,
  itemTimer: 0,
  rockTimer: 0,
  items: [],
  rocks: [],
  birds: [],
  droppings: [],
  boss: null,
  bossShots: [],
  clouds: [],
  fireworks: [],
  popups: [],
  shake: 0,
  folderPulse: 0,
  lastBossDelivered: 0,
  dying: false,
  deathTime: 0
};

const player = {
  x: 110,
  y: groundY - 52,
  width: 42,
  height: 52,
  vx: 0,
  vy: 0,
  speed: 290,
  jumpStrength: 480,
  riseGravity: 760,
  fallGravity: 1040,
  maxFallSpeed: 640,
  onGround: true,
  jumpsAvailable: 2,
  color: '#ffb703'
};

const folder = {
  x: canvas.width - 120,
  width: 90,
  height: 58,
  y: groundY - 58
};

const keys = {
  left: false,
  right: false,
  jump: false
};

function getCurrentStage() {
  return countryStages[state.stageIndex];
}

function updateBest() {
  bestScoreEl.textContent = String(state.best);
}

function updateLevel() {
  if (state.delivered >= state.level * 5) {
    state.level += 1;
  }
  state.stageIndex = (state.level - 1) % countryStages.length;
  state.difficulty = Math.max(0, state.level - countryStages.length);
  state.wind = state.level >= 2 ? 1 : 0;
  state.folderTarget = 20 + (state.level - 1) * 5;
  levelEl.textContent = String(state.level);
  updateFolderStatus();
}

function updateFolderStatus() {
  dataPointsEl.textContent = String(state.carryValue);
  folderTargetEl.textContent = `${state.carryValue} / ${state.folderTarget}`;
  folderTargetEl.classList.toggle('ready', state.carryValue >= state.folderTarget);
}

function updateLives() {
  livesEl.textContent = String(state.lives);
}

function positionOverlay() {
  overlay.style.top = `${menuActions.offsetHeight + topBar.offsetHeight}px`;
}

function setOverlay(title, message, buttonText, onClick, secondaryButtonText = '', secondaryOnClick = null) {
  if (levelIntroTimer) {
    clearTimeout(levelIntroTimer);
    levelIntroTimer = null;
  }
  menuActions.classList.remove('visible');
  positionOverlay();
  const panel = overlay.querySelector('.panel');
  panel.innerHTML = `
    <h1>${title}</h1>
    <p>${message}</p>
    <div class="button-row">
      <button id="startButton">${buttonText}</button>
      ${secondaryButtonText ? `<button id="secondaryButton" class="secondary">${secondaryButtonText}</button>` : ''}
    </div>
  `;

  const actionButton = document.getElementById('startButton');
  actionButton.addEventListener('click', onClick);

  if (secondaryButtonText && secondaryOnClick) {
    const secondaryButton = document.getElementById('secondaryButton');
    secondaryButton.addEventListener('click', secondaryOnClick);
  }

  overlay.classList.add('visible');
}

function getLeaderboardMarkup() {
  const entries = [...state.leaderboard].sort((a, b) => b.score - a.score).slice(0, 5);

  if (!entries.length) {
    return '<div class="leaderboard"><strong>Top runs</strong><p class="empty">No scores yet. Start the run and set the pace.</p></div>';
  }

  const items = entries
    .map((entry, index) => `<li><span>#${index + 1}</span><strong>${entry.score}</strong></li>`)
    .join('');

  return `
    <div class="leaderboard">
      <strong>Top runs</strong>
      <ol>${items}</ol>
    </div>
  `;
}

function saveScoreToLeaderboard(score) {
  const next = [...state.leaderboard, { score }]
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  state.leaderboard = next;
  localStorage.setItem('geo-collector-scores', JSON.stringify(next));
  return next;
}

function triggerLevelIntro() {
  state.paused = true;
  state.running = false;
  const continueLevel = () => {
    if (levelIntroTimer) {
      clearTimeout(levelIntroTimer);
      levelIntroTimer = null;
    }
    state.paused = false;
    state.running = true;
    overlay.classList.remove('visible');
  };
  setOverlay(
    `Level ${state.level}`,
    `Country ${state.stageIndex + 1} of ${countryStages.length}: ${getCurrentStage().name} is live. ${getCurrentStage().challenge}. Keep the pipeline moving and keep the data flowing to Evo.`,
    'Continue',
    continueLevel,
    '',
    null
  );
  levelIntroTimer = setTimeout(continueLevel, 1800);
}

function showTitleScreen() {
  stopBackgroundMusic();
  const panel = overlay.querySelector('.panel');
  panel.innerHTML = `
    <h1>Evo Foldes</h1>
    <p><strong class="mission-label">Mission</strong><br>Collect all your files and objects and organise them in your Evo Folder.<br><br>Travel automatically through New Zealand, Australia, Canada, and South Africa. Each level brings a new country, and after the first round the hazards get faster.<br><br><strong>Tap Space to jump higher or lower while moving.</strong></p>
    <div class="country-route" aria-label="Country route">
      <div class="route-stop"><span class="route-icon">NZ</span><strong>New Zealand</strong></div>
      <span class="route-arrow">-&gt;</span>
      <div class="route-stop"><span class="route-icon">AU</span><strong>Australia</strong></div>
      <span class="route-arrow">-&gt;</span>
      <div class="route-stop"><span class="route-icon">CA</span><strong>Canada</strong></div>
      <span class="route-arrow">-&gt;</span>
      <div class="route-stop"><span class="route-icon">ZA</span><strong>South Africa</strong></div>
    </div>
    ${getLeaderboardMarkup()}
  `;
  menuActions.classList.add('visible');
  positionOverlay();
  overlay.classList.add('visible');
}

function resetGame() {
  if (levelIntroTimer) {
    clearTimeout(levelIntroTimer);
    levelIntroTimer = null;
  }
  menuActions.classList.remove('visible');
  startBackgroundMusic();
  state.running = true;
  state.gameOver = false;
  state.paused = false;
  state.score = 0;
  state.carry = 0;
  state.carryValue = 0;
  state.folderTarget = 20;
  state.delivered = 0;
  state.level = 1;
  state.stageIndex = 0;
  state.difficulty = 0;
  state.lives = MAX_LIVES;
  state.elapsed = 0;
  state.introTime = 0;
  state.itemTimer = 0.8;
  state.rockTimer = 1.7;
  state.items = [];
  state.rocks = [];
  state.birds = [];
  state.droppings = [];
  state.boss = null;
  state.bossShots = [];
  state.fireworks = [];
  state.popups = [];
  state.shake = 0;
  state.folderPulse = 0;
  state.lastBossDelivered = 0;
  state.dying = false;
  state.deathTime = 0;
  player.x = 110;
  player.y = groundY - player.height;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  player.jumpsAvailable = 2;
  scoreEl.textContent = '0';
  carryEl.textContent = '0';
  updateFolderStatus();
  levelEl.textContent = '1';
  updateLives();
  overlay.classList.remove('visible');
}

function createClouds() {
  state.clouds = Array.from({ length: 8 }, () => ({
    x: Math.random() * canvas.width,
    y: 30 + Math.random() * 180,
    radius: 18 + Math.random() * 28,
    speed: 12 + Math.random() * 28
  }));
}

function spawnItem() {
  const itemTypes = ['file', 'mesh', 'blockmodel'];
  const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
  const baseValues = { file: 1, mesh: 2, blockmodel: 3 };
  const size = 18 + Math.random() * 16;
  const x = canvas.width + 30;
  const y = 100 + Math.random() * (groundY - 140);
  const heightBonus = Math.max(0, (y - 100) / (groundY - 180)) * 4;
  const value = Math.round(baseValues[type] + heightBonus);

  state.items.push({
    type,
    value,
    x,
    y,
    width: size,
    height: size,
    speed: 170 + state.level * 18 + state.difficulty * 12 + Math.random() * 60,
    drift: (Math.random() - 0.5) * 24,
    bob: Math.random() * Math.PI * 2
  });
}

function spawnRock() {
  let width = 28 + Math.random() * 18;
  let height = width * (0.8 + Math.random() * 0.6);
  const x = canvas.width + 30;
  const y = groundY + 10;
  const hazardType = getCurrentStage().hazards[Math.floor(Math.random() * getCurrentStage().hazards.length)];
  const hazardScale = hazardType === 'kangaroo'
    ? 1.45
    : hazardType === 'maple'
      ? 0.8 + Math.random() * 0.8
      : ['lion', 'elephant', 'buffalo', 'leopard', 'rhino'].includes(hazardType)
        ? 1.15
        : hazardType === 'giraffe' || hazardType === 'springbok'
          ? 1.3
      : 1;

  width *= hazardScale;
  height *= hazardScale;

  state.rocks.push({
    x,
    y,
    width,
    height,
    type: hazardType,
    speed: 190 + state.level * 25 + state.difficulty * 18,
    rise: 18 + Math.random() * 22,
    phase: Math.random() * Math.PI
  });
}

function spawnBird() {
  state.birds.push({
    x: canvas.width + 50,
    y: 90 + Math.random() * 145,
    width: 42,
    height: 24,
    speed: 125 + state.level * 12 + state.difficulty * 14,
    phase: Math.random() * Math.PI * 2,
    poopTimer: 0.8 + Math.random() * 1.4
  });
}

function endGame() {
  stopBackgroundMusic();
  state.running = false;
  state.gameOver = true;
  state.paused = false;
  state.dying = false;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem('geo-collector-best', String(state.best));
  updateBest();
  playTone(90, 0.2, 'sawtooth', 0.09);

  const minutes = Math.floor(state.elapsed / 60);
  const seconds = Math.floor(state.elapsed % 60);
  const timeLabel = `${minutes}m ${seconds}s`;
  const leaderboard = saveScoreToLeaderboard(state.score);
  const leaderboardHtml = leaderboard.length
    ? `<div class="leaderboard"><strong>Top runs</strong><ol>${leaderboard
        .map((entry, index) => `<li><span>#${index + 1}</span><strong>${entry.score}</strong></li>`)
        .join('')}</ol></div>`
    : '<div class="leaderboard"><strong>Top runs</strong><p class="empty">No scores yet.</p></div>';

  setOverlay('Game Over', `You collected ${state.score} points and lasted ${timeLabel}. Best score: ${state.best}.${leaderboardHtml}`, 'Play Again', () => {
    resetGame();
  }, 'Main menu', showTitleScreen);
}

function togglePause() {
  if (!state.running || state.gameOver) {
    return;
  }

  state.paused = !state.paused;

  if (state.paused) {
    stopBackgroundMusic();
    setOverlay('Paused', 'Catch your breath and jump back in when ready.', 'Resume', () => {
      state.paused = false;
      startBackgroundMusic();
      overlay.classList.remove('visible');
    }, 'Main menu', showTitleScreen);
    return;
  }

  overlay.classList.remove('visible');
}

function loseLife() {
  if (!state.running || state.gameOver || state.paused) {
    return;
  }

  state.lives = 0;
  updateLives();
  state.carry = 0;
  state.carryValue = 0;
  carryEl.textContent = '0';
  updateFolderStatus();
  state.items = [];
  state.rocks = [];
  state.birds = [];
  state.droppings = [];
  state.bossShots = [];
  state.boss = null;
  state.fireworks = [];
  player.x = 110;
  player.y = groundY - player.height;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  state.shake = 1.6;
  spawnPopup(player.x + player.width / 2, player.y - 10, 'DANGER!', '#ff6b6b');
  playTone(160, 0.18, 'sawtooth', 0.06);

  state.dying = true;
  state.deathTime = 0;
  state.running = false;
  state.gameOver = false;
  player.vy = -300;
  playTone(95, 0.32, 'sawtooth', 0.09);
  playTone(55, 0.5, 'triangle', 0.06);
}

function jump() {
  if (!state.running || state.gameOver || state.paused) {
    return;
  }

  if (player.onGround) {
    player.vy = -player.jumpStrength;
    player.onGround = false;
    player.jumpsAvailable = 1;
    return;
  }

  player.vy = Math.max(player.vy - player.jumpStrength * 0.72, -player.jumpStrength * 1.15);
}

function highJump() {
  if (!state.running || state.gameOver || state.paused) {
    return;
  }

  player.vy = -player.jumpStrength * 1.35;
  player.onGround = false;
  player.jumpsAvailable = 0;
  playTone(680, 0.08, 'triangle', 0.04);
}

function updatePlayer(dt) {
  const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  const windDrift = state.level >= 2 ? Math.sin(state.elapsed * 2.2) * 32 : 0;
  player.vx = move * player.speed + windDrift * 0.25;
  player.x += player.vx * dt;
  player.x = Math.max(30, Math.min(canvas.width - 60, player.x));

  const gravity = player.vy < 0 ? player.riseGravity : player.fallGravity;
  player.vy = Math.min(player.vy + gravity * dt, player.maxFallSpeed);
  player.y += player.vy * dt;

  if (player.y + player.height >= groundY) {
    player.y = groundY - player.height;
    player.vy = 0;
    player.onGround = true;
    player.jumpsAvailable = 2;
  }
}

function triggerFireworks(x, y) {
  const colors = ['#ffd166', '#ff7f50', '#7bd3ff', '#a086ff', '#82d9a3', '#f72585'];
  const burst = [];

  state.shake = Math.max(state.shake, 1.2);

  for (let i = 0; i < 28; i += 1) {
    const angle = (Math.PI * 2 * i) / 28;
    const speed = 90 + Math.random() * 120;
    burst.push({
      x,
      y,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 0.8 + Math.random() * 0.6,
      size: 2 + Math.random() * 3,
      color: colors[Math.floor(Math.random() * colors.length)]
    });
  }

  for (let i = 0; i < 12; i += 1) {
    const angle = (Math.PI * 2 * i) / 12 + Math.random() * 0.18;
    const speed = 55 + Math.random() * 75;
    burst.push({
      x: x + (Math.random() - 0.5) * 24,
      y: y + (Math.random() - 0.5) * 18,
      dx: Math.cos(angle) * speed,
      dy: Math.sin(angle) * speed,
      life: 0.9 + Math.random() * 0.35,
      size: 5 + Math.random() * 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      sparkle: true
    });
  }

  state.fireworks.push(...burst);
  playTone(740, 0.12, 'triangle', 0.05);
  playTone(980, 0.09, 'sine', 0.04);
}

function spawnPopup(x, y, text, color = '#ffffff') {
  state.popups.push({
    x,
    y,
    text,
    color,
    life: 1,
    vy: -18
  });
}

function spawnBoss() {
  if (state.boss || state.delivered < 5) {
    return;
  }

  if (state.delivered % 5 !== 0 && state.delivered !== state.lastBossDelivered + 5) {
    return;
  }

  state.boss = {
    x: canvas.width + 80,
    y: 80 + Math.random() * 150,
    width: 120,
    height: 76,
    speed: 95 + state.difficulty * 14,
    phase: Math.random() * Math.PI * 2,
    fireCooldown: Math.max(0.7, 1.2 - state.difficulty * 0.08),
    drift: (Math.random() - 0.5) * 18
  };
  state.lastBossDelivered = state.delivered;
  state.bossShots = [];
  spawnPopup(canvas.width * 0.7, 55, 'BOSS WAVE!', '#ffdd57');
  playTone(220, 0.15, 'sawtooth', 0.08);
}

function getRect(obj) {
  return {
    x: obj.x,
    y: obj.y,
    width: obj.width,
    height: obj.height
  };
}

function rectIntersect(a, b) {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function update(dt) {
  state.shake *= 0.85;
  state.folderPulse *= 0.9;

  if (state.paused) {
    return;
  }

  if (state.dying) {
    state.deathTime += dt;
    player.y -= 150 * dt;
    if (state.deathTime >= 1.5) {
      endGame();
    }
    return;
  }

  if (!state.running || state.gameOver) {
    state.clouds.forEach((cloud) => {
      cloud.x -= cloud.speed * dt;
      if (cloud.x + cloud.radius < 0) {
        cloud.x = canvas.width + cloud.radius;
      }
    });
    return;
  }

  if (state.introTime < 1.8) {
    state.introTime += dt;
    const fade = Math.min(1, state.introTime / 1.2);
    ctx.globalAlpha = 0.24 + fade * 0.76;
  }

  state.elapsed += dt;
  updatePlayer(dt);
  const currentPlayerRect = getRect(player);

  state.itemTimer -= dt;
  if (state.itemTimer <= 0) {
    spawnItem();
    const nextGap = Math.max(0.7, 1.3 - state.level * 0.08);
    state.itemTimer = nextGap;
  }

  state.rockTimer -= dt;
  if (state.rockTimer <= 0) {
    spawnRock();
    const openingRelief = state.elapsed < 120 ? 3.6 : 0;
    const nextRockGap = Math.max(1.05, 1.45 + openingRelief - state.level * 0.08);
    state.rockTimer = nextRockGap;
  }

  if (state.elapsed > 45) {
    state.birds.forEach((bird) => {
      bird.poopTimer -= dt;
    });
    if (state.birds.length < 2 && state.elapsed > 55 && Math.random() < dt * 0.22) {
      spawnBird();
    }
  }

  if (!state.boss && state.delivered >= state.lastBossDelivered + 5) {
    spawnBoss();
  }

  if (state.boss) {
    state.boss.x -= state.boss.speed * dt;
    state.boss.y += Math.sin((state.elapsed + state.boss.phase) * 2.4) * 24 * dt;
    state.boss.fireCooldown -= dt;

    if (state.boss.fireCooldown <= 0) {
      state.bossShots.push({
        x: state.boss.x,
        y: state.boss.y + state.boss.height / 2,
        width: 12,
        height: 18,
        speed: 250 + state.level * 10
      });
      state.boss.fireCooldown = Math.max(0.55, 1.2 - state.difficulty * 0.08) + Math.random() * 0.6;
      playTone(150, 0.05, 'square', 0.02);
    }

    const bossRect = getRect(state.boss);
    if (rectIntersect(currentPlayerRect, bossRect)) {
      loseLife();
      return;
    }
  }

  for (const item of state.items) {
    const windPush = state.level >= 2 ? Math.sin(state.elapsed * 2.4 + item.x * 0.04) * 20 : 0;
    item.x -= item.speed * dt;
    item.x += windPush * dt;
    item.y += Math.sin((item.x + item.bob) * 0.04) * 0.7;
    item.bob += dt * 4;

    const playerRect = getRect(player);
    const itemRect = getRect(item);
    if (rectIntersect(playerRect, itemRect)) {
      state.carry += 1;
      state.carryValue += item.value;
      carryEl.textContent = String(state.carry);
      updateFolderStatus();
      spawnPopup(item.x, item.y, `+${item.value}`, item.type === 'blockmodel' ? '#ffd166' : '#d9f99d');
      playTone(380 + item.value * 70, 0.06, 'square', 0.03);
      item.x = -200;
    }
  }

  const folderRect = { x: folder.x, y: folder.y, width: folder.width, height: folder.height };
  const playerRect = getRect(player);
  const folderReady = state.carryValue >= state.folderTarget;
  if (state.carry > 0 && rectIntersect(playerRect, folderRect) && !folderReady) {
    if (state.folderPulse <= 0.05) {
      spawnPopup(folder.x + folder.width / 2, folder.y - 10, `Need ${state.folderTarget} pts`, '#ffe08a');
      state.folderPulse = 0.5;
    }
  }
  if (state.carry > 0 && folderReady && rectIntersect(playerRect, folderRect)) {
    const levelBefore = state.level;
    const baseGain = state.carryValue;
    const bonus = state.carryValue * 2;
    const totalGain = baseGain + bonus;
    state.delivered += state.carry;
    state.score += totalGain;
    scoreEl.textContent = String(state.score);
    state.folderPulse = 1;
    state.shake = Math.max(state.shake, 0.9);
    const reachedNewLevel = state.level > levelBefore;
    updateLevel();
    if (reachedNewLevel) {
      triggerFireworks(folder.x + folder.width / 2, folder.y + 20);
      triggerLevelIntro();
    }
    spawnPopup(folder.x + folder.width / 2, folder.y - 10, `+${totalGain}!`, '#ffd166');
    state.carry = 0;
    state.carryValue = 0;
    carryEl.textContent = '0';
    updateFolderStatus();
    playTone(620, 0.08, 'triangle', 0.04);
  }

  for (const rock of state.rocks) {
    rock.x -= rock.speed * dt;
    rock.y -= rock.rise * dt;
    rock.rise *= 0.985;

    const rockRect = getRect(rock);
    const playerRect = getRect(player);
    if (rectIntersect(playerRect, rockRect)) {
      loseLife();
      return;
    }
  }

  for (const bird of state.birds) {
    bird.x -= bird.speed * dt;
    bird.phase += dt * 8;
    bird.y += Math.sin(bird.phase) * 18 * dt;
    if (state.elapsed > 45 && bird.poopTimer <= 0) {
      state.droppings.push({
        x: bird.x + bird.width / 2,
        y: bird.y + bird.height,
        width: 10,
        height: 14,
        speed: 210 + state.level * 10
      });
      bird.poopTimer = 1.1 + Math.random() * 1.5;
      playTone(180, 0.05, 'sine', 0.018);
    }
  }

  for (const dropping of state.droppings) {
    dropping.y += dropping.speed * dt;
    if (rectIntersect(playerRect, dropping)) {
      loseLife();
      return;
    }
  }

  state.bossShots = state.bossShots.filter((shot) => {
    shot.y += shot.speed * dt;
    if (rectIntersect(playerRect, shot)) {
      loseLife();
      return false;
    }
    return shot.y < canvas.height + 40;
  });

  if (state.boss && state.boss.x + state.boss.width < -20) {
    state.boss = null;
    state.bossShots = [];
  }

  state.items = state.items.filter((item) => item.x > -80 && item.x < canvas.width + 200);
  state.rocks = state.rocks.filter((rock) => rock.x + rock.width > -50);
  state.birds = state.birds.filter((bird) => bird.x + bird.width > -60);
  state.droppings = state.droppings.filter((dropping) => dropping.y < canvas.height + 30);

  state.fireworks = state.fireworks.filter((spark) => {
    spark.x += spark.dx * dt;
    spark.y += spark.dy * dt;
    spark.dy += 120 * dt;
    spark.life -= dt;
    return spark.life > 0;
  });

  state.popups = state.popups.filter((popup) => {
    popup.x += 0.3;
    popup.y += popup.vy * dt;
    popup.vy += 35 * dt;
    popup.life -= dt * 1.7;
    return popup.life > 0;
  });

  if (state.score > state.best) {
    state.best = state.score;
    updateBest();
  }
}

function drawBackground() {
  const currentStage = getCurrentStage();
  const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
  gradient.addColorStop(0, currentStage.skyTop);
  gradient.addColorStop(1, currentStage.skyBottom);
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const sunX = canvas.width * 0.8;
  const sunY = 82;
  ctx.fillStyle = 'rgba(255,255,255,0.24)';
  ctx.beginPath();
  ctx.arc(sunX, sunY, 42, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = 'rgba(255,255,255,0.14)';
  ctx.beginPath();
  ctx.arc(sunX - 10, sunY - 12, 56, 0, Math.PI * 2);
  ctx.fill();

  state.clouds.forEach((cloud) => {
    ctx.fillStyle = 'rgba(255,255,255,0.82)';
    ctx.beginPath();
    ctx.arc(cloud.x, cloud.y, cloud.radius, 0, Math.PI * 2);
    ctx.arc(cloud.x + cloud.radius * 0.7, cloud.y - 8, cloud.radius * 0.8, 0, Math.PI * 2);
    ctx.arc(cloud.x - cloud.radius * 0.7, cloud.y - 6, cloud.radius * 0.75, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = currentStage.mountain;
  ctx.beginPath();
  ctx.moveTo(0, groundY + 5);
  for (let i = 0; i <= 7; i += 1) {
    const x = i * 150;
    const peak = 100 + ((i % 2) * 70);
    ctx.lineTo(x + 70, groundY - peak);
    ctx.lineTo(x + 150, groundY + 5);
  }
  ctx.lineTo(canvas.width, canvas.height);
  ctx.lineTo(0, canvas.height);
  ctx.closePath();
  ctx.fill();

  drawLandmarks(currentStage.name);
}

function drawLandmarks(stageName) {
  ctx.save();
  ctx.globalAlpha = 0.5;
  ctx.fillStyle = getCurrentStage().accent;

  if (stageName === 'New Zealand') {
    ctx.beginPath();
    ctx.moveTo(710, groundY + 5);
    ctx.lineTo(760, groundY - 118);
    ctx.lineTo(810, groundY + 5);
    ctx.moveTo(752, groundY + 5);
    ctx.lineTo(805, groundY - 84);
    ctx.lineTo(855, groundY + 5);
    ctx.fill();
    ctx.fillRect(78, groundY - 68, 8, 68);
    ctx.beginPath();
    ctx.arc(82, groundY - 78, 28, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(760, groundY - 132, 18, 0, Math.PI * 2);
    ctx.arc(780, groundY - 148, 24, 0, Math.PI * 2);
    ctx.arc(805, groundY - 136, 16, 0, Math.PI * 2);
    ctx.fill();
  }

  if (stageName === 'Australia') {
    ctx.fillStyle = 'rgba(255, 241, 176, 0.7)';
    ctx.beginPath();
    ctx.arc(760, 82, 58, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = getCurrentStage().accent;
    ctx.fillRect(760, groundY - 106, 12, 106);
    ctx.beginPath();
    ctx.arc(766, groundY - 110, 58, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(70, groundY - 38, 120, 38);
    ctx.fillRect(92, groundY - 70, 76, 32);
    ctx.globalAlpha = 0.22;
    ctx.fillStyle = '#fff0bd';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillRect(230 + i * 120, groundY - 26 - (i % 2) * 10, 70, 5);
    }
  }

  if (stageName === 'Canada') {
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(500, groundY + 5);
    ctx.lineTo(575, groundY - 125);
    ctx.lineTo(650, groundY + 5);
    ctx.moveTo(605, groundY + 5);
    ctx.lineTo(700, groundY - 160);
    ctx.lineTo(800, groundY + 5);
    ctx.fill();
    ctx.fillRect(754, groundY - 110, 9, 110);
    drawCanadianFlag(763, groundY - 118, 92, 58);
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 24; i += 1) {
      const snowX = (i * 83 + performance.now() * 0.02) % canvas.width;
      const snowY = 70 + ((i * 47 + performance.now() * 0.05) % (groundY - 90));
      ctx.fillRect(snowX, snowY, 3, 3);
    }
  }

  if (stageName === 'South Africa') {
    ctx.fillStyle = 'rgba(255, 226, 120, 0.6)';
    ctx.beginPath();
    ctx.arc(760, 78, 42, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = 0.8;
    ctx.fillStyle = '#47733f';
    for (let i = 0; i < 24; i += 1) {
      const grassX = i * 43;
      const grassHeight = 12 + (i % 4) * 5;
      ctx.fillRect(grassX, groundY - grassHeight, 4, grassHeight);
      ctx.fillRect(grassX + 7, groundY - grassHeight * 0.7, 3, grassHeight * 0.7);
    }

    ctx.fillStyle = '#6e4935';
    ctx.fillRect(108, groundY - 92, 8, 92);
    ctx.beginPath();
    ctx.arc(112, groundY - 100, 40, Math.PI, Math.PI * 2);
    ctx.arc(150, groundY - 96, 32, Math.PI, Math.PI * 2);
    ctx.fill();

    for (let i = 0; i < 3; i += 1) {
      const flagX = 600 + i * 92;
      const flagY = groundY - 102 - (i % 2) * 25;
      ctx.fillStyle = '#6e4935';
      ctx.fillRect(flagX, flagY, 4, 102);
      drawSouthAfricanFlag(flagX + 4, flagY, 58, 38);
    }
  }
  ctx.restore();
}

function drawSouthAfricanFlag(x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);

  ctx.fillStyle = '#d62839';
  ctx.fillRect(0, 0, width, height / 2);
  ctx.fillStyle = '#173f8a';
  ctx.fillRect(0, height / 2, width, height / 2);

  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.27);
  ctx.lineTo(width * 0.43, height * 0.47);
  ctx.lineTo(width, height * 0.47);
  ctx.lineTo(width, height * 0.58);
  ctx.lineTo(width * 0.43, height * 0.58);
  ctx.lineTo(0, height * 0.75);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#f4d35e';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.08);
  ctx.lineTo(width * 0.47, height * 0.47);
  ctx.lineTo(width, height * 0.47);
  ctx.lineTo(width, height * 0.58);
  ctx.lineTo(width * 0.47, height * 0.58);
  ctx.lineTo(0, height * 0.92);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.15);
  ctx.lineTo(width * 0.4, height / 2);
  ctx.lineTo(0, height * 0.85);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#1f9b54';
  ctx.beginPath();
  ctx.moveTo(0, height * 0.34);
  ctx.lineTo(width * 0.43, height * 0.49);
  ctx.lineTo(width, height * 0.49);
  ctx.lineTo(width, height * 0.56);
  ctx.lineTo(width * 0.43, height * 0.56);
  ctx.lineTo(0, height * 0.67);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawCanadianFlag(x, y, width, height) {
  ctx.save();
  ctx.translate(x, y);
  ctx.globalAlpha = 0.9;
  ctx.fillStyle = '#d62828';
  ctx.fillRect(0, 0, width * 0.25, height);
  ctx.fillRect(width * 0.75, 0, width * 0.25, height);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(width * 0.25, 0, width * 0.5, height);

  ctx.fillStyle = '#d62828';
  ctx.beginPath();
  ctx.moveTo(width * 0.5, height * 0.08);
  ctx.lineTo(width * 0.56, height * 0.32);
  ctx.lineTo(width * 0.68, height * 0.22);
  ctx.lineTo(width * 0.63, height * 0.43);
  ctx.lineTo(width * 0.78, height * 0.4);
  ctx.lineTo(width * 0.62, height * 0.58);
  ctx.lineTo(width * 0.68, height * 0.7);
  ctx.lineTo(width * 0.55, height * 0.67);
  ctx.lineTo(width * 0.55, height * 0.92);
  ctx.lineTo(width * 0.45, height * 0.92);
  ctx.lineTo(width * 0.45, height * 0.67);
  ctx.lineTo(width * 0.32, height * 0.7);
  ctx.lineTo(width * 0.38, height * 0.58);
  ctx.lineTo(width * 0.22, height * 0.4);
  ctx.lineTo(width * 0.37, height * 0.43);
  ctx.lineTo(width * 0.32, height * 0.22);
  ctx.lineTo(width * 0.44, height * 0.32);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawGround() {
  const stage = getCurrentStage();
  ctx.fillStyle = stage.ground;
  ctx.fillRect(0, groundY, canvas.width, canvas.height - groundY);

  ctx.fillStyle = 'rgba(0,0,0,0.12)';
  for (let i = 0; i < canvas.width; i += 30) {
    ctx.fillRect(i, groundY + 12, 18, 18);
  }
}

function drawProgressAtmosphere() {
  if (state.level < 2) {
    return;
  }

  const stageName = getCurrentStage().name;
  const intensity = Math.min(1, 0.35 + state.difficulty * 0.12);
  ctx.save();
  ctx.globalAlpha = intensity;

  if (stageName === 'Australia') {
    ctx.strokeStyle = '#fff0bd';
    ctx.lineWidth = 3;
    for (let i = 0; i < 7; i += 1) {
      const x = (i * 150 + performance.now() * 0.06) % (canvas.width + 100) - 50;
      ctx.beginPath();
      ctx.moveTo(x, 110 + i * 28);
      ctx.lineTo(x + 42, 110 + i * 28);
      ctx.stroke();
    }
  } else if (stageName === 'Canada') {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 30; i += 1) {
      const x = (i * 61 + performance.now() * 0.04) % canvas.width;
      const y = 70 + ((i * 37 + performance.now() * 0.08) % (groundY - 90));
      ctx.fillRect(x, y, 3, 7);
    }
  } else if (stageName === 'South Africa') {
    ctx.fillStyle = '#f4d35e';
    for (let i = 0; i < 8; i += 1) {
      const x = (i * 130 - performance.now() * 0.05) % (canvas.width + 100) - 50;
      ctx.fillRect(x, groundY - 54 - (i % 3) * 12, 54, 4);
    }
  } else {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const x = (i * 125 - performance.now() * 0.08) % (canvas.width + 120) - 60;
      ctx.beginPath();
      ctx.moveTo(x, 100 + i * 31);
      ctx.quadraticCurveTo(x + 24, 92 + i * 31, x + 52, 100 + i * 31);
      ctx.stroke();
    }
  }

  ctx.restore();
}

function drawFolder() {
  const pulse = 1 + state.folderPulse * 0.22 + Math.sin(performance.now() * 0.016) * 0.04;
  const folderReady = state.carryValue >= state.folderTarget;
  ctx.save();
  ctx.translate(folder.x + folder.width / 2, folder.y + folder.height / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-(folder.x + folder.width / 2), -(folder.y + folder.height / 2));

  if (folderReady) {
    ctx.fillStyle = `rgba(255, 209, 102, ${0.2 + Math.sin(performance.now() * 0.008) * 0.08})`;
    ctx.beginPath();
    ctx.arc(folder.x + folder.width / 2, folder.y + folder.height / 2, 66, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffe08a';
    ctx.beginPath();
    ctx.moveTo(folder.x + 8, folder.y + 18);
    ctx.lineTo(folder.x + folder.width / 2, folder.y - 20);
    ctx.lineTo(folder.x + folder.width - 8, folder.y + 18);
    ctx.closePath();
    ctx.fill();
  }

  ctx.fillStyle = 'rgba(255, 58, 58, 0.28)';
  ctx.fillRect(folder.x - 12, folder.y - 12, folder.width + 20, folder.height + 18);

  ctx.fillStyle = '#d62839';
  ctx.fillRect(folder.x, folder.y, folder.width, folder.height);
  ctx.fillStyle = '#ef476f';
  ctx.beginPath();
  ctx.moveTo(folder.x + 8, folderReady ? folder.y - 2 : folder.y + 8);
  ctx.lineTo(folder.x + 24, folder.y + 8);
  ctx.lineTo(folder.x + 32, folder.y + 20);
  ctx.lineTo(folder.x + folder.width, folder.y + 20);
  ctx.lineTo(folder.x + folder.width, folder.y + folder.height);
  ctx.lineTo(folder.x, folder.y + folder.height);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#b5172b';
  ctx.fillRect(folder.x + 22, folder.y + 20, folder.width - 30, 8);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 17px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Evo', folder.x + folder.width / 2, folder.y + 28);
  ctx.fillStyle = 'rgba(0,0,0,0.28)';
  ctx.fillRect(folder.x + 14, folder.y + 36, folder.width - 28, 16);
  for (let i = 0; i < Math.min(state.carry, 8); i += 1) {
    ctx.fillStyle = i % 2 === 0 ? '#8bd3ff' : '#cdb4ff';
    ctx.fillRect(folder.x + 20 + (i % 4) * 13, folder.y + 39 - Math.floor(i / 4) * 4, 9, 5);
  }
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Arial';
  ctx.fillText(`${state.carry}`, folder.x + folder.width - 12, folder.y + 51);
  ctx.restore();
}

function drawCollectible(item) {
  ctx.save();
  ctx.translate(item.x, item.y);

  if (item.type === 'file') {
    ctx.fillStyle = '#6ec6ff';
    ctx.fillRect(-item.width / 2, -item.height / 2, item.width, item.height);
    ctx.fillStyle = '#bfe7ff';
    ctx.fillRect(-item.width / 2 + item.width * 0.45, -item.height / 2, item.width * 0.22, item.height * 0.22);
    ctx.fillStyle = '#3e80d8';
    ctx.fillRect(-item.width / 2 + 6, -item.height / 2 + 10, item.width - 12, 4);
  }

  if (item.type === 'mesh') {
    ctx.fillStyle = '#a086ff';
    ctx.beginPath();
    ctx.moveTo(0, -item.height / 2);
    ctx.lineTo(item.width / 2, item.height / 2);
    ctx.lineTo(-item.width / 2, item.height / 2);
    ctx.closePath();
    ctx.fill();
  }

if (item.type === 'blockmodel') {
    ctx.fillStyle = '#82d9a3';
    ctx.fillRect(-item.width / 2, -item.height / 2, item.width, item.height);
    ctx.fillStyle = '#2fa86c';
    ctx.fillRect(-item.width / 2 + 4, -item.height / 2 + 4, item.width - 8, 5);
  }

  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = 'bold 11px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(item.value, 0, item.height / 2 + 14);

  ctx.restore();
}

function drawRock(rock) {
  ctx.save();
  ctx.translate(rock.x + rock.width / 2, rock.y + rock.height / 2);

  if (rock.type === 'volcano') {
    ctx.fillStyle = '#8d3d2e';
    ctx.beginPath();
    ctx.moveTo(-rock.width * 0.8, rock.height * 0.5);
    ctx.lineTo(0, -rock.height * 0.9);
    ctx.lineTo(rock.width * 0.8, rock.height * 0.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffe6a7';
    ctx.beginPath();
    ctx.arc(0, -rock.height * 0.5, rock.width * 0.18, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(55, 62, 72, 0.72)';
    ctx.beginPath();
    ctx.arc(rock.width * 0.18, -rock.height * 1.05, rock.width * 0.22, 0, Math.PI * 2);
    ctx.arc(rock.width * 0.48, -rock.height * 1.3, rock.width * 0.3, 0, Math.PI * 2);
    ctx.fill();
  } else if (rock.type === 'rugby') {
    ctx.fillStyle = '#121826';
    ctx.beginPath();
    ctx.arc(0, -rock.height * 0.42, rock.width * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-rock.width * 0.25, -rock.height * 0.2, rock.width * 0.5, rock.height * 0.48);
    ctx.fillRect(-rock.width * 0.38, -rock.height * 0.1, rock.width * 0.13, rock.height * 0.42);
    ctx.fillRect(rock.width * 0.25, -rock.height * 0.1, rock.width * 0.13, rock.height * 0.42);
    ctx.fillRect(-rock.width * 0.2, rock.height * 0.2, rock.width * 0.14, rock.height * 0.4);
    ctx.fillRect(rock.width * 0.06, rock.height * 0.2, rock.width * 0.14, rock.height * 0.4);
    ctx.fillStyle = '#ffffff';
    ctx.font = `bold ${Math.max(7, rock.width * 0.25)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('AB', 0, rock.height * 0.08);
    ctx.fillStyle = '#0a1a2b';
    ctx.fillRect(-rock.width * 0.24, rock.height * 0.58, rock.width * 0.16, rock.height * 0.1);
    ctx.fillRect(rock.width * 0.08, rock.height * 0.58, rock.width * 0.16, rock.height * 0.1);
    ctx.save();
    ctx.translate(rock.width * 0.62, rock.height * 0.12);
    ctx.rotate(-0.35);
    ctx.fillStyle = '#8b4d2a';
    ctx.beginPath();
    ctx.ellipse(0, 0, rock.width * 0.18, rock.height * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f0d8b2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-rock.width * 0.04, -rock.height * 0.08);
    ctx.lineTo(rock.width * 0.04, rock.height * 0.08);
    ctx.stroke();
    ctx.restore();
  } else if (rock.type === 'springbok') {
    ctx.fillStyle = '#176b4d';
    ctx.beginPath();
    ctx.arc(0, -rock.height * 0.42, rock.width * 0.22, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-rock.width * 0.25, -rock.height * 0.2, rock.width * 0.5, rock.height * 0.48);
    ctx.fillRect(-rock.width * 0.38, -rock.height * 0.1, rock.width * 0.13, rock.height * 0.42);
    ctx.fillRect(rock.width * 0.25, -rock.height * 0.1, rock.width * 0.13, rock.height * 0.42);
    ctx.fillRect(-rock.width * 0.2, rock.height * 0.2, rock.width * 0.14, rock.height * 0.4);
    ctx.fillRect(rock.width * 0.06, rock.height * 0.2, rock.width * 0.14, rock.height * 0.4);
    ctx.fillStyle = '#f4d35e';
    ctx.fillRect(-rock.width * 0.25, rock.height * 0.02, rock.width * 0.5, rock.height * 0.08);
    ctx.font = `bold ${Math.max(7, rock.width * 0.24)}px Arial`;
    ctx.textAlign = 'center';
    ctx.fillText('SA', 0, rock.height * 0.16);
    ctx.save();
    ctx.translate(rock.width * 0.62, rock.height * 0.12);
    ctx.rotate(-0.35);
    ctx.fillStyle = '#8b4d2a';
    ctx.beginPath();
    ctx.ellipse(0, 0, rock.width * 0.18, rock.height * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#f0d8b2';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-rock.width * 0.04, -rock.height * 0.08);
    ctx.lineTo(rock.width * 0.04, rock.height * 0.08);
    ctx.stroke();
    ctx.restore();
  } else if (['lion', 'elephant', 'buffalo', 'leopard', 'rhino', 'giraffe'].includes(rock.type)) {
    const animalColor = {
      lion: '#c8873e',
      elephant: '#68747b',
      buffalo: '#302c2a',
      leopard: '#d69a35',
      rhino: '#737b78',
      giraffe: '#d69b42'
    }[rock.type];
    ctx.fillStyle = animalColor;
    ctx.fillRect(-rock.width * 0.45, -rock.height * 0.15, rock.width * 0.78, rock.height * 0.38);
    ctx.fillRect(-rock.width * 0.34, rock.height * 0.2, rock.width * 0.12, rock.height * 0.42);
    ctx.fillRect(-rock.width * 0.04, rock.height * 0.2, rock.width * 0.12, rock.height * 0.42);
    ctx.fillRect(rock.width * 0.2, rock.height * 0.2, rock.width * 0.12, rock.height * 0.42);
    ctx.beginPath();
    ctx.arc(rock.width * 0.35, -rock.height * 0.2, rock.width * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-rock.width * 0.52, -rock.height * 0.1, rock.width * 0.18, rock.height * 0.08);
    if (rock.type === 'giraffe') {
      ctx.fillRect(rock.width * 0.22, -rock.height * 0.65, rock.width * 0.14, rock.height * 0.48);
      ctx.fillStyle = '#5f4027';
      for (let i = 0; i < 4; i += 1) {
        ctx.fillRect(-rock.width * 0.3 + i * rock.width * 0.18, -rock.height * 0.08, rock.width * 0.07, rock.height * 0.1);
      }
    }
    if (rock.type === 'elephant') {
      ctx.fillRect(rock.width * 0.52, -rock.height * 0.1, rock.width * 0.28, rock.height * 0.1);
    }
    if (rock.type === 'rhino') {
      ctx.fillStyle = '#f4d35e';
      ctx.beginPath();
      ctx.moveTo(rock.width * 0.54, -rock.height * 0.32);
      ctx.lineTo(rock.width * 0.82, -rock.height * 0.42);
      ctx.lineTo(rock.width * 0.58, -rock.height * 0.15);
      ctx.fill();
    }
    if (rock.type === 'buffalo') {
      ctx.strokeStyle = '#f4d35e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(rock.width * 0.35, -rock.height * 0.38, rock.width * 0.3, Math.PI, Math.PI * 2);
      ctx.stroke();
    }
    if (rock.type === 'leopard') {
      ctx.fillStyle = '#51351f';
      ctx.fillRect(-rock.width * 0.25, -rock.height * 0.08, 4, 4);
      ctx.fillRect(rock.width * 0.02, -rock.height * 0.02, 4, 4);
      ctx.fillRect(rock.width * 0.2, -rock.height * 0.12, 4, 4);
    }
  } else if (rock.type === 'kangaroo') {
    ctx.fillStyle = '#8b4d2a';
    ctx.beginPath();
    ctx.ellipse(-rock.width * 0.02, -rock.height * 0.06, rock.width * 0.34, rock.height * 0.38, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(-rock.width * 0.22, rock.height * 0.08);
    ctx.quadraticCurveTo(-rock.width * 0.65, rock.height * 0.42, -rock.width * 0.98, rock.height * 0.5);
    ctx.quadraticCurveTo(-rock.width * 0.55, rock.height * 0.12, -rock.width * 0.18, -rock.height * 0.02);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rock.width * 0.27, -rock.height * 0.48, rock.width * 0.24, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(rock.width * 0.18, -rock.height * 0.65);
    ctx.lineTo(rock.width * 0.2, -rock.height * 1.02);
    ctx.lineTo(rock.width * 0.3, -rock.height * 0.68);
    ctx.moveTo(rock.width * 0.34, -rock.height * 0.67);
    ctx.lineTo(rock.width * 0.48, -rock.height * 1.0);
    ctx.lineTo(rock.width * 0.46, -rock.height * 0.58);
    ctx.fill();
    ctx.strokeStyle = '#8b4d2a';
    ctx.lineWidth = Math.max(2, rock.width * 0.08);
    ctx.beginPath();
    ctx.moveTo(rock.width * 0.03, rock.height * 0.02);
    ctx.lineTo(rock.width * 0.18, rock.height * 0.38);
    ctx.stroke();
    ctx.lineWidth = Math.max(3, rock.width * 0.12);
    ctx.beginPath();
    ctx.moveTo(-rock.width * 0.05, rock.height * 0.2);
    ctx.lineTo(-rock.width * 0.28, rock.height * 0.65);
    ctx.moveTo(rock.width * 0.14, rock.height * 0.2);
    ctx.lineTo(rock.width * 0.42, rock.height * 0.62);
    ctx.stroke();
    ctx.lineWidth = Math.max(2, rock.width * 0.06);
    ctx.beginPath();
    ctx.moveTo(-rock.width * 0.3, rock.height * 0.65);
    ctx.lineTo(-rock.width * 0.48, rock.height * 0.65);
    ctx.moveTo(rock.width * 0.42, rock.height * 0.62);
    ctx.lineTo(rock.width * 0.6, rock.height * 0.62);
    ctx.stroke();
    ctx.fillStyle = '#f0d8b2';
    ctx.beginPath();
    ctx.ellipse(-rock.width * 0.02, rock.height * 0.02, rock.width * 0.2, rock.height * 0.2, -0.12, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1d1714';
    ctx.beginPath();
    ctx.arc(rock.width * 0.38, -rock.height * 0.52, Math.max(2, rock.width * 0.06), 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#f0d8b2';
    ctx.fillRect(rock.width * 0.47, -rock.height * 0.45, rock.width * 0.15, rock.height * 0.08);
  } else if (rock.type === 'maple') {
    ctx.fillStyle = '#8d5e3d';
    ctx.fillRect(-rock.width * 0.1, -rock.height * 0.4, rock.width * 0.2, rock.height * 0.6);
    ctx.fillStyle = '#d72638';
    ctx.beginPath();
    ctx.moveTo(0, -rock.height * 0.85);
    ctx.lineTo(rock.width * 0.45, -rock.height * 0.25);
    ctx.lineTo(rock.width * 0.2, -rock.height * 0.18);
    ctx.lineTo(rock.width * 0.55, rock.height * 0.15);
    ctx.lineTo(0, rock.height * 0.05);
    ctx.lineTo(-rock.width * 0.55, rock.height * 0.15);
    ctx.lineTo(-rock.width * 0.2, -rock.height * 0.18);
    ctx.lineTo(-rock.width * 0.45, -rock.height * 0.25);
    ctx.closePath();
    ctx.fill();
  } else if (rock.type === 'flag') {
    ctx.fillStyle = '#d62839';
    ctx.fillRect(-rock.width * 0.15, -rock.height * 0.2, rock.width * 0.1, rock.height * 0.7);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-rock.width * 0.05, -rock.height * 0.2, rock.width * 0.7, rock.height * 0.28);
    ctx.fillStyle = '#d62839';
    ctx.beginPath();
    ctx.moveTo(-rock.width * 0.05, -rock.height * 0.2);
    ctx.lineTo(rock.width * 0.65, -rock.height * 0.06);
    ctx.lineTo(-rock.width * 0.05, rock.height * 0.08);
    ctx.closePath();
    ctx.fill();
  } else {
    ctx.fillStyle = '#4d4d4d';
    ctx.beginPath();
    const points = 6;
    for (let i = 0; i < points; i += 1) {
      const angle = (i / points) * Math.PI * 2;
      const dist = i % 2 === 0 ? 1 : 0.7;
      const px = Math.cos(angle) * rock.width * dist;
      const py = Math.sin(angle) * rock.height * dist;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
  }
  ctx.restore();
}

function drawBoss() {
  if (!state.boss) {
    return;
  }

  const boss = state.boss;
  ctx.save();
  ctx.translate(boss.x, boss.y);
  ctx.fillStyle = '#4a1d6f';
  ctx.fillRect(0, 0, boss.width, boss.height);
  ctx.fillStyle = '#ff7b54';
  ctx.fillRect(18, 12, boss.width - 36, 16);
  ctx.fillStyle = '#ffd166';
  ctx.fillRect(26, 30, boss.width - 52, 18);
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(18, 52, 16, 12);
  ctx.fillRect(boss.width - 34, 52, 16, 12);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 12px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('BOSS', boss.width / 2, 27);
  ctx.restore();

  state.bossShots.forEach((shot) => {
    ctx.fillStyle = '#ff8c42';
    ctx.fillRect(shot.x, shot.y, shot.width, shot.height);
  });
}

function drawBird(bird) {
  ctx.save();
  ctx.translate(bird.x, bird.y);
  const wingLift = Math.sin(bird.phase) * 5;
  ctx.fillStyle = '#273449';
  ctx.beginPath();
  ctx.ellipse(bird.width / 2, bird.height / 2, bird.width / 2, bird.height / 2.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(20, 12);
  ctx.quadraticCurveTo(8, -8 - wingLift, 2, 8);
  ctx.quadraticCurveTo(12, 4, 20, 12);
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(27, 12);
  ctx.quadraticCurveTo(39, -8 + wingLift, 42, 8);
  ctx.quadraticCurveTo(34, 4, 27, 12);
  ctx.fill();
  ctx.fillStyle = '#f4c95d';
  ctx.beginPath();
  ctx.moveTo(0, 10);
  ctx.lineTo(-10, 15);
  ctx.lineTo(0, 18);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(34, 8, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#17202d';
  ctx.beginPath();
  ctx.arc(35, 8, 1.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawDropping(dropping) {
  ctx.save();
  ctx.fillStyle = '#6b4f3a';
  ctx.beginPath();
  ctx.ellipse(dropping.x + dropping.width / 2, dropping.y + dropping.height / 2, dropping.width / 2, dropping.height / 2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawFireworks() {
  state.fireworks.forEach((spark) => {
    ctx.save();
    ctx.fillStyle = spark.color;
    ctx.globalAlpha = Math.max(0, spark.life);
    if (spark.sparkle) {
      ctx.translate(spark.x, spark.y);
      ctx.rotate(performance.now() * 0.004);
      ctx.beginPath();
      ctx.moveTo(0, -spark.size);
      ctx.lineTo(spark.size * 0.28, -spark.size * 0.28);
      ctx.lineTo(spark.size, 0);
      ctx.lineTo(spark.size * 0.28, spark.size * 0.28);
      ctx.lineTo(0, spark.size);
      ctx.lineTo(-spark.size * 0.28, spark.size * 0.28);
      ctx.lineTo(-spark.size, 0);
      ctx.lineTo(-spark.size * 0.28, -spark.size * 0.28);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.fillRect(spark.x, spark.y, spark.size, spark.size);
    }
    ctx.restore();
  });
  ctx.globalAlpha = 1;
}

function drawPopups() {
  state.popups.forEach((popup) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, popup.life);
    ctx.fillStyle = popup.color;
    ctx.font = 'bold 18px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(popup.text, popup.x, popup.y);
    ctx.restore();
  });
}

function drawPlayer() {
  const bounce = Math.sin((performance.now() / 200) + player.x * 0.05) * 2;
  ctx.save();
  ctx.translate(player.x + player.width / 2, player.y + player.height / 2 + bounce);
  if (state.dying) {
    ctx.rotate(state.deathTime * 5);
    ctx.globalAlpha = Math.max(0, 1 - state.deathTime / 1.5);
  }

  ctx.fillStyle = '#2b2d42';
  ctx.fillRect(-11, 4, 22, 22);

  ctx.fillStyle = '#f1c27d';
  ctx.beginPath();
  ctx.arc(0, -16, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#3d4d5c';
  ctx.beginPath();
  ctx.moveTo(-15, -24);
  ctx.lineTo(15, -24);
  ctx.lineTo(12, -12);
  ctx.lineTo(-12, -12);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#c8d8e4';
  ctx.fillRect(-10, -29, 20, 6);

  ctx.fillStyle = '#1b263b';
  ctx.beginPath();
  ctx.arc(-4, -18, 2.4, 0, Math.PI * 2);
  ctx.arc(4, -18, 2.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#2b2d42';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-5, -10);
  ctx.lineTo(5, -10);
  ctx.stroke();

  ctx.fillStyle = '#d4a373';
  ctx.fillRect(-18, 2, 7, 22);
  ctx.fillRect(11, 2, 7, 22);

  ctx.fillStyle = '#3a3a3a';
  ctx.fillRect(-2, 23, 5, 17);
  ctx.fillRect(-12, 24, 6, 16);
  ctx.fillRect(7, 24, 6, 16);

  ctx.fillStyle = '#d8f3dc';
  ctx.fillRect(-10, 12, 7, 10);
  ctx.fillRect(3, 12, 7, 10);

  ctx.fillStyle = '#d9b44a';
  ctx.fillRect(-13, 12, 26, 11);
  ctx.fillStyle = '#f5e6a4';
  ctx.fillRect(-8, 15, 6, 5);
  ctx.fillRect(2, 15, 6, 5);

  ctx.fillStyle = '#5c3d2e';
  ctx.fillRect(-19, 15, 8, 12);
  ctx.fillRect(11, 15, 8, 12);
  ctx.fillStyle = '#7f5a3c';
  ctx.fillRect(-17, 14, 3, 15);
  ctx.fillRect(14, 14, 3, 15);

  ctx.fillStyle = '#d8bb8d';
  ctx.beginPath();
  ctx.moveTo(-20, 8);
  ctx.lineTo(-28, 0);
  ctx.lineTo(-20, -2);
  ctx.closePath();
  ctx.fill();
  ctx.fillRect(-29, -2, 4, 12);
  ctx.fillRect(-32, 3, 10, 4);

  ctx.fillStyle = '#6a4c41';
  ctx.fillRect(18, -2, 4, 18);
  ctx.fillRect(21, -7, 3, 12);
  ctx.fillRect(24, -9, 18, 4);
  ctx.fillRect(28, -9, 4, 14);
  ctx.fillRect(31, -12, 4, 12);

  ctx.fillStyle = '#6d4c41';
  ctx.fillRect(-23, 0, 5, 16);
  ctx.fillRect(-30, 15, 6, 10);

  ctx.fillStyle = '#d62839';
  ctx.fillRect(18, 4, 18, 12);
  ctx.fillStyle = '#ef476f';
  ctx.beginPath();
  ctx.moveTo(20, 6);
  ctx.lineTo(28, 6);
  ctx.lineTo(31, 11);
  ctx.lineTo(34, 11);
  ctx.lineTo(34, 16);
  ctx.lineTo(18, 16);
  ctx.closePath();
  ctx.fill();

  const carriedItems = Math.min(state.carry, 6);
  for (let i = 0; i < carriedItems; i += 1) {
    const row = Math.floor(i / 3);
    const col = i % 3;
    const x = 20 + col * 4.5;
    const y = 7 + row * 4;
    ctx.fillStyle = i % 2 === 0 ? '#6ec6ff' : '#a086ff';
    ctx.fillRect(x, y, 3.2, 3.2);
  }

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Evo', 22, 18);

  ctx.restore();
}

function drawProgressText() {
  const stage = getCurrentStage();
  ctx.fillStyle = 'rgba(8, 20, 30, 0.7)';
  ctx.fillRect(canvas.width / 2 - 140, 20, 280, 34);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 20px Arial';
  ctx.textAlign = 'center';
  ctx.fillText(`${stage.name} - Level ${state.level}`, canvas.width / 2, 43);
}

function drawIntroFlash() {
  if (state.introTime <= 0) {
    return;
  }

  const alpha = Math.max(0, 1 - state.introTime / 1.4);
  ctx.fillStyle = `rgba(255, 255, 255, ${alpha * 0.28})`;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    const offsetX = (Math.random() - 0.5) * state.shake * 18;
    const offsetY = (Math.random() - 0.5) * state.shake * 18;
    ctx.translate(offsetX, offsetY);
  }

  drawBackground();
  drawGround();
  drawProgressAtmosphere();
  drawFolder();

  state.items.forEach(drawCollectible);
  state.rocks.forEach(drawRock);
  state.birds.forEach(drawBird);
  state.droppings.forEach(drawDropping);
  drawBoss();
  drawFireworks();
  drawPopups();
  drawPlayer();
  drawProgressText();
  drawIntroFlash();
  ctx.restore();
}

function gameLoop(timestamp) {
  if (!state.lastTime) state.lastTime = timestamp;
  const dt = Math.min((timestamp - state.lastTime) / 1000, 0.032);
  state.lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(gameLoop);
}

let lastPointerTime = 0;
let doubleClickGrace = 260;

window.addEventListener('keydown', (event) => {
  if (event.repeat) {
    return;
  }

  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
    keys.left = true;
  }
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
    keys.right = true;
  }
  if (event.key === 'p' || event.key === 'P') {
    togglePause();
    return;
  }
  if (event.key === 'ArrowUp' || event.key === ' ' || event.key.toLowerCase() === 'w') {
    event.preventDefault();
    if (!state.running && !state.gameOver) {
      resetGame();
      overlay.classList.remove('visible');
      playTone(440, 0.08, 'triangle', 0.04);
    }
    jump();
  }
});

window.addEventListener('keyup', (event) => {
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
    keys.left = false;
  }
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
    keys.right = false;
  }
});

canvas.addEventListener('pointerdown', () => {
  const now = performance.now();
  const isDouble = now - lastPointerTime < doubleClickGrace;
  lastPointerTime = now;

  if (!state.running && !state.gameOver) {
    resetGame();
    overlay.classList.remove('visible');
    playTone(440, 0.08, 'triangle', 0.04);
  }

  if (state.paused) {
    togglePause();
    return;
  }

  if (isDouble) {
    highJump();
  }

  jump();
});

canvas.addEventListener('dblclick', (event) => {
  event.preventDefault();
  highJump();
});

const touchControls = document.querySelectorAll('.touch-button');
for (const control of touchControls) {
  const action = control.dataset.control;

  const press = (event) => {
    event.preventDefault();
    if (action === 'left') {
      keys.left = true;
    }
    if (action === 'right') {
      keys.right = true;
    }
    if (action === 'jump') {
      if (!state.running && !state.gameOver) {
        resetGame();
      }
      jump();
    }
  };

  const release = () => {
    if (action === 'left') {
      keys.left = false;
    }
    if (action === 'right') {
      keys.right = false;
    }
  };

  control.addEventListener('pointerdown', press);
  control.addEventListener('pointerup', release);
  control.addEventListener('pointerleave', release);
  control.addEventListener('pointercancel', release);
}

startButton.addEventListener('click', () => {
  resetGame();
  playTone(440, 0.08, 'triangle', 0.04);
});

tutorialButton.addEventListener('click', () => {
  setOverlay(
    'How to play',
    '1. Grab every flying item you can carry.\n2. Deliver them to the Evo folder.\n3. Each delivery adds score and boosts your level.\n4. Rocks and bird poo cost a life, so keep moving and keep jumping.',
    'Back',
    showTitleScreen,
    '',
    null
  );
});

topStartButton.addEventListener('click', () => {
  resetGame();
  playTone(440, 0.08, 'triangle', 0.04);
});

topTutorialButton.addEventListener('click', () => {
  setOverlay(
    'How to play',
    '1. Grab every flying item you can carry.\n2. Deliver them to the Evo folder.\n3. Press Space to jump, then tap it in the air to stay up or go higher. Wait between taps to descend.\n4. Every five deliveries advances the country and level.\n5. After the New Zealand, Australia, and Canada round, each level gets harder.\n6. Hazards cost a life, so keep moving and keep jumping.',
    'Back',
    showTitleScreen,
    '',
    null
  );
});

window.addEventListener('resize', positionOverlay);

createClouds();
updateBest();
updateLevel();
updateLives();
showTitleScreen();
requestAnimationFrame(gameLoop);
