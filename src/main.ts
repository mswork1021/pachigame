import Matter from 'matter-js';

// ========================================
// 設定
// ========================================
const BOARD_WIDTH = 380;
const BOARD_HEIGHT = 600;
const BALL_RADIUS = 4;
const NAIL_RADIUS = 3;

// ========================================
// サウンド（Web Audio API）
// ========================================
const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();

function playSound(type: 'shoot' | 'hit' | 'win' | 'reach' | 'rush') {
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.connect(gain);
  gain.connect(audioCtx.destination);

  switch (type) {
    case 'shoot':
      osc.frequency.value = 200;
      gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.05);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.05);
      break;
    case 'hit':
      osc.frequency.value = 800;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.1);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.1);
      break;
    case 'reach':
      osc.frequency.value = 440;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
      for (let i = 0; i < 3; i++) {
        osc.frequency.setValueAtTime(440 + i * 100, audioCtx.currentTime + i * 0.15);
      }
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
      break;
    case 'win':
      osc.type = 'square';
      gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
      const notes = [523, 659, 784, 1047];
      notes.forEach((freq, i) => {
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime + i * 0.1);
      });
      osc.start();
      osc.stop(audioCtx.currentTime + 0.5);
      break;
    case 'rush':
      osc.type = 'sawtooth';
      gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
      for (let i = 0; i < 8; i++) {
        osc.frequency.setValueAtTime(300 + (i % 2) * 200, audioCtx.currentTime + i * 0.08);
      }
      osc.start();
      osc.stop(audioCtx.currentTime + 0.7);
      break;
  }
}

// ========================================
// ゲーム状態
// ========================================
let balls = 500;
let spins = 0;
let wins = 0;
let mode: 'normal' | 'rush' | 'fever' = 'normal';
let rushRemaining = 0;
let isSpinning = false;
let isShooting = false;
let shootPower = 0;
let shootHoldTime = 0;

// ========================================
// Matter.js
// ========================================
const engine = Matter.Engine.create({ gravity: { x: 0, y: 1 } });
const world = engine.world;
const runner = Matter.Runner.create();

// ========================================
// Canvas
// ========================================
const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = BOARD_WIDTH;
canvas.height = BOARD_HEIGHT;

const lcdCanvas = document.getElementById('lcd-overlay') as HTMLCanvasElement;
const lcdCtx = lcdCanvas.getContext('2d')!;
lcdCanvas.width = BOARD_WIDTH;
lcdCanvas.height = BOARD_HEIGHT;
lcdCanvas.style.top = '0';
lcdCanvas.style.left = '0';

const activeBalls: Matter.Body[] = [];

// ========================================
// 液晶設定
// ========================================
const LCD = {
  x: BOARD_WIDTH / 2 - 20,
  y: 130,
  width: 180,
  height: 120,
  symbols: ['七', '七', '七'] as string[],
  spinning: [false, false, false],
  spinSpeed: [0, 0, 0],
  spinOffset: [0, 0, 0],
  targetSymbols: ['壱', '壱', '壱'] as string[],
  reachMode: false,
  bgHue: 0
};

const SYMBOLS = ['壱', '弐', '参', '四', '伍', '六', '七'];
const SYMBOL_COLORS: Record<string, string> = {
  '壱': '#ff3d00', '弐': '#00aaff', '参': '#00ff88',
  '四': '#ffaa00', '伍': '#ff00ff', '六': '#00ffff', '七': '#ffd700'
};

// ========================================
// 発射レーン設定
// ========================================
const LAUNCH_LANE = {
  x: BOARD_WIDTH - 25,
  startY: BOARD_HEIGHT - 50,
  endY: 30,
  width: 20
};

// ========================================
// 初期化
// ========================================
function init() {
  createWalls();
  createNails();
  createPockets();
  setupCollision();
  setupInput();
  resize();
  window.addEventListener('resize', resize);
  Matter.Runner.run(runner, engine);
  requestAnimationFrame(gameLoop);
}

// ========================================
// 壁作成（発射レーン込み）
// ========================================
function createWalls() {
  const walls = [
    // 左壁
    Matter.Bodies.rectangle(5, BOARD_HEIGHT / 2, 10, BOARD_HEIGHT, { isStatic: true, label: 'wall' }),
    // 右壁（発射レーンの外側）
    Matter.Bodies.rectangle(BOARD_WIDTH - 5, BOARD_HEIGHT / 2, 10, BOARD_HEIGHT, { isStatic: true, label: 'wall' }),
    // 発射レーン内壁
    Matter.Bodies.rectangle(LAUNCH_LANE.x - LAUNCH_LANE.width / 2 - 3, BOARD_HEIGHT / 2 + 100, 6, BOARD_HEIGHT - 150, { isStatic: true, label: 'wall' }),
    // 上部カーブ（発射レーンから盤面へ）
    Matter.Bodies.rectangle(BOARD_WIDTH - 60, 20, 80, 8, { isStatic: true, angle: 0.3, label: 'wall' }),
    Matter.Bodies.rectangle(BOARD_WIDTH - 100, 8, 60, 8, { isStatic: true, label: 'wall' }),
    // 上壁（左側）
    Matter.Bodies.rectangle(80, 8, 160, 8, { isStatic: true, label: 'wall' }),
    // 下の誘導壁
    Matter.Bodies.rectangle(80, BOARD_HEIGHT - 25, 100, 8, { isStatic: true, angle: 0.35, label: 'wall' }),
    Matter.Bodies.rectangle(BOARD_WIDTH - 140, BOARD_HEIGHT - 25, 100, 8, { isStatic: true, angle: -0.35, label: 'wall' }),
  ];
  Matter.Composite.add(world, walls);
}

// ========================================
// 釘作成
// ========================================
function createNails() {
  const nails: Matter.Body[] = [];
  const lcdLeft = LCD.x - LCD.width / 2;
  const lcdRight = LCD.x + LCD.width / 2;
  const lcdTop = LCD.y - LCD.height / 2;
  const lcdBottom = LCD.y + LCD.height / 2;
  const playAreaRight = LAUNCH_LANE.x - LAUNCH_LANE.width / 2 - 10;

  // 上部（液晶より上）
  for (let row = 0; row < 3; row++) {
    const y = 30 + row * 18;
    const offset = row % 2 === 0 ? 0 : 10;
    for (let col = 0; col < 15; col++) {
      const x = 20 + offset + col * 22;
      if (x < playAreaRight && x > 15) {
        nails.push(Matter.Bodies.circle(x, y, NAIL_RADIUS, { isStatic: true, label: 'nail', restitution: 0.5 }));
      }
    }
  }

  // 液晶の左右
  for (let row = 0; row < 6; row++) {
    const y = lcdTop + row * 20;
    // 左側
    for (let col = 0; col < 2; col++) {
      const x = 20 + col * 18 + (row % 2) * 9;
      if (x < lcdLeft - 10) {
        nails.push(Matter.Bodies.circle(x, y, NAIL_RADIUS, { isStatic: true, label: 'nail', restitution: 0.5 }));
      }
    }
    // 右側
    for (let col = 0; col < 3; col++) {
      const x = lcdRight + 15 + col * 18 + (row % 2) * 9;
      if (x < playAreaRight) {
        nails.push(Matter.Bodies.circle(x, y, NAIL_RADIUS, { isStatic: true, label: 'nail', restitution: 0.5 }));
      }
    }
  }

  // 液晶下部（メインエリア）
  for (let row = 0; row < 10; row++) {
    const y = lcdBottom + 25 + row * 20;
    const offset = row % 2 === 0 ? 0 : 12;
    for (let col = 0; col < 12; col++) {
      const x = 25 + offset + col * 25;
      const centerX = LCD.x;
      // ヘソ周辺は避ける
      const avoidHeso = row >= 3 && row <= 5 && Math.abs(x - centerX) < 35;
      if (x < playAreaRight && !avoidHeso) {
        nails.push(Matter.Bodies.circle(x, y, NAIL_RADIUS, { isStatic: true, label: 'nail', restitution: 0.5 }));
      }
    }
  }

  // 命釘（ヘソの上）
  const hesoY = lcdBottom + 95;
  nails.push(Matter.Bodies.circle(LCD.x - 16, hesoY - 12, NAIL_RADIUS + 1, { isStatic: true, label: 'nail', restitution: 0.5 }));
  nails.push(Matter.Bodies.circle(LCD.x + 16, hesoY - 12, NAIL_RADIUS + 1, { isStatic: true, label: 'nail', restitution: 0.5 }));

  Matter.Composite.add(world, nails);
}

// ========================================
// 入賞口
// ========================================
function createPockets() {
  const lcdBottom = LCD.y + LCD.height / 2;
  const hesoY = lcdBottom + 95;

  const pockets = [
    Matter.Bodies.rectangle(LCD.x, hesoY, 26, 14, { isStatic: true, isSensor: true, label: 'heso' }),
    Matter.Bodies.rectangle(BOARD_WIDTH / 2 - 30, BOARD_HEIGHT - 5, 200, 15, { isStatic: true, isSensor: true, label: 'out' }),
  ];
  Matter.Composite.add(world, pockets);
}

// ========================================
// 衝突処理
// ========================================
function setupCollision() {
  Matter.Events.on(engine, 'collisionStart', (event) => {
    for (const pair of event.pairs) {
      const a = pair.bodyA;
      const b = pair.bodyB;
      const ball = a.label === 'ball' ? a : b.label === 'ball' ? b : null;
      const other = ball === a ? b : a;

      if (ball && other.isSensor) {
        removeBall(ball);
        if (other.label === 'heso') {
          balls += 3;
          playSound('hit');
          triggerSpin();
        }
        updateUI();
      }
    }
  });
}

// ========================================
// 入力処理
// ========================================
function setupInput() {
  const handle = document.getElementById('handle')!;

  const startShoot = (e: Event) => {
    e.preventDefault();
    audioCtx.resume();
    isShooting = true;
    shootHoldTime = Date.now();
  };
  const stopShoot = () => {
    isShooting = false;
    shootPower = 0;
    updatePowerMeter();
  };

  handle.addEventListener('mousedown', startShoot);
  handle.addEventListener('mouseup', stopShoot);
  handle.addEventListener('mouseleave', stopShoot);
  handle.addEventListener('touchstart', startShoot, { passive: false });
  handle.addEventListener('touchend', stopShoot);
  handle.addEventListener('touchcancel', stopShoot);

  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space' && !isShooting) {
      isShooting = true;
      shootHoldTime = Date.now();
    }
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      isShooting = false;
      shootPower = 0;
      updatePowerMeter();
    }
  });
}

function updatePowerMeter() {
  const fill = document.getElementById('power-fill')!;
  fill.style.height = `${shootPower * 100}%`;
}

// ========================================
// リサイズ
// ========================================
function resize() {
  const wrapper = document.getElementById('game-wrapper')!;
  const maxWidth = window.innerWidth - 20;
  const maxHeight = window.innerHeight - 20;

  const totalWidth = BOARD_WIDTH + 140;
  const scaleX = maxWidth / totalWidth;
  const scaleY = maxHeight / BOARD_HEIGHT;
  const scale = Math.min(scaleX, scaleY, 1.2);

  wrapper.style.transform = `scale(${scale})`;
  wrapper.style.transformOrigin = 'center center';
}

// ========================================
// 玉発射
// ========================================
let lastShootTime = 0;
function shootBall() {
  const now = Date.now();
  if (now - lastShootTime < 120) return;
  if (balls <= 0) return;

  balls--;
  lastShootTime = now;
  playSound('shoot');

  // 発射レーンの下から上へ打ち上げ
  const x = LAUNCH_LANE.x;
  const y = LAUNCH_LANE.startY;
  const ball = Matter.Bodies.circle(x, y, BALL_RADIUS, {
    restitution: 0.5,
    friction: 0.02,
    frictionAir: 0.001,
    label: 'ball'
  });

  // パワーに応じた速度
  const power = 18 + shootPower * 12;
  Matter.Body.setVelocity(ball, { x: -1 - Math.random(), y: -power });
  Matter.Composite.add(world, ball);
  activeBalls.push(ball);

  updateUI();
}

function removeBall(ball: Matter.Body) {
  Matter.Composite.remove(world, ball);
  const idx = activeBalls.indexOf(ball);
  if (idx !== -1) activeBalls.splice(idx, 1);
}

// ========================================
// スピン処理
// ========================================
async function triggerSpin() {
  if (isSpinning) return;
  isSpinning = true;
  spins++;

  // 抽選
  const prob = mode === 'rush' ? 8 : mode === 'fever' ? 2 : 319;
  const isWin = Math.random() < (1 / prob);
  const isReach = isWin || Math.random() < 0.12;

  // 結果決定
  if (isWin) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    LCD.targetSymbols = [sym, sym, sym];
  } else if (isReach) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    let other: string;
    do {
      other = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    } while (other === sym);
    LCD.targetSymbols = [sym, sym, other];
  } else {
    do {
      LCD.targetSymbols = [
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
        SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
      ];
    } while (LCD.targetSymbols[0] === LCD.targetSymbols[1] || LCD.targetSymbols[1] === LCD.targetSymbols[2]);
  }

  // スピン開始
  LCD.spinning = [true, true, true];
  LCD.spinSpeed = [25, 25, 25];

  // 左リール停止
  await delay(500 + Math.random() * 200);
  LCD.spinning[0] = false;
  LCD.symbols[0] = LCD.targetSymbols[0];

  // 中リール停止
  await delay(400 + Math.random() * 200);
  LCD.spinning[1] = false;
  LCD.symbols[1] = LCD.targetSymbols[1];

  // リーチ演出
  if (isReach) {
    LCD.reachMode = true;
    playSound('reach');
    showEffect('REACH!', '#ff6600');
    await delay(1500 + Math.random() * 1000);
  } else {
    await delay(300);
  }

  // 右リール停止
  LCD.spinning[2] = false;
  LCD.symbols[2] = LCD.targetSymbols[2];
  LCD.reachMode = false;

  // 当たり処理
  if (isWin) {
    await handleWin();
  }

  // RUSH処理
  if (mode === 'rush' || mode === 'fever') {
    rushRemaining--;
    if (rushRemaining <= 0 && !isWin) {
      mode = 'normal';
    }
  }

  updateUI();
  isSpinning = false;
}

async function handleWin() {
  wins++;
  playSound('win');

  // フラッシュ演出
  for (let i = 0; i < 5; i++) {
    showFlash();
    await delay(80);
  }

  showEffect('大当り!!', '#ffd700');
  await delay(1000);

  // 払い出し
  const payout = mode === 'fever' ? 2000 : 1500;
  balls += payout;

  // RUSH突入判定
  const rushChance = Math.random();
  if (rushChance < 0.6) {
    mode = 'rush';
    rushRemaining = 100;
    playSound('rush');
    showEffect('RUSH突入!', '#ff3d00');
  } else if (rushChance < 0.8) {
    mode = 'fever';
    rushRemaining = 50;
    playSound('rush');
    showEffect('FEVER!!', '#ff00ff');
  }

  await delay(1500);
}

// ========================================
// 演出
// ========================================
function showEffect(text: string, color: string) {
  const overlay = document.getElementById('effect-overlay')!;
  const el = document.createElement('div');
  el.className = 'effect-text';
  el.textContent = text;
  el.style.color = color;
  el.style.opacity = '1';
  overlay.appendChild(el);

  setTimeout(() => el.remove(), 2000);
}

function showFlash() {
  const overlay = document.getElementById('effect-overlay')!;
  const flash = document.createElement('div');
  flash.className = 'flash';
  overlay.appendChild(flash);
  setTimeout(() => flash.remove(), 150);
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ========================================
// UI更新
// ========================================
function updateUI() {
  document.getElementById('balls')!.textContent = balls.toString();
  document.getElementById('spins')!.textContent = spins.toString();
  document.getElementById('wins')!.textContent = wins.toString();

  const modeBox = document.getElementById('mode-box')!;
  const modeValue = document.getElementById('mode-value')!;

  if (mode === 'rush') {
    modeBox.classList.add('rush');
    modeValue.textContent = `RUSH ${rushRemaining}`;
    modeValue.style.color = '#ff3d00';
  } else if (mode === 'fever') {
    modeBox.classList.add('rush');
    modeValue.textContent = `FEVER ${rushRemaining}`;
    modeValue.style.color = '#ff00ff';
  } else {
    modeBox.classList.remove('rush');
    modeValue.textContent = '通常';
    modeValue.style.color = '#ff3d00';
  }
}

// ========================================
// 描画
// ========================================
function draw() {
  // メインキャンバス（盤面）
  ctx.fillStyle = '#0f0f1a';
  ctx.fillRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // 発射レーン背景
  ctx.fillStyle = '#1a1a2e';
  ctx.fillRect(LAUNCH_LANE.x - LAUNCH_LANE.width / 2, 20, LAUNCH_LANE.width, BOARD_HEIGHT - 40);

  // 発射レーン装飾
  const gradient = ctx.createLinearGradient(LAUNCH_LANE.x - 10, 0, LAUNCH_LANE.x + 10, 0);
  gradient.addColorStop(0, '#333');
  gradient.addColorStop(0.5, '#555');
  gradient.addColorStop(1, '#333');
  ctx.fillStyle = gradient;
  ctx.fillRect(LAUNCH_LANE.x - LAUNCH_LANE.width / 2 - 5, 20, 5, BOARD_HEIGHT - 40);

  // 釘描画
  const bodies = Matter.Composite.allBodies(world);
  for (const body of bodies) {
    if (body.label === 'nail') {
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, NAIL_RADIUS + 0.5, 0, Math.PI * 2);
      ctx.fillStyle = '#666';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(body.position.x - 1, body.position.y - 1, 1.5, 0, Math.PI * 2);
      ctx.fillStyle = '#999';
      ctx.fill();
    }
  }

  // ヘソ描画
  const hesoY = LCD.y + LCD.height / 2 + 95;
  ctx.fillStyle = '#220000';
  ctx.beginPath();
  ctx.roundRect(LCD.x - 13, hesoY - 7, 26, 14, 3);
  ctx.fill();
  ctx.strokeStyle = '#ff3d00';
  ctx.lineWidth = 2;
  ctx.stroke();

  ctx.fillStyle = '#ff3d00';
  ctx.font = 'bold 8px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('START', LCD.x, hesoY - 12);

  // 玉描画
  for (const ball of activeBalls) {
    const gradient = ctx.createRadialGradient(
      ball.position.x - 1.5, ball.position.y - 1.5, 0,
      ball.position.x, ball.position.y, BALL_RADIUS
    );
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.4, '#ddd');
    gradient.addColorStop(0.8, '#aaa');
    gradient.addColorStop(1, '#777');

    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y, BALL_RADIUS, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // 液晶描画（別キャンバス）
  drawLCD();
}

function drawLCD() {
  lcdCtx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  const x = LCD.x;
  const y = LCD.y;
  const w = LCD.width;
  const h = LCD.height;

  // 背景
  if (LCD.reachMode) {
    LCD.bgHue = (LCD.bgHue + 5) % 360;
    lcdCtx.fillStyle = `hsl(${LCD.bgHue}, 70%, 15%)`;
  } else if (mode === 'rush') {
    lcdCtx.fillStyle = '#200000';
  } else if (mode === 'fever') {
    LCD.bgHue = (LCD.bgHue + 3) % 360;
    lcdCtx.fillStyle = `hsl(${LCD.bgHue}, 50%, 10%)`;
  } else {
    lcdCtx.fillStyle = '#000';
  }
  lcdCtx.fillRect(x - w / 2, y - h / 2, w, h);

  // 枠
  lcdCtx.strokeStyle = LCD.reachMode ? '#ff6600' : mode !== 'normal' ? '#ff3d00' : '#333';
  lcdCtx.lineWidth = LCD.reachMode ? 4 : 3;
  lcdCtx.strokeRect(x - w / 2, y - h / 2, w, h);

  // タイトル
  lcdCtx.fillStyle = '#ff3d00';
  lcdCtx.font = 'bold 12px sans-serif';
  lcdCtx.textAlign = 'center';
  lcdCtx.fillText('紅蓮の刻', x, y - h / 2 + 18);

  // 図柄
  for (let i = 0; i < 3; i++) {
    const sx = x - 50 + i * 50;
    const sy = y + 15;

    // リール背景
    lcdCtx.fillStyle = '#111';
    lcdCtx.fillRect(sx - 20, sy - 30, 40, 60);

    lcdCtx.save();
    lcdCtx.beginPath();
    lcdCtx.rect(sx - 18, sy - 28, 36, 56);
    lcdCtx.clip();

    if (LCD.spinning[i]) {
      LCD.spinOffset[i] += LCD.spinSpeed[i] * 0.1;
      for (let j = -1; j <= 1; j++) {
        const symIdx = (Math.floor(LCD.spinOffset[i]) + j + SYMBOLS.length * 100) % SYMBOLS.length;
        const sym = SYMBOLS[symIdx];
        const offsetY = (LCD.spinOffset[i] % 1) * 40;

        lcdCtx.fillStyle = SYMBOL_COLORS[sym];
        lcdCtx.font = 'bold 32px serif';
        lcdCtx.fillText(sym, sx, sy + j * 40 + offsetY);
      }
      // 減速
      if (LCD.spinSpeed[i] > 5) LCD.spinSpeed[i] *= 0.98;
    } else {
      lcdCtx.fillStyle = SYMBOL_COLORS[LCD.symbols[i]];
      lcdCtx.font = 'bold 32px serif';
      lcdCtx.shadowColor = SYMBOL_COLORS[LCD.symbols[i]];
      lcdCtx.shadowBlur = LCD.reachMode ? 15 : 5;
      lcdCtx.fillText(LCD.symbols[i], sx, sy);
      lcdCtx.shadowBlur = 0;
    }

    lcdCtx.restore();
  }

  // リーチテキスト
  if (LCD.reachMode) {
    lcdCtx.fillStyle = '#ff6600';
    lcdCtx.font = 'bold 14px sans-serif';
    lcdCtx.fillText('- REACH -', x, y + h / 2 - 10);
  }
}

// ========================================
// ゲームループ
// ========================================
function gameLoop() {
  // 発射処理
  if (isShooting) {
    const holdDuration = Date.now() - shootHoldTime;
    shootPower = Math.min(holdDuration / 1000, 1);
    updatePowerMeter();
    shootBall();
  }

  // 画面外の玉削除
  for (let i = activeBalls.length - 1; i >= 0; i--) {
    const ball = activeBalls[i];
    if (ball.position.y > BOARD_HEIGHT + 50 ||
      ball.position.x < -50 ||
      ball.position.x > BOARD_WIDTH + 50) {
      removeBall(ball);
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// ========================================
// 開始
// ========================================
init();
