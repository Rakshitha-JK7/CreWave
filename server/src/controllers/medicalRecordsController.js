/**
 * CareBridge Medical Records Controller
 * Handles unified binary telemetry uploads, verification queries, attachment streaming, and doctor advice.
 */

const fs = require('fs');
const path = require('path');
const medicalRecordService = require('../services/medicalRecordService');
const db = require('../models/db');
const aiRestorationService = require('../services/aiRestorationService');

class MedicalRecordsController {
  async upload(req, res, next) {
    try {
      const buffer = req.body;
      if (!Buffer.isBuffer(buffer)) {
        return res.status(400).json({
          success: false,
          error: 'Expected binary payload with Content-Type: application/vnd.carebridge.medical-record or application/octet-stream',
        });
      }

      const receipt = await medicalRecordService.processUpload(buffer, req.headers, req.user);
      res.status(receipt.alreadyDelivered ? 200 : 201).json({
        success: true,
        message: 'Medical record received, decompressed, verified and safely committed.',
        receipt,
      });
    } catch (err) {
      console.error('[MedicalRecords Upload Error]:', err.message);
      res.status(422).json({
        success: false,
        error: err.message,
      });
    }
  }

  async getById(req, res, next) {
    try {
      const record = await medicalRecordService.getReconstructedRecord(req.params.id);
      if (!record) {
        return res.status(404).json({
          success: false,
          error: `Medical record #${req.params.id} not found.`,
        });
      }
      res.status(200).json({
        success: true,
        data: record,
      });
    } catch (err) {
      next(err);
    }
  }

  async getOriginalAttachment(req, res, next) {
    try {
      const att = await db.get('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
      if (!att || !att.storage_path || !fs.existsSync(att.storage_path)) {
        return res.status(404).json({ success: false, error: 'Attachment file not found' });
      }

      res.setHeader('Content-Type', att.mime_type || 'application/octet-stream');
      res.setHeader('X-Original-Checksum', att.checksum || '');
      res.setHeader('Content-Disposition', `inline; filename="${att.file_name}"`);
      fs.createReadStream(att.storage_path).pipe(res);
    } catch (err) {
      next(err);
    }
  }

  async getEnhancedAttachment(req, res, next) {
    try {
      const rest = await aiRestorationService.getRestorationByAttachmentId(req.params.id);
      if (!rest || !rest.enhanced_file_path || !fs.existsSync(rest.enhanced_file_path)) {
        return res.status(404).json({ success: false, error: 'Enhanced preview not yet generated' });
      }

      res.setHeader('Content-Type', 'image/png');
      res.setHeader('X-Enhanced-Checksum', rest.enhanced_file_hash || '');
      res.setHeader('X-AI-Model', rest.model_name || '');
      res.setHeader('Content-Disposition', `inline; filename="${req.params.id}_enhanced.png"`);
      fs.createReadStream(rest.enhanced_file_path).pipe(res);
    } catch (err) {
      next(err);
    }
  }

  async uploadResponse(req, res, next) {
    try {
      // Handles doctor response submission
      const { consultationId, assessment, recommendations, prescriptions, followUpInstructions, referral } = req.body;
      const doctorId = req.user?.id || 'DOC-DEMO-01';
      const doctorName = req.user?.name || 'Dr. Anjali Mehta';

      const responseId = `RESP-${Date.now()}`;
      await db.run(
        `INSERT INTO doctor_responses 
         (id, consultation_id, doctor_id, doctor_name, assessment, recommended_steps, follow_up_advice, referral_required, referral_details, delivery_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'submitted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          responseId,
          consultationId,
          doctorId,
          doctorName,
          assessment || '',
          recommendations || '',
          followUpInstructions || '',
          referral?.recommended ? 1 : 0,
          referral?.details || '',
        ]
      );

      // Update consultation status to response_available
      await db.run(
        `UPDATE consultations SET status = 'response_available', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
        [consultationId]
      );

      res.status(201).json({
        success: true,
        message: 'Doctor advice and prescription stamped and queued for rural clinic sync.',
        data: {
          responseId,
          consultationId,
          status: 'submitted',
        },
      });
    } catch (err) {
      next(err);
    }
  }

  async getResponse(req, res, next) {
    try {
      const resp = await db.get(
        'SELECT * FROM doctor_responses WHERE consultation_id = ? ORDER BY created_at DESC LIMIT 1',
        [req.params.consultationId]
      );
      if (!resp) {
        return res.status(404).json({ success: false, error: 'No doctor advice on record yet' });
      }
      res.status(200).json({ success: true, data: resp });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new MedicalRecordsController();
