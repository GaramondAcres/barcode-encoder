/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { CodewordEncoder } from "./lib/CodewordEncoder.ts";
import { ModuleCanvas } from "./lib/ModuleCanvas.ts";
import { SymbolInfo } from "./lib/SymbolInfo.ts";
import { SymbolSizes } from "./lib/SymbolSizes.ts";
import { Coord } from "../lib/Coord.ts";

export const Encoding = {
  ASCII: 0,
  X12: 1,
  C40: 2,
  TEXT: 3,
};

export class DataMatrix {
  symbolInfo: SymbolInfo;

  array: Array<number>;

  constructor(
    data: string,
    mode: number = 0x11,
    _quietZone: number = 1,
  ) {
    const codewordEncoder = (new CodewordEncoder())
      .appendSegment((new TextEncoder()).encode(data), mode);

    // Find the symbol size that can accomodate the data

    let l = SymbolSizes[0].length - 1;
    for (; l > 0; l--) {
      if (codewordEncoder.getBlockLength() <= SymbolSizes[0][l].codewordCount) {
        break;
      }
    }
    if (SymbolSizes[0][l].codewordCount < codewordEncoder.getBlockLength()) {
      throw new Error("Data too large for symbol size");
    }

    this.symbolInfo = SymbolSizes[0][l];

    this.array = codewordEncoder.toArray(
      this.symbolInfo.codewordCount,
      this.symbolInfo.eccPerBlock,
      this.symbolInfo.blocksCount,
    );

    return this;
  }

  public toString() {
    // Init Canvas

    const di_edgeLength = this.symbolInfo.moduleSqd *
      (this.symbolInfo.edgeLength + 2);

    // Draw To canvas

    const canvas = new ModuleCanvas(
      this.symbolInfo,
    );

    canvas.drawDataBits(this.array, this.symbolInfo.blocksCount);

    return canvas.barcodeCanvas.drawMatrix(di_edgeLength + 2);
  }

  public getEdgeLength() {
    return this.symbolInfo.edgeLength + 1 * 2;
  }

  public getCoords(): Coord[] {
    const canvas = new ModuleCanvas(
      this.symbolInfo,
    );

    canvas.drawDataBits(this.array, this.symbolInfo.blocksCount);

    return canvas.barcodeCanvas.getCoords();
  }
}
