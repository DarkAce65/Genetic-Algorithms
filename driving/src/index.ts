import './style.scss';

import Simulator from './Simulator';
import Track from './Track';
import { Vector2 } from './constants';

const width = 800;
const height = 600;
document.getElementById('statsContainer')!.style.maxWidth = `${width}px`;
const canvas = document.getElementById('canvas') as HTMLCanvasElement;
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
ctx.scale(1, -1);
ctx.translate(0, -height);

const statWidth = 200;
const statHeight = 125;
const netCanvas = document.getElementById('net') as HTMLCanvasElement;
netCanvas.width = statWidth;
netCanvas.height = statHeight;
const netCtx = netCanvas.getContext('2d') as CanvasRenderingContext2D;

const carStatusCanvas = document.getElementById('carStatus') as HTMLCanvasElement;
carStatusCanvas.width = statWidth;
carStatusCanvas.height = statHeight;
const carStatusCtx = carStatusCanvas.getContext('2d') as CanvasRenderingContext2D;
carStatusCtx.scale(1, -1);
carStatusCtx.translate(0, -statHeight);

const simCanvasParams = { ctx, width, height };
const netCanvasParams = { ctx: netCtx, width: statWidth, height: statHeight };
const carStatusCanvasParams = { ctx: carStatusCtx, width: statWidth, height: statHeight };

const trackPoints: Vector2[] = [
  [130, 110],
  [150, 320],
  [90, 420],
  [110, 520],
  [400, 540],
  [650, 500],
  [700, 420],
  [660, 360],
  [560, 360],
  [400, 400],
  [320, 360],
  [300, 240],
  [390, 180],
  [620, 240],
  [700, 180],
  [685, 120],
  [600, 65],
  [305, 75],
];
const track = new Track(trackPoints.map((position) => ({ position })));

const simulator = new Simulator(track, simCanvasParams, netCanvasParams, carStatusCanvasParams);

document.querySelector('#start')!.addEventListener('click', () => simulator.start());
document.querySelector('#kill')!.addEventListener('click', () => simulator.killCurrentSimulation());
document.querySelector('#reset')!.addEventListener('click', () => simulator.reset());
