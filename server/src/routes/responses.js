const express = require('express');
const router = express.Router();
const responsesController = require('../controllers/responsesController');
const { optionalAuth } = require('../middleware/auth');

// Acknowledge receipt of a doctor's response by the rural clinic
router.patch('/:id/acknowledge', optionalAuth, responsesController.acknowledge);

module.exports = router;
