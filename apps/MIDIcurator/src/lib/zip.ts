import type { ZipEntry } from '../types/zip';

export function crc32(data: Uint8Array): number {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }

  let crc = 0xFFFFFFFF;
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]!) & 0xFF]! ^ (crc >>> 8);
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

export function createZip(files: ZipEntry[]): Uint8Array {
  const centralDirectory: Uint8Array[] = [];
  const fileData: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const filename = new TextEncoder().encode(file.name);
    const data = file.data;

    // Local file header
    const localHeader = new Uint8Array(30 + filename.length);
    const localView = new DataView(localHeader.buffer);

    localView.setUint32(0, 0x04034b50, true);  // signature
    localView.setUint16(4, 20, true);           // version needed
    localView.setUint16(6, 0, true);            // flags
    localView.setUint16(8, 0, true);            // compression (none)
    localView.setUint16(10, 0, true);           // time
    localView.setUint16(12, 0, true);           // date
    localView.setUint32(14, crc32(data), true); // crc32
    localView.setUint32(18, data.length, true); // compressed size
    localView.setUint32(22, data.length, true); // uncompressed size
    localView.setUint16(26, filename.length, true); // filename length
    localView.setUint16(28, 0, true);           // extra field length

    localHeader.set(filename, 30);

    fileData.push(localHeader);
    fileData.push(data);

    // Central directory header
    const cdHeader = new Uint8Array(46 + filename.length);
    const cdView = new DataView(cdHeader.buffer);

    cdView.setUint32(0, 0x02014b50, true);     // signature
    cdView.setUint16(4, 20, true);              // version made by
    cdView.setUint16(6, 20, true);              // version needed
    cdView.setUint16(8, 0, true);               // flags
    cdView.setUint16(10, 0, true);              // compression
    cdView.setUint16(12, 0, true);              // time
    cdView.setUint16(14, 0, true);              // date
    cdView.setUint32(16, crc32(data), true);    // crc32
    cdView.setUint32(20, data.length, true);    // compressed size
    cdView.setUint32(24, data.length, true);    // uncompressed size
    cdView.setUint16(28, filename.length, true); // filename length
    cdView.setUint16(30, 0, true);              // extra field length
    cdView.setUint16(32, 0, true);              // comment length
    cdView.setUint16(34, 0, true);              // disk number
    cdView.setUint16(36, 0, true);              // internal attributes
    cdView.setUint32(38, 0, true);              // external attributes
    cdView.setUint32(42, offset, true);         // relative offset

    cdHeader.set(filename, 46);

    centralDirectory.push(cdHeader);
    offset += localHeader.length + data.length;
  }

  // End of central directory
  const cdSize = centralDirectory.reduce((sum, cd) => sum + cd.length, 0);
  const eocd = new Uint8Array(22);
  const eocdView = new DataView(eocd.buffer);

  eocdView.setUint32(0, 0x06054b50, true);           // signature
  eocdView.setUint16(4, 0, true);                     // disk number
  eocdView.setUint16(6, 0, true);                     // central directory disk
  eocdView.setUint16(8, files.length, true);           // entries on this disk
  eocdView.setUint16(10, files.length, true);          // total entries
  eocdView.setUint32(12, cdSize, true);                // central directory size
  eocdView.setUint32(16, offset, true);                // central directory offset
  eocdView.setUint16(20, 0, true);                     // comment length

  // Combine everything
  const totalSize = fileData.reduce((sum, d) => sum + d.length, 0) + cdSize + eocd.length;
  const zip = new Uint8Array(totalSize);

  let pos = 0;
  for (const data of fileData) {
    zip.set(data, pos);
    pos += data.length;
  }
  for (const cd of centralDirectory) {
    zip.set(cd, pos);
    pos += cd.length;
  }
  zip.set(eocd, pos);

  return zip;
}
