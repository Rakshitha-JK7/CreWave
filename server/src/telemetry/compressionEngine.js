/**
 * CareBridge Unified Lossless Compression Engine (Server & Node.js)
 * High-efficiency lossless GZIP compression over Protocol Buffers binary payloads.
 * Strictly preserves 100% original medical data fidelity.
 */

const zlib = require('zlib');
const crypto = require('crypto');

const MAX_DECOMPRESSED_SIZE_DEFAULT = 200 * 1024 * 1024; // 200 MB safety limit against zip-bombs

/**
 * Computes exact SHA-256 hex checksum
 * @param {Buffer|Uint8Array|string} buffer 
 * @returns {string}
 */
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

/**
 * Compresses an uncompressed binary buffer using lossless GZIP (DEFLATE)
 * @param {Buffer} buffer - uncompressed protobuf serialized binary
 * @param {object} [options]
 * @param {number} [options.level=6] - GZIP compression level (1-9)
 * @returns {{ compressed: Buffer, originalSize: number, compressedSize: number, sha256: string, ratio: number, durationMs: number }}
 */
function compressRecord(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer)) {
    buffer = Buffer.from(buffer);
  }

  const level = options.level !== undefined ? options.level : 6;
  const originalSize = buffer.length;
  const hash = sha256(buffer);

  const startTime = process.hrtime.bigint();
  const compressed = zlib.gzipSync(buffer, {
    level: Math.max(1, Math.min(9, level)),
  });
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1e6;

  const compressedSize = compressed.length;
  const ratio = originalSize > 0
    ? Number(((1 - (compressedSize / originalSize)) * 100).toFixed(2))
    : 0;

  return {
    compressed,
    originalSize,
    compressedSize,
    sha256: hash,
    ratio, // % reduction in size
    compressionLevel: level,
    durationMs: Number(durationMs.toFixed(2)),
  };
}

/**
 * Decompresses a GZIP-compressed binary payload safely with zip-bomb safeguards
 * @param {Buffer} compressedBuffer 
 * @param {object} [options]
 * @param {number} [options.maxDecompressedSize]
 * @returns {{ uncompressed: Buffer, uncompressedSize: number, sha256: string, durationMs: number }}
 */
function decompressRecord(compressedBuffer, options = {}) {
  if (!Buffer.isBuffer(compressedBuffer)) {
    compressedBuffer = Buffer.from(compressedBuffer);
  }

  const maxDecompressedSize = options.maxDecompressedSize || MAX_DECOMPRESSED_SIZE_DEFAULT;

  const startTime = process.hrtime.bigint();
  // Safe decompression: gunzipSync with maxOutputLength to prevent memory exhaustion
  let uncompressed;
  try {
    uncompressed = zlib.gunzipSync(compressedBuffer, {
      maxOutputLength: maxDecompressedSize,
    });
  } catch (err) {
    if (err.code === 'ERR_BUFFER_TOO_LARGE' || err.message.includes('maxOutputLength')) {
      throw new Error(`Decompression rejected: Payload exceeds maximum allowed size (${maxDecompressedSize} bytes)`);
    }
    throw new Error(`Lossless decompression failed: ${err.message}`);
  }
  const endTime = process.hrtime.bigint();
  const durationMs = Number(endTime - startTime) / 1e6;

  const uncompressedSize = uncompressed.length;
  const hash = sha256(uncompressed);

  return {
    uncompressed,
    uncompressedSize,
    sha256: hash,
    durationMs: Number(durationMs.toFixed(2)),
  };
}

/**
 * Validates that the uncompressed buffer's SHA-256 matches the expected hash
 * @param {Buffer} uncompressedBuffer 
 * @param {string} expectedSha256 
 * @returns {boolean}
 */
function verifyIntegrity(uncompressedBuffer, expectedSha256) {
  if (!expectedSha256) return false;
  const actualHash = sha256(uncompressedBuffer);
  return actualHash.toLowerCase() === expectedSha256.toLowerCase();
}

module.exports = {
  sha256,
  compressRecord,
  decompressRecord,
  verifyIntegrity,
  MAX_DECOMPRESSED_SIZE_DEFAULT,
};
