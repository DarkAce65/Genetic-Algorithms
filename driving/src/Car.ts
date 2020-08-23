import p2, { Body, Box, Ray, RaycastResult, TopDownVehicle, WheelConstraint, World } from 'p2';

import { CHECKPOINT_MASK, Vector2, WALL_MASK } from './constants';

type SensorOptions = { numSensors?: number; sensorLength?: number; sensorAngle?: number };
type Sensor = {
  localFrom: Vector2;
  localTo: Vector2;
  ray: Ray;

  hasHit: boolean;
  hitDistance?: number;
  hitPoint?: Vector2;
  hitNormal?: Vector2;
};

class Car {
  private chassis: { body: Body; box: Box };
  private tdv: TopDownVehicle;
  private wheels: [WheelConstraint, WheelConstraint, WheelConstraint, WheelConstraint];

  private sensors: Sensor[] = [];

  constructor(
    bodyWidth: number,
    bodyHeight: number,
    { numSensors = 3, sensorLength = 120, sensorAngle = (90 * Math.PI) / 180 }: SensorOptions = {}
  ) {
    const chassisBody = new Body({ mass: 1 });
    const chassisBox = new Box({
      width: bodyWidth,
      height: bodyHeight,
      collisionMask: WALL_MASK | CHECKPOINT_MASK,
    });
    chassisBody.addShape(chassisBox);

    const vehicle = new TopDownVehicle(chassisBody);
    const flWheel = vehicle.addWheel({ localPosition: [-bodyWidth / 2, bodyHeight / 2] });
    const frWheel = vehicle.addWheel({ localPosition: [bodyWidth / 2, bodyHeight / 2] });
    const blWheel = vehicle.addWheel({ localPosition: [-bodyWidth / 2, -bodyHeight / 2] });
    const brWheel = vehicle.addWheel({ localPosition: [bodyWidth / 2, -bodyHeight / 2] });
    flWheel.setSideFriction(400);
    frWheel.setSideFriction(400);
    blWheel.setSideFriction(300);
    brWheel.setSideFriction(300);

    flWheel.setBrakeForce(20);
    frWheel.setBrakeForce(20);

    for (let s = 0; s < numSensors; s++) {
      const r = s / (numSensors - 1);
      const w = bodyWidth * 0.9;
      const h = bodyHeight * 0.9;
      const localFrom = p2.vec2.fromValues(-w / 2 + w * r, h / 2);
      const localTo = p2.vec2.clone(localFrom);
      const angle = sensorAngle / 2 - sensorAngle * r + Math.PI / 2;
      p2.vec2.add(localTo, localTo, [
        sensorLength * Math.cos(angle),
        sensorLength * Math.sin(angle),
      ]);

      const sensor = {
        localFrom,
        localTo,
        ray: new Ray({
          mode: Ray.CLOSEST,
          collisionMask: WALL_MASK,
          from: localFrom,
          to: localTo,
        }),
        hasHit: false,
      };
      this.sensors.push(sensor);
    }

    this.tdv = vehicle;
    this.chassis = { body: chassisBody, box: chassisBox };
    this.wheels = [flWheel, frWheel, blWheel, brWheel];
  }

  getSpeed(): number {
    return (this.wheels[2].getSpeed() + this.wheels[3].getSpeed()) / 2;
  }

  update(world: World, throttle: number, brake: number, steer: number): void {
    const steerValue = 0.63 * -(steer * 2 - 1);
    const engineForce = 150 * throttle;
    const brakeForce = 150 * brake;

    this.wheels[0].steerValue = steerValue;
    this.wheels[1].steerValue = steerValue;

    this.wheels[2].engineForce = engineForce;
    this.wheels[3].engineForce = engineForce;

    this.wheels[2].setBrakeForce(brakeForce);
    this.wheels[3].setBrakeForce(brakeForce);

    this.computeSensorIntersections(world);
  }

  private computeSensorIntersections(world: World) {
    const result = new RaycastResult();
    for (const sensor of this.sensors) {
      const localFrom = p2.vec2.clone(sensor.localFrom);
      const localTo = p2.vec2.clone(sensor.localTo);

      p2.vec2.rotate(localFrom, localFrom, this.chassis.body.angle);
      p2.vec2.add(localFrom, localFrom, this.chassis.body.position);
      p2.vec2.rotate(localTo, localTo, this.chassis.body.angle);
      p2.vec2.add(localTo, localTo, this.chassis.body.position);

      sensor.ray.from = localFrom;
      sensor.ray.to = localTo;
      sensor.ray.update();

      result.reset();
      world.raycast(result, sensor.ray);

      sensor.hasHit = result.hasHit();
      if (sensor.hasHit) {
        const hitPoint = p2.vec2.create();
        result.getHitPoint(hitPoint, sensor.ray)

        sensor.hitDistance = result.getHitDistance(sensor.ray);
        sensor.hitPoint = hitPoint;
        sensor.hitNormal = result.normal;
      } else {
        sensor.hitDistance = null;
        sensor.hitPoint = null;
        sensor.hitNormal = null;
      }
    }
  }

  draw(ctx: CanvasRenderingContext2D, steer: number): void {
    this.drawSensors(ctx);

    ctx.strokeStyle = 'white';
    const [x, y] = this.chassis.body.position;
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
      const wy =
        Math.sign(wheel.localPosition[1]) * (Math.abs(wheel.localPosition[1]) - wheelHeight);

      ctx.save();
      ctx.translate(wx, wy);
      if (i < 2) {
        ctx.rotate(0.63 * -(steer * 2 - 1));
      }
      ctx.translate(-wheelWidth / 2, -wheelHeight / 2);

      ctx.rect(0, 0, wheelWidth, wheelHeight);
      ctx.restore();
    }

    ctx.stroke();
    ctx.restore();
  }

  private drawSensors(ctx: CanvasRenderingContext2D) {
    const hitPointRadius = 5;
    const normalLength = 10;

    for (const sensor of this.sensors) {
      ctx.strokeStyle = '#ff5050';
      ctx.beginPath();
      ctx.moveTo(sensor.ray.from[0], sensor.ray.from[1]);
      ctx.lineTo(sensor.ray.to[0], sensor.ray.to[1]);
      ctx.stroke();

      const { hitPoint, hitNormal } = sensor;

      if (sensor.hasHit) {
        ctx.beginPath();
        ctx.arc(hitPoint[0], hitPoint[1], hitPointRadius, 0, 2 * Math.PI);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(hitPoint[0], hitPoint[1]);
        ctx.lineTo(
          hitPoint[0] + hitNormal[0] * normalLength,
          hitPoint[1] + hitNormal[1] * normalLength
        );
        ctx.stroke();
      }
    }
  }
}

export default Car;
