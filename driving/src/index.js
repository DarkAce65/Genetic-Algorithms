import './style.scss';

import chroma from 'chroma-js';
import p2 from 'p2';

import { shuffle, squaredSum } from './utils';

let tickId = false;
const numInputNodes = 3;
const numHiddenNodes = 10;
const numOutputNodes = 3;
const mutationChance = 0.1;
const mutationAmount = 0.1;
const speedAvgWindow = 50;

const sensorDist = 120;
const sensorAngle = (35 * Math.PI) / 180;
const sensorCos = sensorDist * Math.cos(sensorAngle);
const sensorSin = sensorDist * Math.sin(sensorAngle);

let data = [];
let trails = [];
let fitnessData = [];
let generation = 0;
let genome = 0;
let currentIndividual;
let bestFitness = 0;

const width = 800;
const height = 600;
document.getElementById('stats').style.width = `${width}px`;
const canvas = document.getElementById('canvas');
canvas.width = width;
canvas.height = height;
const ctx = canvas.getContext('2d');
ctx.scale(1, -1);
ctx.translate(0, -height);

const statWidth = 200;
const statHeight = 125;
const netCanvas = document.getElementById('net');
netCanvas.width = statWidth;
netCanvas.height = statHeight;
const netCtx = netCanvas.getContext('2d');
const netNodeColor = chroma.scale(['aquamarine', '#222222', 'white']).domain([-1, 1]);
const netWeightColor = chroma.scale(['aquamarine', '#222222', 'white']).domain([-1, 1]);

const fitnessCanvas = document.getElementById('fitness');
fitnessCanvas.width = statWidth;
fitnessCanvas.height = statHeight;
const fitnessCtx = fitnessCanvas.getContext('2d');
fitnessCtx.scale(1, -1);
fitnessCtx.translate(0, -statHeight);

const world = new p2.World({ gravity: [0, 0] });
const wallGroup = 0b10;
const checkpointGroup = 0b100;
let walls = [];
let checkpoints = [];
const track = [
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
  [450, 200],
  [620, 240],
  [700, 180],
  [685, 120],
  [600, 65],
  [305, 75],
];
// const track = [
//   [130, 110],
//   [150, 320],
//   [90, 420],
//   [110, 520],
//   [400, 540],
//   [650, 500],
//   [700, 420],
//   [660, 360],
//   [600, 65],
//   [305, 75]
// ];
let trackLengths = [];
let startingPosition = [width / 2, height / 2];
let startingAngle = 0;

const Car = function (bodyWidth, bodyHeight) {
  const chassisBody = new p2.Body({
    mass: 1,
    position: p2.vec2.clone(startingPosition),
    angle: startingAngle,
  });
  const boxShape = new p2.Box({
    width: bodyWidth,
    height: bodyHeight,
    collisionMask: wallGroup | checkpointGroup,
  });
  chassisBody.addShape(boxShape);

  const vehicle = new p2.TopDownVehicle(chassisBody);
  const flWheel = vehicle.addWheel({
    localPosition: [-bodyWidth / 2, bodyHeight / 2],
  });
  const frWheel = vehicle.addWheel({
    localPosition: [bodyWidth / 2, bodyHeight / 2],
  });
  const blWheel = vehicle.addWheel({
    localPosition: [-bodyWidth / 2, -bodyHeight / 2],
  });
  const brWheel = vehicle.addWheel({
    localPosition: [bodyWidth / 2, -bodyHeight / 2],
  });
  flWheel.setSideFriction(400);
  frWheel.setSideFriction(400);
  blWheel.setSideFriction(300);
  brWheel.setSideFriction(300);

  flWheel.setBrakeForce(20);
  frWheel.setBrakeForce(20);

  const lSensor = new p2.Ray({
    mode: p2.Ray.CLOSEST,
    collisionMask: wallGroup,
  });
  const fSensor = new p2.Ray({
    mode: p2.Ray.CLOSEST,
    collisionMask: wallGroup,
  });
  const rSensor = new p2.Ray({
    mode: p2.Ray.CLOSEST,
    collisionMask: wallGroup,
  });

  this.tdv = vehicle;
  this.chassis = {
    body: chassisBody,
    box: boxShape,
  };
  this.wheels = [flWheel, frWheel, blWheel, brWheel];
  this.lSensor = lSensor;
  this.fSensor = fSensor;
  this.rSensor = rSensor;

  this.speeds = [];
  this.avgSpeed = 0;
  this.steer = 0.5;
  this.throttle = 0;
  this.brake = 0;
};

Car.prototype.getDistances = function () {
  const distances = [1, 1, 1];
  const result = new p2.RaycastResult();
  world.raycast(result, this.lSensor);
  drawSensor(result, this.lSensor);
  if (result.hasHit()) {
    distances[0] = result.getHitDistance(this.lSensor) / sensorDist;
  }
  result.reset();
  world.raycast(result, this.fSensor);
  drawSensor(result, this.fSensor);
  if (result.hasHit()) {
    distances[1] = result.getHitDistance(this.fSensor) / sensorDist;
  }
  result.reset();
  world.raycast(result, this.rSensor);
  drawSensor(result, this.rSensor);
  if (result.hasHit()) {
    distances[2] = result.getHitDistance(this.rSensor) / sensorDist;
  }

  return distances;
};

Car.prototype.update = function () {
  this.speeds.push((this.wheels[2].getSpeed() + this.wheels[3].getSpeed()) / 2);
  while (this.speeds.length > speedAvgWindow) {
    this.speeds.shift();
  }

  let sum = 0;
  for (let i = 0; i < this.speeds.length; i++) {
    sum += this.speeds[i];
  }
  this.avgSpeed = sum / this.speeds.length;

  const steerValue = 0.63 * -(this.steer * 2 - 1);
  const engineForce = 150 * this.throttle;
  const brakeForce = 150 * this.brake;

  this.wheels[0].steerValue = steerValue;
  this.wheels[1].steerValue = steerValue;

  this.wheels[2].engineForce = engineForce;
  this.wheels[3].engineForce = engineForce;

  this.wheels[2].setBrakeForce(brakeForce);
  this.wheels[3].setBrakeForce(brakeForce);

  const w = (this.chassis.box.width * 9) / 10;
  const h = (this.chassis.box.height * 9) / 10;
  const sensorPositions = [];
  sensorPositions.push([-w / 2, h / 2]);
  sensorPositions.push([0, h / 2]);
  sensorPositions.push([w / 2, h / 2]);
  sensorPositions.push([-w / 2 - sensorCos, h / 2 + sensorSin]);
  sensorPositions.push([0, h / 2 + sensorDist]);
  sensorPositions.push([w / 2 + sensorCos, h / 2 + sensorSin]);
  for (let i = 0; i < sensorPositions.length; i++) {
    p2.vec2.rotate(sensorPositions[i], sensorPositions[i], this.chassis.body.angle);
    p2.vec2.add(sensorPositions[i], sensorPositions[i], this.chassis.body.position);
  }

  this.lSensor.from = sensorPositions[0];
  this.lSensor.to = sensorPositions[3];
  this.fSensor.from = sensorPositions[1];
  this.fSensor.to = sensorPositions[4];
  this.rSensor.from = sensorPositions[2];
  this.rSensor.to = sensorPositions[5];

  this.lSensor.update();
  this.fSensor.update();
  this.rSensor.update();
};

Car.prototype.draw = function () {
  ctx.strokeStyle = 'white';
  const x = this.chassis.body.position[0];
  const y = this.chassis.body.position[1];
  const w = this.chassis.box.width;
  const h = this.chassis.box.height;

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(this.chassis.body.angle);

  ctx.translate(-w / 2, -h / 2);
  ctx.fillStyle = 'rgba(18, 18, 18, 0.8)';
  ctx.fillRect(0, 0, w, h);
  ctx.beginPath();
  ctx.rect(0, 0, w, h);
  ctx.translate(w / 2, h / 2);

  const wheelWidth = w / 6;
  const wheelHeight = h / 6;
  for (let i = 0; i < this.wheels.length; i++) {
    const wheel = this.wheels[i];
    const wx = wheel.localPosition[0];
    const wy = Math.sign(wheel.localPosition[1]) * (Math.abs(wheel.localPosition[1]) - wheelHeight);

    ctx.save();
    ctx.translate(wx, wy);
    if (i < 2) {
      ctx.rotate(0.63 * -(this.steer * 2 - 1));
    }
    ctx.translate(-wheelWidth / 2, -wheelHeight / 2);

    ctx.rect(0, 0, wheelWidth, wheelHeight);
    ctx.restore();
  }

  ctx.stroke();
  ctx.restore();
};

const Individual = function (p0, p1) {
  this.inputLayerWeights = [];
  this.hiddenLayerWeights = [];

  if (p0 && p1) {
    for (let i = 0; i < numInputNodes * numHiddenNodes; i++) {
      if (Math.random() < 0.5) {
        this.inputLayerWeights.push(p0.inputLayerWeights[i]);
      } else {
        this.inputLayerWeights.push(p1.inputLayerWeights[i]);
      }

      if (Math.random() < mutationChance) {
        let v = this.inputLayerWeights[i];
        v += (Math.random() * 2 - 1) * mutationAmount;
        v = Math.max(-1, Math.min(1, v));
        this.inputLayerWeights[i] = v;
      }
    }
    for (let i = 0; i < numHiddenNodes * numOutputNodes; i++) {
      if (Math.random() < 0.5) {
        this.hiddenLayerWeights.push(p0.hiddenLayerWeights[i]);
      } else {
        this.hiddenLayerWeights.push(p1.hiddenLayerWeights[i]);
      }

      if (Math.random() < mutationChance) {
        let v = this.inputLayerWeights[i];
        v += (Math.random() * 2 - 1) * mutationAmount;
        v = Math.max(-1, Math.min(1, v));
        this.inputLayerWeights[i] = v;
      }
    }
  } else {
    for (let i = 0; i < numInputNodes * numHiddenNodes; i++) {
      this.inputLayerWeights.push(Math.random() * 2 - 1);
    }
    for (let i = 0; i < numHiddenNodes * numOutputNodes; i++) {
      this.hiddenLayerWeights.push(Math.random() * 2 - 1);
    }
  }
  this.weightsSquared =
    (this.inputLayerWeights.reduce(squaredSum) + this.hiddenLayerWeights.reduce(squaredSum)) /
    numHiddenNodes /
    (numInputNodes + numOutputNodes);

  this.car = new Car(20, 40);
  this.laps = 0;
  this.checkpoint = 0;
  this.finished = false;
};

Individual.prototype.loadWeights = function (input, hidden) {
  this.inputLayerWeights = input;
  this.hiddenLayerWeights = hidden;
};

Individual.prototype.setSimulation = function () {
  world.clear();
  world.gravity = [0, 0];

  addTrack();

  this.car = new Car(20, 40);
  trails.push([p2.vec2.clone(this.car.chassis.body.position)]);
  world.addBody(this.car.chassis.body);
  this.car.tdv.addToWorld(world);

  drawNetWeights(this);
  drawNetNodes(
    Array(numInputNodes).fill(0),
    Array(numHiddenNodes).fill(0),
    Array(numOutputNodes).fill(0)
  );
  fitnessData = [];
  this.laps = 0;
  this.checkpoint = 0;
  this.finished = false;

  currentIndividual = this;
};

Individual.prototype.update = function () {
  this.car.update();
  fitnessData.push({
    speed: this.car.avgSpeed,
  });

  if (this.car.speeds.length === speedAvgWindow && this.car.avgSpeed < 1) {
    bestFitness = Math.max(bestFitness, this.fitness());
    this.finished = true;
  }

  const inputLayer = this.car.getDistances();
  const hiddenLayer = Array(numHiddenNodes).fill(0);
  const outputLayer = Array(numOutputNodes).fill(0);

  for (let i = 0; i < numHiddenNodes; i++) {
    for (let j = 0; j < numInputNodes; j++) {
      hiddenLayer[i] += inputLayer[j] * this.inputLayerWeights[i * numInputNodes + j];
    }
  }

  for (let i = 0; i < numOutputNodes; i++) {
    for (let j = 0; j < numHiddenNodes; j++) {
      outputLayer[i] += hiddenLayer[j] * this.hiddenLayerWeights[i * numHiddenNodes + j];
    }
  }

  for (let i = 0; i < numOutputNodes; i++) {
    outputLayer[i] = Math.min(Math.max(0, Math.abs(outputLayer[i])), 1);
  }

  drawNetNodes(inputLayer, hiddenLayer, outputLayer);
  this.car.steer = outputLayer[0];
  this.car.throttle = outputLayer[1];
  this.car.brake = outputLayer[2];

  trails[genome].push(p2.vec2.clone(this.car.chassis.body.position));
  document.querySelector(
    '#genetic'
  ).innerHTML = `Generation: ${generation}, Genome: ${genome}<br>Best Fitness: ${bestFitness.toFixed(
    2
  )}`;
  document.querySelector('#individual').innerHTML = `Fitness: ${this.fitness().toFixed(
    2
  )}, Avg. Speed: ${this.car.avgSpeed.toFixed(2)}`;
};

Individual.prototype.distFromLastCheckpoint = function () {
  const pt0 = this.car.chassis.body.position;
  const pt1 = checkpoints[this.checkpoint].position;
  const pt2 = checkpoints[this.checkpoint + 1].position;

  const k = (pt2[1] - pt1[1]) * (pt0[0] - pt1[0]) - (pt2[0] - pt1[0]) * (pt0[1] - pt1[1]);
  const k2 = k / (Math.pow(pt2[1] - pt1[1], 2) + Math.pow(pt2[0] - pt1[0], 2));
  const pt3 = [pt0[0] - k2 * (pt2[1] - pt1[1]), pt0[1] + k2 * (pt2[0] - pt1[0])];

  const dist = p2.vec2.dist(pt1, pt3);
  if (
    Math.min(pt1[0], pt2[0]) <= pt3[0] &&
    pt3[0] <= Math.max(pt1[0], pt2[0]) &&
    Math.min(pt1[1], pt2[1]) <= pt3[1] &&
    pt3[1] <= Math.max(pt1[1], pt2[1])
  ) {
    return dist;
  }
  return -dist;
};

Individual.prototype.fitness = function () {
  return (
    this.laps * 10_000 +
    (trackLengths[this.checkpoint] + this.distFromLastCheckpoint()) / this.weightsSquared
  );
};

function buildWall(pt0, pt1) {
  const wall = new p2.Body({
    position: [(pt0[0] + pt1[0]) / 2, (pt0[1] + pt1[1]) / 2],
    angle: Math.atan2(pt1[1] - pt0[1], pt1[0] - pt0[0]),
  });
  wall.addShape(
    new p2.Box({
      width: p2.vec2.dist(pt0, pt1),
      height: 5,
      collisionGroup: wallGroup,
    })
  );

  return wall;
}

function buildCheckpoint(pt0, pt1) {
  const checkpoint = new p2.Body({
    position: [(pt0[0] + pt1[0]) / 2, (pt0[1] + pt1[1]) / 2],
    angle: Math.atan2(pt1[1] - pt0[1], pt1[0] - pt0[0]),
  });
  checkpoint.addShape(
    new p2.Box({
      width: p2.vec2.dist(pt0, pt1),
      height: 0.5,
      sensor: true,
      collisionGroup: checkpointGroup,
    })
  );

  return checkpoint;
}

function buildTrack(trackPoints) {
  if (trackPoints.length > 1) {
    walls = [];
    checkpoints = [];
    trackLengths = [];

    const points = trackPoints.slice(0);
    const pathWidth = 80;

    points.push(points[0]);
    points.push(points[1]);
    trackLengths.push(0);

    const innerPoints = [];
    const outerPoints = [];

    const [x0, y0] = points[0];
    const [x1, y1] = points[1];
    let prevAngle = Math.atan2(y1 - y0, x1 - x0);
    startingPosition = points[0];
    startingAngle = prevAngle - Math.PI / 2;

    for (let i = 1; i < points.length - 1; i++) {
      trackLengths[i] = p2.vec2.dist(points[i - 1], points[i]) + trackLengths[i - 1];
    }

    for (let i = 0; i < points.length - 1; i++) {
      const [px0, py0] = points[i];
      const [px1, py1] = points[i + 1];

      const angle = Math.atan2(py1 - py0, px1 - px0);
      const pathAngle = Math.PI + angle - prevAngle;

      const shift = [Math.cos(pathAngle / 2 + prevAngle), Math.sin(pathAngle / 2 + prevAngle)];
      p2.vec2.scale(shift, shift, (pathWidth + 5) / 2 / Math.sin(pathAngle / 2));

      const inPt = p2.vec2.add([0, 0], points[i], shift);
      const outPt = p2.vec2.sub([0, 0], points[i], shift);

      innerPoints.push(inPt);
      outerPoints.push(outPt);

      if (i === points.length - 2) {
        innerPoints[0] = inPt;
        outerPoints[0] = outPt;
        const checkpoint = buildCheckpoint(inPt, outPt);
        checkpoint.number = 0;
        checkpoints[0] = checkpoint;
      } else {
        const checkpoint = buildCheckpoint(inPt, outPt);
        checkpoint.number = checkpoints.length;
        checkpoints.push(checkpoint);
      }

      prevAngle = angle;
    }

    for (let i = 0; i < innerPoints.length - 1; i++) {
      walls.push(buildWall(innerPoints[i], innerPoints[i + 1]));
    }
    for (let i = 0; i < outerPoints.length - 1; i++) {
      walls.push(buildWall(outerPoints[i], outerPoints[i + 1]));
    }
  }

  const top = new p2.Body({ position: [width / 2, 0] });
  top.addShape(
    new p2.Box({
      width,
      height: 10,
      collisionGroup: wallGroup,
    })
  );
  walls.push(top);
  const bottom = new p2.Body({ position: [width / 2, height] });
  bottom.addShape(
    new p2.Box({
      width,
      height: 10,
      collisionGroup: wallGroup,
    })
  );
  walls.push(bottom);
  const left = new p2.Body({ position: [0, height / 2] });
  left.addShape(
    new p2.Box({
      width: 10,
      height,
      collisionGroup: wallGroup,
    })
  );
  walls.push(left);
  const right = new p2.Body({ position: [width, height / 2] });
  right.addShape(
    new p2.Box({
      width: 10,
      height,
      collisionGroup: wallGroup,
    })
  );
  walls.push(right);
}

function addTrack() {
  for (let i = 0; i < walls.length; i++) {
    world.addBody(walls[i]);
  }
  for (let i = 0; i < checkpoints.length; i++) {
    world.addBody(checkpoints[i]);
  }
}

function drawWall(wall) {
  ctx.strokeStyle = 'white';
  ctx.beginPath();
  ctx.save();
  ctx.translate(wall.position[0], wall.position[1]);
  ctx.rotate(wall.angle);
  ctx.clearRect(
    -wall.shapes[0].width / 2,
    -wall.shapes[0].height / 2,
    wall.shapes[0].width,
    wall.shapes[0].height
  );
  ctx.rect(
    -wall.shapes[0].width / 2,
    -wall.shapes[0].height / 2,
    wall.shapes[0].width,
    wall.shapes[0].height
  );
  ctx.stroke();
  ctx.restore();
}

function drawSensor(result, ray) {
  ctx.strokeStyle = '#ff5050';
  ctx.beginPath();
  ctx.moveTo(ray.from[0], ray.from[1]);
  ctx.lineTo(ray.to[0], ray.to[1]);
  ctx.stroke();

  const hitPoint = p2.vec2.create();
  result.getHitPoint(hitPoint, ray);

  if (result.hasHit()) {
    ctx.beginPath();
    ctx.arc(hitPoint[0], hitPoint[1], 5, 0, 2 * Math.PI);
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.moveTo(hitPoint[0], hitPoint[1]);
  ctx.lineTo(hitPoint[0] + result.normal[0] * 10, hitPoint[1] + result.normal[1] * 10);
  ctx.stroke();
}

function drawCheckpoint(checkpoint) {
  ctx.beginPath();
  ctx.save();
  ctx.translate(checkpoint.position[0], checkpoint.position[1]);
  ctx.rotate(checkpoint.angle);
  ctx.rect(
    -checkpoint.shapes[0].width / 2,
    -checkpoint.shapes[0].height / 2,
    checkpoint.shapes[0].width,
    checkpoint.shapes[0].height
  );
  ctx.stroke();
  ctx.restore();
}

function drawCross(pt) {
  ctx.strokeStyle = '#ff5050';
  ctx.beginPath();
  ctx.save();
  ctx.translate(pt[0], pt[1]);
  ctx.moveTo(-4, -4);
  ctx.lineTo(4, 4);
  ctx.moveTo(-4, 4);
  ctx.lineTo(4, -4);
  ctx.stroke();
  ctx.restore();
}

function drawFitness(individual) {
  fitnessCtx.clearRect(0, 0, statWidth, statHeight);

  fitnessCtx.fillStyle = 'white';
  fitnessCtx.fillRect(
    Math.min(statWidth / 2, individual.car.steer * statWidth),
    0,
    Math.abs(individual.car.steer - 0.5) * statWidth,
    statHeight / 10
  );
  fitnessCtx.fillRect(
    statWidth / 9,
    statHeight / 10,
    statWidth / 3,
    (individual.car.throttle * statHeight * 9) / 10
  );
  fitnessCtx.fillStyle = '#ff5050';
  fitnessCtx.fillRect(
    (statWidth * 5) / 9,
    statHeight / 10,
    statWidth / 3,
    (individual.car.brake * statHeight * 9) / 10
  );

  fitnessCtx.strokeStyle = 'aqua';
  fitnessCtx.beginPath();
  let max = 0;
  for (let i = 0; i < fitnessData.length; i++) {
    max = Math.max(max, fitnessData[i].speed);
  }
  fitnessCtx.moveTo(0, (fitnessData[0].speed / max) * statHeight);
  for (let i = 1; i < fitnessData.length; i++) {
    fitnessCtx.lineTo(
      (i / fitnessData.length) * statWidth,
      (fitnessData[i].speed / max) * statHeight
    );
  }
  fitnessCtx.stroke();
}

function drawNetWeights(individual) {
  netCtx.clearRect(0, 0, statWidth, statHeight);

  for (let i = 0; i < numInputNodes; i++) {
    const p = (i + 0.5) / numInputNodes;
    for (let j = 0; j < numHiddenNodes; j++) {
      const pn = (j + 0.5) / numHiddenNodes;
      const w = individual.inputLayerWeights[i * numHiddenNodes + j];
      netCtx.strokeStyle = netWeightColor(w);
      netCtx.beginPath();
      netCtx.moveTo(30, p * statHeight);
      netCtx.lineTo(statWidth / 2, pn * statHeight);
      netCtx.stroke();
    }
  }
  for (let i = 0; i < numHiddenNodes; i++) {
    const p = (i + 0.5) / numHiddenNodes;
    for (let j = 0; j < numOutputNodes; j++) {
      const pn = (j + 0.5) / numOutputNodes;
      const w = individual.hiddenLayerWeights[i * numOutputNodes + j];
      netCtx.strokeStyle = netWeightColor(w);
      netCtx.beginPath();
      netCtx.moveTo(statWidth / 2, p * statHeight);
      netCtx.lineTo(statWidth - 30, pn * statHeight);
      netCtx.stroke();
    }
  }
}

function drawNetNodes(input, hidden, output) {
  for (let i = 0; i < input.length; i++) {
    const p = (i + 0.5) / input.length;
    const w = input[i];
    netCtx.fillStyle = netNodeColor(w);
    netCtx.beginPath();
    netCtx.arc(30, p * statHeight, 5, 0, 2 * Math.PI);
    netCtx.fill();
  }
  for (let i = 0; i < hidden.length; i++) {
    const p = (i + 0.5) / hidden.length;
    const w = hidden[i];
    netCtx.fillStyle = netNodeColor(w);
    netCtx.beginPath();
    netCtx.arc(statWidth / 2, p * statHeight, 5, 0, 2 * Math.PI);
    netCtx.fill();
  }
  for (let i = 0; i < output.length; i++) {
    const p = (i + 0.5) / output.length;
    const w = output[i];
    netCtx.fillStyle = netNodeColor(w);
    netCtx.beginPath();
    netCtx.arc(statWidth - 30, p * statHeight, 5, 0, 2 * Math.PI);
    netCtx.fill();
  }
}

function makeNewPopulation() {
  trails = [];
  genome = 0;
  if (generation === 0) {
    data = [];
    for (let i = 0; i < 20; i++) {
      data.push(new Individual());
    }
    // data[0].loadWeights([-0.7733835869223846, 0.6912134550870966, 0.5200670862577853, 0.010066281266006852, -0.5835689638660787, 0.8593150302810204, 0.26383433483466945, 0.9188772623254501, 0.31082387838616016, -0.9230020957835063, -0.7608622651918358, 0.30120385825322604, -0.14702176464584205, 0.7945683676145202, 0.007116911217986167], [0.9611058622695274, 0.4453658472827804, 0.5119108361151719, 0.3207568399123908, -0.4422832359833526, -0.7372888053877926, -0.1949370821845664, 0.874614217636968, -0.7331837892749098, 0.9683396872537071, 0.16838989173208696, 0.19111659656828306, -0.2644370555293081, -0.07536544694538527, 0.6761137178251246]);
    // data[0].loadWeights(
    //   [
    //     -0.15250313818875572,
    //     -0.9057243150330836,
    //     0.07720203547420974,
    //     0.794598150258994,
    //     -0.22613064730224908,
    //     0.4087367394157919,
    //     -0.6681367325689058,
    //     0.4864668894452464,
    //     0.14084754079052397,
    //     -0.4313446225353572,
    //     -0.35481136606928,
    //     0.29799390850455976,
    //     -0.7615523974782925,
    //     0.3390017137403778,
    //     0.7786633451532937,
    //     -0.7982191477913647,
    //     -0.5956880840364096,
    //     -0.1568186036010379,
    //     0.45976230821022424,
    //     0.39805169111384336,
    //     -0.0712561051290046,
    //     -0.8620710320323439,
    //     -0.7730529203290846,
    //     -0.5098758202885376,
    //     -0.3199874171574249,
    //     0.5868894075847007,
    //     -0.8587388854772351,
    //     0.6133446786028228,
    //     -0.15712503907777947,
    //     0.4006131002803923,
    //   ],
    //   [
    //     -0.8342930068528522,
    //     0.026601683539390075,
    //     0.8593502325127136,
    //     0.046895265392731256,
    //     0.9721326518328139,
    //     0.8941021369932631,
    //     0.14010080431076588,
    //     0.24210951922250912,
    //     -0.6112207280941877,
    //     0.4089161825094696,
    //     0.9065584742149526,
    //     0.07807753466752976,
    //     -0.08565813844354864,
    //     0.44603231509810803,
    //     -0.8980875101118448,
    //     0.8854887090896308,
    //     0.5735409176282764,
    //     -0.5836261830862255,
    //     0.3787693065880753,
    //     -0.3314474113343935,
    //     -0.536300642297451,
    //     -0.4748664543821164,
    //     0.8594491709052401,
    //     0.9250256938890045,
    //     0.9734591542659776,
    //     -0.7483233694498557,
    //     -0.4567446986639936,
    //     0.6266938180999602,
    //     0.313141239367388,
    //     -0.6054635034140432,
    //   ]
    // );
  } else {
    const datalen = data.length;
    data = data.sort(function (a, b) {
      return b.fitness() - a.fitness();
    });

    let breeders = data.slice(0, Math.max(2, ~~(datalen * 0.15)));
    data = [breeders[0]];
    for (let i = data.length; i < datalen - 1; i++) {
      breeders = shuffle(breeders);
      data.push(new Individual(breeders[0], breeders[1]));
    }
    data.push(new Individual());
  }
}

function tick() {
  world.step(1 / 60);
  ctx.clearRect(0, 0, width, height);

  for (let i = 0; i < walls.length; i++) {
    drawWall(walls[i]);
  }
  for (let i = 0; i < checkpoints.length; i++) {
    ctx.strokeStyle = 'rgba(255, 80, 80, 0.3)';
    if (currentIndividual && currentIndividual.checkpoint.number >= i) {
      ctx.strokeStyle = '#ff5050';
    }
    drawCheckpoint(checkpoints[i]);
  }

  for (let i = 0; i < trails.length; i++) {
    ctx.strokeStyle = i === trails.length - 1 ? 'aquamarine' : 'rgba(255, 255, 255, 0.15)';
    ctx.beginPath();
    ctx.moveTo(trails[i][0][0], trails[i][0][1]);
    for (let j = 1; j < trails[i].length; j++) {
      ctx.lineTo(trails[i][j][0], trails[i][j][1]);
    }
    ctx.stroke();
    if (i !== genome) {
      drawCross(trails[i][trails[i].length - 1]);
    }
  }

  if (currentIndividual) {
    currentIndividual.update();
    currentIndividual.car.draw();
    drawFitness(currentIndividual);

    if (currentIndividual.finished) {
      genome++;
      if (genome >= data.length) {
        generation++;
        makeNewPopulation();
      }

      currentIndividual = data[genome];
      currentIndividual.setSimulation();
      document.querySelector(
        '#genetic'
      ).innerHTML = `Generation: ${generation}, Genome: ${genome}<br>Best Fitness: ${bestFitness.toFixed(
        2
      )}`;
    }
  }

  tickId = requestAnimationFrame(tick);
}

function start() {
  if (!tickId) {
    data[0].setSimulation();
    document.querySelector(
      '#genetic'
    ).innerHTML = `Generation: ${generation}, Genome: ${genome}<br>Best Fitness: ${bestFitness.toFixed(
      2
    )}`;
    tick();
  }
}

function kill() {
  if (currentIndividual) {
    bestFitness = Math.max(bestFitness, currentIndividual.fitness());
    currentIndividual.finished = true;
  }
}

function reset() {
  buildTrack(track);

  cancelAnimationFrame(tickId);
  tickId = false;

  ctx.clearRect(0, 0, width, height);
  netCtx.clearRect(0, 0, statWidth, statHeight);
  fitnessCtx.clearRect(0, 0, statWidth, statHeight);

  for (let i = 0; i < walls.length; i++) {
    drawWall(walls[i]);
  }
  ctx.strokeStyle = 'rgba(255, 80, 80, 0.3)';
  for (let i = 0; i < checkpoints.length; i++) {
    drawCheckpoint(checkpoints[i]);
  }

  currentIndividual = undefined;
  bestFitness = 0;
  generation = 0;
  genome = 0;
  makeNewPopulation();
  document.querySelector(
    '#genetic'
  ).innerHTML = `Generation: ${generation}, Genome: ${genome}<br>Best Fitness: ${bestFitness.toFixed(
    2
  )}`;
  document.querySelector('#individual').innerHTML = 'Fitness: 0.00, Avg. Speed: 0.00';
}

reset();

document.querySelector('#start').addEventListener('click', start);
document.querySelector('#kill').addEventListener('click', kill);
document.querySelector('#reset').addEventListener('click', reset);

world.on('beginContact', function (event) {
  function updateCheckpoint(body) {
    let number = Math.max(body.number, currentIndividual.checkpoint);
    if (body.number === checkpoints.length - 1 && number === checkpoints.length - 1) {
      currentIndividual.laps++;
      number = 0;
    }
    currentIndividual.checkpoint = number;
  }

  if (event.shapeA.collisionGroup === checkpointGroup) {
    updateCheckpoint(event.bodyA);
  } else if (event.shapeB.collisionGroup === checkpointGroup) {
    updateCheckpoint(event.bodyB);
  } else {
    bestFitness = Math.max(bestFitness, currentIndividual.fitness());
    currentIndividual.finished = true;
  }
});
