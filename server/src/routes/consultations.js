const express = require('express');
const router = express.Router();
const consultationsController = require('../controllers/consultationsController');
const responsesController = require('../controllers/responsesController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Create consultation (handles idempotency key for offline-first retries)
router.post('/', authenticateToken, requireRole('health_worker', 'admin'), consultationsController.create);

// List all consultations for health worker / clinic / patient
router.get('/', authenticateToken, consultationsController.list);

// List available approved doctors for consultation routing
router.get('/doctors', authenticateToken, consultationsController.getDoctors);

// Get consultation details
router.get('/:id', authenticateToken, consultationsController.getById);

// Update consultation data
router.patch('/:id', authenticateToken, consultationsController.update);

// Update doctor review status (in_review, reviewed_by_doctor)
router.patch('/:id/review', authenticateToken, requireRole('doctor', 'admin'), consultationsController.updateReview);

// Get consultation delivery and sync status
router.get('/:id/sync-status', authenticateToken, consultationsController.getSyncStatus);

// Doctor response endpoints for a consultation
router.post('/:id/responses', authenticateToken, requireRole('doctor', 'admin'), responsesController.create);
router.get('/:id/responses', authenticateToken, responsesController.listForConsultation);

module.exports = router;
