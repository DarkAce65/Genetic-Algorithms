import { World } from 'p2';

import Car from './Car';
import Network from './Network';
import Track, { Checkpoint } from './Track';
import {
  CHECKPOINT_MASK,
  CanvasParams,
  MINIMUM_AVERAGE_SPEED,
  TICKS_TO_WAIT_FOR_STOP,
} from './constants';
import { wrappedModulo } from './utils';

type SimulationDataPoint = { speed: number; fitness: number };

class Simulation {
  private world: World;
  private checkpoint: number;
  private laps: number;

  private simulationData: SimulationDataPoint[];
  private running = false;
  private stoppedTicks = TICKS_TO_WAIT_FOR_STOP;

  private finishCallback: (fitness: number) => void;

  constructor(
    private readonly network: Network,
    private readonly car: Car,
    private readonly track: Track
  ) {}

  bindToWorld(world: World, finishCallback: (fitness: number) => void): void {
    world.clear();

    this.track.addToWorld(world);

    world.addBody(this.car.chassis.body);
    this.car.tdv.addToWorld(world);

    world.on('beginContact', this.collisionHandler.bind(this));

    this.world = world;
    this.finishCallback = finishCallback;
  }

  start(): void {
    this.checkpoint = 0;
    this.laps = 0;
    this.simulationData = [];
    this.stoppedTicks = TICKS_TO_WAIT_FOR_STOP;

    this.car.chassis.body.position = this.track.initialPosition;
    this.car.chassis.body.angle = this.track.initialAngle - Math.PI / 2;

    this.simulationData.push({ speed: this.car.getAvgSpeed(), fitness: this.fitness() });
    this.running = true;
  }

  finish(): void {
    this.finishCallback(this.fitness());
    this.running = false;
  }

  unbind(): void {
    if (this.world === null) {
      throw new Error('Simulation is not bound to a world');
    }

    this.world.off('beginContact', this.collisionHandler);
    this.collisionHandler = null;
    this.world = null;
  }

  private collisionHandler(event: World['beginContactEvent']) {
    if (event.shapeA.collisionGroup === CHECKPOINT_MASK) {
      this.hitCheckpoint(event.bodyA as Checkpoint);
    } else if (event.shapeB.collisionGroup === CHECKPOINT_MASK) {
      this.hitCheckpoint(event.bodyB as Checkpoint);
    } else {
      this.finish();
    }
  }

  private hitCheckpoint(checkpoint: Checkpoint): void {
    if (checkpoint.index === this.checkpoint) {
      if (checkpoint.lastCheckpoint) {
        this.laps++;
        this.checkpoint = 0;
      } else {
        this.checkpoint++;
      }
    }
  }

  private fitness(): number {
    return (
      this.laps * this.track.totalTrackLength +
      (this.checkpoint === 0 ? 0 : this.track.checkpoints[this.checkpoint - 1].cumulativeDistance) +
      this.distFromLastCheckpoint()
    );
  }

  private distFromLastCheckpoint(): number {
    const [pt0x, pt0y] = this.track.checkpoints[
      wrappedModulo(this.checkpoint - 1, this.track.checkpoints.length)
    ].position;
    const [pt1x, pt1y] = this.car.chassis.body.position;
    const [pt2x, pt2y] = this.track.checkpoints[this.checkpoint].position;

    const t =
      ((pt1x - pt0x) * (pt2x - pt0x) + (pt1y - pt0y) * (pt2y - pt0y)) /
      (Math.pow(pt2x - pt0x, 2) + Math.pow(pt2y - pt0y, 2));

    return t * this.track.checkpoints[this.checkpoint].trackLength;
  }

  tick(
    { ctx, width, height }: CanvasParams,
    netCanvasParams: CanvasParams,
    fitnessCanvasParams: CanvasParams
  ): void {
    if (this.world === null) {
      throw new Error('Simulation is not bound to a world');
    }

    if (!this.running) {
      return;
    }

    this.world.step(1 / 60);
    if (this.stoppedTicks <= 0) {
      this.finish();
    }

    ctx.clearRect(0, 0, width, height);

    this.track.draw(ctx);

    const inputs = this.car.getNormalizedSensorValues();
    const [throttle, brake, steer] = this.network.evaluateAndDraw(inputs, netCanvasParams);

    this.car.update(this.world, throttle, brake, steer);
    this.car.draw(ctx, steer);

    const avgSpeed = this.car.getAvgSpeed();
    this.simulationData.push({ speed: avgSpeed, fitness: this.fitness() });
    if (Math.abs(avgSpeed) < MINIMUM_AVERAGE_SPEED) {
      this.stoppedTicks--;
    } else if (this.stoppedTicks !== TICKS_TO_WAIT_FOR_STOP) {
      this.stoppedTicks = TICKS_TO_WAIT_FOR_STOP;
    }

    this.drawFitness(fitnessCanvasParams, [throttle, brake, steer]);

    document.querySelector('#individual').innerHTML = `Fitness: ${this.fitness().toFixed(
      2
    )}, Avg. Speed: ${avgSpeed.toFixed(2)}`;
  }

  private drawFitness({ ctx, width, height }: CanvasParams, [throttle, brake, steer]: number[]) {
    ctx.clearRect(0, 0, width, height);

    ctx.fillStyle = 'white';
    ctx.fillRect(Math.min(width / 2, steer * width), 0, Math.abs(steer - 0.5) * width, height / 10);
    ctx.fillRect(width / 9, height / 10, width / 3, (throttle * height * 9) / 10);
    ctx.fillStyle = '#ff5050';
    ctx.fillRect((width * 5) / 9, height / 10, width / 3, (brake * height * 9) / 10);

    if (this.simulationData.length > 0) {
      ctx.strokeStyle = 'aqua';
      ctx.beginPath();
      let max = 1;
      for (let i = 0; i < this.simulationData.length; i++) {
        max = Math.max(max, this.simulationData[i].speed);
      }
      ctx.moveTo(0, (this.simulationData[0].speed / max) * height);
      for (let i = 1; i < this.simulationData.length; i++) {
        ctx.lineTo(
          (i / (this.simulationData.length - 1)) * width,
          (this.simulationData[i].speed / max) * height
        );
      }
      ctx.stroke();
    }
  }
}

export default Simulation;
