const express = require('express');
const router = express.Router();
const responsesController = require('../controllers/responsesController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Rural clinic and patient reverse synchronisation: poll for doctor responses
router.get('/responses', authenticateToken, requireRole('health_worker', 'patient', 'doctor', 'admin'), responsesController.getPendingForClinic);

module.exports = router;
