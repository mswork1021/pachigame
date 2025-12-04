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
    this.createWalls();
    this.createNails();
    this.createPockets();
    this.createDecorations();
  }

  private createWalls(): void {
    const { width, height } = this.config;

    // 左壁
    this.physics.createWall(5, height / 2, 10, height);
    this.renderer.drawWall(5, height / 2, 10, height);

    // 右壁
    this.physics.createWall(width - 5, height / 2, 10, height);
    this.renderer.drawWall(width - 5, height / 2, 10, height);

    // 上壁
    this.physics.createWall(width / 2, 5, width, 10);
    this.renderer.drawWall(width / 2, 5, width, 10);

    // 液晶周りの壁（液晶の左右に玉が当たるように）
    const lcdLeft = (width - this.config.lcdWidth) / 2 - 10;
    const lcdRight = (width + this.config.lcdWidth) / 2 + 10;
    const lcdCenterY = this.config.lcdTop + this.config.lcdHeight / 2;

    // 液晶左側の斜め壁
    this.physics.createWall(lcdLeft - 30, lcdCenterY - 60, 80, 8, -0.3);
    this.renderer.drawWall(lcdLeft - 30, lcdCenterY - 60, 80, 8, -0.3);

    // 液晶右側の斜め壁
    this.physics.createWall(lcdRight + 30, lcdCenterY - 60, 80, 8, 0.3);
    this.renderer.drawWall(lcdRight + 30, lcdCenterY - 60, 80, 8, 0.3);

    // 玉の発射レーン（右側）
    this.physics.createWall(width - 25, height / 2 - 100, 8, 400);
    this.renderer.drawWall(width - 25, height / 2 - 100, 8, 400);

    // 発射レーンのカーブ部分
    this.physics.createWall(width - 50, 50, 60, 8, -0.5);
    this.renderer.drawWall(width - 50, 50, 60, 8, -0.5);

    // アウト口への誘導壁（左下）
    this.physics.createWall(80, height - 50, 120, 8, 0.2);
    this.renderer.drawWall(80, height - 50, 120, 8, 0.2);

    // アウト口への誘導壁（右下）
    this.physics.createWall(width - 100, height - 50, 120, 8, -0.2);
    this.renderer.drawWall(width - 100, height - 50, 120, 8, -0.2);
  }

  private createNails(): void {
    const { width, lcdTop, lcdHeight, lcdWidth } = this.config;
    const lcdBottom = lcdTop + lcdHeight + 20;
    const lcdLeft = (width - lcdWidth) / 2 - 20;
    const lcdRight = (width + lcdWidth) / 2 + 20;

    // 上部エリアの釘（液晶の上）
    for (let row = 0; row < 3; row++) {
      const y = 30 + row * 25;
      const offset = row % 2 === 0 ? 0 : 15;
      for (let col = 0; col < 15; col++) {
        const x = 40 + offset + col * 30;
        if (x < width - 60) {
          this.physics.createNail(x, y);
          this.renderer.drawNail(x, y);
        }
      }
    }

    // 液晶横のエリア（左側）
    for (let row = 0; row < 8; row++) {
      const y = lcdTop + 20 + row * 28;
      const offset = row % 2 === 0 ? 0 : 12;
      for (let col = 0; col < 3; col++) {
        const x = 25 + offset + col * 25;
        if (x < lcdLeft - 10) {
          this.physics.createNail(x, y);
          this.renderer.drawNail(x, y);
        }
      }
    }

    // 液晶横のエリア（右側）
    for (let row = 0; row < 8; row++) {
      const y = lcdTop + 20 + row * 28;
      const offset = row % 2 === 0 ? 0 : 12;
      for (let col = 0; col < 3; col++) {
        const x = lcdRight + 15 + offset + col * 25;
        if (x < width - 60) {
          this.physics.createNail(x, y);
          this.renderer.drawNail(x, y);
        }
      }
    }

    // 液晶下のメインエリア
    for (let row = 0; row < 10; row++) {
      const y = lcdBottom + 20 + row * 28;
      const offset = row % 2 === 0 ? 0 : 18;

      // 中央を避けて配置（ヘソへの道を作る）
      for (let col = 0; col < 14; col++) {
        const x = 30 + offset + col * 35;
        const centerX = width / 2;

        // ヘソ周辺は釘を配置しない
        if (Math.abs(x - centerX) > 40 || row < 2 || row > 5) {
          if (x > 20 && x < width - 60) {
            this.physics.createNail(x, y);
            this.renderer.drawNail(x, y);
          }
        }
      }
    }

    // 命釘（ヘソ直上の重要な釘）
    const hesoY = lcdBottom + 130;
    this.physics.createNail(width / 2 - 22, hesoY - 15, 5);
    this.renderer.drawNail(width / 2 - 22, hesoY - 15, 5);
    this.physics.createNail(width / 2 + 22, hesoY - 15, 5);
    this.renderer.drawNail(width / 2 + 22, hesoY - 15, 5);

    // 道釘（ヘソへの誘導）
    for (let i = 0; i < 3; i++) {
      this.physics.createNail(width / 2 - 60 - i * 25, hesoY - 5);
      this.renderer.drawNail(width / 2 - 60 - i * 25, hesoY - 5);
      this.physics.createNail(width / 2 + 60 + i * 25, hesoY - 5);
      this.renderer.drawNail(width / 2 + 60 + i * 25, hesoY - 5);
    }
  }

  private createPockets(): void {
    const { width, height, lcdTop, lcdHeight } = this.config;
    const lcdBottom = lcdTop + lcdHeight + 20;
    const centerX = width / 2;

    // ヘソ（始動口）
    const hesoY = lcdBottom + 130;
    const heso = this.physics.createPocket(centerX, hesoY, 30, 12, 'heso');
    this.pockets.set('heso', heso);
    this.renderer.drawStartPocket(centerX, hesoY);

    // 電チュー（ヘソの下）
    const denchuY = hesoY + 50;
    const denchu = this.physics.createPocket(centerX, denchuY, 35, 14, 'denchu');
    this.pockets.set('denchu', denchu);
    this.renderer.drawElectricPocket(centerX, denchuY, false);

    // アタッカー
    const attackerY = height - 100;
    const attacker = this.physics.createPocket(centerX, attackerY, 60, 18, 'attacker');
    this.pockets.set('attacker', attacker);
    this.renderer.drawAttacker(centerX, attackerY, false);

    // 左ポケット
    const leftPocket = this.physics.createPocket(60, lcdBottom + 80, 20, 12, 'left_pocket');
    this.pockets.set('left_pocket', leftPocket);
    this.renderer.drawPocket(60, lcdBottom + 80, 20, 12, 0x00aaff);

    // 右ポケット
    const rightPocket = this.physics.createPocket(width - 80, lcdBottom + 80, 20, 12, 'right_pocket');
    this.pockets.set('right_pocket', rightPocket);
    this.renderer.drawPocket(width - 80, lcdBottom + 80, 20, 12, 0x00aaff);

    // アウト口
    const outPocket = this.physics.createPocket(centerX, height - 10, width - 40, 20, 'out');
    this.pockets.set('out', outPocket);
  }

  private createDecorations(): void {
    const { width, lcdTop, lcdHeight } = this.config;
    const lcdBottom = lcdTop + lcdHeight + 20;

    // ステージ
    this.renderer.drawStage(width / 2, lcdBottom);
  }

  getPocket(name: string): Matter.Body | undefined {
    return this.pockets.get(name);
  }
}
