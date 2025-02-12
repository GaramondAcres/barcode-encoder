/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

const base64abc =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".split("");

export function encodeBase64(uint8: Uint8Array): string {
  let result = "";
  let i;
  const l = uint8.length;
  for (i = 2; i < l; i += 3) {
    result += base64abc[(uint8[i - 2]!) >> 2];
    result += base64abc[
      (((uint8[i - 2]!) & 0x03) << 4) |
      ((uint8[i - 1]!) >> 4)
    ];
    result += base64abc[
      (((uint8[i - 1]!) & 0x0f) << 2) |
      ((uint8[i]!) >> 6)
    ];
    result += base64abc[(uint8[i]!) & 0x3f];
  }
  if (i === l + 1) {
    // 1 octet yet to write
    result += base64abc[(uint8[i - 2]!) >> 2];
    result += base64abc[((uint8[i - 2]!) & 0x03) << 4];
    result += "==";
  }
  if (i === l) {
    // 2 octets yet to write
    result += base64abc[(uint8[i - 2]!) >> 2];
    result += base64abc[
      (((uint8[i - 2]!) & 0x03) << 4) |
      ((uint8[i - 1]!) >> 4)
    ];
    result += base64abc[((uint8[i - 1]!) & 0x0f) << 2];
    result += "=";
  }
  return result;
}

export function decodeBase64(b64: string): Uint8Array {
  const binString = atob(b64);
  const size = binString.length;
  const bytes = new Uint8Array(size);
  for (let i = 0; i < size; i++) {
    bytes[i] = binString.charCodeAt(i);
  }
  return bytes;
}
