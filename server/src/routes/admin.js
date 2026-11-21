const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const { authenticateToken, requireRole } = require('../middleware/auth');

// All admin routes strictly require authentication and 'admin' role
router.use(authenticateToken, requireRole('admin'));

router.get('/pending-users', adminController.getPendingUsers);
router.get('/users', adminController.getAllUsers);
router.patch('/users/:id/approve', adminController.approveUser);
router.patch('/users/:id/reject', adminController.rejectUser);
router.get('/stats', adminController.getSystemStats);

module.exports = router;
