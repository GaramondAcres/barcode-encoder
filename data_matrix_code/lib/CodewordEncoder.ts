/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { GaloisField, ReedSolomonEncoder } from "../../reed_solomon/mod.ts";

const DATAMATRIX_FIELD = new GaloisField(0x100, 0x12d, 2);

const ENCODER_CACHE: Array<ReedSolomonEncoder> = [];

const EncodingMode = {
  DataMatrixASCII: 0x10,
  DataMatrixC40: 0x11,
  DataMatrixText: 0x12,
  DataMatrixX12: 0x13,
};

export class CodewordEncoder {
  private blocks: number[];
  private mode: number;

  constructor() {
    this.blocks = [];
    this.mode = EncodingMode.DataMatrixASCII;
  }

  appendSegment(text: Uint8Array, mode: number) {
    if (mode == EncodingMode.DataMatrixASCII) {
      const unpacked = [];

      for (let i = 0; i < text.byteLength; i += 1) {
        const byte = text[i] & 0x7f;
        unpacked.push(byte);
      }

      if (this.mode !== EncodingMode.DataMatrixASCII) {
        this.blocks.push(0xfe);
        this.mode = EncodingMode.DataMatrixASCII;
      }

      for (let i = 0; i < unpacked.length; i += 1) {
        const v = unpacked[i] + 1;
        this.blocks.push(v & 0xff);
      }
    } else if (mode == EncodingMode.DataMatrixC40) {
      const unpacked = [];
      for (let i = 0; i < text.byteLength; i += 1) {
        const byte = text[i];

        if (byte == 0x20) {
          unpacked.push(0x03);
        } else if (byte >= 0x30 && byte <= 0x39) {
          unpacked.push(byte - 0x30 + 4); // 0x30 - 0x39 begin at 4.
        } else if (byte >= 0x41 && byte <= 0x5a) {
          unpacked.push(byte - 0x41 + 14); // 0x41 - 0x5a begin at 14.
        } else if (byte < 0x20) { // ' '
          unpacked.push(0x00);
          unpacked.push(byte);
        } else if (byte <= 0x2f) { // '/'
          unpacked.push(0x01);
          unpacked.push(byte - 0x21); // 0x21 - 0x2f begin at 0
        } else if (byte <= 0x40) { // '@'
          unpacked.push(0x01);
          unpacked.push(byte - 0x3a + 15); // 0x3a - 0x40 begin at 15
        } else if (byte <= 0x5f) { //  '_'
          unpacked.push(0x01);
          unpacked.push(byte - 0x5b + 22); // 0x5b - 0x5f begin at 22
        } else if (byte <= 0x7f) {
          unpacked.push(0x02);
          unpacked.push(byte - 0x60);
        } else {
          unpacked.push(0x01);
          unpacked.push(0x1e); // Hibit
          unpacked.push(byte - 0x80);
        }
      }

      if (
        this.mode !== EncodingMode.DataMatrixC40 &&
        this.mode !== EncodingMode.DataMatrixASCII
      ) {
        this.blocks.push(0xfe);
        this.mode = EncodingMode.DataMatrixASCII;
      }

      if (this.mode !== EncodingMode.DataMatrixC40) {
        this.blocks.push(0xe6);
        this.mode = EncodingMode.DataMatrixC40;
      }

      for (let i = 0; i < unpacked.length; i += 3) {
        let v = 0x640 * unpacked[i] + 1;
        if (i + 1 < unpacked.length) v += 0x28 * unpacked[i + 1];
        if (i + 2 < unpacked.length) v += unpacked[i + 2];

        this.blocks.push((v >>> 8) & 0xff);
        this.blocks.push(v & 0xff);
      }
    } else if (mode == EncodingMode.DataMatrixX12) {
      const ToX12 = (byte: number) => {
        if (byte > 0x2f && byte < 0x3a) {
          return byte - 0x2c;
        } else if (byte > 0x40 && byte < 0x5b) {
          return byte - 0x33;
        } else if (byte === 0x0d) {
          return 0x00;
        } else if (byte === 0x2a) {
          return 0x01;
        } else if (byte === 0x3e) {
          return 0x02;
        } else if (byte === 0x20) {
          return 0x03;
        } else {
          return 0x03; // Any other character maps to space
        }
      };

      if (
        this.mode !== EncodingMode.DataMatrixX12 &&
        this.mode !== EncodingMode.DataMatrixASCII
      ) {
        this.blocks.push(0xfe);
        this.mode = EncodingMode.DataMatrixASCII;
      }

      if (this.mode !== EncodingMode.DataMatrixX12) {
        this.blocks.push(0xee);
        this.mode = EncodingMode.DataMatrixX12;
      }

      for (let i = 0; i < text.byteLength; i += 3) {
        let v = ToX12(text[i]);

        v = 0x640 * v + 1;
        if (i + 1 < text.byteLength) v += 0x28 * ToX12(text[i + 1]);
        if (i + 2 < text.byteLength) v += ToX12(text[i + 2]);

        this.blocks.push((v >>> 8) & 0xff);
        this.blocks.push(v & 0xff);
      }

      this.mode = EncodingMode.DataMatrixX12;
    } else if (mode == EncodingMode.DataMatrixText) {
      const unpacked = [];
      for (let i = 0; i < text.byteLength; i += 1) {
        const byte = text[i];

        if (byte == 0x20) {
          unpacked.push(0x03);
        } else if (byte >= 0x30 && byte <= 0x39) {
          unpacked.push(byte - 0x30 + 4); // 0x30 - 0x39 begin at 4.
        } else if (byte >= 0x61 && byte <= 0x7a) {
          unpacked.push(byte - 0x61 + 14); // 0x61 - 0x7a begin at 14.
        } else if (byte < 0x20) { // ' '
          unpacked.push(0x00);
          unpacked.push(byte);
        } else if (byte <= 0x2f) { // '/'
          unpacked.push(0x01);
          unpacked.push(byte - 0x21); // 0x21 - 0x2f begin at 0
        } else if (byte <= 0x40) { // '@'
          unpacked.push(0x01);
          unpacked.push(byte - 0x3a + 15); // 0x3a - 0x40 begin at 15
        } else if (byte >= 0x5b && byte <= 0x5f) { // '[' '_'
          unpacked.push(0x01);
          unpacked.push(byte - 0x5b + 22); // 0x5b - 0x5f begin at 22
        } else if (byte == 0x60) { // '`'
          unpacked.push(0x02);
          unpacked.push(0x00); // 0x60 begins at 0
        } else if (byte <= 0x5a) { // 0x5a
          unpacked.push(0x02);
          unpacked.push(byte - 0x41 + 1); // 0x41 - 0x5a begin at 1
        } else {
          unpacked.push(0x01);
          unpacked.push(0x1e); // Hibit
          unpacked.push(byte - 0x80);
        }
      }

      if (
        this.mode !== EncodingMode.DataMatrixText &&
        this.mode !== EncodingMode.DataMatrixASCII
      ) {
        this.blocks.push(0xfe);
        this.mode = EncodingMode.DataMatrixASCII;
      }

      if (this.mode !== EncodingMode.DataMatrixText) {
        this.blocks.push(0xef);
        this.mode = EncodingMode.DataMatrixText;
      }

      for (let i = 0; i < unpacked.length; i += 3) {
        let v = 0x640 * unpacked[i] + 1;
        if (i + 1 < unpacked.length) v += 0x28 * unpacked[i + 1];
        if (i + 2 < unpacked.length) v += unpacked[i + 2];

        this.blocks.push((v >>> 8) & 0xff);
        this.blocks.push(v & 0xff);
      }
    }

    return this;
  }

  getBlockLength() {
    return this.blocks.length;
  }

  toArray(
    codewordCount: number,
    eccPerBlock: number,
    blocksCount: number,
  ): number[] {
    const Randomize253State = (codewordPosition: number) => {
      const pseudoRandom = ((149 * codewordPosition) % 253) + 1;
      const tempVariable = 0x81 + pseudoRandom;
      return tempVariable <= 254 ? tempVariable : tempVariable - 254;
    };

    // return to ASCII
    if (
      this.blocks.length < codewordCount &&
      this.mode !== EncodingMode.DataMatrixASCII
    ) {
      this.blocks.push(0xfe);
    }

    // End
    if (this.blocks.length < codewordCount) {
      this.blocks.push(0x81);
    }

    // Fill to capacity
    while (this.blocks.length < codewordCount) {
      this.blocks.push(Randomize253State(this.blocks.length + 1));
    }

    const codewords: number[] = [];

    if (!ENCODER_CACHE[eccPerBlock]) {
      ENCODER_CACHE[eccPerBlock] = new ReedSolomonEncoder(
        DATAMATRIX_FIELD,
        eccPerBlock,
      );
    }

    // Add ECC blocks
    if (blocksCount == 1) {
      for (let i = 0; i < this.blocks.length; i += 1) {
        const b = this.blocks[i];
        codewords.push(b & 0xff);
      }

      return ENCODER_CACHE[eccPerBlock].encode(codewords);
    }

    const codewordsPerBlock = Math.floor(codewordCount / blocksCount); // Total data codewords per block
    const blocks: number[][] = Array.from({ length: blocksCount }, () => []);

    // Distribute data codewords into interleaved blocks
    for (let i = 0; i < codewordCount; i++) {
      const blockIndex = i % blocksCount;
      blocks[blockIndex].push(this.blocks[i]);
      codewords.push(this.blocks[i]); // Add directly to final codewords
    }

    // Generate ECC for each block
    for (let i = 0; i < blocksCount; i++) {
      blocks[i] = ENCODER_CACHE[eccPerBlock].encode(blocks[i]); // Generate ECC
    }

    // Add ECC to the final interleaved output
    for (let j = 0; j < eccPerBlock; j++) {
      for (let i = 0; i < blocksCount; i++) {
        codewords.push(blocks[i][codewordsPerBlock + j] & 0xff); // Interleaved ECC
      }
    }

    return codewords;
  }
}
