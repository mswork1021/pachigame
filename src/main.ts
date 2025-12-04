import Matter from 'matter-js';

// ゲーム設定
const BOARD_WIDTH = 360;
const BOARD_HEIGHT = 580;
const BALL_RADIUS = 6;
const NAIL_RADIUS = 3;

// ゲーム状態
let balls = 500;
let spins = 0;
let wins = 0;
let mode: 'normal' | 'rush' = 'normal';
let rushRemaining = 0;
let isSpinning = false;
let isShooting = false;

// Matter.js
const engine = Matter.Engine.create({ gravity: { x: 0, y: 0.8 } });
const world = engine.world;
const runner = Matter.Runner.create();

// Canvas
const canvas = document.getElementById('board') as HTMLCanvasElement;
const ctx = canvas.getContext('2d')!;
canvas.width = BOARD_WIDTH;
canvas.height = BOARD_HEIGHT;

// アクティブな玉
const activeBalls: Matter.Body[] = [];

// 液晶エリア
const LCD = {
  x: BOARD_WIDTH / 2,
  y: 140,
  width: 200,
  height: 140,
  symbols: ['七', '七', '七'],
  spinning: [false, false, false],
  targetSymbols: ['壱', '壱', '壱']
};

// 図柄
const SYMBOLS = ['壱', '弐', '参', '四', '伍', '六', '七'];
const SYMBOL_COLORS: Record<string, string> = {
  '壱': '#ff3d00', '弐': '#00aaff', '参': '#ff3d00', '四': '#00ff00',
  '伍': '#ff3d00', '六': '#00aaff', '七': '#ffd700'
};

// 初期化
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

// 壁作成
function createWalls() {
  const walls = [
    // 左壁
    Matter.Bodies.rectangle(5, BOARD_HEIGHT / 2, 10, BOARD_HEIGHT, { isStatic: true }),
    // 右壁
    Matter.Bodies.rectangle(BOARD_WIDTH - 5, BOARD_HEIGHT / 2, 10, BOARD_HEIGHT, { isStatic: true }),
    // 上壁（玉の入口を開ける）
    Matter.Bodies.rectangle(BOARD_WIDTH / 2 - 60, 5, BOARD_WIDTH - 140, 10, { isStatic: true }),
    // 下の誘導壁
    Matter.Bodies.rectangle(60, BOARD_HEIGHT - 30, 80, 8, { isStatic: true, angle: 0.3 }),
    Matter.Bodies.rectangle(BOARD_WIDTH - 60, BOARD_HEIGHT - 30, 80, 8, { isStatic: true, angle: -0.3 }),
    // 液晶周りの壁
    Matter.Bodies.rectangle(LCD.x - LCD.width/2 - 15, LCD.y, 10, LCD.height + 20, { isStatic: true }),
    Matter.Bodies.rectangle(LCD.x + LCD.width/2 + 15, LCD.y, 10, LCD.height + 20, { isStatic: true }),
    Matter.Bodies.rectangle(LCD.x, LCD.y - LCD.height/2 - 10, LCD.width + 20, 10, { isStatic: true }),
    Matter.Bodies.rectangle(LCD.x, LCD.y + LCD.height/2 + 10, LCD.width + 20, 10, { isStatic: true }),
  ];
  Matter.Composite.add(world, walls);
}

// 釘作成
function createNails() {
  const nails: Matter.Body[] = [];

  // 上部の釘（液晶の上）
  for (let row = 0; row < 2; row++) {
    const y = 35 + row * 20;
    const offset = row % 2 === 0 ? 0 : 12;
    for (let col = 0; col < 12; col++) {
      const x = 30 + offset + col * 25;
      if (x < BOARD_WIDTH - 30) {
        nails.push(Matter.Bodies.circle(x, y, NAIL_RADIUS, { isStatic: true, label: 'nail' }));
      }
    }
  }

  // 液晶下の釘
  const lcdBottom = LCD.y + LCD.height / 2 + 25;
  for (let row = 0; row < 8; row++) {
    const y = lcdBottom + row * 22;
    const offset = row % 2 === 0 ? 0 : 15;
    for (let col = 0; col < 10; col++) {
      const x = 35 + offset + col * 30;
      // ヘソ周辺は避ける
      const centerX = BOARD_WIDTH / 2;
      if (Math.abs(x - centerX) > 30 || row < 2 || row > 4) {
        if (x < BOARD_WIDTH - 30) {
          nails.push(Matter.Bodies.circle(x, y, NAIL_RADIUS, { isStatic: true, label: 'nail' }));
        }
      }
    }
  }

  // 命釘（ヘソの上）
  const hesoY = lcdBottom + 70;
  nails.push(Matter.Bodies.circle(BOARD_WIDTH / 2 - 18, hesoY - 10, NAIL_RADIUS + 1, { isStatic: true, label: 'nail' }));
  nails.push(Matter.Bodies.circle(BOARD_WIDTH / 2 + 18, hesoY - 10, NAIL_RADIUS + 1, { isStatic: true, label: 'nail' }));

  Matter.Composite.add(world, nails);
}

// 入賞口作成
function createPockets() {
  const lcdBottom = LCD.y + LCD.height / 2 + 25;
  const hesoY = lcdBottom + 70;

  const pockets = [
    // ヘソ
    Matter.Bodies.rectangle(BOARD_WIDTH / 2, hesoY + 5, 28, 12, { isStatic: true, isSensor: true, label: 'heso' }),
    // アウト口
    Matter.Bodies.rectangle(BOARD_WIDTH / 2, BOARD_HEIGHT - 5, 150, 15, { isStatic: true, isSensor: true, label: 'out' }),
  ];

  Matter.Composite.add(world, pockets);
}

// 衝突検知
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
          triggerSpin();
        }
        updateUI();
      }
    }
  });
}

// 入力設定
function setupInput() {
  const btn = document.getElementById('shoot-btn')!;

  const startShoot = (e: Event) => {
    e.preventDefault();
    isShooting = true;
  };
  const stopShoot = () => {
    isShooting = false;
  };

  btn.addEventListener('mousedown', startShoot);
  btn.addEventListener('mouseup', stopShoot);
  btn.addEventListener('mouseleave', stopShoot);
  btn.addEventListener('touchstart', startShoot);
  btn.addEventListener('touchend', stopShoot);
  btn.addEventListener('touchcancel', stopShoot);

  // キーボード
  document.addEventListener('keydown', (e) => {
    if (e.code === 'Space') isShooting = true;
  });
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') isShooting = false;
  });
}

// 画面リサイズ
function resize() {
  const wrapper = document.getElementById('game-wrapper')!;
  const maxWidth = window.innerWidth - 20;
  const maxHeight = window.innerHeight - 120;

  const scaleX = maxWidth / BOARD_WIDTH;
  const scaleY = maxHeight / BOARD_HEIGHT;
  const scale = Math.min(scaleX, scaleY, 1.5);

  wrapper.style.transform = `scale(${scale})`;
}

// 玉発射
let lastShootTime = 0;
function shootBall() {
  const now = Date.now();
  if (now - lastShootTime < 150) return;
  if (balls <= 0) return;

  balls--;
  lastShootTime = now;

  // 上から落とす（ランダムな位置）
  const x = BOARD_WIDTH - 30 + (Math.random() - 0.5) * 20;
  const ball = Matter.Bodies.circle(x, 15, BALL_RADIUS, {
    restitution: 0.5,
    friction: 0.05,
    label: 'ball'
  });

  Matter.Body.setVelocity(ball, { x: -3 - Math.random() * 2, y: 2 });
  Matter.Composite.add(world, ball);
  activeBalls.push(ball);

  updateUI();
}

// 玉削除
function removeBall(ball: Matter.Body) {
  Matter.Composite.remove(world, ball);
  const idx = activeBalls.indexOf(ball);
  if (idx !== -1) activeBalls.splice(idx, 1);
}

// スピン開始
async function triggerSpin() {
  if (isSpinning) return;
  isSpinning = true;
  spins++;

  // 抽選
  const prob = mode === 'rush' ? 10 : 319;
  const isWin = Math.random() < (1 / prob);

  // リーチ判定
  const isReach = isWin || Math.random() < 0.1;

  // 結果決定
  if (isWin) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    LCD.targetSymbols = [sym, sym, sym];
  } else if (isReach) {
    const sym = SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
    const other = SYMBOLS[(SYMBOLS.indexOf(sym) + 1) % SYMBOLS.length];
    LCD.targetSymbols = [sym, sym, other];
  } else {
    LCD.targetSymbols = [
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    ];
    // リーチにならないように
    if (LCD.targetSymbols[0] === LCD.targetSymbols[1]) {
      LCD.targetSymbols[1] = SYMBOLS[(SYMBOLS.indexOf(LCD.targetSymbols[1]) + 1) % SYMBOLS.length];
    }
  }

  // スピンアニメーション
  LCD.spinning = [true, true, true];
  await delay(600);
  LCD.spinning[0] = false;
  LCD.symbols[0] = LCD.targetSymbols[0];
  await delay(400);
  LCD.spinning[1] = false;
  LCD.symbols[1] = LCD.targetSymbols[1];

  if (isReach) await delay(1000);
  else await delay(400);

  LCD.spinning[2] = false;
  LCD.symbols[2] = LCD.targetSymbols[2];

  if (isWin) {
    wins++;
    balls += 1500;

    // RUSH突入
    if (Math.random() < 0.8) {
      mode = 'rush';
      rushRemaining = 100;
    }
  }

  // RUSH処理
  if (mode === 'rush') {
    rushRemaining--;
    if (rushRemaining <= 0 && !isWin) {
      mode = 'normal';
    }
  }

  updateUI();
  isSpinning = false;
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// UI更新
function updateUI() {
  document.getElementById('balls')!.textContent = balls.toString();
  document.getElementById('spins')!.textContent = spins.toString();
  document.getElementById('wins')!.textContent = wins.toString();

  const modeEl = document.getElementById('mode')!;
  if (mode === 'rush') {
    modeEl.textContent = `RUSH ${rushRemaining}`;
    modeEl.className = 'rush';
  } else {
    modeEl.textContent = '通常モード';
    modeEl.className = '';
  }
}

// 描画
let spinOffset = 0;
function draw() {
  ctx.clearRect(0, 0, BOARD_WIDTH, BOARD_HEIGHT);

  // 液晶背景
  ctx.fillStyle = '#000';
  ctx.fillRect(LCD.x - LCD.width/2, LCD.y - LCD.height/2, LCD.width, LCD.height);

  // 液晶タイトル
  ctx.fillStyle = '#ff3d00';
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('紅蓮の刻', LCD.x, LCD.y - LCD.height/2 + 20);

  // 図柄
  spinOffset += 0.3;
  for (let i = 0; i < 3; i++) {
    const x = LCD.x - 60 + i * 60;
    const y = LCD.y + 20;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x - 25, y - 35, 50, 70);
    ctx.clip();

    if (LCD.spinning[i]) {
      // スピン中
      for (let j = -1; j <= 1; j++) {
        const sym = SYMBOLS[(Math.floor(spinOffset) + j + i * 3) % SYMBOLS.length];
        ctx.fillStyle = SYMBOL_COLORS[sym];
        ctx.font = 'bold 36px serif';
        ctx.fillText(sym, x, y + j * 40 + (spinOffset % 1) * 40);
      }
    } else {
      // 停止
      ctx.fillStyle = SYMBOL_COLORS[LCD.symbols[i]];
      ctx.font = 'bold 36px serif';
      ctx.fillText(LCD.symbols[i], x, y);
    }
    ctx.restore();
  }

  // 釘
  const bodies = Matter.Composite.allBodies(world);
  for (const body of bodies) {
    if (body.label === 'nail') {
      ctx.beginPath();
      ctx.arc(body.position.x, body.position.y, NAIL_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = '#888';
      ctx.fill();
      // ハイライト
      ctx.beginPath();
      ctx.arc(body.position.x - 1, body.position.y - 1, 1, 0, Math.PI * 2);
      ctx.fillStyle = '#ccc';
      ctx.fill();
    }
  }

  // 入賞口
  const lcdBottom = LCD.y + LCD.height / 2 + 25;
  const hesoY = lcdBottom + 70;

  // ヘソ
  ctx.fillStyle = '#220000';
  ctx.fillRect(BOARD_WIDTH/2 - 14, hesoY, 28, 12);
  ctx.strokeStyle = '#ff3d00';
  ctx.lineWidth = 2;
  ctx.strokeRect(BOARD_WIDTH/2 - 14, hesoY, 28, 12);
  ctx.fillStyle = '#ff3d00';
  ctx.font = 'bold 8px sans-serif';
  ctx.fillText('START', BOARD_WIDTH/2, hesoY - 5);

  // 玉
  for (const ball of activeBalls) {
    ctx.beginPath();
    ctx.arc(ball.position.x, ball.position.y, BALL_RADIUS, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(
      ball.position.x - 2, ball.position.y - 2, 0,
      ball.position.x, ball.position.y, BALL_RADIUS
    );
    gradient.addColorStop(0, '#fff');
    gradient.addColorStop(0.5, '#c0c0c0');
    gradient.addColorStop(1, '#808080');
    ctx.fillStyle = gradient;
    ctx.fill();
  }

  // 壁（デバッグ用にコメントアウト可）
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 2;
  // 外枠
  ctx.strokeRect(2, 2, BOARD_WIDTH - 4, BOARD_HEIGHT - 4);
}

// ゲームループ
function gameLoop() {
  if (isShooting) {
    shootBall();
  }

  // 画面外の玉を削除
  for (let i = activeBalls.length - 1; i >= 0; i--) {
    const ball = activeBalls[i];
    if (ball.position.y > BOARD_HEIGHT + 50 || ball.position.x < -50 || ball.position.x > BOARD_WIDTH + 50) {
      removeBall(ball);
    }
  }

  draw();
  requestAnimationFrame(gameLoop);
}

// 開始
init();
