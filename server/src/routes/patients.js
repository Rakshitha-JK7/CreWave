const express = require('express');
const router = express.Router();
const patientsController = require('../controllers/patientsController');
const { optionalAuth } = require('../middleware/auth');

// Allow optional auth so that early milestone tests can post without requiring JWT,
// but extract user identity if token or dev headers provided
router.post('/', optionalAuth, patientsController.create);
router.get('/', optionalAuth, patientsController.list);
router.get('/:id', optionalAuth, patientsController.getById);

module.exports = router;
