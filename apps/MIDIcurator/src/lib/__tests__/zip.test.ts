import { describe, it, expect } from 'vitest';
import { crc32, createZip } from '../zip';

describe('crc32', () => {
  it('returns 0 for empty data', () => {
    expect(crc32(new Uint8Array(0))).toBe(0);
  });

  it('produces consistent hashes', () => {
    const data = new TextEncoder().encode('hello');
    const hash1 = crc32(data);
    const hash2 = crc32(data);
    expect(hash1).toBe(hash2);
  });

  it('produces different hashes for different data', () => {
    const a = crc32(new TextEncoder().encode('hello'));
    const b = crc32(new TextEncoder().encode('world'));
    expect(a).not.toBe(b);
  });
});

describe('createZip', () => {
  it('creates valid zip with PK signature', () => {
    const files = [{ name: 'test.txt', data: new TextEncoder().encode('hello') }];
    const zip = createZip(files);
    // ZIP local file header signature: PK\x03\x04
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x03);
    expect(zip[3]).toBe(0x04);
  });

  it('handles empty file list', () => {
    const zip = createZip([]);
    // Should still produce valid EOCD record
    expect(zip.length).toBeGreaterThan(0);
    // EOCD signature: PK\x05\x06
    expect(zip[0]).toBe(0x50);
    expect(zip[1]).toBe(0x4b);
    expect(zip[2]).toBe(0x05);
    expect(zip[3]).toBe(0x06);
  });

  it('includes all files', () => {
    const files = [
      { name: 'a.mid', data: new Uint8Array([1, 2, 3]) },
      { name: 'b.mid', data: new Uint8Array([4, 5, 6]) },
    ];
    const zip = createZip(files);
    // EOCD entry count at offset -22+8 = number of entries
    const view = new DataView(zip.buffer);
    // Find EOCD by searching for signature from end
    let eocdOffset = -1;
    for (let i = zip.length - 22; i >= 0; i--) {
      if (zip[i] === 0x50 && zip[i + 1] === 0x4b && zip[i + 2] === 0x05 && zip[i + 3] === 0x06) {
        eocdOffset = i;
        break;
      }
    }
    expect(eocdOffset).toBeGreaterThan(-1);
    const totalEntries = view.getUint16(eocdOffset + 10, true);
    expect(totalEntries).toBe(2);
  });
});
