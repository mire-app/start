// Minimal types for the part of opentype.js that tools/build-logo.mjs uses.
declare module 'opentype.js' {
  interface BoundingBox {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
  }
  interface Path {
    getBoundingBox(): BoundingBox;
    toPathData(decimalPlaces?: number): string;
  }
  interface Glyph {
    advanceWidth?: number;
    getPath(x: number, y: number, fontSize: number): Path;
  }
  interface Font {
    unitsPerEm: number;
    tables: { os2: { sCapHeight: number } };
    charToGlyph(char: string): Glyph;
  }
  const opentype: { parse(buffer: ArrayBufferLike): Font };
  export default opentype;
  export type { Font, Glyph, Path };
}
