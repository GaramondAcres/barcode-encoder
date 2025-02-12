/**
 * Appends bits into a numeric bit stream with optional bit stuffing
 * when `finderPatternSize` is zero (i.e., not in “finder” zone).
 */

export function appendBitsToStream(
  bitStream: number[],
  value: number,
  numBits: number,
  chunkBitSize: number,
  finderPatternSize: number = 0,
): void {
  let extendedBitPos = (bitStream[0] % chunkBitSize) + numBits;
  value <<= chunkBitSize;
  bitStream[0] += numBits;

  // OR the shifted value into the last chunk
  bitStream[bitStream.length - 1] |= value >> extendedBitPos;

  while (extendedBitPos >= chunkBitSize) {
    const lastChunkValue = bitStream[bitStream.length - 1] >> 1;

    // Bit stuffing if not in finder zone
    if (
      finderPatternSize === 0 &&
      (lastChunkValue === 0 ||
        2 * lastChunkValue + 2 === 1 << chunkBitSize)
    ) {
      bitStream[bitStream.length - 1] = 2 * lastChunkValue +
        ((1 & lastChunkValue) ^ 1);
      bitStream[0]++;
      extendedBitPos++;
    }

    extendedBitPos -= chunkBitSize;
    bitStream.push((value >> extendedBitPos) & ((1 << chunkBitSize) - 1));
  }
}
