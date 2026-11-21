const express = require('express');
const router = express.Router();
const patientsController = require('../controllers/patientsController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// Mandatory authentication on patient records
router.post('/', authenticateToken, requireRole('health_worker', 'doctor', 'admin'), patientsController.create);
router.get('/', authenticateToken, patientsController.list);
router.get('/:id', authenticateToken, patientsController.getById);

module.exports = router;
