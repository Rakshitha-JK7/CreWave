import { computeSHA256 } from './cryptoUtils.js';
import { networkSimulator } from './networkSimulator.js';
import { defaultRetryManager } from './retryManager.js';
import {
  saveChunk,
  getChunk,
  getChunksByComponent,
  deleteChunksForComponent,
  updateComponentStatus,
} from './localDB.js';
import { TransferState } from './constants.js';

export class UploadManager {
  constructor({ apiBaseUrl = '/api', onProgress = null } = {}) {
    this.apiBaseUrl = apiBaseUrl;
    this.onProgress = onProgress; // callback ({ componentId, progress, uploadedChunks, totalChunks })
  }

  /**
   * Prepares and splits a file/blob into chunks, stores them in IndexedDB
   * @param {string} componentId 
   * @param {Blob | File} file 
   * @param {number} chunkSize 
   * @returns {Promise<{ totalChunks: number, fileHash: string, chunkSize: number }>}
   */
  async prepareFileChunks(componentId, file, chunkSize = 64 * 1024) {
    const totalChunks = Math.ceil(file.size / chunkSize);
    const fileHash = await computeSHA256(file);

    for (let index = 0; index < totalChunks; index++) {
      const start = index * chunkSize;
      const end = Math.min(start + chunkSize, file.size);
      const chunkBlob = file.slice(start, end);
      const chunkHash = await computeSHA256(chunkBlob);
      await saveChunk(componentId, index, chunkBlob, chunkHash);
    }

    return { totalChunks, fileHash, chunkSize };
  }

  /**
   * Resumable chunked upload protocol
   * 1. init -> returns already received chunk indexes
   * 2. upload only missing chunks (with chunk hash)
   * 3. complete -> server verifies file hash
   */
  async uploadComponent({
    consultationId,
    componentId,
    type,
    file,
    chunkSize = 64 * 1024,
    signal = null,
  }) {
    // Check if chunks already prepared in DB
    let existingChunks = await getChunksByComponent(componentId);
    let totalChunks = existingChunks.length;
    let fileHash;

    if (totalChunks === 0) {
      const prep = await this.prepareFileChunks(componentId, file, chunkSize);
      totalChunks = prep.totalChunks;
      fileHash = prep.fileHash;
    } else {
      fileHash = await computeSHA256(file);
    }

    await updateComponentStatus(componentId, {
      status: TransferState.UPLOADING,
      totalChunks,
      chunkSize,
      fileHash,
    });

    // Step 1: Init session
    const initPayload = {
      consultationId,
      componentId,
      type,
      size: file.size,
      chunkSize,
      totalChunks,
      fileHash,
    };

    const initRes = await defaultRetryManager.executeWithRetry(async () => {
      const res = await networkSimulator.simulatedFetch(`${this.apiBaseUrl}/uploads/init`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initPayload),
        signal,
      });
      if (!res.ok) {
        throw new Error(`Init failed with status ${res.status}`);
      }
      return res.json();
    });

    const receivedIndices = new Set(initRes.receivedChunks || []);
    let uploadedCount = receivedIndices.size;

    this.emitProgress(componentId, uploadedCount, totalChunks);

    // Step 2: Upload missing chunks (0-indexed)
    for (let index = 0; index < totalChunks; index++) {
      if (signal && signal.aborted) {
        throw new Error('Upload aborted');
      }

      if (receivedIndices.has(index)) {
        continue; // Chunk already on server
      }

      const chunkRecord = await getChunk(componentId, index);
      if (!chunkRecord) {
        throw new Error(`Chunk ${index} not found locally for component ${componentId}`);
      }

      await defaultRetryManager.executeWithRetry(async () => {
        const formData = new FormData();
        formData.append('chunk', chunkRecord.blob);
        formData.append('hash', chunkRecord.hash);
        formData.append('index', index.toString());

        const chunkRes = await networkSimulator.simulatedFetch(
          `${this.apiBaseUrl}/uploads/${initRes.uploadId || componentId}/chunks/${index}`,
          {
            method: 'PUT',
            body: formData,
            headers: {
              'X-Chunk-Hash': chunkRecord.hash,
              'X-Chunk-Index': index.toString(),
            },
            signal,
          }
        );

        if (!chunkRes.ok) {
          throw new Error(`Chunk ${index} upload failed: HTTP ${chunkRes.status}`);
        }
        return chunkRes;
      });

      uploadedCount++;
      this.emitProgress(componentId, uploadedCount, totalChunks);
      await updateComponentStatus(componentId, { uploadedChunks: uploadedCount });
    }

    // Step 3: Complete upload
    const completeRes = await defaultRetryManager.executeWithRetry(async () => {
      const res = await networkSimulator.simulatedFetch(
        `${this.apiBaseUrl}/uploads/${initRes.uploadId || componentId}/complete`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            consultationId,
            componentId,
            fileHash,
            totalChunks,
          }),
          signal,
        }
      );
      if (!res.ok) {
        throw new Error(`Upload completion verification failed: HTTP ${res.status}`);
      }
      return res.json();
    });

    await updateComponentStatus(componentId, {
      status: TransferState.COMPLETED,
      completedAt: new Date().toISOString(),
    });

    // Optionally cleanup chunks from IndexedDB after successful server verification
    await deleteChunksForComponent(componentId);

    return completeRes;
  }

  emitProgress(componentId, uploadedChunks, totalChunks) {
    const percentage = totalChunks > 0 ? Math.round((uploadedChunks / totalChunks) * 100) : 0;
    if (this.onProgress) {
      this.onProgress({ componentId, progress: percentage, uploadedChunks, totalChunks });
    }
  }
}
