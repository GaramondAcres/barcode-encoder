/*
 * This file is part of barcode-encoder, released under the MIT License.
 * See the LICENSE file in the root of the repository for details.
 */

export const LARGE_NUMBER = 20000;

export const latchLength = [
  [0, 5, 5, 10, 5, 10],
  [9, 0, 5, 10, 5, 10],
  [5, 5, 0, 5, 10, 10],
  [5, 10, 10, 0, 10, 15],
  [4, 9, 9, 14, 0, 14],
  [0, 0, 0, 0, 0, 0],
];

export const shiftLength = [
  [0, LARGE_NUMBER, LARGE_NUMBER, 5, LARGE_NUMBER],
  [5, 0, LARGE_NUMBER, 5, LARGE_NUMBER],
  [LARGE_NUMBER, LARGE_NUMBER, 0, 5, LARGE_NUMBER],
  [LARGE_NUMBER, LARGE_NUMBER, LARGE_NUMBER, 0, LARGE_NUMBER],
  [4, LARGE_NUMBER, LARGE_NUMBER, 4, 0],
];

export const latchTable = [
  [
    [],
    [28],
    [29],
    [29, 30],
    [30],
    [31],
  ], // from upper to ULMPDB
  [
    [30, 14],
    [],
    [29],
    [29, 30],
    [30],
    [31],
  ], // lower
  [
    [29],
    [28],
    [],
    [30],
    [28, 30],
    [31],
  ], // mixed
  [
    [31],
    [31, 28],
    [31, 29],
    [],
    [31, 30],
    [31, 31],
  ], // punct
  [
    [14],
    [14, 28],
    [14, 29],
    [14, 29, 30],
    [],
    [14, 31],
  ], // digit
];

export const characterMap = [
  "  ABCDEFGHIJKLMNOPQRSTUVWXYZ", // upper
  "  abcdefghijklmnopqrstuvwxyz", // lower
  String.fromCharCode(
    0,
    32,
    1,
    2,
    3,
    4,
    5,
    6,
    7,
    8,
    9,
    10,
    11,
    12,
    13,
    7,
    28,
    29,
    30,
    31,
    64,
    92,
    94,
    95,
    96,
    124,
    126,
    127,
  ), // mixed
  " \r\r\r\r\r!\"#$%&'()*+,-./:;<=>?[]{}", // punct
  "  0123456789,.", // digit
];
