/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

export class Coord {
  constructor(
    public x: number,
    public y: number,
    public isDark: number = 1, // 0 or 1
    public isModule: number = 0, // 0 or 1
  ) {}
}
