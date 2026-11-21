const consultationService = require('../services/consultationService');

class ConsultationsController {
  async create(req, res, next) {
    try {
      const healthWorkerId = req.user ? req.user.id : (req.body.healthWorkerId || 'HW-DEMO-01');
      if (req.user && req.user.clinicId && !req.body.clinicId) {
        req.body.clinicId = req.user.clinicId;
      }
      if (!req.body.idempotencyKey) {
        if (req.headers['idempotency-key']) {
          req.body.idempotencyKey = req.headers['idempotency-key'];
        } else if (req.headers['x-idempotency-key']) {
          req.body.idempotencyKey = req.headers['x-idempotency-key'];
        } else if (req.body.id) {
          req.body.idempotencyKey = `IDEMP-${req.body.id}`;
        } else if (req.body.consultationId) {
          req.body.idempotencyKey = `IDEMP-${req.body.consultationId}`;
        }
      }
      const result = await consultationService.createConsultation(req.body, healthWorkerId);

      // If duplicate idempotency key, return 200 OK with duplicate notice
      const statusCode = result.isDuplicate ? 200 : 201;
      res.status(statusCode).json({
        success: true,
        isDuplicate: result.isDuplicate,
        message: result.message,
        data: result.consultation,
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const consultation = await consultationService.getConsultationById(id);
      res.status(200).json({
        success: true,
        data: consultation,
      });
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const updated = await consultationService.updateConsultation(id, req.body);
      res.status(200).json({
        success: true,
        message: 'Consultation updated successfully.',
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { status, priority, clinicId, patientId, limit, offset } = req.query;
      const list = await consultationService.getConsultationsList({
        status,
        priority,
        clinicId,
        patientId,
        limit,
        offset,
      });

      if (req.query.envelope === 'true') {
        return res.status(200).json({
          success: true,
          count: list.length,
          data: list,
        });
      }

      res.status(200).json(list);
    } catch (err) {
      next(err);
    }
  }

  async getDoctors(req, res, next) {
    try {
      const doctors = await consultationService.getDoctors();
      res.status(200).json({
        success: true,
        count: doctors.length,
        data: doctors,
      });
    } catch (err) {
      next(err);
    }
  }

  async getDoctorQueue(req, res, next) {
    try {
      const { status, priority, clinicId, limit, offset } = req.query;
      const queue = await consultationService.getDoctorQueue({
        status,
        priority,
        clinicId,
        limit,
        offset,
      });
      res.status(200).json({
        success: true,
        count: queue.length,
        data: queue,
      });
    } catch (err) {
      next(err);
    }
  }

  async updateReview(req, res, next) {
    try {
      const { id } = req.params;
      const status = req.body.status || req.body.reviewStatus || 'in_review';
      const doctorId = req.user ? req.user.id : (req.body.doctorId || 'DOC-DEMO-01');
      const doctorName = req.user ? req.user.name : (req.body.doctorName || 'Dr. Remote Specialist');

      const updated = await consultationService.updateReviewStatus(id, {
        status,
        doctorId,
        doctorName,
      });

      res.status(200).json({
        success: true,
        message: `Consultation review status updated to "${status}".`,
        data: updated,
      });
    } catch (err) {
      next(err);
    }
  }

  async getSyncStatus(req, res, next) {
    try {
      const { id } = req.params;
      const syncStatus = await consultationService.getSyncStatus(id);
      res.status(200).json({
        success: true,
        data: syncStatus,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ConsultationsController();
