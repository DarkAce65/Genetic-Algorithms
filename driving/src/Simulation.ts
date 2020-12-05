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

interface SimulationDataPoint {
  position: Vector2;
  speed: number;
  fitness: number;
}
interface SimulationData {
  datapoints: SimulationDataPoint[];
  minSpeed: number;
  maxSpeed: number;
  bestFitness: number;
}
interface SimulationResult {
  fitness: number;
  avgSpeed: number;
}

class Simulation {
  private world: World;
  private checkpoint = 0;
  private laps = 0;

  readonly simulationData: SimulationData;
  private completed = false;
  private stoppedTicks = TICKS_TO_WAIT_FOR_STOP;

  constructor(
    readonly network: Network,
    private readonly car: Car,
    private readonly track: Track,
    private readonly finishCallback: (fitness: number) => void
  ) {
    if (network.structure.numInputs !== car.numSensors) {
      throw new Error(
        `Given network has an invalid number of inputs - must match number of sensors of car (${car.numSensors}) but got ${network.structure.numInputs}`
      );
    }
    if (network.structure.numOutputs !== 3) {
      throw new Error(
        `Given network has an invalid number of outputs - must be 3 but got ${network.structure.numOutputs}`
      );
    }

    this.simulationData = { datapoints: [], minSpeed: 0, maxSpeed: 1, bestFitness: 0 };

    this.world = new World({ gravity: p2.vec2.fromValues(0, 0) });

    this.world.on('beginContact', this.collisionHandler.bind(this));

    this.track.addToWorld(this.world);
    this.car.addToWorld(this.world);
  }

  initialize(): void {
    this.checkpoint = 0;
    this.laps = 0;
    this.simulationData.datapoints = [];
    this.simulationData.minSpeed = 0;
    this.simulationData.maxSpeed = 1;
    this.simulationData.bestFitness = 0;
    this.stoppedTicks = TICKS_TO_WAIT_FOR_STOP;

    this.car.position = p2.vec2.clone(this.track.initialPosition);
    this.car.angle = this.track.initialAngle - Math.PI / 2;

    this.simulationData.datapoints.push({
      position: p2.vec2.clone(this.car.position),
      speed: this.car.avgSpeed,
      fitness: this.fitness(),
    });
    this.completed = false;
  }

  finish(): void {
    this.completed = true;

    this.finishCallback(this.simulationData.bestFitness);
  }

  getCarTrail(): Vector2[] {
    return this.simulationData.datapoints.map((datapoint) => datapoint.position);
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
    const {
      position: prevCheckpointPosition,
      cumulativeDistance: prevCheckpointDistance,
    } = this.track.checkpoints[wrappedModulo(this.checkpoint - 1, this.track.checkpoints.length)];
    const {
      position: nextCheckpointPosition,
      trackSegmentLength: nextCheckpointSegmentLength,
    } = this.track.checkpoints[this.checkpoint];

    const [pt0x, pt0y] = prevCheckpointPosition;
    const [pt1x, pt1y] = this.car.position;
    const [pt2x, pt2y] = nextCheckpointPosition;

    const t =
      ((pt1x - pt0x) * (pt2x - pt0x) + (pt1y - pt0y) * (pt2y - pt0y)) /
      (Math.pow(pt2x - pt0x, 2) + Math.pow(pt2y - pt0y, 2));

    const distFromLastCheckpoint = t * nextCheckpointSegmentLength;

    return (
      this.laps * this.track.totalTrackLength +
      (this.checkpoint === 0 ? 0 : prevCheckpointDistance) +
      distFromLastCheckpoint
    );
  }

  tick(
    { ctx, width, height }: CanvasParams,
    netCanvasParams: CanvasParams,
    carStatusCanvasParams: CanvasParams,
    trails: Vector2[][]
  ): SimulationResult {
    if (this.completed) {
      return { fitness: this.fitness(), avgSpeed: this.car.avgSpeed };
    }

    this.world.step(1 / 60);
    if (this.stoppedTicks <= 0) {
      this.finish();
    }

    ctx.clearRect(0, 0, width, height);

    this.track.draw(ctx);

    this.drawTrails(ctx, trails);

    this.car.computeSensorIntersections(this.world);
    const inputs = this.car.getNormalizedSensorValues();
    const [throttle, brake, steer] = this.network.evaluateAndDraw(inputs, netCanvasParams);

    this.car.update(throttle, brake, steer);
    this.car.draw(ctx, steer);

    const avgSpeed = this.car.avgSpeed;
    const fitness = this.fitness();
    this.simulationData.datapoints.push({
      position: p2.vec2.clone(this.car.position),
      speed: avgSpeed,
      fitness,
    });
    this.simulationData.maxSpeed = Math.max(this.simulationData.maxSpeed, avgSpeed);
    this.simulationData.minSpeed = Math.min(this.simulationData.minSpeed, avgSpeed);
    this.simulationData.bestFitness = Math.max(this.simulationData.bestFitness, fitness);

    this.drawCarStatus(carStatusCanvasParams, [throttle, brake, steer]);

    if (Math.abs(avgSpeed) < MINIMUM_AVERAGE_SPEED) {
      this.stoppedTicks--;
    } else if (this.stoppedTicks !== TICKS_TO_WAIT_FOR_STOP) {
      this.stoppedTicks = TICKS_TO_WAIT_FOR_STOP;
    }

    return { fitness, avgSpeed };
  }

  private drawTrails(ctx: CanvasRenderingContext2D, trails: Vector2[][]) {
    for (const trail of trails) {
      if (trail.length === 0) {
        continue;
      }

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.beginPath();
      ctx.moveTo(trail[0][0], trail[0][1]);
      for (let i = 1; i < trail.length; i++) {
        ctx.lineTo(trail[i][0], trail[i][1]);
      }
      ctx.stroke();

      // Draw cross
      ctx.strokeStyle = '#ff5050';
      ctx.beginPath();
      ctx.save();
      ctx.translate(trail[trail.length - 1][0], trail[trail.length - 1][1]);
      ctx.moveTo(-4, -4);
      ctx.lineTo(4, 4);
      ctx.moveTo(-4, 4);
      ctx.lineTo(4, -4);
      ctx.stroke();
      ctx.restore();
    }

    const { datapoints } = this.simulationData;
    ctx.strokeStyle = 'aquamarine';
    ctx.beginPath();
    ctx.moveTo(datapoints[0].position[0], datapoints[0].position[1]);
    for (let i = 1; i < datapoints.length; i++) {
      const { position } = datapoints[i];
      ctx.lineTo(position[0], position[1]);
    }
    ctx.stroke();
  }

  private drawCarStatus({ ctx, width, height }: CanvasParams, [throttle, brake, steer]: number[]) {
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
