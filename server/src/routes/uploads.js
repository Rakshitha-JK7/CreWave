const express = require('express');
const router = express.Router();
const multer = require('multer');
const uploadsController = require('../controllers/uploadsController');
const { optionalAuth } = require('../middleware/auth');

// Multer memory storage for multipart chunk uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB per chunk limit
});

// Middleware to parse raw binary octet-stream bodies if sent
const rawBodyParser = express.raw({
  type: ['application/octet-stream', 'application/binary'],
  limit: '20mb',
});

// Create upload session
router.post('/init', optionalAuth, uploadsController.init);

// Upload a single chunk (supports raw binary, multipart file, or base64 JSON)
router.put(
  '/:uploadId/chunks/:index',
  optionalAuth,
  upload.single('chunk'),
  rawBodyParser,
  uploadsController.uploadChunk
);

// Get upload status and list missing chunks for resume
router.get('/:uploadId/status', optionalAuth, uploadsController.getStatus);

// Verify all chunks, reassemble file, and complete upload
router.post('/:uploadId/complete', optionalAuth, uploadsController.complete);

module.exports = router;
