/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { BarcodeCanvas } from "../../lib/BarcodeCanvas.ts";

export class ModuleCanvas extends BarcodeCanvas {
  public finderPatternSize: number;
  public centerPosition: number;

  constructor(finderPatternSize: number, layerCount: number) {
    super();

    this.finderPatternSize = finderPatternSize;

    this.centerPosition = this.finderPatternSize + 2 * layerCount;
    this.centerPosition += Math.floor((this.centerPosition - 1) / 15);
  }

  public drawDataModules(
    encodedCodewords: number[],
    bitsPerWord: number,
  ): ModuleCanvas {
    let x = -this.finderPatternSize;
    let y = x - 1;

    const move = (dx: number, dy: number) => {
      do {
        x += dx;
      } while (this.finderPatternSize === 7 && (x & 0x0f) === 0);
      do {
        y += dy;
      } while (this.finderPatternSize === 7 && (y & 0x0f) === 0);
    };

    let sideSpiral = (3 * this.finderPatternSize + 9) / 2;
    let stepsLeft = sideSpiral;
    let dx = 1;
    let dy = 0;

    let tmpVal: number | undefined;
    while ((tmpVal = encodedCodewords.pop()) !== undefined) {
      for (let i = bitsPerWord / 2; i-- > 0; tmpVal >>= 2) {
        this.setDataModule(
          this.centerPosition + x,
          this.centerPosition + y,
          tmpVal & 1,
        );
        move(dy, -dx);

        this.setDataModule(
          this.centerPosition + x,
          this.centerPosition + y,
          tmpVal & 2,
        );
        move(dx - dy, dx + dy);

        if (stepsLeft-- === 0) {
          move(dy, -dx);
          stepsLeft = dx;
          dx = -dy;
          dy = stepsLeft;
          if (dx < 1) {
            for (stepsLeft = 2; stepsLeft--;) {
              move(dx - dy, dx + dy);
            }
          } else {
            sideSpiral += 4;
          }
          stepsLeft = sideSpiral;
        }
      }
    }

    return this;
  }

  public drawFunctionPatterns(
    paramArray: number[],
    paramBitsPerWord: number,
  ): ModuleCanvas {
    for (
      let i = 2 - this.finderPatternSize, mask = 1;
      i < this.finderPatternSize - 1;
      i++, mask <<= 1
    ) {
      if (this.finderPatternSize === 7 && i === 0) i++;

      this.setFunctionModule(
        this.centerPosition - i,
        this.centerPosition - this.finderPatternSize,
        paramArray[paramBitsPerWord + 1] & mask,
      );
      this.setFunctionModule(
        this.centerPosition + this.finderPatternSize,
        this.centerPosition - i,
        paramArray[paramBitsPerWord + 2] & mask,
      );
      this.setFunctionModule(
        this.centerPosition + i,
        this.centerPosition + this.finderPatternSize,
        paramArray[paramBitsPerWord + 3] & mask,
      );
      this.setFunctionModule(
        this.centerPosition - this.finderPatternSize,
        this.centerPosition + i,
        paramArray[paramBitsPerWord + 4] & mask,
      );
    }

    // Place finder pattern
    for (let y = 1 - this.finderPatternSize; y < this.finderPatternSize; y++) {
      for (
        let x = 1 - this.finderPatternSize;
        x < this.finderPatternSize;
        x++
      ) {
        if (((Math.max(Math.abs(x), Math.abs(y))) & 1) ^ 1) {
          this.setFunctionModule(
            this.centerPosition + x,
            this.centerPosition + y,
            1,
          );
        }
      }
    }

    this.setFunctionModule(
      this.centerPosition - this.finderPatternSize,
      this.centerPosition - this.finderPatternSize + 1,
      1,
    );
    this.setFunctionModule(
      this.centerPosition - this.finderPatternSize,
      this.centerPosition - this.finderPatternSize,
      1,
    );
    this.setFunctionModule(
      this.centerPosition - this.finderPatternSize + 1,
      this.centerPosition - this.finderPatternSize,
      1,
    );
    this.setFunctionModule(
      this.centerPosition + this.finderPatternSize,
      this.centerPosition + this.finderPatternSize - 1,
      1,
    );
    this.setFunctionModule(
      this.centerPosition + this.finderPatternSize,
      this.centerPosition - this.finderPatternSize + 1,
      1,
    );
    this.setFunctionModule(
      this.centerPosition + this.finderPatternSize,
      this.centerPosition - this.finderPatternSize,
      1,
    );

    let x, y;
    if (this.finderPatternSize === 7) {
      for (
        x = (15 - this.centerPosition) & -16;
        x <= this.centerPosition;
        x += 16
      ) {
        for (
          y = (1 - this.centerPosition) & -2;
          y <= this.centerPosition;
          y += 2
        ) {
          this.setFunctionModule(
            this.centerPosition + x,
            this.centerPosition + y,
            1,
          );
          this.setFunctionModule(
            this.centerPosition + y,
            this.centerPosition + x,
            1,
          );
        }
      }
    }

    return this;
  }
}
