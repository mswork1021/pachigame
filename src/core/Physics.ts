import Matter from 'matter-js';

export interface PhysicsConfig {
  width: number;
  height: number;
  gravity?: { x: number; y: number };
}

export class Physics {
  engine: Matter.Engine;
  world: Matter.World;
  private runner: Matter.Runner | null = null;
  private width: number;
  private height: number;

  constructor(config: PhysicsConfig) {
    this.width = config.width;
    this.height = config.height;

    this.engine = Matter.Engine.create({
      gravity: config.gravity || { x: 0, y: 0.8 }
    });
    this.world = this.engine.world;
  }

  start(): void {
    this.runner = Matter.Runner.create();
    Matter.Runner.run(this.runner, this.engine);
  }

  stop(): void {
    if (this.runner) {
      Matter.Runner.stop(this.runner);
    }
  }

  update(delta: number): void {
    Matter.Engine.update(this.engine, delta);
  }

  addBody(body: Matter.Body): void {
    Matter.Composite.add(this.world, body);
  }

  removeBody(body: Matter.Body): void {
    Matter.Composite.remove(this.world, body);
  }

  // 釘を作成
  createNail(x: number, y: number, radius: number = 4): Matter.Body {
    const nail = Matter.Bodies.circle(x, y, radius, {
      isStatic: true,
      restitution: 0.5,
      friction: 0.1,
      label: 'nail',
      render: {
        fillStyle: '#c0c0c0'
      }
    });
    this.addBody(nail);
    return nail;
  }

  // パチンコ玉を作成
  createBall(x: number, y: number, velocity?: { x: number; y: number }): Matter.Body {
    const ball = Matter.Bodies.circle(x, y, 7, {
      restitution: 0.4,
      friction: 0.05,
      frictionAir: 0.001,
      density: 0.004,
      label: 'ball',
      render: {
        fillStyle: '#c0c0c0'
      }
    });

    if (velocity) {
      Matter.Body.setVelocity(ball, velocity);
    }

    this.addBody(ball);
    return ball;
  }

  // 壁を作成
  createWall(x: number, y: number, width: number, height: number, angle: number = 0): Matter.Body {
    const wall = Matter.Bodies.rectangle(x, y, width, height, {
      isStatic: true,
      angle: angle,
      restitution: 0.3,
      friction: 0.1,
      label: 'wall',
      render: {
        fillStyle: '#333333'
      }
    });
    this.addBody(wall);
    return wall;
  }

  // 入賞口を作成（センサー）
  createPocket(x: number, y: number, width: number, height: number, label: string): Matter.Body {
    const pocket = Matter.Bodies.rectangle(x, y, width, height, {
      isStatic: true,
      isSensor: true,
      label: label,
      render: {
        fillStyle: 'rgba(255, 215, 0, 0.3)'
      }
    });
    this.addBody(pocket);
    return pocket;
  }

  // 衝突イベントのリスナー
  onCollision(callback: (pairs: Matter.Pair[]) => void): void {
    Matter.Events.on(this.engine, 'collisionStart', (event) => {
      callback(event.pairs);
    });
  }

  // ボディが画面外に出たかチェック
  isOutOfBounds(body: Matter.Body): boolean {
    return body.position.y > this.height + 50 ||
           body.position.x < -50 ||
           body.position.x > this.width + 50;
  }
}
