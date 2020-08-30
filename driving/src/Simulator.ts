import Car from './Car';
import Network from './Network';
import Simulation from './Simulation';
import Track from './Track';
import { CanvasParams, Vector2 } from './constants';

type SimulatorControls = {
  generationSize?: number;

  numBestPerformersToKeep?: number;
  numBreeders?: number;
  numRandom?: number;

  numHiddenNodes?: number;

  numSensors?: number;
  sensorLength?: number;
  sensorAngle?: number;
};

const DEFAULT_CONTROLS: SimulatorControls = {
  generationSize: 20,
  numBestPerformersToKeep: 1,
  numBreeders: 2,
  numRandom: 1,
  numHiddenNodes: 5,
  numSensors: 3,
};

class Simulator {
  private running = false;

  private simulatorControls: SimulatorControls;

  private generation = 0;
  private genome = 0;
  private bestFitness = 0;

  private bestPerformers: Network[] = [];
  private breeders: Network[] = [];

  private scoresAndNetwork: [number, Network][] = [];
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

    this.breeders = [];

    this.scoresAndNetwork = [];
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
    if (this.running) {
      return;
    }

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
    if (!this.running) {
      return;
    }

    this.handleSimulationComplete();
  }

  private getRandomBreeders(): [Network, Network] {
    const b0 = Math.floor(Math.random() * this.breeders.length);
    const b1 = Math.floor(Math.random() * this.breeders.length);

    return [this.breeders[b0], this.breeders[b1]];
  }

  private createNewSimulation(): Simulation {
    const {
      generationSize,
      numRandom,
      numHiddenNodes,
      numSensors,
      sensorLength,
      sensorAngle,
    } = this.simulatorControls;
    const networkStructure = { numInputs: numSensors, numHiddenNodes, numOutputs: 3 };

    let network;
    if (this.bestPerformers.length > 0) {
      network = Network.transformIfNecessary(networkStructure, this.bestPerformers.pop());
    } else if (generationSize - this.genome > numRandom && this.breeders.length >= 2) {
      network = Network.fromParents(networkStructure, this.getRandomBreeders());
    } else {
      network = new Network(networkStructure);
    }
    const car = new Car(20, 40, { numSensors, sensorLength, sensorAngle });

    return new Simulation(network, car, this.track, this.handleSimulationComplete);
  }

  private handleSimulationComplete(): void {
    this.scoresAndNetwork.push([
      this.activeSimulation.simulationData.bestFitness,
      this.activeSimulation.network,
    ]);
    this.generationTrails.push(this.activeSimulation.getCarTrail());

    this.genome++;
    if (this.genome >= this.simulatorControls.generationSize) {
      this.generation++;
      this.genome = 0;

      this.scoresAndNetwork.sort((a, b) => b[0] - a[0]);

      this.bestPerformers = this.scoresAndNetwork
        .slice(0, this.simulatorControls.numBestPerformersToKeep)
        .map(([_, network]) => network)
        .reverse();
      this.breeders = this.scoresAndNetwork
        .slice(0, this.simulatorControls.numBreeders)
        .map(([_, network]) => network);

      this.scoresAndNetwork = [];
      this.generationTrails = [];
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
