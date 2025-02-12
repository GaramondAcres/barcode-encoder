/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { BarcodeCanvas } from "../../lib/BarcodeCanvas.ts";
import { SymbolInfo } from "./SymbolInfo.ts";

const UtahCoords = [
  { x: 0, y: 0 },
  { x: -1, y: 0 },
  { x: -2, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: -1 },
  { x: -2, y: -1 },
  { x: -1, y: -2 },
  { x: -2, y: -2 },
];

export class ModuleCanvas {
  public modules: Uint8Array;
  public barcodeCanvas: BarcodeCanvas;

  en_edgeLength: number;

  ib_edgeLength: number;

  data: Array<number>;
  cur: number;

  symbolInfo: SymbolInfo;

  constructor(
    symbolInfo: SymbolInfo,
  ) {
    this.barcodeCanvas = new BarcodeCanvas();

    this.symbolInfo = symbolInfo;

    const di_edgeLength = this.symbolInfo.moduleSqd *
      (this.symbolInfo.edgeLength + 2);

    this.ib_edgeLength = this.symbolInfo.edgeLength * this.symbolInfo.moduleSqd;
    this.en_edgeLength = this.symbolInfo.edgeLength;

    this.modules = new Uint8Array(
      (this.symbolInfo.moduleSqd * (di_edgeLength + 2)) *
        (this.symbolInfo.moduleSqd * (di_edgeLength + 2)),
    )
      .fill(0x03);

    this.data = [];
    this.cur = 0;

    this.drawFunctionPatterns();
  }

  public drawDataBits(allCodewords: number[], _eccLevel: number = 1): void {
    this.data = allCodewords;

    const ib = this.ib_edgeLength;
    const en = this.en_edgeLength;

    let px = 0;
    let py = 4;

    const push = (array: Array<{ x: number; y: number }>) => {
      const currentSymbol = this.data[this.cur++];

      array.forEach((coord, j) => {
        if (coord.y < 0) {
          coord.y += ib;
          coord.x += 4 - ((ib + 4) % 8);
        }

        if (coord.x < 0) {
          coord.x += ib;
          coord.y += 4 - ((ib + 4) % 8);
        }

        this.setNotEmpty(coord.x, coord.y);
        if (((currentSymbol >>> j) & 1) !== 0) {
          const xOffset = Math.floor(coord.x / en) * 2;
          const yOffset = Math.floor(coord.y / en) * 2;

          this.setColor(coord.x + xOffset + 1, coord.y + yOffset + 1);

          this.barcodeCanvas.setDataModule(
            coord.x + xOffset + 2,
            coord.y + yOffset + 2,
            1,
          );
        }
      });

      return this;
    };

    do {
      const cornerCondition = (i: number) => {
        const pattern = [
          [
            { x: -1, y: 3 },
            { x: -1, y: 2 },
            { x: -1, y: 1 },
            { x: -1, y: 0 },
            { x: -2, y: 0 },
            { x: 2, y: -1 },
            { x: 1, y: -1 },
            { x: 0, y: -1 },
          ],
          [
            { x: -1, y: 1 },
            { x: -1, y: 0 },
            { x: -2, y: 0 },
            { x: -3, y: 0 },
            { x: -4, y: 0 },
            { x: 0, y: -1 },
            { x: 0, y: -2 },
            { x: 0, y: -3 },
          ],
          [
            { x: -1, y: 3 },
            { x: -1, y: 2 },
            { x: -1, y: 1 },
            { x: -1, y: 0 },
            { x: -2, y: 0 },
            { x: 0, y: -1 },
            { x: 0, y: -2 },
            { x: 0, y: -3 },
          ],
          [
            { x: -1, y: 1 },
            { x: -2, y: 1 },
            { x: -3, y: 1 },
            { x: -1, y: 0 },
            { x: -2, y: 0 },
            { x: -3, y: 0 },
            { x: -1, y: -1 },
            { x: 0, y: -1 },
          ],
        ][i];
        push(pattern.map((c) => {
          if (c.x < 0) c.x = ib + c.x;
          if (c.y < 0) c.y = ib + c.y;
          return c;
        }));
      };

      if (py === ib && px === 0) {
        cornerCondition(0);
      } else if (py === ib - 2 && px === 0 && (ib % 4) !== 0) {
        cornerCondition(1);
      } else if (py === ib - 2 && px === 0 && (ib % 8) === 4) {
        cornerCondition(2);
      } else if (py === ib + 4 && px === 2 && (ib % 8) === 0) {
        cornerCondition(3);
      }

      do {
        if (
          py < ib && px >= 0 &&
          this.isEmpty(px, py)
        ) {
          push(
            UtahCoords.map((pos) => {
              return {
                x: px + pos.x,
                y: py + pos.y,
              };
            }),
          );
        }

        px += 2;
        py -= 2;
      } while (
        py >= 0 && px < ib
      );

      px += 3;
      py += 1;
      do {
        if (
          py >= 0 && px < ib &&
          this.isEmpty(px, py)
        ) {
          push(
            UtahCoords.map((pos) => {
              return {
                x: px + pos.x,
                y: py + pos.y,
              };
            }),
          );
        }

        px -= 2;
        py += 2;
      } while (
        py < ib && px >= 0
      );

      px += 1;
      py += 3;
    } while (
      py < ib ||
      px < ib
    );

    if (this.isEmpty(ib - 1, ib - 1) === true) {
      this.setColor(ib, ib);
      this.setColor(ib - 1, ib - 1);

      this.barcodeCanvas.setFunctionModule(ib + 1, ib + 1, 1);
      this.barcodeCanvas.setFunctionModule(ib, ib, 1);
    }
  }

  private drawFunctionPatterns(): void {
    const en = this.en_edgeLength;

    for (let x = this.symbolInfo.moduleSqd; x--;) {
      for (let y = this.symbolInfo.moduleSqd; y--;) {
        const px = x * (en + 2);
        const py = (y + 1) * (en + 2) - 1;

        for (let l = en + 2; l--;) {
          this.setColor(px, py - l);
          this.setColor(px + l, py);

          this.barcodeCanvas.setFunctionModule(px + 1, py - l + 1, 1);
          this.barcodeCanvas.setFunctionModule(px + l + 1, py + 1, 1);
        }

        for (let l = en + 2; (l -= 2);) {
          this.setColor(px + en + 1, py - l);
          this.setColor(px + l, py - en - 1);

          this.barcodeCanvas.setFunctionModule(px + en + 2, py - l + 1, 1);
          this.barcodeCanvas.setFunctionModule(px + l + 1, py - en, 1);
        }
      }
    }
  }

  private setColor(px: number, py: number): void {
    const di_edgeLength = this.symbolInfo.moduleSqd *
      (this.symbolInfo.edgeLength + 2);

    this.modules[py * di_edgeLength + px] &= 0x02;

    this.barcodeCanvas.setDataModule(px + 1, py + 1, 1);
  }

  private setNotEmpty(ix: number, iy: number) {
    const di_edgeLength = this.symbolInfo.moduleSqd *
      (this.symbolInfo.edgeLength + 2);

    this.modules[iy * di_edgeLength + ix] &= 0x01;
  }

  private isEmpty(ix: number, iy: number): boolean {
    const di_edgeLength = this.symbolInfo.moduleSqd *
      (this.symbolInfo.edgeLength + 2);

    return (
      (this.modules[iy * di_edgeLength + ix] & 0x02) === 0x02
    );
  }
}
