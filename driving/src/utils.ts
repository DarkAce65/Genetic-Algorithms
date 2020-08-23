import p2, { Body, Box } from 'p2';

import { Vector2, WALL_MASK } from './constants';

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export const shuffle = <T>(array: T[]): T[] => {
  // Fisher–Yates Shuffle
  let m = array.length;
  let t;
  let i;
  while (m) {
    i = Math.floor(Math.random() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
};

export const squaredSum = (array: number[]): number =>
  array.reduce((acc, value) => acc + value * value, 0);

type WallBody = Body;

export const constructWall = (pt0: Vector2, pt1: Vector2, wallThickness = 5): WallBody => {
  const [pt0x, pt0y] = pt0;
  const [pt1x, pt1y] = pt1;

  const wall = new Body({
    position: [(pt0x + pt1x) / 2, (pt0y + pt1y) / 2],
    angle: Math.atan2(pt1y - pt0y, pt1x - pt0x),
  });
  wall.addShape(
    new Box({
      width: p2.vec2.dist(pt0, pt1),
      height: wallThickness,
      collisionGroup: WALL_MASK,
    })
  );

  return wall;
};
