const express = require('express');
const router = express.Router();
const consultationsController = require('../controllers/consultationsController');
const responsesController = require('../controllers/responsesController');
const { optionalAuth } = require('../middleware/auth');

// Doctor's prioritized incoming queue
router.get('/consultations', optionalAuth, consultationsController.getDoctorQueue);

// Doctor views specific consultation detail
router.get('/consultations/:id', optionalAuth, consultationsController.getById);

// Doctor updates review status
router.patch('/consultations/:id/review', optionalAuth, consultationsController.updateReview);

// Doctor response endpoints for a consultation
router.post('/consultations/:id/responses', optionalAuth, responsesController.create);
router.get('/consultations/:id/responses', optionalAuth, responsesController.listForConsultation);

module.exports = router;
