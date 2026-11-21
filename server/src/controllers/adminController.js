const authService = require('../services/authService');
const db = require('../models/db');

class AdminController {
  async getPendingUsers(req, res, next) {
    try {
      const users = await authService.getPendingUsers();
      res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    } catch (err) {
      next(err);
    }
  }

  async getAllUsers(req, res, next) {
    try {
      const users = await authService.getAllUsers();
      res.status(200).json({
        success: true,
        count: users.length,
        data: users,
      });
    } catch (err) {
      next(err);
    }
  }

  async approveUser(req, res, next) {
    try {
      const { id } = req.params;
      const approved = await authService.approveUser(id);
      res.status(200).json({
        success: true,
        message: `User ${approved.name} (${approved.username}) approved successfully.`,
        data: approved,
      });
    } catch (err) {
      next(err);
    }
  }

  async rejectUser(req, res, next) {
    try {
      const { id } = req.params;
      const rejected = await authService.rejectUser(id);
      res.status(200).json({
        success: true,
        message: `User ${rejected.name} rejected.`,
        data: rejected,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSystemStats(req, res, next) {
    try {
      const usersCount = await db.get('SELECT COUNT(*) as count FROM users');
      const patientsCount = await db.get('SELECT COUNT(*) as count FROM patients');
      const consultationsCount = await db.get('SELECT COUNT(*) as count FROM consultations');
      const responsesCount = await db.get('SELECT COUNT(*) as count FROM doctor_responses');
      const pendingUsersCount = await db.get("SELECT COUNT(*) as count FROM users WHERE status = 'pending'");

      res.status(200).json({
        success: true,
        data: {
          users: usersCount?.count || 0,
          pendingApprovals: pendingUsersCount?.count || 0,
          patients: patientsCount?.count || 0,
          consultations: consultationsCount?.count || 0,
          responses: responsesCount?.count || 0,
          databaseType: db.getType(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
