/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { Coord } from "./Coord.ts";

const BLOCK_CHARSET = "\u2588\u2584\u2580 ";
"\u2500";

export class BarcodeCanvas {
  coords: Coord[] = [];

  constructor() {
    this.coords = [];
  }

  public setDataModule(col: number, row: number, color: number): void {
    this.coords.push(new Coord(col, row, color ? 1 : 0, 0));
  }

  public setFunctionModule(col: number, row: number, color: number): void {
    this.coords.push(new Coord(col, row, color ? 1 : 0, 1));
  }

  public getCoords(): Coord[] {
    return this.coords;
  }

  public drawMatrix(matrixSide: number): string {
    const numericMatrix = Array.from(
      { length: matrixSide },
      () => Array(matrixSide).fill(0),
    );

    this.coords.forEach(({ x, y, isDark }) => {
      if (isDark) {
        numericMatrix[y][x] = 1;
      }
    });

    let output = "";

    for (let row = 0; row < matrixSide; row += 2) {
      for (let col = 0; col < matrixSide; col++) {
        const topPixel = (numericMatrix[row][col] & 1) !== 0 ? 1 : 0;
        let bottomPixel = 1;
        if (row + 1 < matrixSide) {
          bottomPixel = (numericMatrix[row + 1][col] & 1) !== 0 ? 1 : 0;
        }
        const charIndex = topPixel + (bottomPixel << 1);
        output += BLOCK_CHARSET[charIndex];
      }
      output += "\n";
    }

    return output;
  }
}
