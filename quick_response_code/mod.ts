/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { ModuleCanvas } from "./lib/ModuleCanvas.ts";
import { CodewordEncoder } from "./lib/CodewordEncoder.ts";
import { SymbolInfo } from "./lib/SymbolInfo.ts";
import { SymbolSizes } from "./lib/SymbolSizes.ts";
import { Coord } from "../lib/Coord.ts";

const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

function getAlphanumericValue(char: string): number {
  return ALPHANUMERIC_CHARSET.indexOf(char);
}

export class QR {
  private symbolInfo: SymbolInfo;
  private moduleCanvas: ModuleCanvas;
  private codewordEncoder: CodewordEncoder;

  private allCodewords: number[];
  private maskId: number;

  constructor(
    private text: string,
    version: number = 1,
    maskId: number = -1,
  ) {
    this.allCodewords = [];
    let mode = 0x02;
    if (version < MIN_VERSION || version > MAX_VERSION) {
      throw new RangeError("Version out of range");
    }

    for (const c of text) {
      if (getAlphanumericValue(c) < 0) {
        mode = 0x04;
      }
    }

    let ecl = 0x01; // Low
    if (version < 4) {
      ecl = 0x02; // High
    } else if (version < 10) {
      ecl = 0x03; // Quartile
    } else if (version < 14) {
      ecl = 0x00; // Medium
    }

    this.symbolInfo = SymbolSizes[ecl][version];

    this.codewordEncoder = (new CodewordEncoder(
      this.symbolInfo.version,
    ))
      .appendSegment((new TextEncoder()).encode(text), mode);

    this.maskId = maskId;

    this.moduleCanvas = new ModuleCanvas(
      this.symbolInfo,
      this.maskId,
    );
  }

  public appendSegment(text: Uint8Array, mode: number) {
    this.codewordEncoder.appendSegment(text, mode);
    return this;
  }

  public toCodewords(): string {
    this.allCodewords = this.codewordEncoder.toArray(
      this.symbolInfo.codewordCount,
      this.symbolInfo.eccPerBlock,
      this.symbolInfo.blocksCount,
    );

    return this.allCodewords.map((b) => {
      return b.toString(16).padStart(2, "0").toUpperCase();
    }).join(" ");
  }

  public getMaskId() {
    return this.moduleCanvas.getMaskId();
  }

  public toString(): string {
    this.allCodewords = this.codewordEncoder.toArray(
      this.symbolInfo.codewordCount,
      this.symbolInfo.eccPerBlock,
      this.symbolInfo.blocksCount,
    );

    this.moduleCanvas.placeDataBits(this.allCodewords);

    const fullSize = this.symbolInfo.edgeLength + 4 * 2;

    this.moduleCanvas.getModuleMatrixWithQuietZone();

    return this.moduleCanvas.barcodeCanvas.drawMatrix(fullSize);
  }

  public getEdgeLength() {
    return this.symbolInfo.edgeLength + 4 * 2;
  }

  public getCoords(): Coord[] {
    this.allCodewords = this.codewordEncoder.toArray(
      this.symbolInfo.codewordCount,
      this.symbolInfo.eccPerBlock,
      this.symbolInfo.blocksCount,
    );

    this.moduleCanvas.placeDataBits(this.allCodewords);

    this.moduleCanvas.getModuleMatrixWithQuietZone();

    return this.moduleCanvas.barcodeCanvas.getCoords();
  }

  public getData(): string {
    return this.allCodewords.map((b) => {
      return b.toString(16).padStart(2, "0").toUpperCase();
    }).join(" ");
  }
}

const MIN_VERSION = 1;
const MAX_VERSION = 40;
