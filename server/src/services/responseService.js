const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

class ResponseService {
  /**
   * Submit doctor's assessment and advice for a consultation
   */
  async createResponse(consultationId, payload, doctorUser = null) {
    const {
      doctorId,
      doctorName,
      assessment,
      recommendedSteps,
      followUpAdvice,
      referralRequired = false,
      referralDetails,
      prescriptionText,
      prescriptionDocumentPath,
    } = payload;

    if (!assessment) {
      const err = new Error('Doctor assessment is required.');
      err.statusCode = 400;
      throw err;
    }

    // Verify consultation exists
    const consultation = await db.get('SELECT id, status FROM consultations WHERE id = ?', [consultationId]);
    if (!consultation) {
      const err = new Error(`Consultation not found: ${consultationId}`);
      err.statusCode = 404;
      err.code = 'CONSULTATION_NOT_FOUND';
      throw err;
    }

    const finalDoctorId = doctorId || (doctorUser ? doctorUser.id : 'DOC-DEMO-01');
    const finalDoctorName = doctorName || (doctorUser ? doctorUser.name : 'Dr. Remote Specialist');
    const responseId = `RES-${uuidv4().substring(0, 8).toUpperCase()}`;

    // Insert response record
    await db.run(
      `INSERT INTO doctor_responses (
        id, consultation_id, doctor_id, doctor_name, review_date,
        assessment, recommended_steps, follow_up_advice,
        referral_required, referral_details, prescription_text, prescription_document_path,
        delivery_status, created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?, CURRENT_TIMESTAMP,
        ?, ?, ?,
        ?, ?, ?, ?,
        'submitted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`,
      [
        responseId,
        consultationId,
        finalDoctorId,
        finalDoctorName,
        assessment,
        recommendedSteps || null,
        followUpAdvice || null,
        referralRequired ? 1 : 0,
        referralDetails || null,
        prescriptionText || null,
        prescriptionDocumentPath || null,
      ]
    );

    // Update consultation status to 'response_submitted' and reviewed_by_doctor
    await db.run(
      `UPDATE consultations
       SET status = 'response_submitted', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [consultationId]
    );

    // Log event
    await db.run(
      `INSERT INTO sync_events (id, consultation_id, event_type, client_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        `EVT-${uuidv4()}`,
        consultationId,
        'DOCTOR_RESPONSE_SUBMITTED',
        finalDoctorId,
        JSON.stringify({ responseId, referralRequired }),
      ]
    );

    return this.getResponseById(responseId);
  }

  async getResponseById(responseId) {
    const res = await db.get(
      `SELECT r.id, r.consultation_id as "consultationId", r.doctor_id as "doctorId",
              r.doctor_name as "doctorName", r.review_date as "reviewDate",
              r.assessment, r.recommended_steps as "recommendedSteps",
              r.follow_up_advice as "followUpAdvice", r.referral_required as "referralRequired",
              r.referral_details as "referralDetails", r.prescription_text as "prescriptionText",
              r.prescription_document_path as "prescriptionDocumentPath",
              r.delivery_status as "deliveryStatus", r.clinic_acknowledged_at as "clinicAcknowledgedAt",
              r.created_at as "createdAt", r.updated_at as "updatedAt"
       FROM doctor_responses r
       WHERE r.id = ?`,
      [responseId]
    );

    if (!res) {
      const err = new Error(`Doctor response not found: ${responseId}`);
      err.statusCode = 404;
      throw err;
    }

    return {
      ...res,
      referralRequired: Boolean(res.referralRequired),
    };
  }

  /**
   * Retrieve all responses for a consultation
   */
  async getResponsesByConsultation(consultationId) {
    const rows = await db.all(
      `SELECT r.id, r.consultation_id as "consultationId", r.doctor_id as "doctorId",
              r.doctor_name as "doctorName", r.review_date as "reviewDate",
              r.assessment, r.recommended_steps as "recommendedSteps",
              r.follow_up_advice as "followUpAdvice", r.referral_required as "referralRequired",
              r.referral_details as "referralDetails", r.prescription_text as "prescriptionText",
              r.prescription_document_path as "prescriptionDocumentPath",
              r.delivery_status as "deliveryStatus", r.clinic_acknowledged_at as "clinicAcknowledgedAt",
              r.created_at as "createdAt"
       FROM doctor_responses r
       WHERE r.consultation_id = ?
       ORDER BY r.created_at DESC`,
      [consultationId]
    );

    return rows.map(r => ({
      ...r,
      referralRequired: Boolean(r.referralRequired),
    }));
  }

  /**
   * Sync API: Retrieve pending responses for the clinic
   */
  async getPendingResponsesForClinic({ clinicId, healthWorkerId, since } = {}) {
    let sql = `SELECT r.id, r.consultation_id as "consultationId", r.doctor_id as "doctorId",
                      r.doctor_name as "doctorName", r.review_date as "reviewDate",
                      r.assessment, r.recommended_steps as "recommendedSteps",
                      r.follow_up_advice as "followUpAdvice", r.referral_required as "referralRequired",
                      r.referral_details as "referralDetails", r.prescription_text as "prescriptionText",
                      r.delivery_status as "deliveryStatus", r.created_at as "createdAt",
                      c.patient_id as "patientId", c.clinic_id as "clinicId", c.health_worker_id as "healthWorkerId",
                      p.reference_id as "patientReferenceId", p.name as "patientName"
               FROM doctor_responses r
               JOIN consultations c ON r.consultation_id = c.id
               JOIN patients p ON c.patient_id = p.id
               WHERE r.delivery_status != 'acknowledged'`;
    const params = [];

    if (clinicId && healthWorkerId) {
      sql += ` AND (c.clinic_id = ? OR c.health_worker_id = ?)`;
      params.push(clinicId, healthWorkerId);
    } else if (clinicId) {
      sql += ` AND c.clinic_id = ?`;
      params.push(clinicId);
    } else if (healthWorkerId) {
      sql += ` AND c.health_worker_id = ?`;
      params.push(healthWorkerId);
    }

    if (since) {
      sql += ` AND r.updated_at > ?`;
      params.push(since);
    }

    sql += ` ORDER BY r.created_at ASC`;

    const rows = await db.all(sql, params);

    return rows.map(r => ({
      id: r.id,
      consultationId: r.consultationId,
      doctorId: r.doctorId,
      doctorName: r.doctorName,
      reviewDate: r.reviewDate,
      assessment: r.assessment,
      recommendedSteps: r.recommendedSteps,
      followUpAdvice: r.followUpAdvice,
      referralRequired: Boolean(r.referralRequired),
      referralDetails: r.referralDetails,
      prescriptionText: r.prescriptionText,
      deliveryStatus: r.deliveryStatus,
      createdAt: r.createdAt,
      patient: {
        id: r.patientId,
        referenceId: r.patientReferenceId,
        name: r.patientName,
      },
    }));
  }

  /**
   * Acknowledge receipt of doctor's response by the rural clinic
   */
  async acknowledgeResponse(responseId, clientInfo = {}) {
    const response = await db.get('SELECT * FROM doctor_responses WHERE id = ?', [responseId]);
    if (!response) {
      const err = new Error(`Response not found: ${responseId}`);
      err.statusCode = 404;
      throw err;
    }

    await db.run(
      `UPDATE doctor_responses
       SET delivery_status = 'acknowledged', clinic_acknowledged_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [responseId]
    );

    // Update consultation status to 'response_received_by_clinic'
    await db.run(
      `UPDATE consultations
       SET status = 'response_received_by_clinic', updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
      [response.consultation_id]
    );

    // Record sync event
    await db.run(
      `INSERT INTO sync_events (id, consultation_id, event_type, client_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        `EVT-${uuidv4()}`,
        response.consultation_id,
        'RESPONSE_ACKNOWLEDGED_BY_CLINIC',
        clientInfo.clientId || clientInfo.healthWorkerId || 'RURAL_CLINIC',
        JSON.stringify({ responseId, acknowledgedAt: new Date().toISOString() }),
      ]
    );

    return {
      success: true,
      responseId,
      consultationId: response.consultation_id,
      deliveryStatus: 'acknowledged',
      consultationStatus: 'response_received_by_clinic',
      acknowledgedAt: new Date().toISOString(),
    };
  }
}

module.exports = new ResponseService();
