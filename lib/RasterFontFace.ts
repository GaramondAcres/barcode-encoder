/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

import { decode } from "https://deno.land/std@0.134.0/encoding/base64.ts";
import { Canvas } from "./Canvas.ts";

export default class RasterFontFace {
  characterWidths: Array<number>;
  characterMaxWidth: number;
  characterHeight: number;
  image: Canvas;

  constructor(image: Canvas) {
    this.characterWidths = ((CharacterWidthsEncoded) => {
      const array = [];
      const CharacterWidthsDecoded = decode(CharacterWidthsEncoded);
      for (let i = 0; i < CharacterWidthsDecoded.length; i++) {
        array.push(CharacterWidthsDecoded[i] * 2);
      }
      return array;
    })(image.comments[0]);

    this.characterMaxWidth = image.width / 6;
    this.characterHeight = image.height / 16;
    this.image = image;
  }

  typeSetVertical(
    image: Canvas,
    options: { x: number; y: number; text: string; fill?: number },
  ) {
    let x = options.x;
    let y = options.y;
    const fill = options.fill ?? 0;

    const imageRoundWidth = Math.ceil(image.width / 8) * 8;

    for (let i = 0; i < options.text.length; i++) {
      const charCode = options.text.charCodeAt(i);

      if (charCode === 0x0a) {
        y = options.y;
        x += Math.floor(this.characterHeight * 0.85);
        continue;
      }

      const charWidth = this.characterWidths[charCode - 0x20];

      const fontFaceX = this.characterMaxWidth *
        Math.floor((charCode - 0x20) / 0x10);
      const fontFaceY = this.characterHeight * ((charCode - 0x20) % 0x10);

      for (let h = this.characterHeight; h--;) {
        const sY = fontFaceY + h;
        const dY = x + h;

        for (let w = Math.min(this.characterMaxWidth, charWidth + 10); w--;) {
          const sX = fontFaceX + w;
          const dX = y - w;

          const tpixel = this.image.frame[this.image.width * sY + sX];

          if (tpixel) continue;

          image.frame[imageRoundWidth * dX + dY] = fill;
        }
      }

      y -= Math.max(0, Math.round(charWidth - (this.characterMaxWidth / 6.75)));
    }

    return;
  }

  typeSet(
    image: Canvas,
    options: { x: number; y: number; text: string; fill?: number },
  ) {
    let x = options.x;
    let y = options.y;
    const fill = options.fill ?? 0;

    const imageRoundWidth = Math.ceil(image.width / 8) * 8;

    for (let i = 0; i < options.text.length; i++) {
      const charCode = options.text.charCodeAt(i);

      if (charCode === 0x0a) {
        y += Math.floor(this.characterHeight * 0.85);
        x = options.x;
        continue;
      }

      const charWidth = this.characterWidths[charCode - 0x20];

      const fontFaceX = this.characterMaxWidth *
        Math.floor((charCode - 0x20) / 0x10);
      const fontFaceY = this.characterHeight * ((charCode - 0x20) % 0x10);

      for (let h = this.characterHeight; h--;) {
        const sY = fontFaceY + h;
        const dY = y + h;

        for (let w = Math.min(this.characterMaxWidth, charWidth + 10); w--;) {
          const sX = fontFaceX + w;
          const dX = x + w;

          const tpixel = this.image.frame[this.image.width * sY + sX];

          if (tpixel) continue;

          image.frame[imageRoundWidth * dY + dX] = fill;
        }
      }

      x += Math.max(0, Math.round(charWidth - (this.characterMaxWidth / 6.75)));
    }

    return;
  }
}
