import p2, { World } from 'p2';

import Car from './Car';
import Network from './Network';
import Track, { Checkpoint } from './Track';
import {
  CHECKPOINT_MASK,
  CanvasParams,
  MINIMUM_AVERAGE_SPEED,
  TICKS_TO_WAIT_FOR_STOP,
  Vector2,
} from './constants';
import { wrappedModulo } from './utils';

type SimulationDataPoint = { position: Vector2; speed: number; fitness: number };
type SimulationData = {
  datapoints: SimulationDataPoint[];
  minSpeed: number;
  maxSpeed: number;
  bestFitness: number;
};

class Simulation {
  private world: World;
  private checkpoint: number;
  private laps: number;

  private simulationData: SimulationData;
  private running = false;
  private stoppedTicks = TICKS_TO_WAIT_FOR_STOP;

  constructor(
    private readonly network: Network,
    private readonly car: Car,
    private readonly track: Track,
    private readonly finishCallback: (fitness: number) => void
  ) {
    this.world = new World({ gravity: p2.vec2.fromValues(0, 0) });

    this.world.on('beginContact', this.collisionHandler.bind(this));

    this.track.addToWorld(this.world);

    this.world.addBody(this.car.chassis.body);
    this.car.tdv.addToWorld(this.world);
  }

  start(): void {
    this.checkpoint = 0;
    this.laps = 0;
    this.simulationData = { datapoints: [], minSpeed: 0, maxSpeed: 1, bestFitness: 0 };
    this.stoppedTicks = TICKS_TO_WAIT_FOR_STOP;

    this.car.chassis.body.position = p2.vec2.clone(this.track.initialPosition);
    this.car.chassis.body.angle = this.track.initialAngle - Math.PI / 2;

    this.simulationData.datapoints.push({
      position: p2.vec2.clone(this.car.chassis.body.position),
      speed: this.car.getAvgSpeed(),
      fitness: this.fitness(),
    });
    this.running = true;
  }

  finish(): void {
    this.running = false;

    this.finishCallback(this.simulationData.bestFitness);
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
    if (!this.running) {
      return;
    }

    this.world.step(1 / 60);
    if (this.stoppedTicks <= 0) {
      this.finish();
    }

    ctx.clearRect(0, 0, width, height);

    this.track.draw(ctx);

    const { datapoints } = this.simulationData;
    ctx.beginPath();
    ctx.moveTo(datapoints[0].position[0], datapoints[0].position[1]);
    for (let i = 1; i < datapoints.length; i++) {
      const { position } = datapoints[i];
      ctx.strokeStyle = 'aquamarine';
      ctx.lineTo(position[0], position[1]);
    }
    ctx.stroke();

    const inputs = this.car.getNormalizedSensorValues();
    const [throttle, brake, steer] = this.network.evaluateAndDraw(inputs, netCanvasParams);

    this.car.update(this.world, throttle, brake, steer);
    this.car.draw(ctx, steer);

    const avgSpeed = this.car.getAvgSpeed();
    const fitness = this.fitness();
    this.simulationData.datapoints.push({
      position: p2.vec2.clone(this.car.chassis.body.position),
      speed: avgSpeed,
      fitness,
    });
    this.simulationData.maxSpeed = Math.max(this.simulationData.maxSpeed, avgSpeed);
    this.simulationData.minSpeed = Math.min(this.simulationData.minSpeed, avgSpeed);
    this.simulationData.bestFitness = Math.max(this.simulationData.bestFitness, fitness);

    this.drawFitness(fitnessCanvasParams, [throttle, brake, steer]);

    if (Math.abs(avgSpeed) < MINIMUM_AVERAGE_SPEED) {
      this.stoppedTicks--;
    } else if (this.stoppedTicks !== TICKS_TO_WAIT_FOR_STOP) {
      this.stoppedTicks = TICKS_TO_WAIT_FOR_STOP;
    }

    document.querySelector(
      '#genetic'
    ).innerHTML = `Generation: ${0}, Genome: ${0}<br>Best Fitness: ${this.simulationData.bestFitness.toFixed(
      2
    )}`;
    document.querySelector('#individual').innerHTML = `Fitness: ${fitness.toFixed(
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

    const { datapoints } = this.simulationData;
    if (datapoints.length > 0) {
      const { minSpeed, maxSpeed } = this.simulationData;
      if (minSpeed < 0) {
        ctx.strokeStyle = 'gray';
        ctx.beginPath();
        ctx.moveTo(0, (-minSpeed / (maxSpeed - minSpeed)) * height);
        ctx.lineTo(width, (-minSpeed / (maxSpeed - minSpeed)) * height);
        ctx.stroke();
      }

      ctx.strokeStyle = 'aqua';
      ctx.beginPath();
      ctx.moveTo(0, ((datapoints[0].speed - minSpeed) / (maxSpeed - minSpeed)) * height);
      for (let i = 1; i < datapoints.length; i++) {
        ctx.lineTo(
          (i / (datapoints.length - 1)) * width,
          ((datapoints[i].speed - minSpeed) / (maxSpeed - minSpeed)) * height
        );
      }
      ctx.stroke();
    }
  }
}

export default Simulation;
