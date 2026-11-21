const responseService = require('../services/responseService');

class ResponsesController {
  async create(req, res, next) {
    try {
      const { id } = req.params;
      const doctorUser = req.user && req.user.role === 'doctor' ? req.user : null;
      const response = await responseService.createResponse(id, req.body, doctorUser);

      res.status(201).json({
        success: true,
        message: 'Doctor response submitted successfully.',
        data: response,
      });
    } catch (err) {
      next(err);
    }
  }

  async listForConsultation(req, res, next) {
    try {
      const { id } = req.params;
      const responses = await responseService.getResponsesByConsultation(id);

      res.status(200).json({
        success: true,
        count: responses.length,
        data: responses,
      });
    } catch (err) {
      next(err);
    }
  }

  async getPendingForClinic(req, res, next) {
    try {
      const { clinicId, healthWorkerId, since } = req.query;
      const responses = await responseService.getPendingResponsesForClinic({
        clinicId: clinicId || (req.user ? req.user.clinicId : null),
        healthWorkerId,
        since,
      });

      // Returns array directly to support Individual 3's responseSync: if (Array.isArray(responses))
      if (req.query.envelope === 'true') {
        return res.status(200).json({
          success: true,
          count: responses.length,
          data: responses,
        });
      }

      res.status(200).json(responses);
    } catch (err) {
      next(err);
    }
  }

  async acknowledge(req, res, next) {
    try {
      const { id } = req.params;
      const clientInfo = {
        clientId: req.user ? req.user.id : (req.body.clientId || req.headers['x-client-id']),
        healthWorkerId: req.user ? req.user.id : req.body.healthWorkerId,
      };

      const result = await responseService.acknowledgeResponse(id, clientInfo);

      res.status(200).json({
        success: true,
        message: 'Doctor response acknowledged by clinic.',
        data: result,
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ResponsesController();
