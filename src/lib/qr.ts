/**
 * QR Code encoder (ISO/IEC 18004) for byte mode at error-correction level L,
 * versions 1 to 10 (up to 271 bytes): enough to show an otpauth:// URL in the
 * terminal when two-factor login is set up. No dependencies. `encodeQr` returns
 * the module matrix; `qrToText` renders it with Unicode block characters.
 *
 * Checked module for module against reference symbols from an independent
 * encoder, and round-tripped through a decoder written from the standard, for
 * every version and mask (tests/qr.test.ts).
 */

export interface QrCode {
  version: number;
  /** Modules per side: 17 + 4 * version. */
  size: number;
  /** Mask pattern 0-7 applied to the data area. */
  mask: number;
  /** modules[y][x]: true is a dark module. */
  modules: boolean[][];
}

export interface QrOptions {
  /** Force a mask pattern (0-7) instead of choosing the one with the lowest penalty score. */
  mask?: number;
}

const MAX_VERSION = 10;
// Level L: error-correction codewords per block and number of blocks, by version.
const EC_PER_BLOCK = [0, 7, 10, 15, 20, 26, 18, 20, 24, 30, 18];
const BLOCKS = [0, 1, 1, 1, 1, 1, 2, 2, 2, 2, 4];
// Alignment pattern centre coordinates (both axes), by version.
const ALIGNMENT = [[], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];
const ECL_BITS_L = 1;
// Mask penalty weights (section 7.8.3.1).
const N1 = 3;
const N2 = 3;
const N3 = 40;
const N4 = 10;

/** Total codewords (data + error correction) in a symbol of this version. */
function totalCodewords(version: number): number {
  let bits = (16 * version + 128) * version + 64;
  if (version >= 2) {
    const n = Math.floor(version / 7) + 2;
    bits -= (25 * n - 10) * n - 55;
    if (version >= 7) bits -= 36;
  }
  return Math.floor(bits / 8);
}

function dataCodewords(version: number): number {
  return totalCodewords(version) - EC_PER_BLOCK[version] * BLOCKS[version];
}

/** Bits of the character-count indicator for byte mode. */
function countBits(version: number): number {
  return version <= 9 ? 8 : 16;
}

/** Largest number of bytes a version holds in byte mode at level L. */
export function qrByteCapacity(version: number): number {
  return Math.floor((dataCodewords(version) * 8 - 4 - countBits(version)) / 8);
}

// --- Reed-Solomon over GF(2^8) with the QR polynomial x^8 + x^4 + x^3 + x^2 + 1 ---

function gfMultiply(x: number, y: number): number {
  let z = 0;
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d);
    z ^= ((y >>> i) & 1) * x;
  }
  return z;
}

/** Coefficients of the generator polynomial of the given degree, highest power first (leading 1 left out). */
function rsGenerator(degree: number): number[] {
  const result = new Array<number>(degree - 1).fill(0);
  result.push(1);
  let root = 1;
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < result.length; j++) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 2);
  }
  return result;
}

function rsRemainder(data: number[], generator: number[]): number[] {
  const result = new Array<number>(generator.length).fill(0);
  for (const byte of data) {
    const factor = byte ^ (result.shift() as number);
    result.push(0);
    generator.forEach((coefficient, i) => {
      result[i] ^= gfMultiply(coefficient, factor);
    });
  }
  return result;
}

// --- Data encoding ---

class BitBuffer {
  bits: number[] = [];
  push(value: number, length: number) {
    for (let i = length - 1; i >= 0; i--) this.bits.push((value >>> i) & 1);
  }
}

/** Mode indicator, count, bytes, terminator and padding, as data codewords for the version. */
function buildDataCodewords(bytes: Uint8Array, version: number): number[] {
  const capacity = dataCodewords(version) * 8;
  const buffer = new BitBuffer();
  buffer.push(0b0100, 4);
  buffer.push(bytes.length, countBits(version));
  for (const b of bytes) buffer.push(b, 8);
  buffer.push(0, Math.min(4, capacity - buffer.bits.length));
  buffer.push(0, (8 - (buffer.bits.length % 8)) % 8);
  for (let pad = 0xec; buffer.bits.length < capacity; pad ^= 0xec ^ 0x11) buffer.push(pad, 8);
  const out: number[] = [];
  for (let i = 0; i < buffer.bits.length; i += 8) {
    let byte = 0;
    for (let j = 0; j < 8; j++) byte = (byte << 1) | buffer.bits[i + j];
    out.push(byte);
  }
  return out;
}

/** Splits the data into blocks, appends error correction to each and interleaves them (section 7.6). */
function addErrorCorrection(data: number[], version: number): number[] {
  const blocks = BLOCKS[version];
  const ecLength = EC_PER_BLOCK[version];
  const total = totalCodewords(version);
  const shortBlocks = blocks - (total % blocks);
  const shortLength = Math.floor(total / blocks);
  const generator = rsGenerator(ecLength);
  const parts: number[][] = [];
  for (let i = 0, k = 0; i < blocks; i++) {
    const chunk = data.slice(k, k + shortLength - ecLength + (i < shortBlocks ? 0 : 1));
    k += chunk.length;
    const ec = rsRemainder(chunk, generator);
    if (i < shortBlocks) chunk.push(-1); // placeholder so every block has the same length
    parts.push(chunk.concat(ec));
  }
  const out: number[] = [];
  for (let i = 0; i < parts[0].length; i++) {
    parts.forEach((block, j) => {
      if (i !== shortLength - ecLength || j >= shortBlocks) out.push(block[i]);
    });
  }
  return out;
}

// --- Matrix ---

class Matrix {
  version: number;
  size: number;
  modules: boolean[][];
  isFunction: boolean[][];

  constructor(version: number) {
    this.version = version;
    this.size = version * 4 + 17;
    this.modules = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
    this.isFunction = Array.from({ length: this.size }, () => new Array<boolean>(this.size).fill(false));
  }

  setFunction(x: number, y: number, dark: boolean) {
    this.modules[y][x] = dark;
    this.isFunction[y][x] = true;
  }

  drawFunctionPatterns() {
    const s = this.size;
    for (let i = 0; i < s; i++) {
      this.setFunction(6, i, i % 2 === 0);
      this.setFunction(i, 6, i % 2 === 0);
    }
    this.drawFinder(3, 3);
    this.drawFinder(s - 4, 3);
    this.drawFinder(3, s - 4);
    const align = ALIGNMENT[this.version];
    const n = align.length;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
        this.drawAlignment(align[i], align[j]);
      }
    }
    this.drawFormatBits(0); // reserve the area; rewritten once the mask is known
    this.drawVersion();
  }

  /** Finder pattern with its separator: 9x9 around (x, y), clipped to the symbol. */
  private drawFinder(x: number, y: number) {
    for (let dy = -4; dy <= 4; dy++) {
      for (let dx = -4; dx <= 4; dx++) {
        const dist = Math.max(Math.abs(dx), Math.abs(dy));
        const xx = x + dx;
        const yy = y + dy;
        if (xx >= 0 && xx < this.size && yy >= 0 && yy < this.size) this.setFunction(xx, yy, dist !== 2 && dist !== 4);
      }
    }
  }

  private drawAlignment(x: number, y: number) {
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) this.setFunction(x + dx, y + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
    }
  }

  /** Format information: 5 data bits (level, mask) with 10 BCH bits, masked, placed twice (section 7.9). */
  drawFormatBits(mask: number) {
    const data = (ECL_BITS_L << 3) | mask;
    let rem = data;
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
    const bits = ((data << 10) | rem) ^ 0x5412;
    const bit = (i: number) => ((bits >>> i) & 1) !== 0;
    for (let i = 0; i <= 5; i++) this.setFunction(8, i, bit(i));
    this.setFunction(8, 7, bit(6));
    this.setFunction(8, 8, bit(7));
    this.setFunction(7, 8, bit(8));
    for (let i = 9; i < 15; i++) this.setFunction(14 - i, 8, bit(i));
    const s = this.size;
    for (let i = 0; i < 8; i++) this.setFunction(s - 1 - i, 8, bit(i));
    for (let i = 8; i < 15; i++) this.setFunction(8, s - 15 + i, bit(i));
    this.setFunction(8, s - 8, true); // the always-dark module
  }

  /** Version information (versions 7 and up): 6 data bits with 12 BCH bits, placed twice (section 7.10). */
  private drawVersion() {
    if (this.version < 7) return;
    let rem = this.version;
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (this.version << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const bit = ((bits >>> i) & 1) !== 0;
      const a = this.size - 11 + (i % 3);
      const b = Math.floor(i / 3);
      this.setFunction(a, b, bit);
      this.setFunction(b, a, bit);
    }
  }

  /** Codewords in the zigzag order of section 7.7.3: two-module columns from the right, skipping the vertical timing pattern. */
  drawCodewords(codewords: number[]) {
    const s = this.size;
    let i = 0;
    for (let right = s - 1; right >= 1; right -= 2) {
      if (right === 6) right = 5;
      for (let vert = 0; vert < s; vert++) {
        for (let j = 0; j < 2; j++) {
          const x = right - j;
          const upward = ((right + 1) & 2) === 0;
          const y = upward ? s - 1 - vert : vert;
          if (!this.isFunction[y][x] && i < codewords.length * 8) {
            this.modules[y][x] = ((codewords[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0;
            i++;
          }
          // Modules left over (the remainder bits) stay light.
        }
      }
    }
  }

  /** XORs the mask pattern over the data area; applying it twice removes it. */
  applyMask(mask: number) {
    for (let y = 0; y < this.size; y++) {
      for (let x = 0; x < this.size; x++) {
        if (this.isFunction[y][x]) continue;
        let invert: boolean;
        switch (mask) {
          case 0:
            invert = (x + y) % 2 === 0;
            break;
          case 1:
            invert = y % 2 === 0;
            break;
          case 2:
            invert = x % 3 === 0;
            break;
          case 3:
            invert = (x + y) % 3 === 0;
            break;
          case 4:
            invert = (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0;
            break;
          case 5:
            invert = ((x * y) % 2) + ((x * y) % 3) === 0;
            break;
          case 6:
            invert = (((x * y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          case 7:
            invert = (((x + y) % 2) + ((x * y) % 3)) % 2 === 0;
            break;
          default:
            throw new RangeError("Mask pattern must be 0-7.");
        }
        if (invert) this.modules[y][x] = !this.modules[y][x];
      }
    }
  }

  /** Penalty score of the current symbol (section 7.8.3.1), lower is better. */
  penalty(): number {
    const s = this.size;
    const m = this.modules;
    let score = 0;
    // Rows and columns: runs of five or more, and finder-like 1:1:3:1:1 patterns with four light modules beside them.
    for (let y = 0; y < s; y++) score += this.linePenalty((x) => m[y][x]);
    for (let x = 0; x < s; x++) score += this.linePenalty((y) => m[y][x]);
    // 2x2 blocks of one colour.
    for (let y = 0; y < s - 1; y++) {
      for (let x = 0; x < s - 1; x++) {
        const c = m[y][x];
        if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += N2;
      }
    }
    // Share of dark modules away from 50%, in steps of 5%.
    let dark = 0;
    for (const row of m) for (const cell of row) if (cell) dark++;
    const total = s * s;
    const k = Math.ceil(Math.abs(dark * 20 - total * 10) / total) - 1;
    score += k * N4;
    return score;
  }

  private linePenalty(at: (i: number) => boolean): number {
    const s = this.size;
    const history = new Array<number>(7).fill(0);
    let colour = false;
    let run = 0;
    let score = 0;
    for (let i = 0; i < s; i++) {
      if (at(i) === colour) {
        run++;
        if (run === 5) score += N1;
        else if (run > 5) score++;
      } else {
        finderPenaltyAddHistory(run, history, s);
        if (!colour) score += finderPenaltyCount(history) * N3;
        run = 1;
        colour = at(i);
      }
    }
    return score + finderPenaltyTerminate(colour, run, history, s) * N3;
  }
}

/** Pushes the finished run onto the history of the last seven runs; the first run is lengthened by the light quiet zone. */
function finderPenaltyAddHistory(run: number, history: number[], size: number) {
  if (history[0] === 0) run += size;
  history.pop();
  history.unshift(run);
}

/** 1 for each 1:1:3:1:1 dark/light pattern with 4+ light modules on either side (history is newest first). */
function finderPenaltyCount(h: number[]): number {
  const n = h[1];
  const core = n > 0 && h[2] === n && h[3] === n * 3 && h[4] === n && h[5] === n;
  return (core && h[0] >= n * 4 && h[6] >= n ? 1 : 0) + (core && h[6] >= n * 4 && h[0] >= n ? 1 : 0);
}

function finderPenaltyTerminate(colour: boolean, run: number, history: number[], size: number): number {
  if (colour) {
    finderPenaltyAddHistory(run, history, size);
    run = 0;
  }
  run += size; // the light quiet zone after the last module
  finderPenaltyAddHistory(run, history, size);
  return finderPenaltyCount(history);
}

/** Encodes text (UTF-8) in byte mode at level L. Throws a RangeError when it needs more than version 10 (271 bytes). */
export function encodeQr(text: string, options: QrOptions = {}): QrCode {
  const bytes = new TextEncoder().encode(text);
  let version = 1;
  while (version <= MAX_VERSION && qrByteCapacity(version) < bytes.length) version++;
  if (version > MAX_VERSION) throw new RangeError(`Text is ${bytes.length} bytes; this encoder holds at most ${qrByteCapacity(MAX_VERSION)}.`);

  const codewords = addErrorCorrection(buildDataCodewords(bytes, version), version);
  const matrix = new Matrix(version);
  matrix.drawFunctionPatterns();
  matrix.drawCodewords(codewords);

  let mask = options.mask;
  if (mask === undefined) {
    let best = Infinity;
    for (let candidate = 0; candidate < 8; candidate++) {
      matrix.applyMask(candidate);
      matrix.drawFormatBits(candidate);
      const score = matrix.penalty();
      if (score < best) {
        best = score;
        mask = candidate;
      }
      matrix.applyMask(candidate); // undo
    }
  }
  if (mask === undefined || !Number.isInteger(mask) || mask < 0 || mask > 7) throw new RangeError("Mask pattern must be 0-7.");
  matrix.applyMask(mask);
  matrix.drawFormatBits(mask);
  return { version, size: matrix.size, mask, modules: matrix.modules };
}

/**
 * The symbol as text, two module rows per line, with a quiet zone. Light
 * modules are drawn with block characters and dark ones left blank, which
 * reads as a normal QR code on the dark background most terminals have.
 */
export function qrToText(qr: QrCode, quiet = 4): string {
  const size = qr.size + quiet * 2;
  const dark = (x: number, y: number) => {
    const mx = x - quiet;
    const my = y - quiet;
    return mx >= 0 && my >= 0 && mx < qr.size && my < qr.size && qr.modules[my][mx];
  };
  const lines: string[] = [];
  for (let y = 0; y < size; y += 2) {
    let line = "";
    for (let x = 0; x < size; x++) {
      const topLight = !dark(x, y);
      const bottomLight = y + 1 < size ? !dark(x, y + 1) : true;
      line += topLight ? (bottomLight ? "█" : "▀") : bottomLight ? "▄" : " ";
    }
    lines.push(line);
  }
  return lines.join("\n");
}
