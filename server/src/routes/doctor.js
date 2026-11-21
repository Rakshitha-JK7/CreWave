const express = require('express');
const router = express.Router();
const consultationsController = require('../controllers/consultationsController');
const { optionalAuth } = require('../middleware/auth');

// Doctor's prioritized incoming queue
router.get('/consultations', optionalAuth, consultationsController.getDoctorQueue);

module.exports = router;
