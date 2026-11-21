const express = require('express');
const router = express.Router();
const consultationsController = require('../controllers/consultationsController');
const responsesController = require('../controllers/responsesController');
const { optionalAuth } = require('../middleware/auth');

// Create consultation (handles idempotency key for offline-first retries)
router.post('/', optionalAuth, consultationsController.create);

// Get consultation details
router.get('/:id', optionalAuth, consultationsController.getById);

// Update consultation data
router.patch('/:id', optionalAuth, consultationsController.update);

// Update doctor review status (in_review, reviewed_by_doctor)
router.patch('/:id/review', optionalAuth, consultationsController.updateReview);

// Get consultation delivery and sync status
router.get('/:id/sync-status', optionalAuth, consultationsController.getSyncStatus);

// Doctor response endpoints for a consultation
router.post('/:id/responses', optionalAuth, responsesController.create);
router.get('/:id/responses', optionalAuth, responsesController.listForConsultation);

module.exports = router;
