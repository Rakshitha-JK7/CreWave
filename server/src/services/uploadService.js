const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const config = require('../config/config');

class UploadService {
  constructor() {
    this.ensureDirectories();
  }

  ensureDirectories() {
    [config.uploadDir, config.chunkDir, config.completedDir].forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  /**
   * Initialize a new chunked upload session
   */
  async initUpload(payload) {
    this.ensureDirectories();

    const {
      consultationId,
      attachmentId,
      fileName,
      fileSize,
      chunkSize = config.defaultChunkSize,
      totalChunks,
      checksum,
      checksumAlgorithm = 'sha256',
      mimeType = 'application/octet-stream',
      priority = 2,
      componentType = 'clinical_recording',
    } = payload;

    if (!consultationId) {
      const err = new Error('consultationId is required to initialize an upload.');
      err.statusCode = 400;
      throw err;
    }

    if (!fileName || !fileSize) {
      const err = new Error('fileName and fileSize are required.');
      err.statusCode = 400;
      throw err;
    }

    // Verify consultation exists
    const consultation = await db.get('SELECT id FROM consultations WHERE id = ?', [consultationId]);
    if (!consultation) {
      const err = new Error(`Consultation not found: ${consultationId}`);
      err.statusCode = 404;
      err.code = 'CONSULTATION_NOT_FOUND';
      throw err;
    }

    // Calculate totalChunks if not provided
    const calculatedChunks = totalChunks || Math.ceil(fileSize / chunkSize);
    const uploadId = `UPL-${uuidv4().substring(0, 8).toUpperCase()}`;
    const finalAttachmentId = attachmentId || `ATT-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Create session chunk storage directory
    const sessionChunkDir = path.join(config.chunkDir, uploadId);
    if (!fs.existsSync(sessionChunkDir)) {
      fs.mkdirSync(sessionChunkDir, { recursive: true });
    }

    // Pre-create or update attachment record
    const existingAtt = await db.get('SELECT id FROM attachments WHERE id = ?', [finalAttachmentId]);
    if (!existingAtt) {
      await db.run(
        `INSERT INTO attachments (
          id, consultation_id, component_id, type, priority, file_name, file_size,
          mime_type, checksum, checksum_algorithm, upload_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'uploading', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          finalAttachmentId,
          consultationId,
          componentType,
          componentType,
          priority,
          fileName,
          fileSize,
          mimeType,
          checksum || null,
          checksumAlgorithm,
        ]
      );
    } else {
      await db.run(
        `UPDATE attachments SET upload_status = 'uploading', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [finalAttachmentId]
      );
    }

    // Insert upload session
    await db.run(
      `INSERT INTO upload_sessions (
        id, consultation_id, attachment_id, file_name, file_size, chunk_size,
        total_chunks, expected_checksum, checksum_algorithm, mime_type, status,
        created_at, updated_at, expires_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'initialised', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        uploadId,
        consultationId,
        finalAttachmentId,
        fileName,
        fileSize,
        chunkSize,
        calculatedChunks,
        checksum || null,
        checksumAlgorithm,
        mimeType,
      ]
    );

    return {
      uploadId,
      consultationId,
      attachmentId: finalAttachmentId,
      fileName,
      fileSize,
      chunkSize,
      totalChunks: calculatedChunks,
      status: 'initialised',
      expiresInHours: config.uploadSessionTtlHours,
    };
  }

  /**
   * Save an uploaded chunk (Idempotent: safely handles duplicate chunks)
   */
  async saveChunk(uploadId, chunkIndex, chunkBuffer, clientChecksum = null) {
    const session = await db.get('SELECT * FROM upload_sessions WHERE id = ?', [uploadId]);
    if (!session) {
      const err = new Error(`Upload session not found: ${uploadId}`);
      err.statusCode = 404;
      err.code = 'UPLOAD_SESSION_NOT_FOUND';
      throw err;
    }

    if (session.status === 'completed') {
      return {
        success: true,
        uploadId,
        chunkIndex,
        message: 'Upload already completed.',
        status: 'completed',
      };
    }

    const index = parseInt(chunkIndex, 10);
    if (isNaN(index) || index < 0 || index >= session.total_chunks) {
      const err = new Error(`Invalid chunkIndex: ${chunkIndex}. Expected 0 to ${session.total_chunks - 1}`);
      err.statusCode = 400;
      throw err;
    }

    if (!chunkBuffer || chunkBuffer.length === 0) {
      const err = new Error('Chunk payload is empty.');
      err.statusCode = 400;
      throw err;
    }

    // Verify chunk checksum if provided by client
    const hash = crypto.createHash(session.checksum_algorithm || 'sha256');
    hash.update(chunkBuffer);
    const calculatedChecksum = hash.digest('hex');

    if (clientChecksum && clientChecksum.toLowerCase() !== calculatedChecksum.toLowerCase()) {
      const err = new Error(`Chunk checksum mismatch at index ${index}. Client: ${clientChecksum}, Server: ${calculatedChecksum}`);
      err.statusCode = 400;
      err.code = 'CHUNK_CHECKSUM_MISMATCH';
      throw err;
    }

    // Save chunk to disk
    const sessionChunkDir = path.join(config.chunkDir, uploadId);
    if (!fs.existsSync(sessionChunkDir)) {
      fs.mkdirSync(sessionChunkDir, { recursive: true });
    }

    const chunkFilePath = path.join(sessionChunkDir, `chunk_${index}.bin`);
    fs.writeFileSync(chunkFilePath, chunkBuffer);

    // Record in database (upsert for idempotency)
    const existingChunk = await db.get(
      'SELECT upload_id FROM upload_chunks WHERE upload_id = ? AND chunk_index = ?',
      [uploadId, index]
    );

    if (existingChunk) {
      await db.run(
        `UPDATE upload_chunks
         SET chunk_size = ?, checksum = ?, storage_path = ?, received_at = CURRENT_TIMESTAMP
         WHERE upload_id = ? AND chunk_index = ?`,
        [chunkBuffer.length, calculatedChecksum, chunkFilePath, uploadId, index]
      );
    } else {
      await db.run(
        `INSERT INTO upload_chunks (upload_id, chunk_index, chunk_size, checksum, storage_path, received_at)
         VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
        [uploadId, index, chunkBuffer.length, calculatedChecksum, chunkFilePath]
      );
    }

    // Update session status to uploading
    await db.run(
      `UPDATE upload_sessions SET status = 'uploading', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [uploadId]
    );

    // Get count of received chunks
    const receivedCountRow = await db.get(
      'SELECT COUNT(*) as count FROM upload_chunks WHERE upload_id = ?',
      [uploadId]
    );
    const totalReceived = parseInt(receivedCountRow.count, 10);

    return {
      success: true,
      uploadId,
      chunkIndex: index,
      receivedBytes: chunkBuffer.length,
      checksum: calculatedChecksum,
      totalChunksReceived: totalReceived,
      totalChunks: session.total_chunks,
      progressPercent: Math.round((totalReceived / session.total_chunks) * 100),
      isComplete: totalReceived === session.total_chunks,
    };
  }

  /**
   * Get upload status, received chunks, and missing chunks for resume
   */
  async getUploadStatus(uploadId) {
    const session = await db.get('SELECT * FROM upload_sessions WHERE id = ?', [uploadId]);
    if (!session) {
      const err = new Error(`Upload session not found: ${uploadId}`);
      err.statusCode = 404;
      err.code = 'UPLOAD_SESSION_NOT_FOUND';
      throw err;
    }

    const receivedChunksRows = await db.all(
      'SELECT chunk_index, chunk_size, checksum, received_at FROM upload_chunks WHERE upload_id = ? ORDER BY chunk_index ASC',
      [uploadId]
    );

    const receivedIndices = new Set(receivedChunksRows.map(r => r.chunk_index));
    const missingChunks = [];

    for (let i = 0; i < session.total_chunks; i++) {
      if (!receivedIndices.has(i)) {
        missingChunks.push(i);
      }
    }

    const receivedCount = receivedChunksRows.length;
    const progressPercent = session.total_chunks > 0
      ? Math.round((receivedCount / session.total_chunks) * 100)
      : 0;

    return {
      uploadId: session.id,
      consultationId: session.consultation_id,
      attachmentId: session.attachment_id,
      fileName: session.file_name,
      fileSize: session.file_size,
      chunkSize: session.chunk_size,
      totalChunks: session.total_chunks,
      status: session.status,
      receivedChunks: Array.from(receivedIndices).sort((a, b) => a - b),
      missingChunks,
      receivedChunksCount: receivedCount,
      missingChunksCount: missingChunks.length,
      progressPercent,
      isComplete: missingChunks.length === 0,
      expectedChecksum: session.expected_checksum,
      checksumAlgorithm: session.checksum_algorithm,
    };
  }

  /**
   * Complete chunked upload: verify all chunks, reassemble file, check final checksum
   */
  async completeUpload(uploadId, { finalChecksum, checksumAlgorithm } = {}) {
    this.ensureDirectories();

    const session = await db.get('SELECT * FROM upload_sessions WHERE id = ?', [uploadId]);
    if (!session) {
      const err = new Error(`Upload session not found: ${uploadId}`);
      err.statusCode = 404;
      err.code = 'UPLOAD_SESSION_NOT_FOUND';
      throw err;
    }

    if (session.status === 'completed') {
      const attachment = await db.get('SELECT * FROM attachments WHERE id = ?', [session.attachment_id]);
      return {
        success: true,
        uploadId,
        attachmentId: session.attachment_id,
        status: 'completed',
        message: 'Upload was already finalized and completed.',
        storagePath: attachment ? attachment.storage_path : null,
        checksum: session.expected_checksum,
      };
    }

    // Verify all chunks are present
    const status = await this.getUploadStatus(uploadId);
    if (!status.isComplete) {
      const err = new Error(`Cannot complete upload. ${status.missingChunks.length} chunks are missing.`);
      err.statusCode = 400;
      err.code = 'CHUNKS_MISSING';
      err.details = {
        missingChunks: status.missingChunks,
        totalChunks: session.total_chunks,
      };
      throw err;
    }

    // Reassemble file
    const safeFileName = path.basename(session.file_name).replace(/[^a-zA-Z0-9._-]/g, '_');
    const finalDestFileName = `${uploadId}_${safeFileName}`;
    const finalFilePath = path.join(config.completedDir, finalDestFileName);

    const writeStream = fs.createWriteStream(finalFilePath);
    const sessionChunkDir = path.join(config.chunkDir, uploadId);

    const algo = checksumAlgorithm || session.checksum_algorithm || 'sha256';
    const hash = crypto.createHash(algo);

    for (let i = 0; i < session.total_chunks; i++) {
      const chunkPath = path.join(sessionChunkDir, `chunk_${i}.bin`);
      if (!fs.existsSync(chunkPath)) {
        writeStream.destroy();
        const err = new Error(`Chunk file missing on disk at index ${i}`);
        err.statusCode = 500;
        throw err;
      }

      const chunkBuffer = fs.readFileSync(chunkPath);
      hash.update(chunkBuffer);
      writeStream.write(chunkBuffer);
    }

    await new Promise((resolve, reject) => {
      writeStream.end(() => resolve());
      writeStream.on('error', reject);
    });

    const actualChecksum = hash.digest('hex');
    const expected = finalChecksum || session.expected_checksum;

    // Checksum verification
    if (expected && expected.toLowerCase() !== actualChecksum.toLowerCase()) {
      // Remove corrupted assembled file
      if (fs.existsSync(finalFilePath)) {
        fs.unlinkSync(finalFilePath);
      }

      const err = new Error(`Final file checksum verification failed! Expected ${expected}, got ${actualChecksum}`);
      err.statusCode = 422;
      err.code = 'INTEGRITY_VERIFICATION_FAILED';
      err.details = { expected, actual: actualChecksum };
      throw err;
    }

    // Update upload_sessions status
    await db.run(
      `UPDATE upload_sessions
       SET status = 'completed', expected_checksum = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [actualChecksum, uploadId]
    );

    // Update attachments table
    await db.run(
      `UPDATE attachments
       SET upload_status = 'completed', storage_path = ?, checksum = ?, checksum_algorithm = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [finalFilePath, actualChecksum, algo, session.attachment_id]
    );

    // Clean up temporary chunks directory
    try {
      if (fs.existsSync(sessionChunkDir)) {
        fs.rmSync(sessionChunkDir, { recursive: true, force: true });
      }
    } catch (e) {
      console.warn(`[CareWave Upload] Notice: Could not remove temporary chunk directory: ${e.message}`);
    }

    console.log(`[CareWave Upload] File assembled and verified: ${finalDestFileName} (${session.file_size} bytes, ${actualChecksum})`);

    return {
      success: true,
      uploadId,
      attachmentId: session.attachment_id,
      consultationId: session.consultation_id,
      fileName: session.file_name,
      fileSize: session.file_size,
      checksum: actualChecksum,
      checksumAlgorithm: algo,
      verified: true,
      status: 'completed',
      storagePath: finalFilePath,
    };
  }
}

module.exports = new UploadService();
