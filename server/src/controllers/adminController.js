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
      const [usersCount, patientsCount, consultationsCount, responsesCount, pendingUsersCount, doctorsCount, hwCount] = await Promise.all([
        db.get('SELECT COUNT(*) as count FROM users'),
        db.get('SELECT COUNT(*) as count FROM patients'),
        db.get('SELECT COUNT(*) as count FROM consultations'),
        db.get('SELECT COUNT(*) as count FROM doctor_responses'),
        db.get("SELECT COUNT(*) as count FROM users WHERE status = 'pending'"),
        db.get("SELECT COUNT(*) as count FROM users WHERE role = 'doctor'"),
        db.get("SELECT COUNT(*) as count FROM users WHERE role = 'health_worker'"),
      ]);

      const users = Number(usersCount?.count || 0);
      const pendingApprovals = Number(pendingUsersCount?.count || 0);
      const patients = Number(patientsCount?.count || 0);
      const consultations = Number(consultationsCount?.count || 0);
      const responses = Number(responsesCount?.count || 0);
      const doctors = Number(doctorsCount?.count || 0);
      const healthWorkers = Number(hwCount?.count || 0);

      res.status(200).json({
        success: true,
        data: {
          users,
          totalUsers: users,
          pendingApprovals,
          patients,
          consultations,
          totalConsultations: consultations,
          responses,
          doctors,
          healthWorkers,
          databaseType: db.getType(),
        },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminController();
