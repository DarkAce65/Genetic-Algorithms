import Car from './Car';
import Network from './Network';
import Simulation from './Simulation';
import Track from './Track';
import { CanvasParams, Vector2 } from './constants';

interface GenerationParams {
  generationSize: number;

  numBestPerformersToKeep: number;
  numBreeders: number;
  numRandom: number;
}
interface SimulatorParams {
  numHiddenNodes: number;

  numSensors: number;
  sensorLength?: number;
  sensorAngle?: number;
}

interface SimulatorOptions {
  generationSize?: number;

  numBestPerformersToKeep?: number;
  numBreeders?: number;
  numRandom?: number;

  numHiddenNodes?: number;
  numSensors?: number;
}

const DEFAULT_CONTROLS = {
  generationSize: 20,

  numBestPerformersToKeep: 1,
  numBreeders: 2,
  numRandom: 1,

  numHiddenNodes: 5,
  numSensors: 3,
};

class Simulator {
  private running = false;

  private simulatorControls: SimulatorParams;
  private generationParams: GenerationParams;

  private generation = 0;
  private genome = 0;
  private bestFitness = 0;

  private bestPerformers: Network[] = [];
  private breeders: Network[] = [];

  private scoresAndNetwork: [number, Network][] = [];
  private generationTrails: Vector2[][] = [];

  private activeSimulation: Simulation | null = null;

  constructor(
    private readonly track: Track,
    private readonly simCanvasParams: CanvasParams,
    private readonly netCanvasParams: CanvasParams,
    private readonly carStatusCanvasParams: CanvasParams,
    private readonly simulatorOptions: SimulatorOptions = {}
  ) {
    this.handleSimulationComplete = this.handleSimulationComplete.bind(this);
    this.run = this.run.bind(this);

    this.simulatorControls = {
      numHiddenNodes: this.simulatorOptions.numHiddenNodes ?? DEFAULT_CONTROLS.numHiddenNodes,
      numSensors: this.simulatorOptions.numSensors ?? DEFAULT_CONTROLS.numSensors,
    };
    this.generationParams = {
      generationSize: this.simulatorOptions.generationSize ?? DEFAULT_CONTROLS.generationSize,
      numBestPerformersToKeep:
        this.simulatorOptions.numBestPerformersToKeep ?? DEFAULT_CONTROLS.numBestPerformersToKeep,
      numBreeders: this.simulatorOptions.numBreeders ?? DEFAULT_CONTROLS.numBreeders,
      numRandom: this.simulatorOptions.numRandom ?? DEFAULT_CONTROLS.numRandom,
    };

    this.reset();
  }

  private resetGenerationParams(): void {
    this.generationParams = {
      generationSize: this.simulatorOptions.generationSize ?? DEFAULT_CONTROLS.generationSize,
      numBestPerformersToKeep:
        this.simulatorOptions.numBestPerformersToKeep ?? DEFAULT_CONTROLS.numBestPerformersToKeep,
      numBreeders: this.simulatorOptions.numBreeders ?? DEFAULT_CONTROLS.numBreeders,
      numRandom: this.simulatorOptions.numRandom ?? DEFAULT_CONTROLS.numRandom,
    };
  }

  reset(): void {
    this.running = false;
    this.resetGenerationParams();

    this.generation = 0;
    this.genome = 0;
    this.bestFitness = 0;

    this.breeders = [];

    this.scoresAndNetwork = [];
    this.generationTrails = [];

    document.querySelector('#generation')!.innerHTML = `${this.generation}`;
    document.querySelector('#genome')!.innerHTML = `${this.genome}`;
    document.querySelector('#bestFitness')!.innerHTML = (0).toFixed(2);
    document.querySelector('#fitness')!.innerHTML = (0).toFixed(2);
    document.querySelector('#avgSpeed')!.innerHTML = (0).toFixed(2);

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
    this.activeSimulation = this.createNewSimulation();
    this.activeSimulation.initialize();

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
    const { generationSize, numRandom } = this.generationParams;
    const { numHiddenNodes, numSensors, sensorLength, sensorAngle } = this.simulatorControls;
    const networkStructure = { numInputs: numSensors, numHiddenNodes, numOutputs: 3 };

    let network;
    if (this.bestPerformers.length > 0) {
      network = Network.transformIfNecessary(networkStructure, this.bestPerformers.pop()!);
    } else if (generationSize - this.genome > numRandom && this.breeders.length >= 2) {
      network = Network.fromParents(networkStructure, this.getRandomBreeders());
    } else {
      network = new Network(networkStructure);
    }
    const car = new Car(20, 40, { numSensors, sensorLength, sensorAngle });

    return new Simulation(network, car, this.track, this.handleSimulationComplete);
  }

  private handleSimulationComplete(): void {
    if (this.activeSimulation === null) {
      return;
    }

    this.scoresAndNetwork.push([
      this.activeSimulation.simulationData.bestFitness,
      this.activeSimulation.network,
    ]);
    this.generationTrails.push(this.activeSimulation.getCarTrail());

    this.genome++;
    if (this.genome >= this.generationParams.generationSize) {
      this.resetGenerationParams();

      this.generation++;
      this.genome = 0;

      this.scoresAndNetwork.sort((a, b) => b[0] - a[0]);

      this.bestPerformers = this.scoresAndNetwork
        .slice(0, this.generationParams.numBestPerformersToKeep)
        .map(([_, network]) => network)
        .reverse();
      this.breeders = this.scoresAndNetwork
        .slice(0, this.generationParams.numBreeders)
        .map(([_, network]) => network);

      this.scoresAndNetwork = [];
      this.generationTrails = [];
    }

    document.querySelector('#generation')!.innerHTML = `${this.generation}`;
    document.querySelector('#genome')!.innerHTML = `${this.genome}`;
    document.querySelector('#bestFitness')!.innerHTML = this.bestFitness.toFixed(2);

    this.activeSimulation = this.createNewSimulation();
    this.activeSimulation.initialize();
  }

  private run(): void {
    if (!this.running || this.activeSimulation === null) {
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

      document.querySelector('#bestFitness')!.innerHTML = this.bestFitness.toFixed(2);
    }

    document.querySelector('#fitness')!.innerHTML = fitness.toFixed(2);
    document.querySelector('#avgSpeed')!.innerHTML = avgSpeed.toFixed(2);

    requestAnimationFrame(this.run);
  }
}

export default Simulator;
