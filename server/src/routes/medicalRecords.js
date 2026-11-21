const express = require('express');
const router = express.Router();
const medicalRecordsController = require('../controllers/medicalRecordsController');
const { authenticateToken, optionalAuth } = require('../middleware/auth');

// Middleware for raw binary payload handling
const rawBinaryParser = express.raw({
  type: ['application/vnd.carebridge.medical-record', 'application/octet-stream', 'application/x-protobuf'],
  limit: '50mb',
});

// Ping endpoint for high-precision latency measurement
router.get('/ping', medicalRecordsController.ping);

// Receiver-side AI image restoration test endpoint
router.post('/test-image-restore', express.json({ limit: '25mb' }), medicalRecordsController.testImageRestore);

// Upload unified compressed medical record
router.post('/upload', optionalAuth, rawBinaryParser, medicalRecordsController.upload);

// Retrieve full reconstructed medical record
router.get('/:id', optionalAuth, medicalRecordsController.getById);

// Stream original reconstructed attachment
router.get('/attachments/:id/original', optionalAuth, medicalRecordsController.getOriginalAttachment);

// Stream receiver-side AI enhanced preview
router.get('/attachments/:id/enhanced', optionalAuth, medicalRecordsController.getEnhancedAttachment);

// Reverse communication: submit specialist medical advice
router.post('/response/upload', optionalAuth, medicalRecordsController.uploadResponse);

// Retrieve doctor advice for consultation
router.get('/response/:consultationId', optionalAuth, medicalRecordsController.getResponse);

module.exports = router;
