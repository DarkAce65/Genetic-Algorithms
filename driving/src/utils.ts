export const wrappedModulo = (value: number, modulus: number): number =>
  ((value % modulus) + modulus) % modulus;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));

export const shuffle = <T>(array: T[]): T[] => {
  // Fisher–Yates Shuffle
  let m = array.length;
  let t;
  let i;
  while (m) {
    i = Math.floor(Math.random() * m--);
    t = array[m];
    array[m] = array[i];
    array[i] = t;
  }

  return array;
};

export const squaredSum = (array: number[]): number =>
  array.reduce((acc, value) => acc + value * value, 0);
