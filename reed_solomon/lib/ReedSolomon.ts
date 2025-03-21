/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { GaloisField } from "./GaloisField.ts";
import { Polynomial } from "./Polynomial.ts";
import { ErrorCorrectingAlgorithm } from "./ErrorCorrectingAlgorithm.ts";

export function ReedSolomonDecoder(
  field: GaloisField,
  array: Array<number>,
  BLOCKS_ECC: number,
) {
  const rsSyndrome = Polynomial.from(field, array, BLOCKS_ECC);
  if (rsSyndrome.zero()) return false;

  const that = new ErrorCorrectingAlgorithm(rsSyndrome, BLOCKS_ECC);
  const R = BLOCKS_ECC / 2;
  while (that.r.coefficients.length >= R) if (that.calculate()) return true;

  if (that.t.constantCoefficient() === 0) return true;

  return that.repair(array);
}

export class ReedSolomonEncoder {
  field: GaloisField;
  coefficients: Array<number>;

  constructor(field: GaloisField, BLOCKS_ECC: number) {
    this.field = field;

    this.coefficients = new Array<number>(BLOCKS_ECC).map(() => {
      return 0;
    });
    this.coefficients[BLOCKS_ECC - 1] = 1;

    let root = this.field.base;
    for (let i = 0; i < BLOCKS_ECC; i++) {
      for (let j = 0; j < BLOCKS_ECC; j++) {
        this.coefficients[j] = this.field.multiply(this.coefficients[j], root);
        if (j + 1 < BLOCKS_ECC) {
          this.coefficients[j] = GaloisField.Add(
            this.coefficients[j],
            this.coefficients[j + 1],
          );
        }
      }

      root = this.field.multiply(root, 2);
    }
  }

  encode(array: Array<number>) {
    const output = new Array<number>(array.length + this.coefficients.length);

    for (let l = array.length; l--;) {
      output[l] = array[l];
    }

    const ecc = new Array<number>(this.coefficients.length).map(() => {
      return 0;
    });

    for (let i = 0; i < array.length; i++) {
      ecc.push(0);
      const factor = GaloisField.Add(array[i], ecc.shift() ?? 0);
      for (let j = 0; j < this.coefficients.length; j++) {
        ecc[j] = GaloisField.Add(
          ecc[j],
          this.field.multiply(this.coefficients[j], factor),
        );
      }
    }

    ecc.forEach((that, i) => {
      output[array.length + i] = that;
    });

    return output;
  }
}
