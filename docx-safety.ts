export const MAX_DOCX_BYTES = 10 * 1024 * 1024;
export const MAX_DOCX_ENTRIES = 5000;
export const MAX_DOCX_UNCOMPRESSED_BYTES = 200 * 1024 * 1024;
export const MAX_DOCX_ENTRY_BYTES = 50 * 1024 * 1024;
export const MAX_DOCX_COMPRESSION_RATIO = 250;

export interface DocxSafetyStats {
  entries: number;
  compressedBytes: number;
  uncompressedBytes: number;
}

export type DocxSafetyResult =
  | { ok: true; stats: DocxSafetyStats }
  | { ok: false; message: string };

const EOCD_SIGNATURE = 0x06054b50;
const CENTRAL_SIGNATURE = 0x02014b50;

function decodeName(bytes: Uint8Array): string {
  try { return new TextDecoder('utf-8', { fatal: false }).decode(bytes); }
  catch { return ''; }
}

/**
 * Performs a central-directory-only ZIP preflight before Mammoth sees the DOCX.
 * This rejects encrypted/ZIP64/oversized archives and common decompression-bomb
 * patterns without extracting document content.
 */
export function validateDocxArchive(buffer: ArrayBuffer): DocxSafetyResult {
  if (buffer.byteLength === 0) return { ok: false, message: 'The Word file is empty.' };
  if (buffer.byteLength > MAX_DOCX_BYTES) return { ok: false, message: 'This file exceeds 10 MB. Choose a smaller document.' };

  const bytes = new Uint8Array(buffer);
  const view = new DataView(buffer);
  const minimum = Math.max(0, bytes.length - 65557);
  let eocd = -1;
  for (let offset = bytes.length - 22; offset >= minimum; offset--) {
    if (view.getUint32(offset, true) === EOCD_SIGNATURE) { eocd = offset; break; }
  }
  if (eocd < 0) return { ok: false, message: 'This file is not a valid DOCX/ZIP archive.' };

  const disk = view.getUint16(eocd + 4, true);
  const directoryDisk = view.getUint16(eocd + 6, true);
  const entriesOnDisk = view.getUint16(eocd + 8, true);
  const entries = view.getUint16(eocd + 10, true);
  const directorySize = view.getUint32(eocd + 12, true);
  const directoryOffset = view.getUint32(eocd + 16, true);

  if (disk !== 0 || directoryDisk !== 0 || entriesOnDisk !== entries) {
    return { ok: false, message: 'Multi-part ZIP documents are not supported.' };
  }
  if (entries === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff) {
    return { ok: false, message: 'Very large ZIP64 Word documents are not supported.' };
  }
  if (entries > MAX_DOCX_ENTRIES) return { ok: false, message: 'This document contains too many internal files to process safely.' };
  if (directoryOffset + directorySize > buffer.byteLength) return { ok: false, message: 'The Word file has a damaged ZIP directory.' };

  let offset = directoryOffset;
  let compressedBytes = 0;
  let uncompressedBytes = 0;
  let hasContentTypes = false;
  let hasDocumentXml = false;

  for (let index = 0; index < entries; index++) {
    if (offset + 46 > buffer.byteLength || view.getUint32(offset, true) !== CENTRAL_SIGNATURE) {
      return { ok: false, message: 'The Word file has a damaged ZIP directory.' };
    }

    const flags = view.getUint16(offset + 8, true);
    const method = view.getUint16(offset + 10, true);
    const compressed = view.getUint32(offset + 20, true);
    const uncompressed = view.getUint32(offset + 24, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const next = offset + 46 + nameLength + extraLength + commentLength;
    if (next > buffer.byteLength) return { ok: false, message: 'The Word file has a damaged ZIP directory.' };

    if (flags & 0x1) return { ok: false, message: 'Encrypted/password-protected Word files cannot be imported.' };
    if (method !== 0 && method !== 8) return { ok: false, message: 'This Word file uses an unsupported ZIP compression method.' };
    if (compressed === 0xffffffff || uncompressed === 0xffffffff) return { ok: false, message: 'ZIP64 document entries are not supported.' };
    if (uncompressed > MAX_DOCX_ENTRY_BYTES) return { ok: false, message: 'This document contains an internal file that is too large to process safely.' };

    compressedBytes += compressed;
    uncompressedBytes += uncompressed;
    if (uncompressedBytes > MAX_DOCX_UNCOMPRESSED_BYTES) {
      return { ok: false, message: 'This document expands beyond the safe processing limit.' };
    }
    if (compressed > 0 && uncompressed > 1024 * 1024 && uncompressed / compressed > MAX_DOCX_COMPRESSION_RATIO) {
      return { ok: false, message: 'This document has an unsafe compression ratio and was not opened.' };
    }

    const name = decodeName(bytes.subarray(offset + 46, offset + 46 + nameLength)).replace(/\\/g, '/');
    if (name.includes('../') || name.startsWith('/')) return { ok: false, message: 'This document contains an unsafe archive path.' };
    if (name === '[Content_Types].xml') hasContentTypes = true;
    if (name === 'word/document.xml') hasDocumentXml = true;
    offset = next;
  }

  if (!hasContentTypes || !hasDocumentXml) return { ok: false, message: 'This archive does not appear to be a valid Word .docx document.' };
  return { ok: true, stats: { entries, compressedBytes, uncompressedBytes } };
}
