import { Application, Graphics, Container, Text, TextStyle } from 'pixi.js';
import Matter from 'matter-js';

export interface RendererConfig {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
  backgroundColor?: number;
}

export class Renderer {
  app: Application;
  private boardContainer: Container;
  private ballGraphics: Map<number, Graphics> = new Map();
  private nailGraphics: Graphics;
  private initialized: boolean = false;

  constructor() {
    this.app = new Application();
    this.boardContainer = new Container();
    this.nailGraphics = new Graphics();
  }

  async init(config: RendererConfig): Promise<void> {
    await this.app.init({
      canvas: config.canvas,
      width: config.width,
      height: config.height,
      backgroundColor: config.backgroundColor || 0x0a0a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true
    });

    this.app.stage.addChild(this.boardContainer);
    this.boardContainer.addChild(this.nailGraphics);
    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  // 釘を描画
  drawNail(x: number, y: number, radius: number = 4): void {
    // 釘の光沢効果
    this.nailGraphics.circle(x, y, radius);
    this.nailGraphics.fill({ color: 0x888888 });

    // ハイライト
    this.nailGraphics.circle(x - 1, y - 1, radius * 0.5);
    this.nailGraphics.fill({ color: 0xcccccc });
  }

  // 盤面の壁を描画
  drawWall(x: number, y: number, width: number, height: number, angle: number = 0): void {
    const wall = new Graphics();
    wall.rect(-width / 2, -height / 2, width, height);
    wall.fill({ color: 0x444444 });
    wall.stroke({ width: 1, color: 0x666666 });
    wall.position.set(x, y);
    wall.rotation = angle;
    this.boardContainer.addChild(wall);
  }

  // 入賞口を描画
  drawPocket(x: number, y: number, width: number, height: number, color: number = 0xffd700): void {
    const pocket = new Graphics();

    // 入賞口の背景
    pocket.rect(-width / 2, -height / 2, width, height);
    pocket.fill({ color: 0x000000 });

    // 枠線（光る効果）
    pocket.rect(-width / 2, -height / 2, width, height);
    pocket.stroke({ width: 2, color: color });

    pocket.position.set(x, y);
    this.boardContainer.addChild(pocket);
  }

  // ヘソ（始動口）を描画
  drawStartPocket(x: number, y: number): void {
    const pocket = new Graphics();

    // 装飾的なヘソ
    pocket.roundRect(-20, -8, 40, 16, 4);
    pocket.fill({ color: 0x220000 });
    pocket.stroke({ width: 2, color: 0xff3d00 });

    // 中央の穴
    pocket.rect(-12, -4, 24, 12);
    pocket.fill({ color: 0x000000 });

    pocket.position.set(x, y);
    this.boardContainer.addChild(pocket);

    // ラベル
    const style = new TextStyle({
      fontSize: 10,
      fill: 0xff3d00,
      fontWeight: 'bold'
    });
    const label = new Text({ text: 'START', style });
    label.anchor.set(0.5);
    label.position.set(x, y - 18);
    this.boardContainer.addChild(label);
  }

  // 電チューを描画
  drawElectricPocket(x: number, y: number, isOpen: boolean = false): Graphics {
    const pocket = new Graphics();

    // 電チュー本体
    pocket.roundRect(-22, -10, 44, 20, 4);
    pocket.fill({ color: 0x001122 });
    pocket.stroke({ width: 2, color: isOpen ? 0x00ff00 : 0x0066ff });

    // 開閉状態
    if (isOpen) {
      pocket.rect(-15, -5, 30, 15);
      pocket.fill({ color: 0x000000 });
    } else {
      pocket.rect(-15, -5, 30, 3);
      pocket.fill({ color: 0x333333 });
    }

    pocket.position.set(x, y);
    this.boardContainer.addChild(pocket);
    return pocket;
  }

  // アタッカーを描画
  drawAttacker(x: number, y: number, isOpen: boolean = false): Graphics {
    const attacker = new Graphics();

    // アタッカー本体
    attacker.roundRect(-35, -12, 70, 24, 6);
    attacker.fill({ color: 0x220000 });
    attacker.stroke({ width: 3, color: isOpen ? 0xff0000 : 0x660000 });

    // 開閉状態
    if (isOpen) {
      attacker.rect(-28, -6, 56, 18);
      attacker.fill({ color: 0x000000 });

      // 開放時の光るエフェクト
      attacker.rect(-28, -6, 56, 18);
      attacker.stroke({ width: 2, color: 0xff6600 });
    } else {
      attacker.rect(-28, -6, 56, 4);
      attacker.fill({ color: 0x444444 });
    }

    attacker.position.set(x, y);
    this.boardContainer.addChild(attacker);

    // ラベル
    const style = new TextStyle({
      fontSize: 10,
      fill: isOpen ? 0xff3d00 : 0x666666,
      fontWeight: 'bold'
    });
    const label = new Text({ text: 'ATTACKER', style });
    label.anchor.set(0.5);
    label.position.set(x, y - 22);
    this.boardContainer.addChild(label);

    return attacker;
  }

  // パチンコ玉を描画
  drawBall(body: Matter.Body): void {
    let graphics = this.ballGraphics.get(body.id);

    if (!graphics) {
      graphics = new Graphics();

      // 玉本体（金属的な光沢）
      graphics.circle(0, 0, 7);
      graphics.fill({ color: 0xc0c0c0 });

      // ハイライト
      graphics.circle(-2, -2, 3);
      graphics.fill({ color: 0xffffff });

      // 影
      graphics.circle(2, 2, 2);
      graphics.fill({ color: 0x888888 });

      this.boardContainer.addChild(graphics);
      this.ballGraphics.set(body.id, graphics);
    }

    graphics.position.set(body.position.x, body.position.y);
  }

  // 玉を削除
  removeBall(bodyId: number): void {
    const graphics = this.ballGraphics.get(bodyId);
    if (graphics) {
      this.boardContainer.removeChild(graphics);
      graphics.destroy();
      this.ballGraphics.delete(bodyId);
    }
  }

  // ステージ（液晶下の振り分け部分）を描画
  drawStage(x: number, y: number): void {
    const stage = new Graphics();

    // ステージの底面（傾斜）
    stage.moveTo(-60, 0);
    stage.lineTo(-20, 15);
    stage.lineTo(20, 15);
    stage.lineTo(60, 0);
    stage.lineTo(60, 5);
    stage.lineTo(-60, 5);
    stage.closePath();
    stage.fill({ color: 0x333366 });
    stage.stroke({ width: 1, color: 0x4444aa });

    stage.position.set(x, y);
    this.boardContainer.addChild(stage);
  }

  // 画面クリア（玉のみ）
  clearBalls(): void {
    this.ballGraphics.forEach((graphics) => {
      this.boardContainer.removeChild(graphics);
      graphics.destroy();
    });
    this.ballGraphics.clear();
  }
}
