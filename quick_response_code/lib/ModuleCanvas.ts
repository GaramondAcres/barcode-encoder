/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { BarcodeCanvas } from "../../lib/BarcodeCanvas.ts";

export class ColorRun {
  private runs: number[] = [];
  private currentColor = 128;
  private currentRunLength = 0;

  append(color: number): void {
    if (this.currentColor === 128) {
      this.currentColor = color;
      this.currentRunLength = 1;
      return;
    }

    if (color === this.currentColor) {
      this.currentRunLength++;
    } else {
      this.runs.push(this.currentRunLength);
      this.currentColor = color;
      this.currentRunLength = 1;
    }
  }

  finish(): number[] {
    if (this.currentRunLength > 0) {
      this.runs.push(this.currentRunLength);
    }
    return this.runs;
  }
}

import { SymbolInfo } from "./SymbolInfo.ts";

export function GetMaskBit(mask: number, y: number, x: number): number {
  switch (mask) {
    case 0:
      return ((x + y) % 2 === 0) ? 1 : 0;
    case 1:
      return (y % 2 === 0) ? 1 : 0;
    case 2:
      return (x % 3 === 0) ? 1 : 0;
    case 3:
      return ((x + y) % 3 === 0) ? 1 : 0;
    case 4:
      return ((((x / 3) | 0) + ((y / 2) | 0)) % 2 === 0) ? 1 : 0;
    case 5:
      return (((x * y) % 2) + ((x * y) % 3) === 0) ? 1 : 0;
    case 6:
      return ((((x * y) % 2) + ((x * y) % 3)) % 2 === 0) ? 1 : 0;
    case 7:
      return ((((x + y) % 2) + ((x * y) % 3)) % 2 === 0) ? 1 : 0;
    case 8:
      return 1;
    default:
      throw new Error("Unreachable mask value");
  }
}

function computeRunPenalty(runs: number[]): number {
  let penalty = 0;

  for (const runLength of runs) {
    if (runLength >= 5) {
      penalty += 3 + (runLength - 5);
    }
  }
  return penalty;
}

function computeFindPenalty(runs: number[]): number {
  let penalty = 0;
  for (let i = 0; i < runs.length - 6; i++) {
    const r0 = runs[i];
    const r1 = runs[i + 1];
    const r2 = runs[i + 2];
    const r3 = runs[i + 3];
    const r4 = runs[i + 4];
    const r5 = runs[i + 5];
    const r6 = runs[i + 6];

    if (
      r1 === 1 && r2 === 3 && r3 === 1 && r4 === 1 &&
      (r0 >= 4 || r5 >= 4)
    ) {
      penalty += 40;
    } else if (
      r1 === 1 && r2 === 1 && r3 === 3 && r4 === 1 && r5 === 1 &&
      (r0 >= 4 || r6 >= 4)
    ) {
      penalty += 40;
    }
  }

  return penalty;
}

export class ModuleCanvas {
  private rawCanvas: Uint8Array;
  private bestMaskedCanvas: Uint8Array | null;
  private lowestPenalty: number;

  private bestMaskId: number;

  private symbolMetadata: SymbolInfo;

  private edgeLength: number;

  private version: number;
  private errorCorrectionLevel: number;

  public barcodeCanvas: BarcodeCanvas;

  constructor(symbolInfo: SymbolInfo, forcedMaskId: number = -1) {
    this.symbolMetadata = symbolInfo;
    this.edgeLength = symbolInfo.edgeLength;
    this.version = symbolInfo.version;
    this.errorCorrectionLevel = symbolInfo.ecl;

    this.rawCanvas = new Uint8Array(this.edgeLength * this.edgeLength).fill(0);

    this.barcodeCanvas = new BarcodeCanvas();

    this.bestMaskedCanvas = null;
    this.lowestPenalty = Infinity;
    this.bestMaskId = forcedMaskId;

    this.placeFunctionPatterns();
  }

  public placeDataBits(allCodewords: number[]): void {
    this.drawFormatBits(0);

    let bitIndex = 0;
    const totalBits = allCodewords.length * 8;

    for (let rightCol = this.edgeLength - 2; rightCol >= 1; rightCol -= 2) {
      for (let rowStep = 0; rowStep < this.edgeLength - 1; rowStep++) {
        for (let subCol = 0; subCol < 2; subCol++) {
          let x = rightCol - subCol;
          const upward = ((rightCol + 1) & 2) === 0;
          let y = upward ? (this.edgeLength - 2 - rowStep) : rowStep;

          if (y >= 6) y++;
          if (x >= 6) x++;

          if (!this.isFunctionModule(x, y) && bitIndex < totalBits) {
            const theByte = allCodewords[bitIndex >>> 3];
            const bit = (theByte >>> (7 - (bitIndex & 7))) & 1;
            const idx = y * this.edgeLength + x;
            if (bit === 1) {
              this.rawCanvas[idx] = 1;
            }
            bitIndex++;
          }
        }
      }
    }

    if (this.bestMaskId >= 0) {
      this.drawFormatBits(this.bestMaskId);
      this.applyMaskAndEvaluate(this.bestMaskId);
    } else {
      for (let candidateMask = 0; candidateMask < 8; candidateMask++) {
        this.drawFormatBits(candidateMask);
        this.applyMaskAndEvaluate(candidateMask);
      }
    }
  }

  public getModuleMatrixWithQuietZone(): void {
    if (!this.bestMaskedCanvas) {
      throw new Error("No best mask chosen; mask generation incomplete?");
    }
    const quiet = 4;

    for (let row = 0; row < this.edgeLength; row++) {
      for (let col = 0; col < this.edgeLength; col++) {
        this.barcodeCanvas.setDataModule(
          col + quiet,
          row + quiet,
          this.bestMaskedCanvas[row * this.edgeLength + col] & 0x1 ? 1 : 0,
        );
      }
    }
    return;
  }

  public getMaskId(): number {
    return this.bestMaskId;
  }

  private applyMaskAndEvaluate(maskId: number): void {
    const maskedCanvas = new Uint8Array(this.edgeLength * this.edgeLength);

    for (let y = 0; y < this.edgeLength; y++) {
      for (let x = 0; x < this.edgeLength; x++) {
        const idx = y * this.edgeLength + x;

        if (this.isFunctionModule(x, y)) {
          maskedCanvas[idx] = this.rawCanvas[idx] & 1;
        } else {
          const maskBit = GetMaskBit(maskId, y, x) ? 1 : 0;
          maskedCanvas[idx] = (this.rawCanvas[idx] ^ maskBit) & 1;
        }
      }
    }

    const penalty = this.computePenalty(maskedCanvas);
    if (penalty < this.lowestPenalty) {
      this.lowestPenalty = penalty;
      this.bestMaskId = maskId;
      this.bestMaskedCanvas = maskedCanvas;
    }
  }

  private computePenalty(canvas: Uint8Array): number {
    let penaltyRuns = 0;
    let penaltyFinders = 0;

    for (let r = 0; r < this.edgeLength; r++) {
      const rowRun = new ColorRun();
      const colRun = new ColorRun();

      for (let c = 0; c < this.edgeLength; c++) {
        rowRun.append(canvas[r * this.edgeLength + c]);
        colRun.append(canvas[c * this.edgeLength + r]);
      }
      const rowSegments = rowRun.finish();
      const colSegments = colRun.finish();

      penaltyFinders += computeFindPenalty(rowSegments);
      penaltyFinders += computeFindPenalty(colSegments);

      penaltyRuns += computeRunPenalty(rowSegments);
      penaltyRuns += computeRunPenalty(colSegments);
    }

    let penaltyTwoByTwo = 0;
    for (let y = 0; y < this.edgeLength - 1; y++) {
      for (let x = 0; x < this.edgeLength - 1; x++) {
        const c = canvas[y * this.edgeLength + x];
        if (
          c === canvas[y * this.edgeLength + (x + 1)] &&
          c === canvas[(y + 1) * this.edgeLength + x] &&
          c === canvas[(y + 1) * this.edgeLength + (x + 1)]
        ) {
          penaltyTwoByTwo += 3;
        }
      }
    }

    let darkCount = 0;
    const totalModules = this.edgeLength * this.edgeLength;
    for (let i = 0; i < totalModules; i++) {
      if (canvas[i] === 1) {
        darkCount++;
      }
    }

    const darkPercent = (darkCount * 100) / totalModules;
    const penaltyDarkBalance = 10 * Math.floor(Math.abs(darkPercent - 50) / 5);

    return penaltyRuns + penaltyFinders + penaltyTwoByTwo + penaltyDarkBalance;
  }

  private drawFormatBits(mask: number): void {
    const formatData = (this.errorCorrectionLevel << 3) | mask;

    if (this.version >= 7) {
      let versionRem = this.version;
      for (let i = 0; i < 12; i++) {
        versionRem = (versionRem << 1) ^ ((versionRem >>> 11) * 0x1F25);
      }
      const versionBits = (this.version << 12) | versionRem;

      for (let i = 0; i < 18; i++) {
        const moduleColor = (versionBits >>> i) & 1;
        const a = this.edgeLength - 11 + (i % 3);
        const b = Math.floor(i / 3);
        this.setVersionBit(a, b, moduleColor);
        this.setVersionBit(b, a, moduleColor);
      }
    }

    let eccRem = formatData;
    for (let i = 0; i < 10; i++) {
      eccRem = (eccRem << 1) ^ ((eccRem >>> 9) * 0x537);
    }
    const formatBits = ((formatData << 10) | eccRem) ^ 0x5412;

    for (let i = 0; i <= 5; i++) {
      this.setMaskedFunctionModule(8, i, (formatBits >>> i) & 1);
    }
    this.setMaskedFunctionModule(8, 7, (formatBits >>> 6) & 1);
    this.setMaskedFunctionModule(8, 8, (formatBits >>> 7) & 1);
    this.setMaskedFunctionModule(7, 8, (formatBits >>> 8) & 1);
    for (let i = 9; i < 15; i++) {
      this.setMaskedFunctionModule(14 - i, 8, (formatBits >>> i) & 1);
    }

    for (let i = 0; i < 8; i++) {
      this.setMaskedFunctionModule(
        this.edgeLength - 1 - i,
        8,
        (formatBits >>> i) & 1,
      );
    }
    for (let i = 8; i < 15; i++) {
      this.setMaskedFunctionModule(
        8,
        this.edgeLength - 15 + i,
        (formatBits >>> i) & 1,
      );
    }

    this.setMaskedFunctionModule(8, this.edgeLength - 8, 1);
  }

  private setMaskedFunctionModule(x: number, y: number, color: number) {
    const idx = y * this.edgeLength + x;
    this.rawCanvas[idx] = (color & 1) | (1 << 2);
  }

  private setVersionBit(x: number, y: number, color: number): void {
    const idx = y * this.edgeLength + x;
    this.rawCanvas[idx] = (color & 1) | (1 << 2);
  }

  private isFunctionModule(x: number, y: number): boolean {
    const idx = y * this.edgeLength + x;
    return ((this.rawCanvas[idx] >>> 2) & 1) === 1;
  }

  private placeFunctionPatterns(): void {
    this.placeFinderPattern(3, 3);
    this.placeFinderPattern(this.edgeLength - 4, 3);
    this.placeFinderPattern(3, this.edgeLength - 4);

    for (let i = 8; i < this.edgeLength - 8; i++) {
      const isBlack = (i % 2 === 0) ? 1 : 0;
      this.setVersionBit(6, i, isBlack);
      this.setVersionBit(i, 6, isBlack);
    }

    if (this.version > 1) {
      const alignmentCount = Math.floor(this.version / 7) + 2;
      const step = Math.floor(
        (this.version * 8 + alignmentCount * 3 + 5) /
          (alignmentCount * 4 - 4),
      ) * 2;

      const alignPos: number[] = [6];
      for (
        let pos = this.edgeLength - 7;
        alignPos.length < alignmentCount;
        pos -= step
      ) {
        alignPos.splice(1, 0, pos);
      }

      const len = alignPos.length;
      for (let i = 0; i < len; i++) {
        for (let j = 0; j < len; j++) {
          const corner1 = i === 0 && j === 0;
          const corner2 = i === 0 && j === len - 1;
          const corner3 = i === len - 1 && j === 0;
          if (!(corner1 || corner2 || corner3)) {
            this.placeAlignmentPattern(alignPos[i], alignPos[j]);
          }
        }
      }
    }
  }

  private placeAlignmentPattern(centerX: number, centerY: number): void {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const isBlack = (dist !== 1) ? 1 : 0;
        this.setVersionBit(centerX + dx, centerY + dy, isBlack);
      }
    }
  }

  private placeFinderPattern(centerX: number, centerY: number): void {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = centerX + dx;
        const yy = centerY + dy;
        if (
          0 <= xx && xx < this.edgeLength && 0 <= yy && yy < this.edgeLength
        ) {
          this.setVersionBit(xx, yy, (dist !== 2 && dist !== 4) ? 1 : 0);
        }
      }
    }
  }
}
