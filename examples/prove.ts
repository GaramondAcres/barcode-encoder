import { AztecCode, Canvas, DataMatrix, QR } from "../mod.ts";
import { ReedSolomonEncoder } from "../reed_solomon/mod.ts";
import { CodewordEncoder as QRWords } from "../quick_response_code/lib/CodewordEncoder.ts";
import { CodewordEncoder as DMWords } from "../data_matrix_code/lib/CodewordEncoder.ts";
import sourceManifest from "./source-manifest.json" with { type: "json" };

// Observe the existing implementation, without replacing any encoding arithmetic.
let rsCalls: unknown[] = [];
const originalEncode = ReedSolomonEncoder.prototype.encode;
ReedSolomonEncoder.prototype.encode = function (data: number[]) {
  const result = originalEncode.call(this, data);
  rsCalls.push({
    fieldSize: this.field.length + 1,
    polynomial: this.field.generator,
    generatorBase: this.field.base,
    data: [...data],
    parity: result.slice(data.length),
  });
  return result;
};
const output = new URL("../proof/", import.meta.url);
await Deno.mkdir(output, { recursive: true });
const hex = (xs: number[]) =>
  xs.map((x) => x.toString(16).padStart(2, "0").toUpperCase()).join(" ");
const sha = async (bytes: Uint8Array) =>
  hex([...new Uint8Array(await crypto.subtle.digest("SHA-256", new Uint8Array(bytes)))]).replaceAll(" ", "")
    .toLowerCase();
for (const [file, expected] of Object.entries(sourceManifest)) {
  if (await sha(await Deno.readFile(new URL("../" + file, import.meta.url))) !== expected) {
    throw Error(
      `Encoder source changed: ${file}. Review provenance before generating this pinned proof.`,
    );
  }
}
type Spec = {
  id: string;
  family: string;
  input: string;
  version?: number;
  mask?: number;
  mode?: number;
  expected?: string;
  note?: string;
};
const specs: Spec[] = [
  { id: "qr", family: "QR Code", input: "ABC123", version: 1 },
  { id: "data-matrix", family: "Data Matrix", input: "ABC123", mode: 0x11 },
  { id: "aztec", family: "Aztec", input: "ABC123" },
  { id: "dm-ascii", family: "Data Matrix", input: "ABC123", mode: 0x10 },
  { id: "dm-text", family: "Data Matrix", input: "abc123", mode: 0x12 },
  { id: "dm-x12", family: "Data Matrix", input: "ABC123", mode: 0x13 },
  { id: "qr-byte", family: "QR Code", input: "abc123", version: 1 },
  ...[2, 4, 7, 10, 14].map((version) => ({
    id: `qr-v${version}`,
    family: "QR Code",
    input: "ABC123",
    version,
  })),
  ...Array.from(
    { length: 8 },
    (_, mask) => ({ id: `qr-mask-${mask}`, family: "QR Code", input: "ABC123", version: 1, mask }),
  ),
  { id: "dm-regions", family: "Data Matrix", input: "ABC123".repeat(12), mode: 0x10 },
  { id: "aztec-lower", family: "Aztec", input: "abc123" },
  { id: "aztec-full", family: "Aztec", input: "ABC123".repeat(60) },
  {
    id: "qr-overflow",
    family: "QR Code",
    input: "A".repeat(100),
    version: 1,
    expected: "known-limitation",
    note: "Over-capacity QR returns an empty codeword array instead of rejecting the input.",
  },
  {
    id: "dm-unicode-ascii",
    family: "Data Matrix",
    input: "é",
    mode: 0x10,
    expected: "known-limitation",
    note: "ASCII path masks UTF-8 bytes with 0x7f.",
  },
  {
    id: "dm-exported-enum",
    family: "Data Matrix",
    input: "ABC123",
    mode: 0,
    expected: "known-limitation",
    note: "Exported Encoding.ASCII is 0, while the encoder dispatch expects 0x10.",
  },
  {
    id: "dm-x12-loss",
    family: "Data Matrix",
    input: "AB?123",
    mode: 0x13,
    expected: "known-limitation",
    note: "Unsupported X12 characters become spaces.",
  },
  {
    id: "aztec-unicode",
    family: "Aztec",
    input: "€",
    expected: "known-limitation",
    note:
      "Binary path writes JavaScript UTF-16 code units into eight bits without UTF-8 conversion.",
  },
];
const results = [];
for (const spec of specs) {
  rsCalls = [];
  try {
    const symbol = spec.family === "QR Code"
      ? new QR(spec.input, spec.version, spec.mask ?? -1)
      : spec.family === "Data Matrix"
      ? new DataMatrix(spec.input, spec.mode)
      : new AztecCode(spec.input, 25, 0);
    // Read once: upstream QR serialization mutates its bit buffer; Aztec placement consumes words.
    const coords = symbol.getCoords();
    const declaredEdge = symbol.getEdgeLength();
    const info = symbol instanceof DataMatrix ? symbol.symbolInfo : undefined;
    // DM edgeLength is a DATA REGION width. Add region borders and the quiet zone.
    const matrixEdge = info ? info.moduleSqd * (info.edgeLength + 2) + 2 : declaredEdge;
    const margin = symbol instanceof AztecCode ? 4 : 0; // presentation whitespace for Aztec
    const edge = matrixEdge + margin * 2;
    const matrix = Array.from({ length: edge }, () => Array<number>(edge).fill(0));
    for (const c of coords) {
      if (c.x < 0 || c.y < 0 || c.x >= matrixEdge || c.y >= matrixEdge) {
        throw Error("Coordinate outside computed bounds");
      }
      if (c.isDark) matrix[c.y + margin][c.x + margin] = 1;
    }
    const scale = 10;
    const canvas = new Canvas(edge * scale, edge * scale);
    for (let y = 0; y < edge; y++) {
      for (let x = 0; x < edge; x++) {
        if (matrix[y][x]) canvas.drawSquare({ x: x * scale, y: y * scale }, scale);
      }
    }
    const gif = canvas.toByteArray();
    const rows = matrix.map((row) => row.join(""));
    const pbm = `P1\n${edge} ${edge}\n` + matrix.map((row) => row.join(" ")).join("\n") + "\n";
    const rects = coords.filter((c) => c.isDark).map((c) =>
      `<rect x="${c.x + margin}" y="${c.y + margin}" width="1" height="1"/>`
    ).join("");
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${edge} ${edge}" width="${
      edge * scale
    }" height="${
      edge * scale
    }" shape-rendering="crispEdges"><title>${spec.id}: barcode proof</title><rect width="${edge}" height="${edge}" fill="white"/><g fill="black">${rects}</g></svg>`;
    await Deno.writeFile(new URL(spec.id + ".gif", output), gif);
    await Deno.writeTextFile(new URL(spec.id + ".pbm", output), pbm);
    await Deno.writeTextFile(new URL(spec.id + ".svg", output), svg);
    let initialBits: string | undefined, initialWords: number[] | undefined;
    if (symbol instanceof QR) {
      const mode = /^[0-9A-Z $%*+./:\-]*$/.test(spec.input) ? 2 : 4;
      const encoder = new QRWords(spec.version!).appendSegment(
        new TextEncoder().encode(spec.input),
        mode,
      );
      initialBits = (Reflect.get(encoder, "blocks") as number[]).join("");
    } else if (symbol instanceof DataMatrix) {
      const encoder = new DMWords().appendSegment(new TextEncoder().encode(spec.input), spec.mode!);
      initialWords = [...Reflect.get(encoder, "blocks") as number[]];
    }
    results.push({
      ...spec,
      inputUtf8: [...new TextEncoder().encode(spec.input)],
      initialBits,
      initialWords,
      reedSolomon: rsCalls,
      codewords: symbol instanceof QR
        ? symbol.getData()
        : symbol instanceof DataMatrix
        ? hex(symbol.array)
        : undefined,
      mask: symbol instanceof QR ? symbol.getMaskId() : undefined,
      info,
      declaredEdge,
      matrixEdge,
      addedMargin: margin,
      rasterWidth: edge * scale,
      scale,
      darkModules: matrix.flat().filter(Boolean).length,
      rows,
      gifSha256: await sha(gif),
      matrixSha256: await sha(new TextEncoder().encode(rows.join("\n") + "\n")),
    });
  } catch (error) {
    results.push({ ...spec, error: String(error) });
  }
}
await Deno.writeTextFile(
  new URL("traces.json", output),
  JSON.stringify(
    {
      sourceCommit: "55aa1da55456318be29a125d7c48ad1c0772184c",
      deno: Deno.version.deno,
      cases: results,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Recorded ${results.length} cases in proof/traces.json`);
