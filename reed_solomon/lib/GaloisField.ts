/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

export class GaloisField {
  length = 0;
  generator = 0;
  base = 0;

  expTable: Array<number> = [];
  logTable: Array<number> = [];

  constructor(size: number, generator: number, base: number) {
    this.expTable = [];
    this.logTable = [0];

    let j = 1;
    for (let i = 0; i < size; i++) {
      this.expTable[i] = j;
      j = j << 1;
      if (j >= size) j ^= generator;
    }

    for (let i = 0; i < size - 1; i++) {
      this.logTable[this.expTable[i]] = i;
    }

    const length: number = size - 1;

    this.base = base;
    this.length = length;
    this.generator = generator;

    return;
  }

  multiply(x: number, y: number) {
    if (x === 0 || y === 0) return 0;
    return this.expTable[(this.logTable[x] + this.logTable[y]) % this.length];
  }

  invert(x: number) {
    return this.expTable[this.length - this.logTable[x]];
  }

  divide(x: number, y: number) {
    return this.multiply(x, this.invert(y));
  }

  log(x: number) {
    return this.logTable[x];
  }

  exp(x: number) {
    return this.expTable[x];
  }

  public static IsZero(x: number) {
    return x === 0;
  }

  public static IsOne(x: number) {
    return x === 1;
  }

  public static Add(x: number, y: number) {
    return x ^ y;
  }
}
