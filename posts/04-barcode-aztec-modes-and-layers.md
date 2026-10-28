# How Aztec builds words around a central finder

Part 4 of 6. Trace mode choices, six-bit data words, two kinds of parity and the layers surrounding Aztec’s bullseye.

Aztec’s central bullseye makes it recognizable, but the message is encoded in the layers around it. The constructor tracks candidate encodings across Upper, Lower, Mixed, Punctuation, Digit and Binary modes. It compares the cost of staying in a mode, shifting for a character, or latching into another mode, then retains the lowest-cost sequence.

## Follow the mode change for ABC123

A, B and C have values 2, 3 and 4 in Upper mode. The selected path latches to Digit mode with value 30, then writes 1, 2 and 3 as values 3, 4 and 5. Upper-mode characters and the latch take five bits each; the three digits take four bits each.

```text
Upper A     00010
Upper B     00011
Upper C     00100
Digit latch 11110
Digit 1     0011
Digit 2     0100
Digit 3     0101

32 bits before final padding
Pad to 36 bits with four 1 bits

Six-bit words:
000100 001100 100111 100011 010001 011111
     4     12     39     35     17     31
```

## Choose a word size and avoid reserved patterns

This short example uses six-bit words. Larger inputs can use eight, ten or twelve bits per word. appendBitsToStream handles word boundaries and inserts a bit when the first word-size-minus-one bits are all zero or all one. That prevents a data word from becoming an all-zero or all-one reserved value. The ABC123 sequence does not need such an inserted bit; its last word is completed with padding.

The constructor uses an error-correction percentage to estimate space and select a layer count. The example calls new AztecCode("ABC123", 25, 0), allowing automatic layer selection. The 25 argument influences sizing; it is not a measurement that exactly 25 percent of the resulting codewords are parity.

## Protect the payload and the mode message separately

```text
Payload field: GF(64), polynomial 0x43, first root 2
Data words:   4 12 39 35 17 31
Parity words: 19 18 51 58 52 48 23 61 42 5 49

Total: 17 six-bit words = 102 bits

Compact mode message before parity:
Layer count minus one = 0
Data-word count minus one = 5
Nibbles: 0 0 5
Mode-message parity: 1 7 13 10 5
```

The mode message has its own Reed–Solomon calculation over GF(16), with polynomial 0x13. It tells the reader how to interpret the surrounding symbol. The payload parity is calculated in a different field selected for the word size. The proof records both calls, so the small parameter message cannot be mistaken for the encoded text.

## Place the words around the bullseye

The selected compact symbol has one layer and is 15 modules square. ModuleCanvas draws the central alternating rings, orientation marks and mode message, then walks around the center in pairs of module positions to place the data and parity. In this implementation placement pops words from the supplied array, so inspecting that array afterward would misleadingly show it as empty. The proof captures the Reed–Solomon output before placement consumes it.

![Compact one-layer Aztec generated from ABC123. The symbol itself is 15 × 15 modules. Four white modules have been added on each side for display, making a 23 × 23 grid and a 230 × 230 pixel GIF.](../proof/aztec.gif)

Compact one-layer Aztec generated from ABC123. The symbol itself is 15 × 15 modules. Four white modules have been added on each side for display, making a 23 × 23 grid and a 230 × 230 pixel GIF.

The added white border is a presentation choice in this proof, not a claim that Aztec shares QR’s four-module quiet-zone requirement. The independently decoded image contains 120 dark modules. A separate 360-character case selects a full 61 × 61 symbol, uses ten-bit words, and also decodes correctly.

## A JavaScript string is not a byte array

The binary path calls charCodeAt and writes eight bits from each JavaScript code unit. It does not first encode the string as UTF-8. That distinction matters for characters outside the basic byte range: the euro-sign probe did not independently decode back to its input. The successful ASCII examples establish the traced path; they do not establish arbitrary Unicode support.

## Sources and evidence

- [aztec_code/mod.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/aztec_code/mod.ts)
- [aztec_code/lib/constants.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/aztec_code/lib/constants.ts)
- [aztec_code/lib/appendBitsToStream.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/aztec_code/lib/appendBitsToStream.ts)
- [aztec_code/lib/ModuleCanvas.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/aztec_code/lib/ModuleCanvas.ts)
- [reed_solomon/lib/ReedSolomon.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/reed_solomon/lib/ReedSolomon.ts)
- [Executable encoding trace](https://forit.us/public/barcode-proof/traces.json)
- [Independent decoder results](https://forit.us/public/barcode-proof/verification.json)

[Series index](../README.md) · [Journal edition](https://forit.us/journal/barcode-aztec-modes-and-layers)
