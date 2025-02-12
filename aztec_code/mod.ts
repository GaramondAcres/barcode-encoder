/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { GaloisField, ReedSolomonEncoder } from "../reed_solomon/mod.ts";
import { appendBitsToStream } from "./lib/appendBitsToStream.ts";
import {
  characterMap,
  LARGE_NUMBER,
  latchLength,
  latchTable,
  shiftLength,
} from "./lib/constants.ts";
import { ModuleCanvas } from "./lib/ModuleCanvas.ts";
import { Coord } from "../lib/Coord.ts";

const AZTEC_DATA_12 = new GaloisField(0x1000, 0x1069, 2); // x^12 + x^6 + x^5 + x^3 + 1
const AZTEC_DATA_10 = new GaloisField(0x400, 0x409, 2); // x^10 + x^3 + 1
const AZTEC_DATA_8 = new GaloisField(0x100, 0x12D, 2); // x^8 + x^5 + x^3 + x^2 + 1
const AZTEC_DATA_6 = new GaloisField(0x40, 0x43, 2); // x^6 + x + 1
const AZTEC_PARAM = new GaloisField(0x10, 0x13, 2); // x^4 + x + 1

export class AztecCode {
  private moduleCanvas: ModuleCanvas = new ModuleCanvas(0, 0);

  private layerCount: number = 0;

  private encodedCodewords: number[] = [];
  private textLength: number = 0;
  private bitsPerWord: number = 0;
  private binaryByteCount: number = 0;
  private bitEstimate: number = 0;

  public encodeBinarySegment(
    localStream: number[],
    position: number,
    text: string,
  ) {
    localStream[0] -= this.binaryByteCount * 8 +
      (this.binaryByteCount > 31 ? 16 : 5);

    appendBitsToStream(
      localStream,
      this.binaryByteCount > 31 ? 0 : this.binaryByteCount,
      5,
      this.bitsPerWord,
    );

    if (this.binaryByteCount > 31) {
      appendBitsToStream(
        localStream,
        this.binaryByteCount - 31,
        11,
        this.bitsPerWord,
      );
    }

    for (let idx = position - this.binaryByteCount; idx < position; idx++) {
      appendBitsToStream(
        localStream,
        text.charCodeAt(idx),
        8,
        this.bitsPerWord,
      );
    }
  }

  public constructor(
    text: string,
    errorCorrectionPercent: number,
    layerCount: number,
  ) {
    this.encodedCodewords = [];
    this.textLength = text.length;
    this.binaryByteCount = 0;
    this.bitsPerWord = 0;
    this.bitEstimate = 0;

    let backToMode: number | undefined;

    let previousBitsPerWord: number;

    errorCorrectionPercent = 100 /
      (100 - Math.min(Math.max(errorCorrectionPercent || 25, 0), 90));

    for (
      this.bitEstimate = previousBitsPerWord = 4;;
      previousBitsPerWord = this.bitsPerWord
    ) {
      this.bitEstimate = Math.max(
        this.bitEstimate,
        (Math.floor(this.textLength * errorCorrectionPercent) + 3) *
          previousBitsPerWord,
      );

      // Select bits-per-word
      if (this.bitEstimate <= 240) {
        this.bitsPerWord = 6;
      } else if (this.bitEstimate <= 1920) {
        this.bitsPerWord = 8;
      } else if (this.bitEstimate <= 10208) {
        this.bitsPerWord = 10;
      } else {
        this.bitsPerWord = 12;
      }

      if (layerCount) {
        this.bitsPerWord = Math.max(
          this.bitsPerWord,
          layerCount < 3 ? 6 : layerCount < 9 ? 8 : layerCount < 23 ? 10 : 12,
        );
      }

      if (previousBitsPerWord >= this.bitsPerWord) {
        break;
      }

      // Working sequences for each mode: [U,L,M,P,D,B]
      let currentSequence: number[][] = [
        [0, 0],
        [LARGE_NUMBER],
        [LARGE_NUMBER],
        [LARGE_NUMBER],
        [LARGE_NUMBER],
        [LARGE_NUMBER],
      ];

      for (let i = 0; i < text.length; i++) {
        for (let toMode = 0; toMode < 6; toMode++) {
          for (let fromMode = 0; fromMode < 6; fromMode++) {
            if (
              currentSequence[fromMode][0] +
                    latchLength[fromMode][toMode] <
                currentSequence[toMode][0] &&
              (fromMode < 5 || toMode === backToMode)
            ) {
              currentSequence[toMode] = currentSequence[fromMode].slice();
              if (fromMode < 5) {
                latchTable[fromMode][toMode].forEach((lat) => {
                  appendBitsToStream(
                    currentSequence[toMode],
                    lat,
                    lat < 16 ? 4 : 5,
                    this.bitsPerWord,
                  );
                });
              } else {
                this.encodeBinarySegment(currentSequence[toMode], i, text);
              }
              if (toMode === 5) {
                backToMode = fromMode;
                this.binaryByteCount = 0;
                currentSequence[5][0] += 5;
              }
            }
          }
        }

        const nextSequence: number[][] = [
          [LARGE_NUMBER],
          [LARGE_NUMBER],
          [LARGE_NUMBER],
          [LARGE_NUMBER],
          [LARGE_NUMBER],
          currentSequence[5],
        ];

        const twoCharIdx = ["\r\n", ". ", ", ", ": "].indexOf(
          text.substring(i, i + 2),
        );

        for (let toMode = 0; toMode < 5; toMode++) {
          const mappedIndex = twoCharIdx < 0
            ? characterMap[toMode].indexOf(text.substring(i, i + 1), 1)
            : twoCharIdx + 2;
          if (mappedIndex < 0 || (twoCharIdx >= 0 && toMode !== 3)) {
            continue;
          }

          for (let fromMode = 0; fromMode < 5; fromMode++) {
            const cost = currentSequence[fromMode][0] +
              shiftLength[fromMode][toMode] +
              (toMode === 4 ? 4 : 5);
            if (cost < nextSequence[fromMode][0]) {
              nextSequence[fromMode] = currentSequence[fromMode].slice();
              if (fromMode !== toMode) {
                appendBitsToStream(
                  nextSequence[fromMode],
                  toMode === 3 ? 0 : fromMode < 4 ? 28 : 15,
                  fromMode < 4 ? 5 : 4,
                  this.bitsPerWord,
                );
              }
              appendBitsToStream(
                nextSequence[fromMode],
                mappedIndex,
                toMode === 4 ? 4 : 5,
                this.bitsPerWord,
              );
            }
          }
        }

        nextSequence[5][0] += ++this.binaryByteCount === 32 ? 19 : 8;
        if (twoCharIdx >= 0) {
          i++;
          nextSequence[5][0] += ++this.binaryByteCount === 32 ? 19 : 8;
        }
        currentSequence = nextSequence;
      }

      this.encodeBinarySegment(currentSequence[5], text.length, text);

      this.encodedCodewords = currentSequence.reduce((a, b) =>
        a[0] < b[0] ? a : b
      );
      const padSize = this.bitsPerWord -
        (this.encodedCodewords[0] % this.bitsPerWord);
      if (padSize < this.bitsPerWord) {
        appendBitsToStream(
          this.encodedCodewords,
          (1 << padSize) - 1,
          padSize,
          this.bitsPerWord,
        );
      }
      this.encodedCodewords.pop();

      const initialChunk = this.encodedCodewords.shift() ?? 0;
      this.textLength = Math.floor(initialChunk / this.bitsPerWord);
    }

    if (this.textLength > 1660) {
      throw new Error("Too Long");
    }

    let finderPatternSize = this.bitEstimate > 608 || this.textLength > 64 ||
        (layerCount && layerCount > 4)
      ? 14
      : 11;

    layerCount = Math.max(
      Math.min(
        32,
        Math.ceil(
          (Math.sqrt(this.bitEstimate + finderPatternSize * finderPatternSize) -
            finderPatternSize) / 4,
        ),
      ),
      0,
    );

    const errorWordCount = Math.floor(
      (8 * layerCount * (finderPatternSize + 2 * layerCount)) /
        this.bitsPerWord,
    ) - this.textLength;

    finderPatternSize >>= 1;
    let centerPosition = finderPatternSize + 2 * layerCount;
    centerPosition += ((centerPosition - 1) / 15) | 0;

    const paramBitsPerWord = (finderPatternSize * 3 - 1) / 2;
    const paramArraySize = finderPatternSize - 2;
    const paramArray: number[] = new Array(paramArraySize);

    let azVal = (layerCount - 1) * (finderPatternSize * 992 - 4896) +
      this.textLength - 1;
    for (let i = paramArraySize - 1; i >= 0; i--) {
      paramArray[i] = azVal & 0x0f;
      azVal >>= 4;
    }

    const paramRsSize = Math.floor((finderPatternSize + 5) / 2);
    const paramEncoder = new ReedSolomonEncoder(AZTEC_PARAM, paramRsSize);
    const paramEncoded = paramEncoder.encode(paramArray.slice());

    for (let i = 0; i < paramEncoded.length; i++) {
      paramArray[i] = paramEncoded[i];
    }
    paramArray.push(0);

    const xorVal = layerCount ? 0 : 10;
    for (let i = 1; i <= paramBitsPerWord; i++) {
      appendBitsToStream(
        paramArray,
        xorVal ^ paramArray[i],
        4,
        paramBitsPerWord,
        finderPatternSize,
      );
    }

    const fields = [AZTEC_DATA_6, AZTEC_DATA_8, AZTEC_DATA_10, AZTEC_DATA_12];
    const fieldIndex = (this.bitsPerWord / 2) - 3; // 6->0,8->1,10->2,12->3

    const rsEncoder = new ReedSolomonEncoder(
      fields[fieldIndex],
      errorWordCount,
    );
    const rsEncoded = rsEncoder.encode(this.encodedCodewords.slice());
    rsEncoded.forEach((val, idx) => {
      this.encodedCodewords[idx] = val;
    });

    this.moduleCanvas = new ModuleCanvas(
      finderPatternSize,
      layerCount,
    )
      .drawFunctionPatterns(paramArray, paramBitsPerWord)
      .drawDataModules(this.encodedCodewords, this.bitsPerWord);

    this.layerCount = layerCount;
  }

  public toString() {
    return this.moduleCanvas.drawMatrix(
      2 * this.moduleCanvas.centerPosition + 1,
    );
  }

  public getCoords(): Coord[] {
    return this.moduleCanvas.getCoords();
  }
}
