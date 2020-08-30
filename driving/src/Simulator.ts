import Car from './Car';
import Network from './Network';
import Simulation from './Simulation';
import Track from './Track';
import { CanvasParams, Vector2 } from './constants';

type SimulatorControls = {
  generationSize?: number;
  numHiddenNodes?: number;
  numSensors: number;
  sensorLength?: number;
  sensorAngle?: number;
};

const DEFAULT_CONTROLS: SimulatorControls = {
  generationSize: 20,
  numHiddenNodes: 5,
  numSensors: 3,
};

class Simulator {
  private running = false;

  private simulatorControls: SimulatorControls;

  private generation = 0;
  private genome = 0;
  private bestFitness = 0;

  private generationTrails: Vector2[][] = [];

  private activeSimulation: Simulation = null;

  constructor(
    private readonly track: Track,
    private readonly simCanvasParams: CanvasParams,
    private readonly netCanvasParams: CanvasParams,
    private readonly carStatusCanvasParams: CanvasParams,
    simulatorControls: SimulatorControls
  ) {
    this.handleSimulationComplete = this.handleSimulationComplete.bind(this);
    this.run = this.run.bind(this);

    this.simulatorControls = {
      ...DEFAULT_CONTROLS,
      ...simulatorControls,
    };
    this.reset();
  }

  reset(): void {
    this.running = false;
    this.generation = 0;
    this.genome = 0;
    this.bestFitness = 0;

    this.generationTrails = [];
    this.activeSimulation = this.createNewSimulation();

    const { ctx, width, height } = this.simCanvasParams;
    ctx.clearRect(0, 0, width, height);
    this.track.draw(this.simCanvasParams.ctx);

    const { numHiddenNodes, numSensors } = this.simulatorControls;
    const networkStructure = { numInputs: numSensors, numHiddenNodes, numOutputs: 3 };
    Network.drawStructure(this.netCanvasParams, networkStructure);

    const {
      ctx: carStatusCtx,
      width: carStatusWidth,
      height: carStatusHeight,
    } = this.carStatusCanvasParams;
    carStatusCtx.clearRect(0, 0, carStatusWidth, carStatusHeight);
  }

  start(): void {
    this.running = true;
    this.activeSimulation.initialize();

    document.querySelector('#genetic').innerHTML = `Generation: ${this.generation}, Genome: ${
      this.genome
    }<br>Best Fitness: ${(0).toFixed(2)}`;
    document.querySelector('#individual').innerHTML = `Fitness: ${(0).toFixed(
      2
    )}, Avg. Speed: ${(0).toFixed(2)}`;

    this.run();
  }

  killCurrentSimulation(): void {
    if (this.activeSimulation === null) {
      console.error('No active simulation');
      return;
    }

    this.handleSimulationComplete();
  }

  private createNewSimulation(): Simulation {
    const { numHiddenNodes, numSensors, sensorLength, sensorAngle } = this.simulatorControls;

    const car = new Car(20, 40, { numSensors, sensorLength, sensorAngle });
    const network = new Network({ numInputs: numSensors, numHiddenNodes, numOutputs: 3 });
    return new Simulation(network, car, this.track, this.handleSimulationComplete);
  }

  private handleSimulationComplete(): void {
    this.generationTrails.push(this.activeSimulation.getCarTrail());
    this.trails.push(this.activeSimulation.getCarTrail());

    this.genome++;
    if (this.genome >= this.simulatorControls.generationSize) {
      this.generation++;
      this.genome = 0;
    }

    document.querySelector('#genetic').innerHTML = `Generation: ${this.generation}, Genome: ${
      this.genome
    }<br>Best Fitness: ${this.bestFitness.toFixed(2)}`;

    this.activeSimulation = this.createNewSimulation();
    this.activeSimulation.initialize();
  }

  private run(): void {
    if (!this.running) {
      return;
    }

    if (this.activeSimulation === null) {
      console.error('No active simulation');
      return;
    }

    const { fitness, avgSpeed } = this.activeSimulation.tick(
      this.simCanvasParams,
      this.netCanvasParams,
      this.carStatusCanvasParams,
      this.generationTrails
    );

    if (fitness > this.bestFitness) {
      this.bestFitness = fitness;

      document.querySelector('#genetic').innerHTML = `Generation: ${this.generation}, Genome: ${
        this.genome
      }<br>Best Fitness: ${this.bestFitness.toFixed(2)}`;
    }

    document.querySelector('#individual').innerHTML = `Fitness: ${fitness.toFixed(
      2
    )}, Avg. Speed: ${avgSpeed.toFixed(2)}`;

    requestAnimationFrame(this.run);
  }
}

export default Simulator;
