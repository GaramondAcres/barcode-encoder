/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { GaloisField, ReedSolomonEncoder } from "../../reed_solomon/mod.ts";

const QR_FIELD = new GaloisField(0x100, 0x11d, 1); // x^8 + x^4 + x^3 + x^2 + 1
const ENCODER_CACHE: Array<ReedSolomonEncoder> = [];

export class CodewordEncoder {
  private version: number;
  private blocks: number[];

  constructor(version: number) {
    this.version = version;
    this.blocks = [];
  }

  appendSegment(text: Uint8Array, mode: number) {
    const appendBits = (val: number, length: number): void => {
      for (let i = length - 1; i >= 0; i--) {
        this.blocks.push((val >>> i) & 1);
      }
    };

    if (mode == 0x02) {
      // Alphanumeric indicator
      appendBits(0b0010, 4);

      // 9, 11, 13
      if (this.version <= 9) {
        appendBits(text.byteLength, 9);
      } else if (this.version <= 26) {
        appendBits(text.byteLength, 11);
      } else {
        appendBits(text.byteLength, 13);
      }

      let i = 0;
      while (i + 1 < text.byteLength) {
        const val1 = getAlphanumericValue(String.fromCharCode(text[i]));
        const val2 = getAlphanumericValue(String.fromCharCode(text[i + 1]));
        const combined = val1 * 45 + val2;
        appendBits(combined, 11);
        i += 2;
      }
      if (i < text.byteLength) {
        appendBits(getAlphanumericValue(String.fromCharCode(text[i])), 6);
      }
    } else if (mode == 0x04) {
      // Byte mode indicator
      appendBits(0b0100, 4);

      // 8, 16, 16
      if (this.version <= 9) {
        appendBits(text.byteLength, 8);
      } else if (this.version <= 26) {
        appendBits(text.byteLength, 16);
      } else {
        appendBits(text.byteLength, 16);
      }

      for (const c of text) {
        appendBits(c, 8);
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
    // Add terminator
    const totalDataBits = codewordCount * 8;
    const remaining = totalDataBits - this.blocks.length;
    if (remaining > 0) {
      const terminatorBits = Math.min(remaining, 4);
      for (let i = 0; i < terminatorBits; i++) {
        this.blocks.push(0);
      }
    }

    // Bit padding to byte boundary (0..7 bits)
    while (this.blocks.length % 8 !== 0) {
      this.blocks.push(0);
    }

    // Stuff bits to codewords.
    const codewords: number[] = [];

    for (let i = 0; i < this.blocks.length; i += 8) {
      let b = 0;
      for (let j = 0; j < 8; j++) {
        b = (b << 1) | (this.blocks[i + j] & 1);
      }
      codewords.push(b);
    }

    // Length must be codewordCount
    // Fill with alternating bytes
    const padBytes = codewordCount - (this.blocks.length / 8);
    let pad = 1;
    for (let i = 0; i < padBytes; i++) {
      const val = pad ? 0xEC : 0x11;
      codewords.push(val);
      pad = 1 ^ pad;
    }

    if (codewords.length > codewordCount) {
      return [];
    }

    if (!ENCODER_CACHE[eccPerBlock]) {
      ENCODER_CACHE[eccPerBlock] = new ReedSolomonEncoder(
        QR_FIELD,
        eccPerBlock,
      );
    }

    if (blocksCount > 1) {
      const allCodewords: number[] = [];
      // Determine how many "short blocks" vs. "long blocks" exist
      //    - The remainder (rawCodewords % numBlocks) blocks get 1 extra data byte
      //    - The difference (numBlocks - remainder) blocks are "short blocks"
      const rawCodewords = codewordCount + (eccPerBlock * blocksCount);
      const remainder = rawCodewords % blocksCount;
      const numShortBlocks = blocksCount - remainder;
      // Each short block has this many total bytes (data + ECC)
      const shortBlockLen = Math.floor(rawCodewords / blocksCount);

      // Split the data into blocks, append ECC to each
      const blocks: number[][] = [];
      let offset = 0;
      for (let i = 0; i < blocksCount; i++) {
        // Decide how many bytes of data this block gets.
        const isShortBlock = i < numShortBlocks;
        const dataLen = (shortBlockLen - eccPerBlock) +
          (isShortBlock ? 0 : 1);

        // Slice the appropriate segment from the data
        const blockData = codewords.slice(offset, offset + dataLen);
        offset += dataLen;

        // Combine the data and ECC
        const fullBlock = ENCODER_CACHE[eccPerBlock].encode(blockData);
        if (isShortBlock) {
          // Short block; Add a placeholder
          fullBlock.splice(dataLen, 0, 0);
        }

        blocks.push(fullBlock);
      }

      for (let i = 0; i < blocks[0].length; i++) {
        blocks.forEach((block: number[], j) => {
          if (i != shortBlockLen - eccPerBlock || j >= numShortBlocks) {
            allCodewords.push(block[i]);
          }
        });
      }

      return allCodewords;
    } else {
      return ENCODER_CACHE[eccPerBlock].encode(codewords);
    }
  }
}

const ALPHANUMERIC_CHARSET = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:";

/**
 * Returns the zero-based index of an alphanumeric character from the charset,
 * or -1 if the character is not found.
 */
function getAlphanumericValue(char: string): number {
  return ALPHANUMERIC_CHARSET.indexOf(char);
}
