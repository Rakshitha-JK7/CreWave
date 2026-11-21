const express = require('express');
const router = express.Router();
const responsesController = require('../controllers/responsesController');
const { optionalAuth } = require('../middleware/auth');

// Rural clinic reverse synchronisation: poll for doctor responses
router.get('/responses', optionalAuth, responsesController.getPendingForClinic);

module.exports = router;
