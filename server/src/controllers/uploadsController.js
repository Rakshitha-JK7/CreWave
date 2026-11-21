const uploadService = require('../services/uploadService');

class UploadsController {
  async init(req, res, next) {
    try {
      const session = await uploadService.initUpload(req.body);
      res.status(201).json({
        success: true,
        message: 'Upload session initialized.',
        data: session,
      });
    } catch (err) {
      next(err);
    }
  }

  async uploadChunk(req, res, next) {
    try {
      const { uploadId, index } = req.params;
      let chunkBuffer = null;

      // 1. Multer file buffer
      if (req.file && req.file.buffer) {
        chunkBuffer = req.file.buffer;
      }
      // 2. Raw binary buffer (application/octet-stream)
      else if (Buffer.isBuffer(req.body)) {
        chunkBuffer = req.body;
      }
      // 3. Base64 in JSON payload
      else if (req.body && (req.body.chunk || req.body.data)) {
        const base64Data = req.body.chunk || req.body.data;
        chunkBuffer = Buffer.from(base64Data, 'base64');
      }

      if (!chunkBuffer || chunkBuffer.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No chunk data received. Please provide chunk as raw binary, multipart file, or base64 data.',
          code: 'EMPTY_CHUNK',
        });
      }

      const clientChecksum = req.headers['x-checksum'] || req.headers['chunk-checksum'] || req.query.checksum || null;

      const result = await uploadService.saveChunk(uploadId, index, chunkBuffer, clientChecksum);

      res.status(200).json({
        success: true,
        message: `Chunk ${index} received successfully.`,
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }

  async getStatus(req, res, next) {
    try {
      const { uploadId } = req.params;
      const status = await uploadService.getUploadStatus(uploadId);
      res.status(200).json({
        success: true,
        data: status,
      });
    } catch (err) {
      next(err);
    }
  }

  async complete(req, res, next) {
    try {
      const { uploadId } = req.params;
      const { finalChecksum, checksumAlgorithm } = req.body || {};
      const result = await uploadService.completeUpload(uploadId, { finalChecksum, checksumAlgorithm });

      res.status(200).json({
        success: true,
        message: 'File upload assembled and integrity verified successfully.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new UploadsController();
