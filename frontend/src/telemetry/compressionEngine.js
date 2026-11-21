/**
 * CareBridge Unified Lossless Compression Engine (Browser)
 * Lossless GZIP compression over Protocol Buffers binary payloads.
 * Strictly preserves 100% original medical data fidelity.
 */

import { gzip, ungzip } from 'pako';
import { calculateSha256 } from './protoCodec';

const MAX_DECOMPRESSED_SIZE_DEFAULT = 200 * 1024 * 1024; // 200 MB safe limit

/**
 * Compresses an uncompressed Uint8Array using lossless GZIP (DEFLATE)
 * @param {Uint8Array} binaryPayload - serialized protobuf binary
 * @param {object} [options]
 * @param {number} [options.level=6] - compression level 1-9
 * @returns {Promise<{ compressed: Uint8Array, originalSize: number, compressedSize: number, sha256: string, ratio: number, durationMs: number }>}
 */
export async function compressRecord(binaryPayload, options = {}) {
  const level = options.level !== undefined ? options.level : 6;
  const originalSize = binaryPayload.byteLength || binaryPayload.length;
  const hash = await calculateSha256(binaryPayload);

  const t0 = performance.now();
  const compressed = gzip(binaryPayload, {
    level: Math.max(1, Math.min(9, level)),
  });
  const t1 = performance.now();
  const durationMs = Number((t1 - t0).toFixed(2));

  const compressedSize = compressed.byteLength || compressed.length;
  const ratio = originalSize > 0
    ? Number(((1 - (compressedSize / originalSize)) * 100).toFixed(2))
    : 0;

  return {
    compressed,
    originalSize,
    compressedSize,
    sha256: hash,
    ratio,
    compressionLevel: level,
    durationMs,
  };
}

/**
 * Decompresses a GZIP Uint8Array safely
 * @param {Uint8Array} compressedPayload 
 * @param {object} [options]
 * @returns {Promise<{ uncompressed: Uint8Array, uncompressedSize: number, sha256: string, durationMs: number }>}
 */
export async function decompressRecord(compressedPayload, options = {}) {
  const t0 = performance.now();
  const uncompressed = ungzip(compressedPayload);
  const t1 = performance.now();
  const durationMs = Number((t1 - t0).toFixed(2));

  const uncompressedSize = uncompressed.byteLength || uncompressed.length;
  const maxLimit = options.maxDecompressedSize || MAX_DECOMPRESSED_SIZE_DEFAULT;
  if (uncompressedSize > maxLimit) {
    throw new Error(`Decompression rejected: Payload exceeds max safe size (${maxLimit} bytes)`);
  }

  const hash = await calculateSha256(uncompressed);
  return {
    uncompressed,
    uncompressedSize,
    sha256: hash,
    durationMs,
  };
}

/**
 * Validates that uncompressed payload matches expected SHA-256
 */
export async function verifyIntegrity(uncompressedPayload, expectedSha256) {
  if (!expectedSha256) return false;
  const hash = await calculateSha256(uncompressedPayload);
  return hash.toLowerCase() === expectedSha256.toLowerCase();
}

export default {
  compressRecord,
  decompressRecord,
  verifyIntegrity,
};
