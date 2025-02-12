/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { GaloisField } from "./GaloisField.ts";
import { Polynomial } from "./Polynomial.ts";

export class ErrorCorrectingAlgorithm {
  t: Polynomial;
  r: Polynomial;
  tNext: Polynomial;
  rNext: Polynomial;
  field: GaloisField;

  constructor(rsSyndrome: Polynomial, BLOCKS_ECC: number) {
    this.field = rsSyndrome.field;
    this.t = Polynomial.one(this.field);
    this.r = rsSyndrome;
    this.tNext = Polynomial.zero(this.field);
    this.rNext = Polynomial.monomial(this.field, BLOCKS_ECC, 1);
  }

  calculate() {
    if (this.r.leadingCoefficient() === 0) return true;

    const tNextNext = this.t;
    this.t = ErrorCorrectingAlgorithm.EuclideanAlgorithm(this.rNext, this.r)
      .multiply(this.t)
      .add(this.tNext);

    this.tNext = tNextNext;

    const rNextNext = this.r;
    this.r = this.rNext;
    this.rNext = rNextNext;

    return this.r.degree() >= this.rNext.degree();
  }

  repair(array: Array<number>) {
    const inverse = this.field.invert(this.t.constantCoefficient());

    const evaluator = this.r.multiplyByScalar(inverse);
    const zeroes = this.t.multiplyByScalar(inverse).findZeroes();

    for (let i = 0; i < zeroes.length; i++) {
      const eccPosition = array.length -
        this.field.log(this.field.invert(zeroes[i])) - 1;
      if (eccPosition < 0 || eccPosition > array.length) {
        continue;
      }

      let denominator = 1;
      for (let j = 0; j < zeroes.length; j++) {
        if (i === j) continue;
        denominator = this.field.multiply(
          denominator,
          GaloisField.Add(1, this.field.divide(zeroes[i], zeroes[j])),
        );
      }

      let k = evaluator.evaluateAt(zeroes[i]);

      if (!GaloisField.IsOne(this.field.base)) {
        k = this.field.multiply(evaluator.evaluateAt(zeroes[i]), zeroes[i]);
      }

      array[eccPosition] ^= this.field.divide(k, denominator);
    }
  }

  public static EuclideanAlgorithm(r: Polynomial, rLast: Polynomial) {
    const t = Polynomial.zero(r.field);
    while (r.degree() >= rLast.degree() && r.leadingCoefficient() !== 0) {
      const degreeDiff = r.degree() - rLast.degree();
      const scale = t.field.divide(
        r.leadingCoefficient(),
        rLast.leadingCoefficient(),
      );

      t.add(Polynomial.monomial(r.field, degreeDiff, scale));
      r.add(rLast.copy().multiplyByScalar(scale).shift(degreeDiff));
    }
    return t;
  }
}
