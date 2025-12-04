import { Application, Graphics, Container, Text, TextStyle, BlurFilter } from 'pixi.js';

// 図柄定義
const SYMBOLS = ['壱', '弐', '参', '四', '伍', '六', '七', '八', '九'];
const SYMBOL_COLORS: { [key: string]: number } = {
  '壱': 0xff3d00,
  '弐': 0x00aaff,
  '参': 0xff3d00,
  '四': 0x00ff00,
  '伍': 0xff3d00,
  '六': 0x00aaff,
  '七': 0xffd700, // 7は金色（プレミア）
  '八': 0x00ff00,
  '九': 0xff3d00
};

export type LCDState = 'idle' | 'spinning' | 'reach' | 'battle' | 'jackpot' | 'rush';

export interface SpinResult {
  symbols: [string, string, string];
  isJackpot: boolean;
  reachType?: 'normal' | 'super' | 'premium';
}

export class LCD {
  private app: Application;
  private container: Container;
  private reelContainers: Container[] = [];
  private reelSymbols: Text[][] = [];
  private backgroundContainer: Container;
  private effectContainer: Container;
  private state: LCDState = 'idle';
  private currentSymbols: [number, number, number] = [0, 0, 0];
  private targetSymbols: [number, number, number] = [0, 0, 0];
  private spinSpeeds: [number, number, number] = [0, 0, 0];
  private initialized = false;

  constructor() {
    this.app = new Application();
    this.container = new Container();
    this.backgroundContainer = new Container();
    this.effectContainer = new Container();
  }

  async init(canvas: HTMLCanvasElement): Promise<void> {
    await this.app.init({
      canvas: canvas,
      width: 320,
      height: 240,
      backgroundColor: 0x000000,
      antialias: true
    });

    this.app.stage.addChild(this.backgroundContainer);
    this.app.stage.addChild(this.container);
    this.app.stage.addChild(this.effectContainer);

    this.createBackground();
    this.createReels();
    this.initialized = true;

    // アニメーションループ
    this.app.ticker.add(() => this.update());
  }

  private createBackground(): void {
    // 背景グラデーション
    const bg = new Graphics();
    bg.rect(0, 0, 320, 240);
    bg.fill({ color: 0x0a0a1a });
    this.backgroundContainer.addChild(bg);

    // タイトル
    const titleStyle = new TextStyle({
      fontSize: 16,
      fill: 0xff3d00,
      fontWeight: 'bold',
      dropShadow: {
        color: 0xff0000,
        blur: 10,
        distance: 0
      }
    });
    const title = new Text({ text: '紅蓮の刻', style: titleStyle });
    title.anchor.set(0.5, 0);
    title.position.set(160, 5);
    this.backgroundContainer.addChild(title);
  }

  private createReels(): void {
    const reelWidth = 80;
    const reelHeight = 160;
    const startX = 40;
    const startY = 40;

    for (let i = 0; i < 3; i++) {
      const reelContainer = new Container();
      reelContainer.position.set(startX + i * (reelWidth + 10), startY);

      // リール背景
      const reelBg = new Graphics();
      reelBg.roundRect(0, 0, reelWidth, reelHeight, 5);
      reelBg.fill({ color: 0x111122 });
      reelBg.stroke({ width: 2, color: 0x333366 });
      reelContainer.addChild(reelBg);

      // 図柄を作成（3つ表示、中央が確定図柄）
      const symbolTexts: Text[] = [];
      for (let j = 0; j < 5; j++) {
        const symbolIndex = (j + 7) % SYMBOLS.length;
        const symbol = SYMBOLS[symbolIndex];
        const style = new TextStyle({
          fontSize: 36,
          fill: SYMBOL_COLORS[symbol],
          fontWeight: 'bold',
          fontFamily: 'serif'
        });
        const text = new Text({ text: symbol, style });
        text.anchor.set(0.5);
        text.position.set(reelWidth / 2, 30 + j * 35);
        reelContainer.addChild(text);
        symbolTexts.push(text);
      }
      this.reelSymbols.push(symbolTexts);

      // マスク（上下をフェードアウト）
      const mask = new Graphics();
      mask.rect(0, 30, reelWidth, 100);
      mask.fill({ color: 0xffffff });
      reelContainer.mask = mask;
      reelContainer.addChild(mask);

      this.container.addChild(reelContainer);
      this.reelContainers.push(reelContainer);
    }

    // 確定ライン
    const line = new Graphics();
    line.moveTo(30, 120);
    line.lineTo(290, 120);
    line.stroke({ width: 2, color: 0xff3d00, alpha: 0.5 });
    this.container.addChild(line);
  }

  private update(): void {
    if (this.state === 'spinning' || this.state === 'reach') {
      this.updateReels();
    }
  }

  private updateReels(): void {
    for (let i = 0; i < 3; i++) {
      if (this.spinSpeeds[i] > 0) {
        // リール回転
        this.currentSymbols[i] += this.spinSpeeds[i] * 0.1;

        // 図柄の位置を更新
        for (let j = 0; j < this.reelSymbols[i].length; j++) {
          const symbolIndex = Math.floor(this.currentSymbols[i] + j) % SYMBOLS.length;
          const symbol = SYMBOLS[symbolIndex];
          this.reelSymbols[i][j].text = symbol;
          this.reelSymbols[i][j].style.fill = SYMBOL_COLORS[symbol];

          // 位置のアニメーション
          const offset = (this.currentSymbols[i] % 1) * 35;
          this.reelSymbols[i][j].position.y = 30 + j * 35 - offset;
        }
      }
    }
  }

  // スピン開始
  async spin(result: SpinResult): Promise<void> {
    if (this.state !== 'idle') return;

    this.state = 'spinning';
    this.spinSpeeds = [15, 15, 15];

    // 結果の図柄インデックスを設定
    this.targetSymbols = result.symbols.map(s => SYMBOLS.indexOf(s)) as [number, number, number];

    // リーチ判定
    const isReach = result.symbols[0] === result.symbols[1] ||
                    result.symbols[0] === result.symbols[2] ||
                    result.symbols[1] === result.symbols[2];

    // 各リールを順番に停止
    await this.delay(800);
    await this.stopReel(0, this.targetSymbols[0]);

    await this.delay(600);
    await this.stopReel(1, this.targetSymbols[1]);

    // リーチの場合は演出
    if (isReach && result.reachType) {
      this.state = 'reach';
      await this.playReachEffect(result.reachType);
    }

    await this.delay(isReach ? 1500 : 600);
    await this.stopReel(2, this.targetSymbols[2]);

    // 結果表示
    if (result.isJackpot) {
      this.state = 'jackpot';
      await this.playJackpotEffect();
    }

    await this.delay(500);
    this.state = 'idle';
  }

  private async stopReel(reelIndex: number, targetSymbol: number): Promise<void> {
    // 減速アニメーション
    const startSpeed = this.spinSpeeds[reelIndex];
    const duration = 300;
    const startTime = Date.now();

    return new Promise((resolve) => {
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);

        this.spinSpeeds[reelIndex] = startSpeed * (1 - easeOut);

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          this.spinSpeeds[reelIndex] = 0;
          this.currentSymbols[reelIndex] = targetSymbol;

          // 図柄を確定位置に
          for (let j = 0; j < this.reelSymbols[reelIndex].length; j++) {
            const symbolIndex = (targetSymbol + j - 2 + SYMBOLS.length) % SYMBOLS.length;
            const symbol = SYMBOLS[symbolIndex];
            this.reelSymbols[reelIndex][j].text = symbol;
            this.reelSymbols[reelIndex][j].style.fill = SYMBOL_COLORS[symbol];
            this.reelSymbols[reelIndex][j].position.y = 30 + j * 35;
          }
          resolve();
        }
      };
      animate();
    });
  }

  private async playReachEffect(type: 'normal' | 'super' | 'premium'): Promise<void> {
    // リーチテキスト表示
    const reachStyle = new TextStyle({
      fontSize: type === 'premium' ? 48 : type === 'super' ? 40 : 32,
      fill: type === 'premium' ? 0xffd700 : type === 'super' ? 0xff3d00 : 0xff6600,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 4 },
      dropShadow: {
        color: type === 'premium' ? 0xffd700 : 0xff0000,
        blur: 15,
        distance: 0
      }
    });

    const reachText = new Text({
      text: type === 'premium' ? '激熱!' : type === 'super' ? 'SUPER REACH!' : 'REACH!',
      style: reachStyle
    });
    reachText.anchor.set(0.5);
    reachText.position.set(160, 120);
    reachText.alpha = 0;
    this.effectContainer.addChild(reachText);

    // フェードイン
    await this.animateAlpha(reachText, 0, 1, 300);

    // 揺れアニメーション
    if (type === 'super' || type === 'premium') {
      this.shakeEffect(reachText, 500);
    }

    await this.delay(1000);

    // フェードアウト
    await this.animateAlpha(reachText, 1, 0, 300);
    this.effectContainer.removeChild(reachText);
  }

  private async playJackpotEffect(): Promise<void> {
    // 背景フラッシュ
    const flash = new Graphics();
    flash.rect(0, 0, 320, 240);
    flash.fill({ color: 0xff3d00 });
    flash.alpha = 0;
    this.effectContainer.addChild(flash);

    // 大当りテキスト
    const jackpotStyle = new TextStyle({
      fontSize: 48,
      fill: 0xffd700,
      fontWeight: 'bold',
      stroke: { color: 0x000000, width: 6 },
      dropShadow: {
        color: 0xffd700,
        blur: 20,
        distance: 0
      }
    });

    const jackpotText = new Text({ text: '大当り!', style: jackpotStyle });
    jackpotText.anchor.set(0.5);
    jackpotText.position.set(160, 120);
    jackpotText.scale.set(0);
    this.effectContainer.addChild(jackpotText);

    // フラッシュ＆テキスト登場
    for (let i = 0; i < 3; i++) {
      flash.alpha = 0.8;
      await this.delay(100);
      flash.alpha = 0;
      await this.delay(100);
    }

    await this.animateScale(jackpotText, 0, 1.2, 300);
    await this.animateScale(jackpotText, 1.2, 1, 100);

    await this.delay(1500);

    // クリーンアップ
    this.effectContainer.removeChild(flash);
    this.effectContainer.removeChild(jackpotText);
  }

  // 待機画面表示
  showIdle(): void {
    // 待機画面用の演出があれば追加
  }

  // RUSH表示
  showRush(remaining: number): void {
    this.state = 'rush';
    // RUSH表示の実装
  }

  getState(): LCDState {
    return this.state;
  }

  isReady(): boolean {
    return this.initialized && this.state === 'idle';
  }

  // ユーティリティ
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  private animateAlpha(obj: Container, from: number, to: number, duration: number): Promise<void> {
    return new Promise(resolve => {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        obj.alpha = from + (to - from) * progress;
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  }

  private animateScale(obj: Container, from: number, to: number, duration: number): Promise<void> {
    return new Promise(resolve => {
      const startTime = Date.now();
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        const scale = from + (to - from) * easeOut;
        obj.scale.set(scale);
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };
      animate();
    });
  }

  private shakeEffect(obj: Container, duration: number): void {
    const startTime = Date.now();
    const originalX = obj.position.x;
    const originalY = obj.position.y;

    const animate = () => {
      const elapsed = Date.now() - startTime;
      if (elapsed < duration) {
        obj.position.x = originalX + (Math.random() - 0.5) * 10;
        obj.position.y = originalY + (Math.random() - 0.5) * 10;
        requestAnimationFrame(animate);
      } else {
        obj.position.x = originalX;
        obj.position.y = originalY;
      }
    };
    animate();
  }
}
