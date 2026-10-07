import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import { encodeQr, qrByteCapacity, qrToText, type QrCode } from "@/lib/qr";

/*
 * Two independent checks of the encoder:
 *
 * 1. Reference symbols made by segno 1.6.6 (a separate Python QR library),
 *    error level L, byte mode, no level boost, mask forced. segno 1.6.6 adds a
 *    spurious all-zero codeword when the terminator already ends on a byte
 *    boundary (`8 - length % 8` without the outer `% 8`), which ISO/IEC 18004
 *    section 7.4.10 does not do, so the references were generated with that one
 *    line corrected. The mask is forced because the automatic choice depends on
 *    how each library reads the penalty rules; any mask decodes.
 *
 * 2. A small decoder written from the standard (below, sharing no code with
 *    the encoder) reads the format information, removes the mask, walks the
 *    codeword placement, de-interleaves the blocks, checks the Reed-Solomon
 *    syndromes and parses the byte-mode segment, for every version 1-10 and
 *    every mask.
 */

const rows = (qr: QrCode) => qr.modules.map((row) => row.map((dark) => (dark ? "1" : "0")).join(""));
const digest = (qr: QrCode) => crypto.createHash("sha256").update(rows(qr).join("\n")).digest("hex");
const abc = (n: number) => "abcdefghijklmnopqrstuvwxyz0123456789".repeat(10).slice(0, n);

// ISO/IEC 18004 Table 7, byte mode at level L.
const CAPACITY = [17, 32, 53, 78, 106, 134, 154, 192, 230, 271];

describe("QR encoder against reference symbols", () => {
  it("draws 1-L \"HELLO WORLD\" with mask 4 module for module", () => {
    const qr = encodeQr("HELLO WORLD", { mask: 4 });
    expect(qr.version).toBe(1);
    expect(qr.size).toBe(21);
    expect(rows(qr)).toEqual([
      "111111101111101111111",
      "100000101010101000001",
      "101110101000001011101",
      "101110101111001011101",
      "101110100000101011101",
      "100000101101001000001",
      "111111101010101111111",
      "000000000111100000000",
      "110011100101000101111",
      "001011001111100001111",
      "110010100111011010010",
      "101010000100010000000",
      "100100101000101100110",
      "000000001100111101011",
      "111111100110101011010",
      "100000101011110110011",
      "101110101011011000110",
      "101110100000100011011",
      "101110100101000111000",
      "100000101011010000000",
      "111111101011111110101",
    ]);
  });

  const references: [string, number, number, string][] = [
    ["Ünïcødé ✓ text", 2, 1, "873d00c66feaf5277e5b910870eca9d4d92244881e00b7354debe9f85f7cc0bb"],
    [
      "otpauth://totp/Hoax%20Analyzer:admin?secret=GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ&issuer=Hoax%20Analyzer",
      5,
      3,
      "9463ba3948039b28a77290b154414ca3d2f8d0471d1385c23c8967aa69c93a8c",
    ],
    [abc(14), 1, 2, "15adb5088afdb8d945db543ad05dabb505361f60063b416e20bb9194eebb3562"],
    [abc(29), 2, 3, "7cedb5ffa123f2a437a51813ec7a5be493917a65fb93d26fc679d17f9f65998b"],
    [abc(50), 3, 4, "7f3440e71c1ab0d77bd95e9c7d63cbc7978a73f87e48f9c0244a5e0543c02bc9"],
    [abc(75), 4, 5, "548fc96c175b198e0ab0eedbc9dc3ea9c98be729da7455b8bfe25d396b918f7f"],
    [abc(103), 5, 6, "7a397e9ebc5506b8f16a32f256113c3230b9f22117d751aae324cac3ec57627a"],
    [abc(131), 6, 7, "d89b8d169831402ee221e3272831c64944e6ddfda03f9656ddf83aefa3760d1f"],
    [abc(151), 7, 0, "9bf040d92073c66116b489bc94ae3360dda2565c0f31ff5dc20a58ddb8457efb"],
    [abc(189), 8, 1, "8a2adc6df9ffa56b6e8db985988c5326629fff1fd688540f93fb2a57880fb2c1"],
    [abc(227), 9, 2, "ea38aebba5f2f5f85cd43aeb37e01bfc7bf02572a766917449b3c21be2b9ea0f"],
    [abc(268), 10, 3, "c2defcf7506fab9b12719975b06643436369a1b2fc1931ab1a0865234eeeb352"],
    ["x".repeat(17), 1, 5, "efc65a615da18a1f33e97f57771ca92390498d33d5f09777358f5c145ff1c447"],
    ["x".repeat(32), 2, 6, "9c1d44b98b6d15300926236fe224490a927c299a323d71471ae99ea72fffbdcf"],
    ["x".repeat(53), 3, 7, "f730a4dea870bfce916e23d994952f899c938559f5bb76fbc749a19d7d593f59"],
    ["x".repeat(78), 4, 0, "d00514b551336660a6d2653ca53a05377697e407844600b3395b34ee5969f4d3"],
    ["x".repeat(106), 5, 1, "aeb3b8546c316284c9a93274477793ce5211554503bd0a2f4908a0f0660d2166"],
    ["x".repeat(134), 6, 2, "2e46fa80c858408d578f3fcbca6612b1d90850bd14c9e7aff246aeb84efba890"],
    ["x".repeat(154), 7, 3, "adea63814ef1e92fff3c522e9b35ec7a1adc221586e5aaab433ca257a5dc612a"],
    ["x".repeat(192), 8, 4, "9ca6c613a131e3b85d6b984bd04fce49132beb5e4ccf277443b076bcf0915eb9"],
    ["x".repeat(230), 9, 5, "128a9f53817622fb1dc82e919d176143ee75fe02a0a62a03170624f72a8fc35b"],
    ["x".repeat(271), 10, 6, "17c3dfff99479e8fa95a0090ca09ec75251f4bcf717f9c92182158d9f035990d"],
  ];

  it.each(references)("matches the reference for %#", (text, version, mask, hash) => {
    const qr = encodeQr(text, { mask });
    expect(qr.version).toBe(version);
    expect(qr.mask).toBe(mask);
    expect(digest(qr)).toBe(hash);
  });
});

// ---------------------------------------------------------------------------
// Reference decoder, written from ISO/IEC 18004 (level L, byte mode only).
// ---------------------------------------------------------------------------

// Table 9, level L: [number of blocks, codewords per block, data codewords per block] groups.
const BLOCKS_L: [number, number, number][][] = [
  [],
  [[1, 26, 19]],
  [[1, 44, 34]],
  [[1, 70, 55]],
  [[1, 100, 80]],
  [[1, 134, 108]],
  [[2, 86, 68]],
  [[2, 98, 78]],
  [[2, 121, 97]],
  [[2, 146, 116]],
  [
    [2, 86, 68],
    [2, 87, 69],
  ],
];
// Annex E: alignment pattern centre rows/columns.
const ALIGN: number[][] = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

// GF(256) with the primitive polynomial 0x11d, by log/antilog tables.
const EXP: number[] = [];
const LOG: number[] = new Array(256).fill(0);
for (let i = 0, v = 1; i < 255; i++) {
  EXP[i] = v;
  LOG[v] = i;
  v <<= 1;
  if (v & 0x100) v ^= 0x11d;
}
const gfMul = (a: number, b: number) => (a === 0 || b === 0 ? 0 : EXP[(LOG[a] + LOG[b]) % 255]);

/** Polynomial remainder in GF(2) (bit strings as numbers), for the BCH codes. */
function bchRemainder(value: number, generator: number): number {
  const degree = 31 - Math.clz32(generator);
  let v = value;
  while (v !== 0 && 31 - Math.clz32(v) >= degree) v ^= generator << (31 - Math.clz32(v) - degree);
  return v;
}

/** Annex C: the 15-bit format word for a 5-bit (level, mask) value. */
const formatWord = (data: number) => ((data << 10) | bchRemainder(data << 10, 0b10100110111)) ^ 0b101010000010010;
/** Annex D: the 18-bit version word. */
const versionWord = (version: number) => (version << 12) | bchRemainder(version << 12, 0b1111100100101);

function maskBit(mask: number, i: number, j: number): boolean {
  // Table 10; i is the row, j the column.
  switch (mask) {
    case 0:
      return (i + j) % 2 === 0;
    case 1:
      return i % 2 === 0;
    case 2:
      return j % 3 === 0;
    case 3:
      return (i + j) % 3 === 0;
    case 4:
      return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
    case 5:
      return ((i * j) % 2) + ((i * j) % 3) === 0;
    case 6:
      return (((i * j) % 2) + ((i * j) % 3)) % 2 === 0;
    default:
      return (((i + j) % 2) + ((i * j) % 3)) % 2 === 0;
  }
}

function decode(m: boolean[][]): { text: string; mask: number } {
  const size = m.length;
  const version = (size - 17) / 4;
  if (!Number.isInteger(version) || version < 1 || version > 10) throw new Error("bad size");
  const at = (row: number, col: number) => m[row][col];

  // Finder patterns with separators, timing patterns, alignment patterns.
  const finderOk = (r0: number, c0: number) => {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        const ring = Math.max(Math.abs(r - 3), Math.abs(c - 3));
        if (at(r0 + r, c0 + c) !== (ring !== 2)) return false;
      }
    }
    return true;
  };
  if (!finderOk(0, 0) || !finderOk(0, size - 7) || !finderOk(size - 7, 0)) throw new Error("finder pattern");
  for (let k = 0; k < 8; k++) {
    if (at(7, k) || at(k, 7) || at(7, size - 1 - k) || at(k, size - 8) || at(size - 8, k) || at(size - 1 - k, 7)) throw new Error("separator");
  }
  for (let k = 8; k < size - 8; k++) if (at(6, k) !== (k % 2 === 0) || at(k, 6) !== (k % 2 === 0)) throw new Error("timing pattern");
  const centres: [number, number][] = [];
  for (const r of ALIGN[version]) {
    for (const c of ALIGN[version]) {
      if ((r === 6 && c === 6) || (r === 6 && c === size - 7) || (r === size - 7 && c === 6)) continue;
      centres.push([r, c]);
      for (let dr = -2; dr <= 2; dr++) {
        for (let dc = -2; dc <= 2; dc++) {
          if (at(r + dr, c + dc) !== (Math.max(Math.abs(dr), Math.abs(dc)) !== 1)) throw new Error("alignment pattern");
        }
      }
    }
  }
  if (!at(size - 8, 8)) throw new Error("dark module");

  // Format information (section 7.9): both copies, most significant bit first.
  const first = [
    ...[0, 1, 2, 3, 4, 5, 7, 8].map((c) => at(8, c)),
    ...[7, 5, 4, 3, 2, 1, 0].map((r) => at(r, 8)),
  ];
  const second = [
    ...Array.from({ length: 7 }, (_, k) => at(size - 1 - k, 8)),
    ...Array.from({ length: 8 }, (_, k) => at(8, size - 8 + k)),
  ];
  const word = (bits: boolean[]) => bits.reduce((acc, b) => (acc << 1) | (b ? 1 : 0), 0);
  if (word(first) !== word(second)) throw new Error("format copies differ");
  const data = Array.from({ length: 32 }, (_, d) => d).find((d) => formatWord(d) === word(first));
  if (data === undefined) throw new Error("format information is not a valid codeword");
  if (data >> 3 !== 0b01) throw new Error("not level L");
  const mask = data & 7;

  // Version information (section 7.10): block above the bottom-left finder, read as 18 bits.
  if (version >= 7) {
    let lower = 0;
    let upper = 0;
    for (let k = 17; k >= 0; k--) {
      const r = Math.floor(k / 3);
      const c = size - 11 + (k % 3);
      upper = upper * 2 + (at(r, c) ? 1 : 0);
      lower = lower * 2 + (at(c, r) ? 1 : 0);
    }
    if (upper !== versionWord(version) || lower !== versionWord(version)) throw new Error("version information");
  }

  // Which modules carry data.
  const reserved = Array.from({ length: size }, () => new Array<boolean>(size).fill(false));
  const reserve = (r0: number, c0: number, h: number, w: number) => {
    for (let r = r0; r < r0 + h; r++) for (let c = c0; c < c0 + w; c++) reserved[r][c] = true;
  };
  reserve(0, 0, 9, 9);
  reserve(0, size - 8, 9, 8);
  reserve(size - 8, 0, 8, 9);
  reserve(6, 0, 1, size);
  reserve(0, 6, size, 1);
  for (const [r, c] of centres) reserve(r - 2, c - 2, 5, 5);
  if (version >= 7) {
    reserve(0, size - 11, 6, 3);
    reserve(size - 11, 0, 3, 6);
  }

  // Section 7.7.3: two-column strips from the right, alternately upward and downward, skipping column 6.
  const bits: number[] = [];
  let upward = true;
  for (let col = size - 1; col > 0; col -= 2) {
    if (col === 6) col = 5;
    for (let k = 0; k < size; k++) {
      const r = upward ? size - 1 - k : k;
      for (const c of [col, col - 1]) {
        if (!reserved[r][c]) bits.push(at(r, c) !== maskBit(mask, r, c) ? 1 : 0);
      }
    }
    upward = !upward;
  }
  const codewords: number[] = [];
  for (let k = 0; k + 8 <= bits.length; k += 8) codewords.push(bits.slice(k, k + 8).reduce((a, b) => a * 2 + b, 0));
  const remainder = bits.length % 8;
  if (![0, 7].includes(remainder) || bits.slice(bits.length - remainder).some((b) => b !== 0)) throw new Error("remainder bits");

  // De-interleave (section 7.6).
  const blocks: { data: number[]; ec: number[]; dataLen: number; ecLen: number }[] = [];
  for (const [count, total, dataLen] of BLOCKS_L[version]) {
    for (let n = 0; n < count; n++) blocks.push({ data: [], ec: [], dataLen, ecLen: total - dataLen });
  }
  if (codewords.length !== blocks.reduce((s, b) => s + b.dataLen + b.ecLen, 0)) throw new Error("codeword count");
  let p = 0;
  const longest = Math.max(...blocks.map((b) => b.dataLen));
  for (let k = 0; k < longest; k++) for (const b of blocks) if (k < b.dataLen) b.data.push(codewords[p++]);
  for (let k = 0; k < blocks[0].ecLen; k++) for (const b of blocks) b.ec.push(codewords[p++]);

  // Reed-Solomon: every syndrome of every block is zero.
  for (const b of blocks) {
    const word = [...b.data, ...b.ec];
    for (let j = 0; j < b.ecLen; j++) {
      let s = 0;
      for (const c of word) s = gfMul(s, EXP[j]) ^ c;
      if (s !== 0) throw new Error("Reed-Solomon syndrome");
    }
  }

  // Byte-mode segment, terminator and padding (sections 7.4.5, 7.4.9, 7.4.10).
  const dataBytes = blocks.flatMap((b) => b.data);
  const stream = dataBytes.flatMap((byte) => Array.from({ length: 8 }, (_, k) => (byte >> (7 - k)) & 1));
  let q = 0;
  const read = (n: number) => {
    let v = 0;
    for (let k = 0; k < n; k++) v = v * 2 + stream[q++];
    return v;
  };
  if (read(4) !== 0b0100) throw new Error("not byte mode");
  const length = read(version <= 9 ? 8 : 16);
  const bytes = Uint8Array.from({ length }, () => read(8));
  const terminator = Math.min(4, stream.length - q);
  if (read(terminator) !== 0) throw new Error("terminator");
  while (q % 8) if (read(1) !== 0) throw new Error("padding bits");
  for (let k = 0; q < stream.length; k++) if (read(8) !== (k % 2 === 0 ? 0xec : 0x11)) throw new Error("pad codewords");
  return { text: new TextDecoder("utf-8", { fatal: true }).decode(bytes), mask };
}

describe("QR encoder against a reference decoder", () => {
  const texts = [
    "",
    "A",
    "otpauth://totp/Hoax%20Analyzer:admin?secret=JBSWY3DPEHPK3PXP&issuer=Hoax%20Analyzer",
    "Cek fakta: ✓ benar / ✗ hoaks",
    ...CAPACITY.flatMap((c, i) => [abc(c), "z".repeat(c - 1), abc(i === 0 ? 1 : CAPACITY[i - 1] + 1)]),
  ];

  it("round-trips text in versions 1-10 with the mask it picks", () => {
    const versions = new Set<number>();
    for (const text of texts) {
      const qr = encodeQr(text);
      versions.add(qr.version);
      expect(decode(qr.modules)).toEqual({ text, mask: qr.mask });
    }
    expect([...versions].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it("round-trips every mask in every version", () => {
    for (const c of CAPACITY) {
      const text = abc(c - 2);
      for (let mask = 0; mask < 8; mask++) expect(decode(encodeQr(text, { mask }).modules)).toEqual({ text, mask });
    }
  });

  it("detects a corrupted symbol", () => {
    const qr = encodeQr("tamper check", { mask: 0 });
    qr.modules[qr.size - 1][qr.size - 1] = !qr.modules[qr.size - 1][qr.size - 1];
    expect(() => decode(qr.modules)).toThrow(/Reed-Solomon/);
  });
});

describe("QR sizing and rendering", () => {
  it("uses the smallest version that fits, per ISO/IEC 18004 Table 7", () => {
    CAPACITY.forEach((c, i) => {
      expect(qrByteCapacity(i + 1)).toBe(c);
      expect(encodeQr("q".repeat(c)).version).toBe(i + 1);
      if (i < 9) expect(encodeQr("q".repeat(c + 1)).version).toBe(i + 2);
    });
    expect(() => encodeQr("q".repeat(272))).toThrow(RangeError);
    expect(() => encodeQr("q", { mask: 8 })).toThrow(RangeError);
  });

  it("renders two module rows per line with a quiet zone", () => {
    const qr = encodeQr("HELLO WORLD", { mask: 4 });
    const lines = qrToText(qr).split("\n");
    expect(lines).toHaveLength(Math.ceil((21 + 8) / 2));
    for (const line of lines) expect([...line]).toHaveLength(21 + 8);
    expect(lines[0]).toBe("█".repeat(29));
    // Text line 2 holds module rows 0 and 1. Dark modules are left blank (light-on-dark terminals), so the
    // finder's solid top row over its hollow second row shows as blank, five lower half blocks, blank.
    expect([...lines[2]].slice(4, 11).join("")).toBe(" ▄▄▄▄▄ ");
  });
});
