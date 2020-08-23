import p2, { Body, Box } from 'p2';

import {
  CAR_MASK,
  CHECKPOINT_MASK,
  DEFAULT_TRACK_WIDTH,
  SENSOR_MASK,
  Vector2,
  WALL_MASK,
  WALL_THICKNESS,
} from './constants';

type Checkpoint = { number: number; cumulativeDistance: number; body: Body };

type TrackPoint = { position: Vector2; width?: number };
type TrackDefinition = TrackPoint[];
export type Track = {
  walls: Body[];
  checkpoints: Checkpoint[];
  totalTrackLength: number;

  initialPosition: Vector2;
  initialAngle: number;
};

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

const wrappedModulo = (value: number, modulus: number): number =>
  ((value % modulus) + modulus) % modulus;

export const buildTrack = (trackPoints: TrackDefinition): Track => {
  if (trackPoints.length < 3) {
    throw new Error('Invalid track configuration - track requires at least 3 points');
  }

  const walls = [];
  const checkpoints = [];
  const leftPoints = [];
  const rightPoints = [];

  const initialPosition = trackPoints[0].position;
  let initialAngle = 0;

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
      initialAngle = nextAngle;
    }

    const angle = (previousAngle + nextAngle) / 2;
    const shift = p2.vec2.fromValues(Math.cos(angle), Math.sin(angle));
    p2.vec2.scale(shift, shift, trackWidth / Math.sin((previousAngle - nextAngle) / 2));
    leftPoints.push(p2.vec2.add(p2.vec2.create(), [pt1x, pt1y], shift));
    rightPoints.push(p2.vec2.sub(p2.vec2.create(), [pt1x, pt1y], shift));
  }

  let totalTrackLength = 0;
  for (let i = 0; i < trackPoints.length; i++) {
    totalTrackLength += p2.vec2.dist(
      trackPoints[i].position,
      trackPoints[(i + 1) % trackPoints.length].position
    );

    walls.push(constructWall(leftPoints[i], leftPoints[(i + 1) % trackPoints.length]));
    walls.push(constructWall(rightPoints[i], rightPoints[(i + 1) % trackPoints.length]));

    const checkpoint = {
      number: i,
      cumulativeDistance: totalTrackLength,
      body: constructCheckpoint(
        leftPoints[(i + 1) % trackPoints.length],
        rightPoints[(i + 1) % trackPoints.length]
      ),
    };
    checkpoints.push(checkpoint);
  }

  return {
    walls,
    checkpoints,
    totalTrackLength,

    initialPosition,
    initialAngle,
  };
};
