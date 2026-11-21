const express = require('express');
const router = express.Router();
const medicalRecordsController = require('../controllers/medicalRecordsController');
const { authenticateToken, requireRole, requireApprovedAccount } = require('../middleware/auth');

// Middleware for raw binary payload handling
const rawBinaryParser = express.raw({
  type: ['application/vnd.carebridge.medical-record', 'application/octet-stream', 'application/x-protobuf'],
  limit: '50mb',
});

// Ping endpoint for high-precision latency measurement (public diagnostic health check)
router.get('/ping', medicalRecordsController.ping);

// Receiver-side AI image restoration test endpoint (Strictly protected for authorized clinical/admin testers)
router.post(
  '/test-image-restore',
  authenticateToken,
  requireRole('admin', 'health_worker', 'doctor'),
  express.json({ limit: '25mb' }),
  medicalRecordsController.testImageRestore
);

// Upload unified compressed medical record (Protected: health worker or admin)
router.post(
  '/upload',
  authenticateToken,
  requireRole('health_worker', 'admin'),
  rawBinaryParser,
  medicalRecordsController.upload
);

// Retrieve full reconstructed medical record (Protected: clinical staff or patient self-access)
router.get('/:id', authenticateToken, requireApprovedAccount, medicalRecordsController.getById);

// Stream original reconstructed attachment (Protected)
router.get('/attachments/:id/original', authenticateToken, medicalRecordsController.getOriginalAttachment);

// Stream receiver-side AI enhanced preview (Protected)
router.get('/attachments/:id/enhanced', authenticateToken, medicalRecordsController.getEnhancedAttachment);

// Reverse communication: submit specialist medical advice (Protected: doctor or admin)
router.post(
  '/response/upload',
  authenticateToken,
  requireRole('doctor', 'admin'),
  express.json({ limit: '10mb' }),
  medicalRecordsController.uploadResponse
);

// Retrieve doctor advice for consultation (Protected)
router.get('/response/:consultationId', authenticateToken, medicalRecordsController.getResponse);

module.exports = router;
