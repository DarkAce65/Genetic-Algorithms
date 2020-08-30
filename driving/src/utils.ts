export const wrappedModulo = (value: number, modulus: number): number =>
  ((value % modulus) + modulus) % modulus;

export const clamp = (value: number, min: number, max: number): number =>
  Math.max(min, Math.min(value, max));
