import chroma from 'chroma-js';

import { clamp, squaredSum } from './utils';

type NetworkOptions = {
  numInputs: number;
  numHiddenNodes: number;
  numOutputs: number;
  mutationChance: number;
  mutationAmount: number;

  parents?: [Network, Network];
};

type NetworkStructure = { numInputs: number; numHiddenNodes: number; numOutputs: number };

const networkColorScale = chroma.scale(['aquamarine', '#222222', 'white']).domain([-1, 1]);

class Network {
  private readonly networkStructure: NetworkStructure;

  private inputLayerWeights: number[] = [];
  private hiddenLayerWeights: number[] = [];

  private readonly weightsSquared: number;

  constructor({
    numInputs,
    numHiddenNodes = 5,
    numOutputs,
    mutationChance = 0.1,
    mutationAmount = 0.1,

    parents,
  }: NetworkOptions) {
    if (parents) {
      const [p0, p1] = parents;

      for (let i = 0; i < numInputs * numHiddenNodes; i++) {
        if (Math.random() < 0.5) {
          this.inputLayerWeights.push(p0.inputLayerWeights[i]);
        } else {
          this.inputLayerWeights.push(p1.inputLayerWeights[i]);
        }

        if (Math.random() < mutationChance) {
          let v = this.inputLayerWeights[i];
          v += (Math.random() - 0.5) * mutationAmount;
          this.inputLayerWeights[i] = clamp(v, -1, 1);
        }
      }

      for (let i = 0; i < numHiddenNodes * numOutputs; i++) {
        if (Math.random() < 0.5) {
          this.hiddenLayerWeights.push(p0.hiddenLayerWeights[i]);
        } else {
          this.hiddenLayerWeights.push(p1.hiddenLayerWeights[i]);
        }

        if (Math.random() < mutationChance) {
          let v = this.hiddenLayerWeights[i];
          v += (Math.random() - 0.5) * mutationAmount;
          this.hiddenLayerWeights[i] = clamp(v, -1, 1);
        }
      }
    } else {
      for (let i = 0; i < numInputs * numHiddenNodes; i++) {
        this.inputLayerWeights.push(Math.random() * 2 - 1);
      }
      for (let i = 0; i < numHiddenNodes * numOutputs; i++) {
        this.hiddenLayerWeights.push(Math.random() * 2 - 1);
      }
    }

    this.weightsSquared = squaredSum(this.inputLayerWeights) + squaredSum(this.hiddenLayerWeights);

    this.networkStructure = { numInputs, numHiddenNodes, numOutputs };
  }

  loadWeights(input: number[], hidden: number[]): void {
    this.inputLayerWeights = input;
    this.hiddenLayerWeights = hidden;
  }

  evaluateAndDraw(
    inputs: number[],
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number
  ): number[] {
    const [hiddenLayer, outputs] = this.evaluate(inputs);

    ctx.clearRect(0, 0, width, height);
    this.drawNetWeights(ctx, width, height);
    this.drawNetNodes(ctx, width, height, inputs, hiddenLayer, outputs);

    return outputs;
  }

  private evaluate(inputs: number[]): [number[], number[]] {
    const { numInputs, numHiddenNodes, numOutputs } = this.networkStructure;

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

  private drawNetWeights(ctx: CanvasRenderingContext2D, width: number, height: number): void {
    const { numInputs, numHiddenNodes, numOutputs } = this.networkStructure;

    for (let i = 0; i < numInputs; i++) {
      const p = (i + 0.5) / numInputs;
      for (let j = 0; j < numHiddenNodes; j++) {
        const pn = (j + 0.5) / numHiddenNodes;
        const w = this.inputLayerWeights[i * numHiddenNodes + j];
        ctx.strokeStyle = networkColorScale(w);
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
        ctx.strokeStyle = networkColorScale(w);
        ctx.beginPath();
        ctx.moveTo(width / 2, p * height);
        ctx.lineTo(width - 30, pn * height);
        ctx.stroke();
      }
    }
  }

  private drawNetNodes(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    input: number[],
    hidden: number[],
    output: number[]
  ): void {
    for (let i = 0; i < input.length; i++) {
      const p = (i + 0.5) / input.length;
      const w = input[i];
      ctx.fillStyle = networkColorScale(w);
      ctx.beginPath();
      ctx.arc(30, p * height, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    for (let i = 0; i < hidden.length; i++) {
      const p = (i + 0.5) / hidden.length;
      const w = hidden[i];
      ctx.fillStyle = networkColorScale(w);
      ctx.beginPath();
      ctx.arc(width / 2, p * height, 5, 0, 2 * Math.PI);
      ctx.fill();
    }

    for (let i = 0; i < output.length; i++) {
      const p = (i + 0.5) / output.length;
      const w = output[i];
      ctx.fillStyle = networkColorScale(w);
      ctx.beginPath();
      ctx.arc(width - 30, p * height, 5, 0, 2 * Math.PI);
      ctx.fill();
    }
  }
}

export default Network;
