import p2, { Body, Box, World } from 'p2';

import {
  CAR_MASK,
  CHECKPOINT_MASK,
  DEFAULT_TRACK_WIDTH,
  SENSOR_MASK,
  Vector2,
  WALL_MASK,
  WALL_THICKNESS,
} from './constants';
import { wrappedModulo } from './utils';

type Checkpoint = { number: number; cumulativeDistance: number; body: Body };

type TrackPoint = { position: Vector2; width?: number };
type TrackDefinition = TrackPoint[];

const constructWall = (point0: Vector2, point1: Vector2): Body => {
  const [pt0x, pt0y] = point0;
  const [pt1x, pt1y] = point1;

  const wall = new Body({
    position: [(pt0x + pt1x) / 2, (pt0y + pt1y) / 2],
    angle: Math.atan2(pt1y - pt0y, pt1x - pt0x),
  });
  wall.addShape(
    new Box({
      width: p2.vec2.dist(point0, point1),
      height: WALL_THICKNESS,
      collisionGroup: WALL_MASK,
      collisionMask: CAR_MASK | SENSOR_MASK,
    })
  );

  return wall;
};

const constructCheckpoint = (point0: Vector2, point1: Vector2): Body => {
  const [pt0x, pt0y] = point0;
  const [pt1x, pt1y] = point1;

  const checkpoint = new Body({
    position: [(pt0x + pt1x) / 2, (pt0y + pt1y) / 2],
    angle: Math.atan2(pt1y - pt0y, pt1x - pt0x),
  });
  checkpoint.addShape(
    new Box({
      width: p2.vec2.dist(point0, point1),
      height: 0.5,
      sensor: true,
      collisionGroup: CHECKPOINT_MASK,
      collisionMask: CAR_MASK,
    })
  );

  return checkpoint;
};

class Track {
  private readonly walls: Body[] = [];
  private readonly checkpoints: Checkpoint[] = [];

  readonly totalTrackLength: number;
  readonly initialPosition: Vector2;
  readonly initialAngle: number;

  constructor(trackPoints: TrackDefinition) {
    if (trackPoints.length < 3) {
      throw new Error('Invalid track configuration - track requires at least 3 points');
    }

    const leftPoints = [];
    const rightPoints = [];

    this.initialPosition = trackPoints[0].position;
    this.initialAngle = 0;

    for (let i = 0; i < trackPoints.length; i++) {
      const [pt0x, pt0y] = trackPoints[wrappedModulo(i - 1, trackPoints.length)].position;
      const {
        position: [pt1x, pt1y],
        width,
      } = trackPoints[i];
      const [pt2x, pt2y] = trackPoints[(i + 1) % trackPoints.length].position;

      const trackWidth = ((width ?? DEFAULT_TRACK_WIDTH) + WALL_THICKNESS) / 2;

      const previousAngle = Math.atan2(pt0y - pt1y, pt0x - pt1x);
      const nextAngle = Math.atan2(pt2y - pt1y, pt2x - pt1x);
      if (i === 0) {
        this.initialAngle = nextAngle;
      }

      const angle = (previousAngle + nextAngle) / 2;
      const shift = p2.vec2.fromValues(Math.cos(angle), Math.sin(angle));
      p2.vec2.scale(shift, shift, trackWidth / Math.sin((previousAngle - nextAngle) / 2));
      leftPoints.push(p2.vec2.add(p2.vec2.create(), [pt1x, pt1y], shift));
      rightPoints.push(p2.vec2.sub(p2.vec2.create(), [pt1x, pt1y], shift));
    }

    this.totalTrackLength = 0;
    for (let i = 0; i < trackPoints.length; i++) {
      this.totalTrackLength += p2.vec2.dist(
        trackPoints[i].position,
        trackPoints[(i + 1) % trackPoints.length].position
      );

      this.walls.push(constructWall(leftPoints[i], leftPoints[(i + 1) % trackPoints.length]));
      this.walls.push(constructWall(rightPoints[i], rightPoints[(i + 1) % trackPoints.length]));

      const checkpoint = {
        number: i,
        cumulativeDistance: this.totalTrackLength,
        body: constructCheckpoint(
          leftPoints[(i + 1) % trackPoints.length],
          rightPoints[(i + 1) % trackPoints.length]
        ),
      };
      this.checkpoints.push(checkpoint);
    }
  }

  addToWorld(world: World): void {
    for (const wall of this.walls) {
      world.addBody(wall);
    }
    for (const checkpoint of this.checkpoints) {
      world.addBody(checkpoint.body);
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = 'white';
    for (const wall of this.walls) {
      this.drawWall(ctx, wall);
    }

    ctx.strokeStyle = 'rgba(255, 80, 80, 0.3)';
    for (const checkpoint of this.checkpoints) {
      this.drawCheckpoint(ctx, checkpoint);
    }
  }

  private drawWall(ctx: CanvasRenderingContext2D, wall: Body) {
    const box = wall.shapes[0] as Box;

    ctx.beginPath();
    ctx.save();
    ctx.translate(wall.position[0], wall.position[1]);
    ctx.rotate(wall.angle);
    ctx.clearRect(-box.width / 2, -box.height / 2, box.width, box.height);
    ctx.rect(-box.width / 2, -box.height / 2, box.width, box.height);
    ctx.stroke();
    ctx.restore();
  }

  private drawCheckpoint(ctx: CanvasRenderingContext2D, checkpoint: Checkpoint) {
    const box = checkpoint.body.shapes[0] as Box;

    ctx.beginPath();
    ctx.save();
    ctx.translate(checkpoint.body.position[0], checkpoint.body.position[1]);
    ctx.rotate(checkpoint.body.angle);
    ctx.rect(-box.width / 2, -box.height / 2, box.width, box.height);
    ctx.stroke();
    ctx.restore();
  }
}

export default Track;
