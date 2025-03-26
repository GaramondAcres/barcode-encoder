/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { Coord } from "./Coord.ts";

const EOI_CODE = 5;
const CLEAR_CODE = 4;
const CODE_MASK = 3;
const MIN_CODE_SIZE = 2;
const ENDING_BYTE = 0x3B;

class CodeTable {
  array: number[];
  index: number[];
  constructor() {
    this.array = [];
    this.index = [];
  }
  indexOf(key: number) {
    return this.index.indexOf(key);
  }
  push(key: number, value: number) {
    this.index.push(key);
    this.array.push(value);
  }
  clear() {
    this.index.splice(0, this.index.length);
    this.array.splice(0, this.array.length);
  }
}

class MonochromeGIFFrameEncoder {
  subBlock: number;
  p: number;
  codeSize: number;
  clearCode: number;
  nextCode: number;
  cur: number;
  curShift: number;
  edgeLength: number;
  byteArray: Uint8Array;

  constructor(edgeLength: number, byteArray: Uint8Array) {
    this.subBlock = 1 + 29;
    this.p = 0;
    this.codeSize = MIN_CODE_SIZE + 1;
    this.clearCode = 1 << MIN_CODE_SIZE;
    this.nextCode = EOI_CODE + 1;
    this.cur = 0;
    this.curShift = 0;
    this.edgeLength = edgeLength;
    this.byteArray = byteArray;
  }

  writeBytes(size: number) {
    while (this.curShift >= size) {
      this.byteArray[this.p++] = this.cur & 0xff;
      this.cur >>>= 8;
      this.curShift -= 8;
      if (this.p === this.subBlock + 0x100) {
        this.byteArray[this.subBlock] = 0xff;
        this.subBlock = this.p++;
      }
    }
  }

  emitCode(code: number) {
    this.cur |= code << this.curShift;
    this.curShift += this.codeSize;
    this.writeBytes(8);
  }

  encodeFrame(position: number, frame: number[]) {
    const codeTable = new CodeTable();

    this.p = position;
    this.byteArray[this.p++] = MIN_CODE_SIZE;
    this.p++;

    let lastCode = frame[0] & CODE_MASK;
    this.emitCode(CLEAR_CODE);

    for (let i = 1; i < frame.length; i++) {
      const byte = frame[i];
      const key = (lastCode << 8) | byte;
      const pos = codeTable.indexOf(key);
      if (pos < 0) {
        this.emitCode(lastCode);
        if (this.nextCode === 0x1000) {
          this.emitCode(CLEAR_CODE);
          this.nextCode = EOI_CODE + 1;
          this.codeSize = MIN_CODE_SIZE + 1;
          codeTable.clear();
        } else {
          // Add new entry
          if (this.nextCode >= 1 << this.codeSize) {
            this.codeSize++;
          }
          codeTable.push(key, this.nextCode++);
        }
        lastCode = byte;
      } else {
        lastCode = codeTable.array[pos];
      }
    }

    this.emitCode(lastCode);
    this.emitCode(EOI_CODE);
    this.writeBytes(1);
    if (this.subBlock + 1 === this.p) {
      this.byteArray[this.subBlock] = 0;
    } else {
      this.byteArray[this.subBlock] = this.p - this.subBlock - 1;
      this.byteArray[this.p++] = 0;
    }

    this.byteArray[this.p++] = ENDING_BYTE;

    this.byteArray = this.byteArray.slice(0, this.p);
  }
}

export class Canvas {
  frame: number[];
  width: number;
  height: number;
  fullSize: number;
  inverted: boolean;
  comments: Array<string>;

  constructor(width: number, height: number, inverted = false) {
    this.width = width;
    this.height = height;
    this.fullSize = width;
    this.inverted = inverted;
    this.comments = [];

    this.frame = new Array(this.width * this.height).fill(1);
  }

  draw(coord: Coord) {
    const px = coord.x;
    const py = coord.y;
    if (px < 0 || py < 0 || px >= this.width || py >= this.height) {
      return; // out of bounds
    }
    const index = py * this.fullSize + px;
    this.frame[index] = 0; // black
  }

  drawSquare(coord: { x: number; y: number }, edgeLength: number) {
    for (let j = edgeLength; j--;) {
      const dY = j + coord.y;
      for (let k = edgeLength; k--;) {
        const dX = k + coord.x;
        this.frame[this.width * dY + dX] = 0;
      }
    }
  }

  drawRect(coord: { x: number; y: number }, width: number, height: number) {
    for (let j = height; j--;) {
      const dY = j + coord.y;
      for (let k = width; k--;) {
        const dX = k + coord.x;
        this.frame[this.width * dY + dX] = 0;
      }
    }
  }

  copy() {
    const that = new Canvas(this.width, this.height);
    that.frame = this.frame.slice(0);
    that.comments = this.comments.slice(0);
    return that;
  }

  toByteArray(): Uint8Array {
    const maxBytes = this.width * this.height + 1024;
    const byteArray = new Uint8Array(maxBytes);

    const GIF_HEADER = [
      0x47,
      0x49,
      0x46,
      0x38,
      0x37,
      0x61,
      0x00,
      0x00,
      0x00,
      0x00,
      0x80,
      0x00,
      0x00,
    ];
    for (let i = 0; i < GIF_HEADER.length; i++) {
      byteArray[i] = GIF_HEADER[i];
    }

    const width = this.width;
    const height = this.height;
    const wLo = width & 0xff;
    const wHi = width >>> 8;
    const hLo = height & 0xff;
    const hHi = height >>> 8;

    byteArray[6] = wLo;
    byteArray[7] = wHi;
    byteArray[8] = hLo;
    byteArray[9] = hHi;

    const color0 = this.inverted ? 0xff : 0x00;
    const color1 = this.inverted ? 0x00 : 0xff;
    byteArray[13] = color0;
    byteArray[14] = color0;
    byteArray[15] = color0;
    byteArray[16] = color1;
    byteArray[17] = color1;
    byteArray[18] = color1;
    byteArray[19] = 0x2C;
    byteArray[20] = 0x00;
    byteArray[21] = 0x00;
    byteArray[22] = 0x00;
    byteArray[23] = 0x00;
    byteArray[24] = wLo;
    byteArray[25] = wHi;
    byteArray[26] = hLo;
    byteArray[27] = hHi;
    byteArray[28] = 0x00;

    const encoder = new MonochromeGIFFrameEncoder(this.width, byteArray);
    encoder.encodeFrame(29, this.frame);

    return encoder.byteArray;
  }

  static async FromPBM(filePath: string): Promise<Canvas> {
    const data = await Deno.readTextFile(filePath);

    const MagicNumbers = "P1\n";
    // Require P1
    let i = 0;
    for (; i < 3; i++) {
      if (data.charCodeAt(i) !== MagicNumbers.charCodeAt(i)) {
        throw new Error("Not an ASCII formatted PBM");
      }
    }

    // Jump over comment(s)
    const comments = [];
    while (data.charCodeAt(i) === 0x23) {
      const currentComment = i;
      for (; i < data.length; i++) {
        if (data.charCodeAt(i) === 0x0a) break;
      }
      comments.push(data.substring(currentComment + 1, i));
      i++;
    }

    const lines = data.split("\n").filter((line) => !line.startsWith("#")); // Remove comments
    const [width, height] = lines[1].split(" ").map(Number);
    const pixels = lines.slice(2).join("").replace(/\s+/g, ""); // Flatten pixel data

    const canvas = new Canvas(width, height, false);
    canvas.comments = comments;

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (pixels[y * width + x] === "1") {
          canvas.draw(new Coord(x, y));
        }
      }
    }

    return canvas;
  }
}
