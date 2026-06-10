/** A single file entry for the ZIP creator. */
export interface ZipEntry {
  name: string;
  data: Uint8Array;
}
