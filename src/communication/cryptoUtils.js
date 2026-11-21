/**
 * Crypto Utilities using Web Crypto API (SHA-256)
 * Available in secure contexts (HTTPS & localhost).
 */

/**
 * Computes SHA-256 hex string for an ArrayBuffer or Blob
 * @param {Blob | ArrayBuffer} data 
 * @returns {Promise<string>} Hex encoded SHA-256 hash
 */
export async function computeSHA256(data) {
  let buffer;
  if (data instanceof Blob) {
    buffer = await data.arrayBuffer();
  } else if (data instanceof ArrayBuffer) {
    buffer = data;
  } else if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data);
  } else {
    throw new Error('Unsupported data type for SHA-256 computation');
  }

  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
