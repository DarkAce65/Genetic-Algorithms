import chroma from 'chroma-js';

import { CanvasParams } from './constants';
import { clamp } from './utils';

interface NetworkStructure {
  numInputs: number;
  numHiddenNodes: number;
  numOutputs: number;
}
interface NetworkValues {
  inputLayerWeights: number[];
  hiddenLayerWeights: number[];
}

const networkColorScale = chroma.scale(['aquamarine', '#222222', 'white']).domain([-1, 1]);

class Network {
  private inputLayerWeights: number[] = [];
  private hiddenLayerWeights: number[] = [];

  constructor(readonly structure: NetworkStructure, values?: NetworkValues) {
    const { numInputs, numHiddenNodes, numOutputs } = structure;

    if (values) {
      if (
        values.inputLayerWeights.length !== numInputs * numHiddenNodes ||
        values.hiddenLayerWeights.length !== numHiddenNodes * numOutputs
      ) {
        throw new Error(
          "Invalid network values provided - number of values doesn't match structure"
        );
      }

      this.inputLayerWeights = values.inputLayerWeights;
      this.hiddenLayerWeights = values.hiddenLayerWeights;
    } else {
      for (let i = 0; i < numInputs * numHiddenNodes; i++) {
        this.inputLayerWeights.push(Math.random() * 2 - 1);
      }
      for (let i = 0; i < numHiddenNodes * numOutputs; i++) {
        this.hiddenLayerWeights.push(Math.random() * 2 - 1);
      }
    }
  }

  static transformIfNecessary(structure: NetworkStructure, network: Network): Network {
    if (
      structure.numInputs === network.structure.numInputs &&
      structure.numHiddenNodes === network.structure.numHiddenNodes &&
      structure.numOutputs === network.structure.numOutputs
    ) {
      return network;
    }

    const { numInputs, numHiddenNodes, numOutputs } = structure;

    const inputLayerWeights = network.inputLayerWeights.slice(0, numInputs * numHiddenNodes);
    const hiddenLayerWeights = network.hiddenLayerWeights.slice(0, numHiddenNodes * numOutputs);

    for (let i = inputLayerWeights.length; i < numInputs * numHiddenNodes; i++) {
      inputLayerWeights.push(Math.random() * 2 - 1);
    }
    for (let i = hiddenLayerWeights.length; i < numHiddenNodes * numOutputs; i++) {
      hiddenLayerWeights.push(Math.random() * 2 - 1);
    }

    return new Network(structure, { inputLayerWeights, hiddenLayerWeights });
  }

  static fromParents(
    structure: NetworkStructure,
    parents: [Network, Network],
    { mutationChance = 0.1, mutationAmount = 0.1 } = {}
  ): Network {
    const { numInputs, numHiddenNodes, numOutputs } = structure;
    const [p0, p1] = parents;

    const inputLayerWeights: number[] = [];
    const hiddenLayerWeights: number[] = [];

    for (let i = 0; i < numInputs * numHiddenNodes; i++) {
      const r = Math.random();
      if (i < p0.inputLayerWeights.length && (r < 0.5 || i >= p1.inputLayerWeights.length)) {
        inputLayerWeights.push(p0.inputLayerWeights[i]);
      } else if (i < p1.inputLayerWeights.length && r >= 0.5) {
        inputLayerWeights.push(p1.inputLayerWeights[i]);
      } else {
        inputLayerWeights.push(Math.random() * 2 - 1);
      }

      if (Math.random() < mutationChance) {
        let v = inputLayerWeights[i];
        v += (Math.random() - 0.5) * mutationAmount;
        inputLayerWeights[i] = clamp(v, -1, 1);
      }
    }

    for (let i = 0; i < numHiddenNodes * numOutputs; i++) {
      const r = Math.random();
      if (i < p0.hiddenLayerWeights.length && (r < 0.5 || i >= p1.hiddenLayerWeights.length)) {
        hiddenLayerWeights.push(p0.hiddenLayerWeights[i]);
      } else if (i < p1.hiddenLayerWeights.length && r >= 0.5) {
        hiddenLayerWeights.push(p1.hiddenLayerWeights[i]);
      } else {
        hiddenLayerWeights.push(Math.random() * 2 - 1);
      }

      if (Math.random() < mutationChance) {
        let v = hiddenLayerWeights[i];
        v += (Math.random() - 0.5) * mutationAmount;
        hiddenLayerWeights[i] = clamp(v, -1, 1);
      }
    }

    return new Network(structure, { inputLayerWeights, hiddenLayerWeights });
  }

  static drawStructure({ ctx, width, height }: CanvasParams, structure: NetworkStructure): void {
    ctx.clearRect(0, 0, width, height);

    const { numInputs, numHiddenNodes, numOutputs } = structure;

    ctx.strokeStyle = 'white';
    ctx.fillStyle = 'white';

    for (let i = 0; i < numInputs; i++) {
      const p = (i + 0.5) / numInputs;
      for (let j = 0; j < numHiddenNodes; j++) {
        const pn = (j + 0.5) / numHiddenNodes;
        ctx.beginPath();
        ctx.moveTo(30, p * height);
        ctx.lineTo(width / 2, pn * height);
        ctx.stroke();
      }
    }

    for (let i = 0; i < numHiddenNodes; i++) {
      const p = (i + 0.5) / numHiddenNodes;
      for (let j = 0; j < numOutputs; j++) {
        const pn = (j + 0.5) / numOutputs;
        ctx.beginPath();
        ctx.moveTo(width / 2, p * height);
        ctx.lineTo(width - 30, pn * height);
        ctx.stroke();
      }
    }

    const drawNodes = (x: number, numNodes: number): void => {
      for (let i = 0; i < numNodes; i++) {
        const p = (i + 0.5) / numNodes;
        ctx.beginPath();
        ctx.arc(x, p * height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    };

    drawNodes(30, numInputs);
    drawNodes(width / 2, numHiddenNodes);
    drawNodes(width - 30, numOutputs);
  }

  loadWeights(input: number[], hidden: number[]): void {
    this.inputLayerWeights = input;
    this.hiddenLayerWeights = hidden;
  }

  evaluateAndDraw(inputs: number[], canvasParams: CanvasParams): number[] {
    const [hiddenLayer, outputs] = this.evaluate(inputs);

    canvasParams.ctx.clearRect(0, 0, canvasParams.width, canvasParams.height);
    this.drawNetWeights(canvasParams);
    this.drawNetNodes(canvasParams, inputs, hiddenLayer, outputs);

    return outputs;
  }

  private evaluate(inputs: number[]): [number[], number[]] {
    const { numInputs, numHiddenNodes, numOutputs } = this.structure;

    const hiddenLayer: number[] = new Array(numHiddenNodes).fill(0);
    const outputs: number[] = new Array(numOutputs).fill(0);

    for (let i = 0; i < numHiddenNodes; i++) {
      for (let j = 0; j < numInputs; j++) {
        hiddenLayer[i] += inputs[j] * this.inputLayerWeights[i * numInputs + j];
      }
    }

    for (let i = 0; i < numOutputs; i++) {
      for (let j = 0; j < numHiddenNodes; j++) {
        outputs[i] += hiddenLayer[j] * this.hiddenLayerWeights[i * numHiddenNodes + j];
      }
      outputs[i] = clamp(Math.abs(outputs[i]), 0, 1);
    }

    return [hiddenLayer, outputs];
  }

  private drawNetWeights({ ctx, width, height }: CanvasParams): void {
    const { numInputs, numHiddenNodes, numOutputs } = this.structure;

    for (let i = 0; i < numInputs; i++) {
      const p = (i + 0.5) / numInputs;
      for (let j = 0; j < numHiddenNodes; j++) {
        const pn = (j + 0.5) / numHiddenNodes;
        const w = this.inputLayerWeights[i * numHiddenNodes + j];
        ctx.strokeStyle = networkColorScale(w).hex();
        ctx.beginPath();
        ctx.moveTo(30, p * height);
        ctx.lineTo(width / 2, pn * height);
        ctx.stroke();
      }
    }

    for (let i = 0; i < numHiddenNodes; i++) {
      const p = (i + 0.5) / numHiddenNodes;
      for (let j = 0; j < numOutputs; j++) {
        const pn = (j + 0.5) / numOutputs;
        const w = this.hiddenLayerWeights[i * numOutputs + j];
        ctx.strokeStyle = networkColorScale(w).hex();
        ctx.beginPath();
        ctx.moveTo(width / 2, p * height);
        ctx.lineTo(width - 30, pn * height);
        ctx.stroke();
      }
    }
  }

  private drawNetNodes(
    { ctx, width, height }: CanvasParams,
    input: number[],
    hidden: number[],
    output: number[]
  ): void {
    const drawNodes = (x: number, nodes: number[]): void => {
      for (let i = 0; i < nodes.length; i++) {
        const p = (i + 0.5) / nodes.length;
        const w = nodes[i];
        ctx.fillStyle = networkColorScale(w).hex();
        ctx.beginPath();
        ctx.arc(x, p * height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    };

    drawNodes(30, input);
    drawNodes(width / 2, hidden);
    drawNodes(width - 30, output);
  }
}

export default Network;
