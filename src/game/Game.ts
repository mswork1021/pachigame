import Matter from 'matter-js';
import { Physics } from '../core/Physics';
import { Renderer } from '../core/Renderer';
import { Board } from './Board';
import { LCD } from './LCD';
import { Lottery, JackpotResult } from './Lottery';

export interface GameState {
  balls: number;
  totalSpins: number;
  jackpotCount: number;
  mode: 'normal' | 'rush';
  rushRemaining: number;
  isAttackerOpen: boolean;
  attackerCount: number;
  currentRound: number;
  maxRound: number;
}

export class Game {
  private physics: Physics;
  private renderer: Renderer;
  private board: Board;
  private lcd: LCD;
  private lottery: Lottery;

  private activeBalls: Map<number, Matter.Body> = new Map();
  private state: GameState;
  private shootPower: number = 0;
  private isAutoShoot: boolean = false;
  private lastShootTime: number = 0;
  private shootInterval: number = 100;

  // DOM要素
  private ballCountEl: HTMLElement | null = null;
  private spinCountEl: HTMLElement | null = null;
  private jackpotCountEl: HTMLElement | null = null;
  private modeDisplayEl: HTMLElement | null = null;
  private rushCounterEl: HTMLElement | null = null;
  private rushRemainingEl: HTMLElement | null = null;
  private powerBarEl: HTMLElement | null = null;
  private historyListEl: HTMLElement | null = null;

  constructor() {
    this.physics = new Physics({ width: 540, height: 700 });
    this.renderer = new Renderer();
    this.lcd = new LCD();
    this.lottery = new Lottery();

    this.board = new Board(this.physics, this.renderer, {
      width: 540,
      height: 700,
      lcdTop: 50,
      lcdHeight: 240,
      lcdWidth: 320
    });

    this.state = {
      balls: 1000,
      totalSpins: 0,
      jackpotCount: 0,
      mode: 'normal',
      rushRemaining: 0,
      isAttackerOpen: false,
      attackerCount: 0,
      currentRound: 0,
      maxRound: 0
    };
  }

  async init(): Promise<void> {
    // DOM要素の取得
    this.ballCountEl = document.getElementById('ball-count');
    this.spinCountEl = document.getElementById('spin-count');
    this.jackpotCountEl = document.getElementById('jackpot-count');
    this.modeDisplayEl = document.getElementById('mode-display');
    this.rushCounterEl = document.getElementById('rush-counter');
    this.rushRemainingEl = document.getElementById('rush-remaining');
    this.powerBarEl = document.getElementById('power-bar');
    this.historyListEl = document.getElementById('history-list');

    // レンダラー初期化
    const boardCanvas = document.getElementById('board-canvas') as HTMLCanvasElement;
    const lcdCanvas = document.getElementById('lcd-canvas') as HTMLCanvasElement;

    await this.renderer.init({
      canvas: boardCanvas,
      width: 540,
      height: 700,
      backgroundColor: 0x0a0a1a
    });

    await this.lcd.init(lcdCanvas);

    // 盤面セットアップ
    this.board.setup();

    // 物理エンジン開始
    this.physics.start();

    // 衝突検知
    this.setupCollisionHandlers();

    // 入力ハンドラ
    this.setupInputHandlers();

    // ゲームループ
    this.startGameLoop();

    this.updateUI();
  }

  private setupCollisionHandlers(): void {
    this.physics.onCollision((pairs) => {
      for (const pair of pairs) {
        const { bodyA, bodyB } = pair;

        // 玉と入賞口の衝突
        const ball = bodyA.label === 'ball' ? bodyA : (bodyB.label === 'ball' ? bodyB : null);
        const pocket = bodyA.label !== 'ball' ? bodyA : bodyB;

        if (ball && pocket.isSensor) {
          this.handlePocketEntry(ball, pocket.label);
        }
      }
    });
  }

  private handlePocketEntry(ball: Matter.Body, pocketLabel: string): void {
    // 玉を削除
    this.removeBall(ball);

    switch (pocketLabel) {
      case 'heso':
        // ヘソ入賞
        this.state.balls += 3; // 賞球3個
        this.triggerSpin();
        break;

      case 'denchu':
        // 電チュー入賞
        this.state.balls += 1;
        if (this.state.mode === 'rush') {
          this.triggerSpin();
        }
        break;

      case 'attacker':
        // アタッカー入賞
        if (this.state.isAttackerOpen) {
          this.state.balls += 15; // 賞球15個
          this.state.attackerCount++;

          // カウント満了でラウンド終了
          if (this.state.attackerCount >= 10) {
            this.endRound();
          }
        }
        break;

      case 'left_pocket':
      case 'right_pocket':
        // サイドポケット
        this.state.balls += 3;
        break;

      case 'out':
        // アウト（何もしない）
        break;
    }

    this.updateUI();
  }

  private async triggerSpin(): Promise<void> {
    if (!this.lcd.isReady()) return;

    this.state.totalSpins++;
    const result = this.lottery.draw();

    await this.lcd.spin(result);

    if (result.isJackpot) {
      const jackpotResult = this.lottery.processJackpot();
      this.handleJackpot(jackpotResult);
    }

    // 状態更新
    this.state.mode = this.lottery.getMode();
    this.state.rushRemaining = this.lottery.getRushRemaining();
    this.updateUI();
  }

  private handleJackpot(result: JackpotResult): void {
    this.state.jackpotCount++;
    this.state.maxRound = result.round;
    this.state.currentRound = 1;

    // 履歴に追加
    this.addHistory(result);

    // アタッカー開放
    this.startRound();
  }

  private startRound(): void {
    this.state.isAttackerOpen = true;
    this.state.attackerCount = 0;
    // アタッカーの視覚的な更新はここで行う（将来実装）
  }

  private endRound(): void {
    this.state.attackerCount = 0;
    this.state.currentRound++;

    if (this.state.currentRound > this.state.maxRound) {
      // 大当り終了
      this.state.isAttackerOpen = false;
      this.state.currentRound = 0;
      this.state.maxRound = 0;
    } else {
      // 次ラウンド
      setTimeout(() => this.startRound(), 500);
    }

    this.updateUI();
  }

  private addHistory(result: JackpotResult): void {
    if (!this.historyListEl) return;

    const item = document.createElement('div');
    item.className = `history-item ${result.isRush ? 'rush' : 'jackpot'}`;
    item.innerHTML = `
      <span>${result.round}R ${result.isRush ? 'RUSH' : ''}</span>
      <span>${this.state.totalSpins}回転</span>
    `;

    this.historyListEl.insertBefore(item, this.historyListEl.firstChild);

    // 最大10件まで
    while (this.historyListEl.children.length > 10) {
      this.historyListEl.removeChild(this.historyListEl.lastChild!);
    }
  }

  private setupInputHandlers(): void {
    const handle = document.getElementById('handle');

    if (handle) {
      // マウス/タッチで発射
      handle.addEventListener('mousedown', () => this.startAutoShoot());
      handle.addEventListener('mouseup', () => this.stopAutoShoot());
      handle.addEventListener('mouseleave', () => this.stopAutoShoot());

      handle.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.startAutoShoot();
      });
      handle.addEventListener('touchend', () => this.stopAutoShoot());
    }

    // キーボード操作
    document.addEventListener('keydown', (e) => {
      if (e.code === 'Space' && !this.isAutoShoot) {
        this.startAutoShoot();
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this.stopAutoShoot();
      }
    });

    // パワー調整（マウスホイール）
    document.addEventListener('wheel', (e) => {
      this.shootPower = Math.max(0, Math.min(1, this.shootPower + (e.deltaY > 0 ? -0.05 : 0.05)));
      this.updatePowerBar();
    });
  }

  private startAutoShoot(): void {
    this.isAutoShoot = true;
    this.shootPower = 0.8; // デフォルトパワー
    this.updatePowerBar();
  }

  private stopAutoShoot(): void {
    this.isAutoShoot = false;
    this.shootPower = 0;
    this.updatePowerBar();
  }

  private shootBall(): void {
    if (this.state.balls <= 0) return;

    this.state.balls--;

    // 発射位置（右レーンの下部）
    const x = 510;
    const y = 680;

    // 発射速度（パワーに応じて上に打ち上げる）
    // パワーが強いほど上まで飛ぶ
    const basePower = 18;
    const powerRange = 8;
    const power = basePower + this.shootPower * powerRange;

    // 真上に発射（レールに沿って上昇）
    const velocity = {
      x: 0,
      y: -power
    };

    const ball = this.physics.createBall(x, y, velocity);
    this.activeBalls.set(ball.id, ball);

    this.updateUI();
  }

  private removeBall(ball: Matter.Body): void {
    this.physics.removeBody(ball);
    this.renderer.removeBall(ball.id);
    this.activeBalls.delete(ball.id);
  }

  private updatePowerBar(): void {
    if (this.powerBarEl) {
      this.powerBarEl.style.height = `${this.shootPower * 100}%`;
    }
  }

  private startGameLoop(): void {
    const loop = () => {
      // 自動発射
      if (this.isAutoShoot) {
        const now = Date.now();
        if (now - this.lastShootTime > this.shootInterval) {
          this.shootBall();
          this.lastShootTime = now;
        }
      }

      // 玉の描画更新
      this.activeBalls.forEach((ball) => {
        if (this.physics.isOutOfBounds(ball)) {
          this.removeBall(ball);
        } else {
          this.renderer.drawBall(ball);
        }
      });

      requestAnimationFrame(loop);
    };

    loop();
  }

  private updateUI(): void {
    if (this.ballCountEl) {
      this.ballCountEl.textContent = this.state.balls.toString();
    }

    if (this.spinCountEl) {
      this.spinCountEl.textContent = this.state.totalSpins.toString();
    }

    if (this.jackpotCountEl) {
      this.jackpotCountEl.textContent = this.state.jackpotCount.toString();
    }

    if (this.modeDisplayEl) {
      if (this.state.isAttackerOpen) {
        this.modeDisplayEl.textContent = `大当り中 ${this.state.currentRound}/${this.state.maxRound}R`;
        this.modeDisplayEl.className = 'rush';
      } else if (this.state.mode === 'rush') {
        this.modeDisplayEl.textContent = 'RUSH中';
        this.modeDisplayEl.className = 'rush';
      } else {
        this.modeDisplayEl.textContent = '通常モード';
        this.modeDisplayEl.className = '';
      }
    }

    if (this.rushCounterEl && this.rushRemainingEl) {
      if (this.state.mode === 'rush' && !this.state.isAttackerOpen) {
        this.rushCounterEl.classList.remove('hidden');
        this.rushRemainingEl.textContent = this.state.rushRemaining.toString();
      } else {
        this.rushCounterEl.classList.add('hidden');
      }
    }
  }
}
