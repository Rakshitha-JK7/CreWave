const patientService = require('../services/patientService');

class PatientsController {
  async create(req, res, next) {
    try {
      const createdBy = req.user ? req.user.id : (req.body.createdBy || 'HW-DEMO-01');
      const patient = await patientService.createPatient(req.body, createdBy);
      res.status(201).json({
        success: true,
        message: 'Patient registered successfully.',
        data: patient,
      });
    } catch (err) {
      next(err);
    }
  }

  async list(req, res, next) {
    try {
      const { search, village, limit, offset } = req.query;
      const patients = await patientService.getPatients({ search, village, limit, offset });
      res.status(200).json({
        success: true,
        count: patients.length,
        data: patients,
      });
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const patient = await patientService.getPatientById(id);
      res.status(200).json({
        success: true,
        data: patient,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new PatientsController();
