import { Game } from './game/Game';

// ゲーム起動
async function main() {
  console.log('紅蓮の刻 -GUREN NO TOKI- 起動中...');

  const game = new Game();

  try {
    await game.init();
    console.log('ゲーム初期化完了');
  } catch (error) {
    console.error('ゲーム初期化エラー:', error);
  }
}

// DOMContentLoaded後に起動
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
