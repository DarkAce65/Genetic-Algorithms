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

export const squaredSum = (acc: number, value: number): number => acc + value * value;
