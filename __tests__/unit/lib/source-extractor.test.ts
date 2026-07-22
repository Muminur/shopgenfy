// @vitest-environment node
// Runs under the node environment (not jsdom): adm-zip's central-directory
// parser returns no entries under jsdom, and the extractor runs in the node
// runtime in production anyway.
import { describe, it, expect } from 'vitest';
import zlib from 'node:zlib';
import AdmZip from 'adm-zip';
import { extractFromZip, extractFromText, SourceExtractError } from '@/lib/source-extractor';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function zipWith(files: Record<string, Buffer | string>): Buffer {
  const zip = new AdmZip();
  for (const [name, content] of Object.entries(files)) {
    zip.addFile(name, Buffer.isBuffer(content) ? content : Buffer.from(content));
  }
  return zip.toBuffer();
}

/**
 * Hand-build a single-entry zip whose CENTRAL-DIRECTORY uncompressed-size field
 * lies as 0 while the entry actually carries a real DEFLATE payload. adm-zip's
 * declared-size guards read this field, so a zero lie sails past every size cap;
 * and its inflater only applies `maxOutputLength` when the expected length is
 * > 0, so `getData()` would inflate the payload unbounded (the decompression
 * bomb — 305 KB of compressed zeros expands to ~300 MB in the real exploit).
 * adm-zip cannot produce such an archive itself, so the bytes are assembled by
 * hand against the ZIP spec (offsets verified against adm-zip's own constants).
 */
function zipWithLyingZeroSize(name: string, uncompressed: Buffer): Buffer {
  const compressed = zlib.deflateRawSync(uncompressed);
  const nameBuf = Buffer.from(name);
  const crc = 0; // arbitrary — not validated while parsing the central directory

  // Local file header (30 bytes + name). Its uncompressed-size field stays
  // truthful; only the central directory carries the lie.
  const local = Buffer.alloc(30 + nameBuf.length);
  local.writeUInt32LE(0x04034b50, 0); // LOCSIG
  local.writeUInt16LE(20, 4); // version needed
  local.writeUInt16LE(0, 6); // flags
  local.writeUInt16LE(8, 8); // method: DEFLATED
  local.writeUInt16LE(0, 10); // mod time
  local.writeUInt16LE(0, 12); // mod date
  local.writeUInt32LE(crc, 14); // crc-32
  local.writeUInt32LE(compressed.length, 18); // compressed size
  local.writeUInt32LE(uncompressed.length, 22); // uncompressed size
  local.writeUInt16LE(nameBuf.length, 26); // filename length
  local.writeUInt16LE(0, 28); // extra length
  nameBuf.copy(local, 30);

  const localAndData = Buffer.concat([local, compressed]);

  // Central directory header (46 bytes + name) — uncompressed size LIED to 0.
  const central = Buffer.alloc(46 + nameBuf.length);
  central.writeUInt32LE(0x02014b50, 0); // CENSIG
  central.writeUInt16LE(20, 4); // version made by
  central.writeUInt16LE(20, 6); // version needed
  central.writeUInt16LE(0, 8); // flags
  central.writeUInt16LE(8, 10); // method: DEFLATED
  central.writeUInt16LE(0, 12); // mod time
  central.writeUInt16LE(0, 14); // mod date
  central.writeUInt32LE(crc, 16); // crc-32
  central.writeUInt32LE(compressed.length, 20); // CENSIZ compressed size (truthful)
  central.writeUInt32LE(0, 24); // CENLEN uncompressed size — THE LIE
  central.writeUInt16LE(nameBuf.length, 28); // filename length
  central.writeUInt16LE(0, 30); // extra length
  central.writeUInt16LE(0, 32); // comment length
  central.writeUInt16LE(0, 34); // disk number start
  central.writeUInt16LE(0, 36); // internal attrs
  central.writeUInt32LE(0, 38); // external attrs
  central.writeUInt32LE(0, 42); // local header offset
  nameBuf.copy(central, 46);

  // End of central directory record (22 bytes).
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0); // ENDSIG
  eocd.writeUInt16LE(0, 4); // disk number
  eocd.writeUInt16LE(0, 6); // disk with central directory
  eocd.writeUInt16LE(1, 8); // entries on this disk
  eocd.writeUInt16LE(1, 10); // total entries
  eocd.writeUInt32LE(central.length, 12); // central directory size
  eocd.writeUInt32LE(localAndData.length, 16); // central directory offset
  eocd.writeUInt16LE(0, 20); // comment length

  return Buffer.concat([localAndData, central, eocd]);
}

function makePng(tag: string): Buffer {
  return Buffer.concat([PNG_SIGNATURE, Buffer.from(`png-${tag}`)]);
}

function extractCode(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (error) {
    return error instanceof SourceExtractError ? error.code : `NOT_SOURCE_ERROR:${String(error)}`;
  }
  return undefined;
}

describe('extractFromZip', () => {
  it('selects README, docs markdown, package.json, and shopify.app.toml; ignores other files', () => {
    const buf = zipWith({
      'myrepo-main/README.md':
        '# My App\nThis is a helpful storefront companion that automates listing chores.',
      'myrepo-main/docs/guide.md': 'Detailed guide describing the primary features and usage.',
      'myrepo-main/package.json': JSON.stringify({ name: 'my-app', description: 'helper' }),
      'myrepo-main/shopify.app.toml': 'name = "my-app"\nclient_id = "toml-marker-abc"',
      'myrepo-main/src/index.js': 'console.log("should be ignored")',
    });

    const result = extractFromZip(buf);

    expect(result.textContent).toContain('My App');
    expect(result.textContent).toContain('Detailed guide');
    expect(result.textContent).toContain('my-app');
    expect(result.textContent).toContain('toml-marker-abc');
    expect(result.textContent).not.toContain('should be ignored');
    expect(result.sourceLabel).toBeTruthy();
  });

  it('excludes files under node_modules and .git', () => {
    const buf = zipWith({
      'repo/README.md': 'A readme with enough content to be analyzed by the model downstream.',
      'repo/node_modules/dep/README.md': 'SHOULD_NOT_APPEAR_FROM_NODE_MODULES',
      'repo/.git/config': 'SHOULD_NOT_APPEAR_FROM_GIT',
    });

    const result = extractFromZip(buf);

    expect(result.textContent).not.toContain('SHOULD_NOT_APPEAR_FROM_NODE_MODULES');
    expect(result.textContent).not.toContain('SHOULD_NOT_APPEAR_FROM_GIT');
  });

  it('redacts lines that expose secrets, keeping surrounding lines', () => {
    const buf = zipWith({
      'README.md':
        'Intro line\nAPI_KEY=sk-supersecret-123\nMiddle line\npassword: hunter2\nAuthorization: Bearer xyz\nFinal line',
    });

    const result = extractFromZip(buf);

    expect(result.textContent).toContain('Intro line');
    expect(result.textContent).toContain('Middle line');
    expect(result.textContent).toContain('Final line');
    expect(result.textContent).not.toContain('sk-supersecret-123');
    expect(result.textContent).not.toContain('hunter2');
    expect(result.textContent).not.toContain('Bearer xyz');
    expect(result.textContent).toContain('[redacted]');
  });

  it('caps the merged text at 12000 characters', () => {
    const buf = zipWith({ 'README.md': 'a'.repeat(20000) });

    const result = extractFromZip(buf);

    expect(result.textContent.length).toBeLessThanOrEqual(12000);
  });

  it('harvests png/jpg/webp screenshots (base64) and mirrors them into images', () => {
    const buf = zipWith({
      'README.md': 'A readme with sufficient descriptive content for the analysis pipeline to run.',
      'docs/screenshots/home.png': makePng('home'),
      'docs/screenshots/detail.jpg': Buffer.from('jpeg-bytes'),
      'assets/logo.webp': Buffer.from('webp-bytes'),
    });

    const result = extractFromZip(buf);

    expect(result.screenshots).toHaveLength(3);
    expect(result.images).toEqual(result.screenshots);

    const png = result.screenshots.find((s) => s.mimeType === 'image/png');
    expect(png).toBeDefined();
    expect(Buffer.from(png!.base64, 'base64').subarray(0, 8).equals(PNG_SIGNATURE)).toBe(true);
    expect(result.screenshots.some((s) => s.mimeType === 'image/jpeg')).toBe(true);
    expect(result.screenshots.some((s) => s.mimeType === 'image/webp')).toBe(true);
  });

  it('caps harvested screenshots at 10', () => {
    const files: Record<string, Buffer | string> = {
      'README.md': 'A readme with sufficient descriptive content for the analysis pipeline to run.',
    };
    for (let i = 0; i < 15; i++) {
      files[`docs/img${i}.png`] = makePng(`i${i}`);
    }

    const result = extractFromZip(zipWith(files));

    expect(result.screenshots).toHaveLength(10);
  });

  it('skips image entries larger than 10 MB', () => {
    const buf = zipWith({
      'README.md': 'A readme with sufficient descriptive content for the analysis pipeline to run.',
      'docs/huge.png': Buffer.alloc(11 * 1024 * 1024),
    });

    const result = extractFromZip(buf);

    expect(result.screenshots).toHaveLength(0);
  });

  it('runs the compressed-size guard before attempting to parse the archive', () => {
    // A 31 MB non-zip buffer: if guards ran after parsing this would surface as
    // INVALID_ZIP. It must surface as ZIP_BOMB, proving the guard runs first.
    const code = extractCode(() => extractFromZip(Buffer.alloc(31 * 1024 * 1024)));
    expect(code).toBe('ZIP_BOMB');
  });

  it('rejects archives with more than 2000 entries', () => {
    const zip = new AdmZip();
    for (let i = 0; i < 2001; i++) {
      zip.addFile(`f${i}.txt`, Buffer.from('x'));
    }
    const code = extractCode(() => extractFromZip(zip.toBuffer()));
    expect(code).toBe('ZIP_BOMB');
  });

  it('rejects an archive with a single entry declaring more than 20 MB uncompressed', () => {
    const zip = new AdmZip();
    zip.addFile('big.txt', Buffer.alloc(21 * 1024 * 1024));
    const code = extractCode(() => extractFromZip(zip.toBuffer()));
    expect(code).toBe('ZIP_BOMB');
  });

  it('rejects an archive whose declared uncompressed total exceeds 100 MB', () => {
    const zip = new AdmZip();
    const chunk = Buffer.alloc(18 * 1024 * 1024);
    for (let i = 0; i < 6; i++) {
      zip.addFile(`f${i}.bin`, chunk);
    }
    const code = extractCode(() => extractFromZip(zip.toBuffer()));
    expect(code).toBe('ZIP_BOMB');
  });

  it('rejects an entry that declares zero uncompressed size but carries a real DEFLATE payload', () => {
    // A real DEFLATE payload with the central-directory size lied to 0. Every
    // declared-size guard sees 0 and lets it through, and adm-zip's inflater
    // then runs uncapped (see helper doc — the real exploit inflates ~300 MB).
    // The zero-lie guard must reject it BEFORE any getData()/inflate happens.
    // A small payload is enough to prove the guard; its correctness does not
    // depend on the inflated size.
    const buf = zipWithLyingZeroSize('README.md', Buffer.from('bomb-payload '.repeat(256)));
    const code = extractCode(() => extractFromZip(buf));
    expect(code).toBe('ZIP_BOMB');
  });

  it('still accepts a legitimately empty file (zero size AND zero compressed size)', () => {
    const buf = zipWith({
      'README.md': 'A readme with sufficient descriptive content for the analysis pipeline to run.',
      'empty.txt': Buffer.alloc(0),
    });
    // Must not be mistaken for the zero-size lie: a real empty file is stored,
    // so compressedSize is 0 too and extraction proceeds normally.
    expect(() => extractFromZip(buf)).not.toThrow();
  });

  it('maps a non-zip buffer to an INVALID_ZIP error', () => {
    const code = extractCode(() =>
      extractFromZip(Buffer.from('definitely not a zip archive at all'))
    );
    expect(code).toBe('INVALID_ZIP');
  });
});

describe('extractFromText', () => {
  it('redacts secret lines and caps at 12000 characters', () => {
    const text = `Overview of the app\nSECRET=topsecret-value\n${'b'.repeat(20000)}`;
    const result = extractFromText(text);

    expect(result.textContent).toContain('Overview of the app');
    expect(result.textContent).not.toContain('topsecret-value');
    expect(result.textContent).toContain('[redacted]');
    expect(result.textContent.length).toBeLessThanOrEqual(12000);
    expect(result.images).toEqual([]);
    expect(result.sourceLabel).toBeTruthy();
  });
});
