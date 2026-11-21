const express = require('express');
const router = express.Router();
const consultationsController = require('../controllers/consultationsController');
const responsesController = require('../controllers/responsesController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Doctor's prioritized incoming queue
router.get('/consultations', authenticateToken, requireRole('doctor', 'admin'), consultationsController.getDoctorQueue);

// Doctor views specific consultation detail
router.get('/consultations/:id', authenticateToken, requireRole('doctor', 'admin'), consultationsController.getById);

// Doctor updates review status
router.patch('/consultations/:id/review', authenticateToken, requireRole('doctor', 'admin'), consultationsController.updateReview);

// Doctor response endpoints for a consultation
router.post('/consultations/:id/responses', authenticateToken, requireRole('doctor', 'admin'), responsesController.create);
router.get('/consultations/:id/responses', authenticateToken, requireRole('doctor', 'admin'), responsesController.listForConsultation);

module.exports = router;
