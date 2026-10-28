# What independent decoding proves and where the encoder fails

Part 6 of 6. Reproduce 23 successful round trips, inspect five failing edge cases and separate image fidelity from message correctness.

The final check begins with the rendered file. A separate library opens the GIF, identifies the barcode family and returns its decoded bytes. Those bytes must equal the original input. This closes the path from text through the encoder and raster writer to a reader that does not share this repository’s encoding implementation.

## Reproduce the run

The encoder source is pinned to revision 55aa1da55456318be29a125d7c48ad1c0772184c. The accompanying examples/prove.ts runner records the encoding stages and writes GIF, SVG and PBM artifacts into proof/. examples/decode.py uses Pillow and ZXing-C++ to check the actual GIF files. The run described here used Deno 2.8.3, ZXing-C++ 2.3.0 and Pillow 11.3.0.

```text
git clone --branch docs/barcode-proof-series https://github.com/GaramondAcres/barcode-encoder.git
cd barcode-encoder
# Use the proof-series checkout containing examples/ and posts/.

deno check mod.ts examples/prove.ts
deno run --allow-read --allow-write=proof examples/prove.ts
python3 -m venv .venv
.venv/bin/pip install -r examples/requirements.txt
.venv/bin/python examples/decode.py
```

The encoder modules were left unchanged for this run. The runner observes calls to the existing Reed–Solomon encoder and reads initial codeword state; it does not replace encoding arithmetic. It computes complete Data Matrix canvas bounds and adds Aztec display whitespace. These rendering choices are recorded in the trace.

## Twenty-three cases pass

- Three headline GIFs: QR, Data Matrix C40 and Aztec all return ABC123.
- Data Matrix ASCII and X12 return ABC123; Text returns abc123.
- QR byte mode returns abc123.
- QR versions 2, 4, 7, 10 and 14 each return ABC123.
- All eight forced QR masks return ABC123.
- A 72-character Data Matrix with four data regions returns all 72 characters.
- Aztec returns abc123 and the full 360-character larger-symbol input.

For each successful case, the test checks the detected barcode family, the exact decoded bytes, the GIF file hash and pixel equality with the module map. The larger QR cases exercise different capacities and block layouts. They do not amount to exhaustive testing of all 40 versions or every input boundary.

## Five deliberate inputs expose limitations

```text
Probe                   Input / setting        Observed result
QR capacity             100 A’s, version 1      no decoded barcode
Data Matrix ASCII       é, mode 0x10           C)
Data Matrix mode enum   ABC123, mode 0         no decoded barcode
Data Matrix X12         AB?123, mode 0x13      AB 123
Aztec Unicode          €, default sizing      no decoded barcode
```

The Data Matrix ASCII failure has a direct byte-level explanation. UTF-8 encodes é as C3 A9. This ASCII path masks each byte with 7F, producing 43 29, the bytes for C). Error correction then protects that altered message perfectly well. A barcode can therefore scan successfully while carrying the wrong content.

X12 has a similar problem with unsupported characters: the code maps them to space. The exported Data Matrix mode constants also differ from the values accepted by its internal dispatcher. QR overflow returns an empty codeword list instead of rejecting the request. Aztec’s binary path writes eight bits from UTF-16 code units, so its handling of arbitrary Unicode cannot be assumed to preserve UTF-8.

## Geometry is a separate failure boundary

The Data Matrix size helper reports 12 modules for the sample that needs 14 including quiet zone, and 18 for the multi-region example that needs 38. Using those reported dimensions directly can crop a valid coordinate set. The rendering adapter uses regionsPerSide × (dataRegionWidth + 2) + 2 instead, and validates that every emitted coordinate fits. The barcode’s geometry must be correct before a decoder has a fair chance to read it.

## What the evidence establishes

The GIF writer reproduced the recorded module maps exactly for all 28 cases. Twenty-three of those images independently recovered the intended message and family. Five did not, and their actual results remain in verification.json. A failed edge case is recorded as a known limitation rather than counted as a successful round trip.

These checks establish reproducible behavior for the tested source and inputs. They do not establish print quality, recovery after physical damage, every possible mode transition or production-wide standards conformance. The practical result is a set of working examples with visible intermediate states, plus specific failures that a future encoder change can turn into regression tests. The current source does not justify presenting arbitrary text as safely supported.

## Sources and evidence

- [quick_response_code/lib/CodewordEncoder.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/quick_response_code/lib/CodewordEncoder.ts)
- [data_matrix_code/mod.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/data_matrix_code/mod.ts)
- [data_matrix_code/lib/CodewordEncoder.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/data_matrix_code/lib/CodewordEncoder.ts)
- [aztec_code/mod.ts](https://github.com/GaramondAcres/barcode-encoder/blob/55aa1da55456318be29a125d7c48ad1c0772184c/aztec_code/mod.ts)
- [Encoding and rendering runner](https://forit.us/public/barcode-proof/prove.txt)
- [Independent decoder script](https://forit.us/public/barcode-proof/decode.py)
- [ZXing-C++ source](https://github.com/zxing-cpp/zxing-cpp)
- [Executable encoding trace](https://forit.us/public/barcode-proof/traces.json)
- [Independent decoder results](https://forit.us/public/barcode-proof/verification.json)

[Series index](../README.md) · [Journal edition](https://forit.us/journal/barcode-independent-decoding-and-limits)
