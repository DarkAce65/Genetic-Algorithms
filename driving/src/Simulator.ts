import Car from './Car';
import Network from './Network';
import Simulation from './Simulation';
import Track from './Track';
import { CanvasParams, Vector2 } from './constants';

class Simulator {
  private running = false;

  private generation = 0;
  private genome = 0;
  private bestFitness = 0;

  private trails: Vector2[][] = [];

  private activeSimulation: Simulation = null;

  constructor(
    private readonly track: Track,
    private readonly simCanvasParams: CanvasParams,
    private readonly netCanvasParams: CanvasParams,
    private readonly carStatusCanvasParams: CanvasParams
  ) {
    this.handleSimulationComplete = this.handleSimulationComplete.bind(this);
    this.run = this.run.bind(this);

    this.reset();
  }

  private reset(): void {
    this.generation = 0;
    this.genome = 0;
    this.bestFitness = 0;

    this.trails = [];
    this.activeSimulation = this.createNewSimulation();
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

  private createNewSimulation(): Simulation {
    const car = new Car(20, 40, { numSensors: 3 });
    const network = new Network({ numInputs: 3, numOutputs: 3 });
    return new Simulation(network, car, this.track, this.handleSimulationComplete);
  }

  private handleSimulationComplete(): void {
    this.trails.push(this.activeSimulation.getCarTrail());

    this.genome++;

    document.querySelector('#genetic').innerHTML = `Generation: ${this.generation}, Genome: ${
      this.genome
    }<br>Best Fitness: ${this.bestFitness.toFixed(2)}`;

    this.activeSimulation = this.createNewSimulation();
    this.activeSimulation.initialize();
  }

  private run(): void {
    if (this.activeSimulation === null) {
      console.error('No active simulation');
      return;
    }

    const { fitness, avgSpeed } = this.activeSimulation.tick(
      this.simCanvasParams,
      this.netCanvasParams,
      this.carStatusCanvasParams,
      this.trails
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

    if (this.running) {
      requestAnimationFrame(this.run);
    }
  }
}

export default Simulator;
