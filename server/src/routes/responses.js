const express = require('express');
const router = express.Router();
const responsesController = require('../controllers/responsesController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Acknowledge receipt of a doctor's response by the rural clinic
router.patch('/:id/acknowledge', authenticateToken, requireRole('health_worker', 'admin'), responsesController.acknowledge);

module.exports = router;
