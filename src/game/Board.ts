import Matter from 'matter-js';
import { Physics } from '../core/Physics';
import { Renderer } from '../core/Renderer';

export interface BoardConfig {
  width: number;
  height: number;
  lcdTop: number;
  lcdHeight: number;
  lcdWidth: number;
}

export class Board {
  private physics: Physics;
  private renderer: Renderer;
  private config: BoardConfig;
  private pockets: Map<string, Matter.Body> = new Map();

  constructor(physics: Physics, renderer: Renderer, config: BoardConfig) {
    this.physics = physics;
    this.renderer = renderer;
    this.config = config;
  }

  setup(): void {
    this.createOuterFrame();
    this.createLaunchLane();
    this.createNails();
    this.createPockets();
    this.createDecorations();
  }

  // 外枠（盤面の境界）
  private createOuterFrame(): void {
    const { width, height } = this.config;
    const frameThickness = 12;
    const playAreaLeft = 15;
    const playAreaRight = width - 50; // 右側は発射レーン用に空ける

    // 左壁
    this.physics.createWall(playAreaLeft, height / 2, frameThickness, height);
    this.renderer.drawWall(playAreaLeft, height / 2, frameThickness, height);

    // 下壁（アウト口用に中央を開ける）
    this.physics.createWall(playAreaLeft + 80, height - 8, 150, frameThickness);
    this.renderer.drawWall(playAreaLeft + 80, height - 8, 150, frameThickness);

    this.physics.createWall(playAreaRight - 80, height - 8, 150, frameThickness);
    this.renderer.drawWall(playAreaRight - 80, height - 8, 150, frameThickness);

    // 左上のカーブ部分（玉の入口）
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI / 2) * (i / 7);
      const x = playAreaLeft + 60 - Math.cos(angle) * 50;
      const y = 60 - Math.sin(angle) * 50 + 20;
      this.physics.createWall(x, y, 20, frameThickness, angle - Math.PI / 2);
      this.renderer.drawWall(x, y, 20, frameThickness, angle - Math.PI / 2);
    }
  }

  // 発射レーン（右側の外レール）
  private createLaunchLane(): void {
    const { width, height } = this.config;
    const laneX = width - 30;

    // 右側の直線レール（内側）
    this.physics.createWall(laneX - 15, height / 2 + 100, 8, height - 200);
    this.renderer.drawWall(laneX - 15, height / 2 + 100, 8, height - 200);

    // 右側の直線レール（外側）
    this.physics.createWall(laneX + 15, height / 2 + 100, 8, height - 200);
    this.renderer.drawWall(laneX + 15, height / 2 + 100, 8, height - 200);

    // 上部カーブ（玉を左方向へ誘導）
    for (let i = 0; i < 12; i++) {
      const angle = -Math.PI / 2 + (Math.PI / 2) * (i / 11);
      const radius = 70;
      const x = width - 100 + Math.cos(angle) * radius;
      const y = 80 + Math.sin(angle) * radius;

      // 外側レール
      this.physics.createWall(x + 15, y, 18, 8, angle);
      this.renderer.drawWall(x + 15, y, 18, 8, angle);

      // 内側レール
      this.physics.createWall(x - 15, y, 18, 8, angle);
      this.renderer.drawWall(x - 15, y, 18, 8, angle);
    }

    // 戻り防止（ファール球防止）
    this.physics.createWall(width - 160, 35, 40, 8, 0.3);
    this.renderer.drawWall(width - 160, 35, 40, 8, 0.3);
  }

  // 釘配置（実機風の千鳥配置）
  private createNails(): void {
    const { width, lcdTop, lcdHeight, lcdWidth } = this.config;
    const lcdBottom = lcdTop + lcdHeight + 15;
    const lcdLeft = (width - lcdWidth) / 2 - 60;
    const lcdRight = (width + lcdWidth) / 2 - 40;
    const centerX = (lcdLeft + lcdRight) / 2;
    const playAreaRight = width - 50;

    // ============================================
    // 上部エリア（天釘）- 玉の入口付近
    // ============================================
    for (let row = 0; row < 2; row++) {
      const y = 55 + row * 22;
      const offset = row % 2 === 0 ? 0 : 12;
      for (let col = 0; col < 12; col++) {
        const x = 70 + offset + col * 28;
        if (x < playAreaRight - 30) {
          this.physics.createNail(x, y);
          this.renderer.drawNail(x, y);
        }
      }
    }

    // ============================================
    // 液晶上部エリア
    // ============================================
    for (let row = 0; row < 3; row++) {
      const y = 100 + row * 24;
      const offset = row % 2 === 0 ? 0 : 14;
      for (let col = 0; col < 14; col++) {
        const x = 35 + offset + col * 30;
        if (x < playAreaRight - 20 && x > 25) {
          this.physics.createNail(x, y);
          this.renderer.drawNail(x, y);
        }
      }
    }

    // ============================================
    // 液晶左側のエリア（ワープルート）
    // ============================================
    for (let row = 0; row < 9; row++) {
      const y = lcdTop + 10 + row * 26;
      const offset = row % 2 === 0 ? 0 : 11;
      for (let col = 0; col < 2; col++) {
        const x = 30 + offset + col * 22;
        if (x < lcdLeft - 5) {
          this.physics.createNail(x, y);
          this.renderer.drawNail(x, y);
        }
      }
    }

    // ============================================
    // 液晶右側のエリア
    // ============================================
    for (let row = 0; row < 9; row++) {
      const y = lcdTop + 10 + row * 26;
      const offset = row % 2 === 0 ? 0 : 11;
      for (let col = 0; col < 3; col++) {
        const x = lcdRight + 15 + offset + col * 22;
        if (x < playAreaRight - 25) {
          this.physics.createNail(x, y);
          this.renderer.drawNail(x, y);
        }
      }
    }

    // ============================================
    // 液晶下のメインエリア（重要な振り分けゾーン）
    // ============================================

    // ステージ上の釘
    for (let row = 0; row < 2; row++) {
      const y = lcdBottom + 5 + row * 22;
      const offset = row % 2 === 0 ? 0 : 16;
      for (let col = 0; col < 10; col++) {
        const x = 50 + offset + col * 32;
        // 中央のステージ部分は避ける
        if (Math.abs(x - centerX) > 55 && x < playAreaRight - 20) {
          this.physics.createNail(x, y);
          this.renderer.drawNail(x, y);
        }
      }
    }

    // ============================================
    // 道釘エリア（ヘソへの誘導）
    // ============================================
    const roadY = lcdBottom + 65;

    // 左側の道釘
    for (let i = 0; i < 4; i++) {
      const x = centerX - 55 - i * 28;
      if (x > 30) {
        this.physics.createNail(x, roadY);
        this.renderer.drawNail(x, roadY);
      }
    }

    // 右側の道釘
    for (let i = 0; i < 4; i++) {
      const x = centerX + 55 + i * 28;
      if (x < playAreaRight - 20) {
        this.physics.createNail(x, roadY);
        this.renderer.drawNail(x, roadY);
      }
    }

    // ============================================
    // 命釘（ヘソ直上の最重要釘）
    // ============================================
    const hesoY = lcdBottom + 100;
    // 寄り釘（ヘソに入りやすくする）
    this.physics.createNail(centerX - 18, hesoY - 12, 4);
    this.renderer.drawNail(centerX - 18, hesoY - 12, 4);
    this.physics.createNail(centerX + 18, hesoY - 12, 4);
    this.renderer.drawNail(centerX + 18, hesoY - 12, 4);

    // ジャンプ釘
    this.physics.createNail(centerX - 35, hesoY - 5, 4);
    this.renderer.drawNail(centerX - 35, hesoY - 5, 4);
    this.physics.createNail(centerX + 35, hesoY - 5, 4);
    this.renderer.drawNail(centerX + 35, hesoY - 5, 4);

    // ============================================
    // 下部エリア（アタッカー周辺）
    // ============================================
    const attackerY = this.config.height - 90;

    for (let row = 0; row < 4; row++) {
      const y = hesoY + 55 + row * 28;
      const offset = row % 2 === 0 ? 0 : 18;
      for (let col = 0; col < 10; col++) {
        const x = 40 + offset + col * 36;
        // アタッカーとヘソ周辺は避ける
        if (Math.abs(x - centerX) > 50 && x < playAreaRight - 20 && y < attackerY - 30) {
          this.physics.createNail(x, y);
          this.renderer.drawNail(x, y);
        }
      }
    }

    // ============================================
    // アウト口への誘導壁
    // ============================================
    const bottomY = this.config.height - 35;

    // 左下の誘導壁
    this.physics.createWall(70, bottomY, 80, 8, 0.25);
    this.renderer.drawWall(70, bottomY, 80, 8, 0.25);

    // 右下の誘導壁
    this.physics.createWall(playAreaRight - 90, bottomY, 80, 8, -0.25);
    this.renderer.drawWall(playAreaRight - 90, bottomY, 80, 8, -0.25);
  }

  private createPockets(): void {
    const { width, height, lcdTop, lcdHeight, lcdWidth } = this.config;
    const lcdBottom = lcdTop + lcdHeight + 15;
    const lcdLeft = (width - lcdWidth) / 2 - 60;
    const lcdRight = (width + lcdWidth) / 2 - 40;
    const centerX = (lcdLeft + lcdRight) / 2;

    // ヘソ（始動口）
    const hesoY = lcdBottom + 100;
    const heso = this.physics.createPocket(centerX, hesoY + 5, 28, 14, 'heso');
    this.pockets.set('heso', heso);
    this.renderer.drawStartPocket(centerX, hesoY + 5);

    // 電チュー（ヘソの下）
    const denchuY = hesoY + 50;
    const denchu = this.physics.createPocket(centerX, denchuY, 32, 14, 'denchu');
    this.pockets.set('denchu', denchu);
    this.renderer.drawElectricPocket(centerX, denchuY, false);

    // アタッカー
    const attackerY = height - 90;
    const attacker = this.physics.createPocket(centerX, attackerY, 55, 18, 'attacker');
    this.pockets.set('attacker', attacker);
    this.renderer.drawAttacker(centerX, attackerY, false);

    // 左ポケット（一般入賞口）
    const leftPocket = this.physics.createPocket(45, lcdBottom + 50, 18, 12, 'left_pocket');
    this.pockets.set('left_pocket', leftPocket);
    this.renderer.drawPocket(45, lcdBottom + 50, 18, 12, 0x00aaff);

    // 右ポケット（一般入賞口）
    const rightPocket = this.physics.createPocket(width - 100, lcdBottom + 50, 18, 12, 'right_pocket');
    this.pockets.set('right_pocket', rightPocket);
    this.renderer.drawPocket(width - 100, lcdBottom + 50, 18, 12, 0x00aaff);

    // アウト口
    const outPocket = this.physics.createPocket(centerX, height - 5, 120, 20, 'out');
    this.pockets.set('out', outPocket);
  }

  private createDecorations(): void {
    const { width, lcdTop, lcdHeight, lcdWidth } = this.config;
    const lcdBottom = lcdTop + lcdHeight + 15;
    const lcdLeft = (width - lcdWidth) / 2 - 60;
    const lcdRight = (width + lcdWidth) / 2 - 40;
    const centerX = (lcdLeft + lcdRight) / 2;

    // ステージ（液晶下の振り分け台）
    this.renderer.drawStage(centerX, lcdBottom - 5);
  }

  getPocket(name: string): Matter.Body | undefined {
    return this.pockets.get(name);
  }
}
