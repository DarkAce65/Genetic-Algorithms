export type Vector2 = [number, number];
export interface CanvasParams {
  ctx: CanvasRenderingContext2D;
  width: number;
  height: number;
}

export const MOVING_AVERAGE_ALPHA = 0.1;
export const MINIMUM_AVERAGE_SPEED = 1;
export const TICKS_TO_WAIT_FOR_STOP = 50;

export const DEFAULT_TRACK_WIDTH = 80;
export const WALL_THICKNESS = 5;

export const WALL_MASK = 0b10;
export const CAR_MASK = 0b100;
export const SENSOR_MASK = 0b1000;
export const CHECKPOINT_MASK = 0b1_0000;
