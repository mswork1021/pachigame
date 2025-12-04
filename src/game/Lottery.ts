import { SpinResult } from './LCD';

// 図柄定義
const SYMBOLS = ['壱', '弐', '参', '四', '伍', '六', '七', '八', '九'];

export type GameMode = 'normal' | 'rush';

export interface LotteryConfig {
  // 通常時の大当り確率（分母）
  normalProbability: number;
  // 確変中の大当り確率（分母）
  rushProbability: number;
  // ST回転数
  stCount: number;
  // 確変突入率
  rushRate: number;
}

export interface JackpotResult {
  round: number;      // 何R大当りか
  isRush: boolean;    // 確変かどうか
  symbol: string;     // 揃った図柄
}

export class Lottery {
  private config: LotteryConfig;
  private mode: GameMode = 'normal';
  private rushRemaining: number = 0;
  private totalSpins: number = 0;
  private jackpotCount: number = 0;

  constructor(config?: Partial<LotteryConfig>) {
    this.config = {
      normalProbability: 319,    // 1/319
      rushProbability: 1,        // ST中は回せば当たる（演出分岐用）
      stCount: 100,              // ST100回転
      rushRate: 0.8,             // 80%が確変
      ...config
    };
  }

  // 抽選実行
  draw(): SpinResult {
    this.totalSpins++;

    const isJackpot = this.checkJackpot();
    const reachType = this.determineReachType(isJackpot);
    const symbols = this.generateSymbols(isJackpot, reachType);

    // RUSH中のカウント減少
    if (this.mode === 'rush') {
      this.rushRemaining--;
      if (this.rushRemaining <= 0 && !isJackpot) {
        this.mode = 'normal';
      }
    }

    return {
      symbols,
      isJackpot,
      reachType
    };
  }

  private checkJackpot(): boolean {
    const probability = this.mode === 'rush'
      ? this.config.rushProbability
      : this.config.normalProbability;

    // RUSH中は特殊確率（ST中の当選確率）
    if (this.mode === 'rush') {
      // ST100回で約80%継続 = 1回あたり約1.6%転落
      // 継続率80%を100回転で実現: 1 - (1-p)^100 = 0.8
      // p ≈ 0.016
      return Math.random() < 0.016;
    }

    return Math.random() < (1 / probability);
  }

  private determineReachType(isJackpot: boolean): 'normal' | 'super' | 'premium' | undefined {
    if (isJackpot) {
      // 大当り時は必ずリーチ
      const rand = Math.random();
      if (rand < 0.1) return 'premium';
      if (rand < 0.4) return 'super';
      return 'normal';
    }

    // ハズレ時のリーチ確率
    const reachChance = this.mode === 'rush' ? 0.3 : 0.08;
    if (Math.random() < reachChance) {
      const rand = Math.random();
      if (rand < 0.02) return 'premium'; // ガセプレミア（激レア）
      if (rand < 0.2) return 'super';
      return 'normal';
    }

    return undefined;
  }

  private generateSymbols(isJackpot: boolean, reachType?: string): [string, string, string] {
    if (isJackpot) {
      // 大当り：3つ揃い
      const symbolIndex = Math.floor(Math.random() * SYMBOLS.length);
      const symbol = SYMBOLS[symbolIndex];
      return [symbol, symbol, symbol];
    }

    if (reachType) {
      // リーチハズレ：2つ揃い
      const symbolIndex = Math.floor(Math.random() * SYMBOLS.length);
      const symbol = SYMBOLS[symbolIndex];

      // 3つ目は異なる図柄
      let thirdIndex = symbolIndex;
      while (thirdIndex === symbolIndex) {
        thirdIndex = Math.floor(Math.random() * SYMBOLS.length);
      }

      // ランダムにどの2つが揃うか決定
      const pattern = Math.floor(Math.random() * 3);
      if (pattern === 0) {
        return [symbol, symbol, SYMBOLS[thirdIndex]]; // 左中リーチ
      } else if (pattern === 1) {
        return [symbol, SYMBOLS[thirdIndex], symbol]; // 左右リーチ
      } else {
        return [SYMBOLS[thirdIndex], symbol, symbol]; // 中右リーチ
      }
    }

    // 通常ハズレ：バラケ目
    const indices: number[] = [];
    while (indices.length < 3) {
      const index = Math.floor(Math.random() * SYMBOLS.length);
      // リーチにならないように
      if (indices.length === 2) {
        if (index !== indices[0] && index !== indices[1]) {
          indices.push(index);
        }
      } else {
        indices.push(index);
      }
    }

    return [SYMBOLS[indices[0]], SYMBOLS[indices[1]], SYMBOLS[indices[2]]];
  }

  // 大当り処理
  processJackpot(): JackpotResult {
    this.jackpotCount++;

    // ラウンド数決定（ほとんど10R）
    const round = Math.random() < 0.9 ? 10 : 3;

    // 確変判定
    const isRush = Math.random() < this.config.rushRate;

    if (isRush) {
      this.mode = 'rush';
      this.rushRemaining = this.config.stCount;
    }

    return {
      round,
      isRush,
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
    };
  }

  // ゲッター
  getMode(): GameMode {
    return this.mode;
  }

  getRushRemaining(): number {
    return this.rushRemaining;
  }

  getTotalSpins(): number {
    return this.totalSpins;
  }

  getJackpotCount(): number {
    return this.jackpotCount;
  }

  // RUSH強制終了（演出用）
  endRush(): void {
    this.mode = 'normal';
    this.rushRemaining = 0;
  }

  // リセット
  reset(): void {
    this.mode = 'normal';
    this.rushRemaining = 0;
    this.totalSpins = 0;
    this.jackpotCount = 0;
  }
}
