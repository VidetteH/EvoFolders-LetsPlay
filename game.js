const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const scoreEl = document.getElementById('score');
const carryEl = document.getElementById('carry');
const levelEl = document.getElementById('level');
const bestScoreEl = document.getElementById('best-score');
const overlay = document.getElementById('overlay');
const startButton = document.getElementById('startButton');

let audioCtx = null;

function playTone(frequency, duration, type = 'sine', volume = 0.04) {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    if (!audioCtx) audioCtx = new AudioCtor();
    const oscillator = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    gain.gain.value = volume;
    oscillator.connect(gain);
    gain.connect(audioCtx.destination);
    oscillator.start();
    oscillator.stop(audioCtx.currentTime + duration);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
  } catch (error) {
    // Ignore audio failures silently in browsers that block audio until interaction.
  }
}

const countryStages = [
  {
    name: 'New Zealand',
    skyTop: '#7bd3ff',
    skyBottom: '#dff6ff',
    ground: '#5f9f5c',
    mountain: '#2d5d4d',
    accent: '#f7d6a2'
  },
  {
    name: 'Australia',
    skyTop: '#f3a54a',
    skyBottom: '#ffe8a8',
    ground: '#d77f3b',
    mountain: '#8f432f',
    accent: '#ffd8b1'
  },
  {
    name: 'Canada',
    skyTop: '#8cc5ff',
    skyBottom: '#edf6ff',
    ground: '#6fa26e',
    mountain: '#4e6d8e',
    accent: '#dce7ff'
  }
];

const groundY = canvas.height - 84;

const state = {
  running: false,
  gameOver: false,
  score: 0,
  carry: 0,
  carryValue: 0,
  delivered: 0,
  best: Number(localStorage.getItem('geo-collector-best') || 0),
  level: 1,
  stageIndex: 0,
  elapsed: 0,
  lastTime: 0,
  itemTimer: 0,
  rockTimer: 0,
  items: [],
  rocks: [],
  birds: [],
  droppings: [],
  clouds: [],
  fireworks: [],
  popups: [],
  shake: 0,
  folderPulse: 0
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
  onGround: true,
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
  return countryStages[Math.min(state.stageIndex, countryStages.length - 1)];
}

function updateBest() {
  bestScoreEl.textContent = String(state.best);
}

function updateLevel() {
  state.level = Math.floor(state.delivered / 10) + 1;
  state.stageIndex = Math.min(countryStages.length - 1, Math.floor(state.delivered / 10));
  levelEl.textContent = String(state.level);
}

function resetGame() {
  state.running = true;
  state.gameOver = false;
  state.score = 0;
  state.carry = 0;
  state.carryValue = 0;
  state.delivered = 0;
  state.level = 1;
  state.stageIndex = 0;
  state.elapsed = 0;
  state.itemTimer = 0.8;
  state.rockTimer = 1.7;
  state.items = [];
  state.rocks = [];
  state.birds = [];
  state.droppings = [];
  state.fireworks = [];
  state.popups = [];
  state.shake = 0;
  state.folderPulse = 0;
  player.x = 110;
  player.y = groundY - player.height;
  player.vx = 0;
  player.vy = 0;
  player.onGround = true;
  scoreEl.textContent = '0';
  carryEl.textContent = '0';
  levelEl.textContent = '1';
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
  const itemTypes = ['file', 'mesh', 'block'];
  const type = itemTypes[Math.floor(Math.random() * itemTypes.length)];
  const values = { file: 1, mesh: 2, block: 3 };
  const size = 18 + Math.random() * 16;
  const x = canvas.width + 30;
  const y = 100 + Math.random() * (groundY - 140);

  state.items.push({
    type,
    value: values[type],
    x,
    y,
    width: size,
    height: size,
    speed: 170 + state.level * 18 + Math.random() * 60,
    drift: (Math.random() - 0.5) * 24,
    bob: Math.random() * Math.PI * 2
  });
}

function spawnRock() {
  const width = 28 + Math.random() * 18;
  const height = width * (0.8 + Math.random() * 0.6);
  const x = canvas.width + 30;
  const y = groundY + 10;

  state.rocks.push({
    x,
    y,
    width,
    height,
    speed: 190 + state.level * 25,
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
    speed: 125 + state.level * 12,
    phase: Math.random() * Math.PI * 2,
    poopTimer: 0.8 + Math.random() * 1.4
  });
}

function endGame() {
  state.running = false;
  state.gameOver = true;
  state.best = Math.max(state.best, state.score);
  localStorage.setItem('geo-collector-best', String(state.best));
  updateBest();
  playTone(90, 0.2, 'sawtooth', 0.09);

  const panel = overlay.querySelector('.panel');
  panel.innerHTML = `
    <h1>Game Over</h1>
    <p>You collected ${state.score} items before the rocks hit.</p>
    <button id="startButton">Play Again</button>
  `;

  const playAgain = document.getElementById('startButton');
  playAgain.addEventListener('click', () => {
    resetGame();
    overlay.classList.remove('visible');
    panel.innerHTML = `
      <h1>Geo Collector</h1>
      <p>Collect the flying files, blocks, and meshes. Avoid the rocks.</p>
      <button id="startButton">Start</button>
    `;
    const newButton = document.getElementById('startButton');
    newButton.addEventListener('click', () => {
      resetGame();
      overlay.classList.remove('visible');
    });
  });

  overlay.classList.add('visible');
}

function jump() {
  if (!state.running || state.gameOver) {
    return;
  }

  if (player.onGround) {
    player.vy = -player.jumpStrength;
    player.onGround = false;
  }
}

function updatePlayer(dt) {
  const move = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
  player.vx = move * player.speed;
  player.x += player.vx * dt;
  player.x = Math.max(30, Math.min(canvas.width - 60, player.x));

  player.vy += 900 * dt;
  player.y += player.vy * dt;

  if (player.y + player.height >= groundY) {
    player.y = groundY - player.height;
    player.vy = 0;
    player.onGround = true;
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

  if (!state.running || state.gameOver) {
    state.clouds.forEach((cloud) => {
      cloud.x -= cloud.speed * dt;
      if (cloud.x + cloud.radius < 0) {
        cloud.x = canvas.width + cloud.radius;
      }
    });
    return;
  }

  state.elapsed += dt;
  updatePlayer(dt);

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

  for (const item of state.items) {
    item.x -= item.speed * dt;
    item.y += Math.sin((item.x + item.bob) * 0.04) * 0.7;
    item.bob += dt * 4;

    const playerRect = getRect(player);
    const itemRect = getRect(item);
    if (rectIntersect(playerRect, itemRect)) {
      state.carry += 1;
      state.carryValue += item.value;
      carryEl.textContent = String(state.carry);
      spawnPopup(item.x, item.y, `+${item.value}`, item.type === 'block' ? '#ffd166' : '#d9f99d');
      playTone(380 + item.value * 70, 0.06, 'square', 0.03);
      item.x = -200;
    }
  }

  const folderRect = { x: folder.x, y: folder.y, width: folder.width, height: folder.height };
  const playerRect = getRect(player);
  if (state.carry > 0 && rectIntersect(playerRect, folderRect)) {
    const deliveredBefore = state.delivered;
    const baseGain = state.carryValue;
    const bonus = state.carryValue * 2;
    const totalGain = baseGain + bonus;
    state.delivered += state.carry;
    state.score += totalGain;
    scoreEl.textContent = String(state.score);
    state.folderPulse = 1;
    state.shake = Math.max(state.shake, 0.9);
    if (Math.floor(state.delivered / 5) > Math.floor(deliveredBefore / 5)) {
      triggerFireworks(folder.x + folder.width / 2, folder.y + 20);
    }
    spawnPopup(folder.x + folder.width / 2, folder.y - 10, `+${totalGain}!`, '#ffd166');
    state.carry = 0;
    state.carryValue = 0;
    carryEl.textContent = '0';
    updateLevel();
    playTone(620, 0.08, 'triangle', 0.04);
  }

  for (const rock of state.rocks) {
    rock.x -= rock.speed * dt;
    rock.y -= rock.rise * dt;
    rock.rise *= 0.985;

    const rockRect = getRect(rock);
    const playerRect = getRect(player);
    if (rectIntersect(playerRect, rockRect)) {
      state.shake = 1.6;
      endGame();
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
      state.shake = 1.6;
      endGame();
      return;
    }
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
  }

  if (stageName === 'Australia') {
    ctx.fillRect(760, groundY - 106, 12, 106);
    ctx.beginPath();
    ctx.arc(766, groundY - 110, 58, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(70, groundY - 38, 120, 38);
    ctx.fillRect(92, groundY - 70, 76, 32);
  }

  if (stageName === 'Canada') {
    ctx.fillRect(754, groundY - 110, 9, 110);
    ctx.beginPath();
    ctx.arc(758, groundY - 115, 32, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(110, groundY - 62, 92, 62);
    ctx.fillRect(98, groundY - 78, 116, 16);
    ctx.fillRect(145, groundY - 104, 18, 26);
  }
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

function drawFolder() {
  const pulse = 1 + state.folderPulse * 0.22 + Math.sin(performance.now() * 0.016) * 0.04;
  ctx.save();
  ctx.translate(folder.x + folder.width / 2, folder.y + folder.height / 2);
  ctx.scale(pulse, pulse);
  ctx.translate(-(folder.x + folder.width / 2), -(folder.y + folder.height / 2));

  ctx.fillStyle = 'rgba(255, 58, 58, 0.28)';
  ctx.fillRect(folder.x - 12, folder.y - 12, folder.width + 20, folder.height + 18);

  ctx.fillStyle = '#d62839';
  ctx.fillRect(folder.x, folder.y, folder.width, folder.height);
  ctx.fillStyle = '#ef476f';
  ctx.beginPath();
  ctx.moveTo(folder.x + 8, folder.y + 8);
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

  if (item.type === 'block') {
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
  ctx.restore();
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

  ctx.fillStyle = '#1d3557';
  ctx.fillRect(-10, 3, 20, 22);

  ctx.fillStyle = '#f6c27c';
  ctx.beginPath();
  ctx.arc(0, -16, 12, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = '#1d3557';
  ctx.fillRect(-2, 25, 6, 18);
  ctx.fillRect(-12, 25, 6, 18);
  ctx.fillRect(7, 25, 6, 18);

  ctx.fillStyle = '#d8f3dc';
  ctx.fillRect(-10, 13, 7, 10);
  ctx.fillRect(3, 13, 7, 10);

  ctx.fillStyle = '#b5172b';
  ctx.fillRect(12, 9, 19, 14);
  ctx.fillStyle = '#ef476f';
  ctx.fillRect(12, 7, 8, 4);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 7px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('Evo', 21, 19);

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

function draw() {
  ctx.save();
  if (state.shake > 0) {
    const offsetX = (Math.random() - 0.5) * state.shake * 18;
    const offsetY = (Math.random() - 0.5) * state.shake * 18;
    ctx.translate(offsetX, offsetY);
  }

  drawBackground();
  drawGround();
  drawFolder();

  state.items.forEach(drawCollectible);
  state.rocks.forEach(drawRock);
  state.birds.forEach(drawBird);
  state.droppings.forEach(drawDropping);
  drawFireworks();
  drawPopups();
  drawPlayer();
  drawProgressText();
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
  if (event.key === 'ArrowLeft' || event.key.toLowerCase() === 'a') {
    keys.left = true;
  }
  if (event.key === 'ArrowRight' || event.key.toLowerCase() === 'd') {
    keys.right = true;
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

  if (isDouble) {
    player.vy = Math.min(player.vy, -player.jumpStrength * 1.25);
    playTone(680, 0.08, 'triangle', 0.04);
  }

  jump();
});

startButton.addEventListener('click', () => {
  resetGame();
  overlay.classList.remove('visible');
  playTone(440, 0.08, 'triangle', 0.04);
});

createClouds();
updateBest();
updateLevel();
requestAnimationFrame(gameLoop);
