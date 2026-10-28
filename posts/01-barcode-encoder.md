# From text to a verified barcode

Part 1 of 6. Follow the same six characters through QR, Data Matrix and Aztec, then check the rendered images with an independent decoder.

A barcode begins as a message and ends as a pattern of dark and light squares. Between those points, an encoder chooses a representation, adds error correction and assigns bits to positions. A renderer turns those positions into pixels. Keeping those steps visible lets us answer a more useful question than “does this look like a barcode?”: does the image preserve the intended message?

This series follows ABC123 through the actual QR, DataMatrix and AztecCode classes in GaramondAcres/barcode-encoder. The examples run the unchanged encoder at revision 55aa1da55456318be29a125d7c48ad1c0772184c. The added proof runner records the intermediate values and uses the repository’s own Canvas to write GIF files. The three images below were read independently by ZXing-C++ 2.3.0; each returned the six bytes 41 42 43 31 32 33 in hexadecimal.

## The same message takes three paths

```text
Input string       ABC123
UTF-8 bytes        41 42 43 31 32 33

QR                 alphanumeric pairs → 8-bit codewords
                   → Reed–Solomon → placement + mask
Data Matrix        C40 triples → 8-bit codewords
                   → Reed–Solomon → Utah placement
Aztec              mode decisions → stuffed 6-bit words
                   → Reed–Solomon → concentric layers

All three          module coordinates → black/white pixels
                   → GIF → independent decoder → ABC123
```

A module is one square in the symbol grid. A codeword is a group of bits interpreted by the encoding and error-correction rules. They are different units: one codeword becomes several modules, while finder patterns and other structural modules do not carry message bytes. A pixel is smaller still when a renderer draws each module as a ten-by-ten square.

![QR version 1 at error-correction level H. The 21 × 21 symbol has a four-module quiet zone, producing a 29 × 29 grid and a 290 × 290 pixel GIF. Decoded payload: ABC123.](../proof/qr.gif)

QR version 1 at error-correction level H. The 21 × 21 symbol has a four-module quiet zone, producing a 29 × 29 grid and a 290 × 290 pixel GIF. Decoded payload: ABC123.

![Data Matrix in C40 mode. A 10 × 10 data region becomes a 12 × 12 symbol after its border, then a 14 × 14 grid with a one-module quiet zone. Decoded payload: ABC123.](../proof/data-matrix.gif)

Data Matrix in C40 mode. A 10 × 10 data region becomes a 12 × 12 symbol after its border, then a 14 × 14 grid with a one-module quiet zone. Decoded payload: ABC123.

![Compact Aztec with one layer and six-bit words. The 15 × 15 symbol is shown with four extra white modules on each side, producing a 230 × 230 pixel GIF. Decoded payload: ABC123.](../proof/aztec.gif)

Compact Aztec with one layer and six-bit words. The 15 × 15 symbol is shown with four extra white modules on each side, producing a 230 × 230 pixel GIF. Decoded payload: ABC123.

## What counts as evidence

The proof crosses three boundaries. First, the trace records the bytes, codewords and error-correction inputs. Second, the renderer’s GIF pixels are compared against a separately written module map. Third, an independent barcode reader checks the GIF’s symbology and decoded bytes. A hash makes the tested file identifiable; it cannot establish that the file is a correct barcode by itself.

Twenty-three cases passed both pixel equality and independent decoding. They include the three headline examples, alternative character modes, all eight QR masks, several QR versions, a Data Matrix with four regions and a larger Aztec symbol. Five deliberate edge cases show where the current API loses information or fails to encode. These are bounded regression results for these inputs, rather than a claim that every mode, size or possible message is correct.

## Read the series

- Part 2 unpacks QR mode bits, paired characters, padding, error correction and masks.
- Part 3 shows Data Matrix C40 arithmetic, region borders and Utah placement.
- Part 4 follows Aztec mode changes, word stuffing, error correction and layer placement.
- Part 5 connects module coordinates to the actual GIF byte stream.
- Part 6 reproduces the independent checks and documents the observed limits.

The navigation above links the six posts in order. Every numeric example is tied to the checked-out source and the downloadable trace. The final post includes the commands needed to regenerate the evidence.

## Sources and evidence

- [mod.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/mod.ts)
- [quick_response_code/mod.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/quick_response_code/mod.ts)
- [data_matrix_code/mod.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/data_matrix_code/mod.ts)
- [aztec_code/mod.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/aztec_code/mod.ts)
- [lib/Canvas.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/lib/Canvas.ts)
- [Executable encoding trace](https://forit.us/public/barcode-proof/traces.json)
- [Independent decoder results](https://forit.us/public/barcode-proof/verification.json)

[Series index](../README.md) · [Journal edition](https://forit.us/journal/barcode-encoder)
