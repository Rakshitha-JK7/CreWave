const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const patientService = require('./patientService');

class ConsultationService {
  /**
   * Create or idempotently return a consultation
   */
  async createConsultation(payload, healthWorkerId = null) {
    const consultationId = payload.consultationId || payload.id;
    const finalConsultationId = consultationId || `CW-${uuidv4().substring(0, 8).toUpperCase()}`;
    const idempotencyKey = payload.idempotencyKey;
    const priority = payload.priority || payload.urgency || 'normal';

    if (!idempotencyKey) {
      const err = new Error('idempotencyKey is required for offline-first transmission.');
      err.statusCode = 400;
      err.code = 'IDEMPOTENCY_KEY_REQUIRED';
      throw err;
    }

    const {
      patientId,
      clinicId = 'CLINIC-RURAL-01',
      urgencyCategory,
      immediateAction,
      measurementsUnavailable,
      consentStatus = true,
      clinicalSummary = {},
      vitals = {},
      attachments = [],
    } = payload;

    // 1. Idempotency Check: prevent duplicate consultation on network retry
    const existing = await db.get(
      'SELECT id FROM consultations WHERE idempotency_key = ?',
      [idempotencyKey]
    );

    if (existing) {
      console.log(`[CareWave Consultation] Idempotent retry detected for key: ${idempotencyKey}`);
      const existingRecord = await this.getConsultationById(existing.id);
      return {
        isDuplicate: true,
        message: 'Consultation already processed with this idempotency key.',
        consultation: existingRecord,
      };
    }

    if (!patientId) {
      const err = new Error('patientId or patient reference ID is required.');
      err.statusCode = 400;
      throw err;
    }

    // Verify patient exists
    let patient = await db.get('SELECT id, reference_id FROM patients WHERE id = ? OR reference_id = ?', [patientId, patientId]);
    if (!patient) {
      // If patient does not exist, let's create a minimal patient record if village provided, or error
      if (payload.patientDetails && payload.patientDetails.village) {
        patient = await patientService.createPatient({
          referenceId: patientId,
          ...payload.patientDetails,
        }, healthWorkerId);
      } else {
        const err = new Error(`Patient not found with ID/Reference: ${patientId}`);
        err.statusCode = 404;
        err.code = 'PATIENT_NOT_FOUND';
        throw err;
      }
    }

    const finalHwId = healthWorkerId || payload.healthWorkerId || 'HW-DEMO-01';

    // Normalize clinical summary fields
    const mainComplaint = clinicalSummary.mainComplaint || clinicalSummary.symptoms || payload.mainComplaint || 'General consultation';
    const symptoms = clinicalSummary.symptoms || payload.symptoms || mainComplaint;
    const symptomOnset = clinicalSummary.onset || payload.symptomOnset || null;
    const symptomDuration = clinicalSummary.duration || payload.symptomDuration || null;
    const severityProgression = clinicalSummary.severityProgression || payload.severityProgression || null;
    const medicalHistory = clinicalSummary.medicalHistory || payload.medicalHistory || null;
    const medications = clinicalSummary.medications || payload.medications || null;
    const allergies = clinicalSummary.allergies || payload.allergies || null;
    const hwObservations = clinicalSummary.healthWorkerObservations || payload.healthWorkerObservations || null;
    const hwNotes = payload.healthWorkerNotes || hwObservations || null;

    // Normalize vitals JSON
    const vitalsJson = typeof vitals === 'object' ? JSON.stringify(vitals) : vitals;

    // Determine initial status:
    // If essential summary is received by server, it's available to doctor
    const status = 'available_to_doctor';
    const syncStatus = 'delivered';

    try {
      await db.run(
        `INSERT INTO consultations (
          id, idempotency_key, patient_id, health_worker_id, clinic_id,
          consultation_date, priority, status, sync_status,
          main_complaint, symptoms, symptom_onset, symptom_duration, severity_progression,
          medical_history, medications, allergies, health_worker_observations, health_worker_notes,
          measurements_unavailable, urgency_category, immediate_action, consent_status,
          vitals, created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?,
          CURRENT_TIMESTAMP, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        )`,
        [
          finalConsultationId,
          idempotencyKey,
          patient.id,
          finalHwId,
          clinicId,
          priority,
          status,
          syncStatus,
          mainComplaint,
          symptoms,
          symptomOnset,
          symptomDuration,
          severityProgression,
          medicalHistory,
          medications,
          allergies,
          hwObservations,
          hwNotes,
          measurementsUnavailable || null,
          urgencyCategory || null,
          immediateAction || null,
          consentStatus ? 1 : 0,
          vitalsJson,
        ]
      );
    } catch (insertErr) {
      // Handle concurrent race condition where multiple requests arrive at the exact same millisecond
      if (
        insertErr.message &&
        (insertErr.message.includes('idempotency_key') ||
         insertErr.message.includes('UNIQUE') ||
         insertErr.message.includes('unique') ||
         insertErr.code === '23505') // Postgres unique_violation code
      ) {
        console.log(`[CareWave Consultation] Concurrent insert race detected for key: ${idempotencyKey}. Resolving existing record.`);
        const raceExisting = await db.get('SELECT id FROM consultations WHERE idempotency_key = ?', [idempotencyKey]);
        if (raceExisting) {
          const existingRecord = await this.getConsultationById(raceExisting.id);
          return {
            isDuplicate: true,
            message: 'Consultation already processed with this idempotency key.',
            consultation: existingRecord,
          };
        }
      }
      throw insertErr;
    }

    // If attachments metadata included in payload, register them
    if (Array.isArray(attachments) && attachments.length > 0) {
      for (const att of attachments) {
        const attId = att.id || `ATT-${uuidv4().substring(0, 8).toUpperCase()}`;
        await db.run(
          `INSERT INTO attachments (
            id, consultation_id, component_id, type, priority, file_name, file_size,
            mime_type, checksum, checksum_algorithm, upload_status, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            attId,
            finalConsultationId,
            att.componentId || 'supporting_attachment',
            att.type || 'other',
            att.priority !== undefined ? att.priority : 2,
            att.fileName || 'attachment.dat',
            att.fileSize || 0,
            att.mimeType || 'application/octet-stream',
            att.checksum || null,
            att.checksumAlgorithm || 'sha256',
            att.uploadStatus || 'pending',
          ]
        );
      }
    }

    // Log sync event
    await db.run(
      `INSERT INTO sync_events (id, consultation_id, event_type, client_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        `EVT-${uuidv4()}`,
        finalConsultationId,
        'CONSULTATION_CREATED',
        finalHwId,
        JSON.stringify({ idempotencyKey, priority, status }),
      ]
    );

    const created = await this.getConsultationById(finalConsultationId);
    return {
      isDuplicate: false,
      message: 'Consultation successfully created and received by server.',
      consultation: created,
    };
  }

  /**
   * Get complete consultation details
   */
  async getConsultationById(id) {
    const consultation = await db.get(
      `SELECT c.*,
              p.reference_id as "patientReferenceId", p.name as "patientName",
              p.age as "patientAge", p.sex as "patientSex", p.village as "patientVillage",
              p.contact_number as "patientContact"
       FROM consultations c
       JOIN patients p ON c.patient_id = p.id
       WHERE c.id = ?`,
      [id]
    );

    if (!consultation) {
      const err = new Error(`Consultation not found: ${id}`);
      err.statusCode = 404;
      err.code = 'CONSULTATION_NOT_FOUND';
      throw err;
    }

    // Attachments
    const attachments = await db.all(
      `SELECT id, component_id as "componentId", type, priority, file_name as "fileName",
              file_size as "fileSize", mime_type as "mimeType", checksum,
              checksum_algorithm as "checksumAlgorithm", upload_status as "uploadStatus",
              storage_path as "storagePath", capture_date as "captureDate", created_at as "createdAt"
       FROM attachments
       WHERE consultation_id = ?
       ORDER BY priority ASC, created_at ASC`,
      [id]
    );

    // Doctor responses
    const responses = await db.all(
      `SELECT id, doctor_id as "doctorId", doctor_name as "doctorName", review_date as "reviewDate",
              assessment, recommended_steps as "recommendedSteps", follow_up_advice as "followUpAdvice",
              referral_required as "referralRequired", referral_details as "referralDetails",
              prescription_text as "prescriptionText", prescription_document_path as "prescriptionDocumentPath",
              delivery_status as "deliveryStatus", clinic_acknowledged_at as "clinicAcknowledgedAt",
              created_at as "createdAt"
       FROM doctor_responses
       WHERE consultation_id = ?
       ORDER BY created_at DESC`,
      [id]
    );

    // Format vitals JSON
    let parsedVitals = {};
    if (consultation.vitals) {
      try {
        parsedVitals = typeof consultation.vitals === 'string' ? JSON.parse(consultation.vitals) : consultation.vitals;
      } catch (e) {
        parsedVitals = { raw: consultation.vitals };
      }
    }

    // Attachment pending summary
    const totalAttachments = attachments.length;
    const completedAttachments = attachments.filter(a => a.uploadStatus === 'completed').length;
    const pendingAttachments = totalAttachments - completedAttachments;

    return {
      id: consultation.id,
      idempotencyKey: consultation.idempotency_key,
      patientId: consultation.patient_id,
      healthWorkerId: consultation.health_worker_id,
      clinicId: consultation.clinic_id,
      consultationDate: consultation.consultation_date,
      priority: consultation.priority,
      status: consultation.status,
      syncStatus: consultation.sync_status,
      clinicalSummary: {
        mainComplaint: consultation.main_complaint,
        symptoms: consultation.symptoms,
        onset: consultation.symptom_onset,
        duration: consultation.symptom_duration,
        severityProgression: consultation.severity_progression,
        medicalHistory: consultation.medical_history,
        medications: consultation.medications,
        allergies: consultation.allergies,
        healthWorkerObservations: consultation.health_worker_observations,
        healthWorkerNotes: consultation.health_worker_notes,
      },
      vitals: parsedVitals,
      urgencyCategory: consultation.urgency_category,
      immediateAction: consultation.immediate_action,
      measurementsUnavailable: consultation.measurements_unavailable,
      consentStatus: Boolean(consultation.consent_status),
      createdAt: consultation.created_at,
      updatedAt: consultation.updated_at,
      patient: {
        id: consultation.patient_id,
        referenceId: consultation.patientReferenceId,
        name: consultation.patientName,
        age: consultation.patientAge,
        sex: consultation.patientSex,
        village: consultation.patientVillage,
        contactNumber: consultation.patientContact,
      },
      attachments: attachments.map(a => ({
        ...a,
        isCompleted: a.uploadStatus === 'completed',
      })),
      attachmentStats: {
        total: totalAttachments,
        completed: completedAttachments,
        pending: pendingAttachments,
        allCompleted: totalAttachments === completedAttachments,
      },
      responses: responses.map(r => ({
        ...r,
        referralRequired: Boolean(r.referralRequired),
      })),
    };
  }

  /**
   * Update consultation data
   */
  async updateConsultation(id, updates) {
    const consultation = await db.get('SELECT id FROM consultations WHERE id = ?', [id]);
    if (!consultation) {
      const err = new Error(`Consultation not found: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    const allowedFields = {
      priority: 'priority',
      status: 'status',
      syncStatus: 'sync_status',
      mainComplaint: 'main_complaint',
      symptoms: 'symptoms',
      symptomDuration: 'symptom_duration',
      medicalHistory: 'medical_history',
      medications: 'medications',
      allergies: 'allergies',
      healthWorkerObservations: 'health_worker_observations',
      healthWorkerNotes: 'health_worker_notes',
      urgencyCategory: 'urgency_category',
      immediateAction: 'immediate_action',
      measurementsUnavailable: 'measurements_unavailable',
    };

    const setClauses = [];
    const params = [];

    for (const [key, col] of Object.entries(allowedFields)) {
      if (updates[key] !== undefined) {
        setClauses.push(`${col} = ?`);
        params.push(updates[key]);
      }
    }

    if (updates.vitals !== undefined) {
      setClauses.push('vitals = ?');
      params.push(typeof updates.vitals === 'object' ? JSON.stringify(updates.vitals) : updates.vitals);
    }

    if (setClauses.length === 0) {
      return this.getConsultationById(id);
    }

    setClauses.push('updated_at = CURRENT_TIMESTAMP');
    params.push(id);

    const sql = `UPDATE consultations SET ${setClauses.join(', ')} WHERE id = ?`;
    await db.run(sql, params);

    return this.getConsultationById(id);
  }

  /**
   * General list of consultations for health worker and patient dashboards
   */
  async getConsultationsList({ status, priority, clinicId, patientId, limit = 50, offset = 0 } = {}) {
    let sql = `SELECT c.*,
                      p.reference_id as "patientReferenceId", p.name as "patientName",
                      p.age as "patientAge", p.sex as "patientSex", p.village as "patientVillage",
                      p.contact_number as "patientContact"
               FROM consultations c
               LEFT JOIN patients p ON c.patient_id = p.id
               WHERE 1=1`;
    const params = [];

    if (status && status !== 'all') {
      sql += ` AND c.status = ?`;
      params.push(status);
    }

    if (priority && priority !== 'all') {
      sql += ` AND (c.priority = ? OR c.urgency_category = ?)`;
      params.push(priority, priority);
    }

    if (clinicId) {
      sql += ` AND c.clinic_id = ?`;
      params.push(clinicId);
    }

    if (patientId) {
      sql += ` AND (c.patient_id = ? OR p.reference_id = ?)`;
      params.push(patientId, patientId);
    }

    sql += ` ORDER BY c.consultation_date DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = await db.all(sql, params);

    return rows.map(r => {
      let vitals = {};
      if (r.vitals) {
        try {
          vitals = typeof r.vitals === 'string' ? JSON.parse(r.vitals) : r.vitals;
        } catch (e) {
          vitals = {};
        }
      }

      return {
        id: r.id,
        consultationId: r.id,
        patientId: r.patient_id,
        patientName: r.patientName || r.patientReferenceId,
        healthWorkerId: r.health_worker_id,
        clinicId: r.clinic_id,
        priority: r.priority,
        urgency: r.priority,
        urgencyCategory: r.urgency_category,
        status: r.status,
        syncStatus: r.sync_status,
        mainComplaint: r.main_complaint,
        symptoms: r.symptoms,
        vitals,
        consultationDate: r.consultation_date,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      };
    });
  }

  /**
   * Doctor incoming consultations queue
   * Prioritized: emergency > urgent > normal, and by consultation date
   */
  async getDoctorQueue({ status, priority, clinicId, limit = 50, offset = 0 } = {}) {
    let sql = `SELECT c.id, c.idempotency_key as "idempotencyKey", c.patient_id as "patientId",
                      c.health_worker_id as "healthWorkerId", c.clinic_id as "clinicId",
                      c.consultation_date as "consultationDate", c.priority, c.status,
                      c.sync_status as "syncStatus", c.main_complaint as "mainComplaint",
                      c.symptom_duration as "symptomDuration", c.urgency_category as "urgencyCategory",
                      c.created_at as "createdAt",
                      p.reference_id as "patientReferenceId", p.name as "patientName",
                      p.age as "patientAge", p.sex as "patientSex", p.village as "patientVillage",
                      (SELECT COUNT(*) FROM attachments a WHERE a.consultation_id = c.id) as "totalAttachments",
                      (SELECT COUNT(*) FROM attachments a WHERE a.consultation_id = c.id AND a.upload_status = 'completed') as "completedAttachments",
                      (SELECT COUNT(*) FROM doctor_responses dr WHERE dr.consultation_id = c.id) as "responseCount"
               FROM consultations c
               JOIN patients p ON c.patient_id = p.id
               WHERE 1=1`;
    const params = [];

    if (status) {
      sql += ` AND c.status = ?`;
      params.push(status);
    }

    if (priority) {
      sql += ` AND c.priority = ?`;
      params.push(priority);
    }

    if (clinicId) {
      sql += ` AND c.clinic_id = ?`;
      params.push(clinicId);
    }

    // Sort order: Emergency (1), Urgent (2), Normal (3), then newest first
    sql += ` ORDER BY
              CASE c.priority
                WHEN 'emergency' THEN 1
                WHEN 'urgent' THEN 2
                ELSE 3
              END ASC,
              c.consultation_date DESC
            LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const rows = await db.all(sql, params);

    return rows.map(r => {
      const totalAtt = parseInt(r.totalAttachments || 0, 10);
      const compAtt = parseInt(r.completedAttachments || 0, 10);
      const pendingAtt = totalAtt - compAtt;

      return {
        id: r.id,
        idempotencyKey: r.idempotencyKey,
        patientId: r.patientId,
        healthWorkerId: r.healthWorkerId,
        clinicId: r.clinicId,
        consultationDate: r.consultationDate,
        priority: r.priority,
        status: r.status,
        syncStatus: r.syncStatus,
        mainComplaint: r.mainComplaint,
        symptomDuration: r.symptomDuration,
        urgencyCategory: r.urgencyCategory,
        createdAt: r.createdAt,
        patient: {
          id: r.patientId,
          referenceId: r.patientReferenceId,
          name: r.patientName,
          age: r.patientAge,
          sex: r.patientSex,
          village: r.patientVillage,
        },
        attachmentStatus: {
          total: totalAtt,
          completed: compAtt,
          pending: pendingAtt,
          hasPendingAttachments: pendingAtt > 0,
        },
        hasResponse: parseInt(r.responseCount || 0, 10) > 0,
      };
    });
  }

  /**
   * Update doctor review status
   */
  async updateReviewStatus(id, { status = 'in_review', doctorId, doctorName }) {
    const consultation = await db.get('SELECT id, status FROM consultations WHERE id = ?', [id]);
    if (!consultation) {
      const err = new Error(`Consultation not found: ${id}`);
      err.statusCode = 404;
      throw err;
    }

    const validStatuses = ['in_review', 'reviewed_by_doctor', 'available_to_doctor'];
    if (!validStatuses.includes(status)) {
      const err = new Error(`Invalid review status: ${status}. Expected one of: ${validStatuses.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    await db.run(
      'UPDATE consultations SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?',
      [status, id]
    );

    await db.run(
      `INSERT INTO sync_events (id, consultation_id, event_type, client_id, payload, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
      [
        `EVT-${uuidv4()}`,
        id,
        'REVIEW_STATUS_UPDATED',
        doctorId || 'UNKNOWN_DOCTOR',
        JSON.stringify({ status, doctorName }),
      ]
    );

    return this.getConsultationById(id);
  }

  /**
   * Get sync status for consultation (Transmission groups 1, 2, 3)
   */
  async getSyncStatus(id) {
    const consultation = await this.getConsultationById(id);

    // Group 1: Essential Clinical Summary
    // Already delivered if consultation exists on server
    const group1Status = {
      group: '1 - Essential summary',
      status: 'delivered',
      receivedAt: consultation.createdAt,
      items: ['Consultation ID', 'Patient Reference ID', 'Main complaint', 'Vitals', 'Urgency'],
    };

    // Group 2: Supporting Clinical Data (ECG, clinical images, recordings)
    const supportingAttachments = consultation.attachments.filter(a => a.priority <= 2);
    const group2Complete = supportingAttachments.every(a => a.uploadStatus === 'completed');
    const group2Status = {
      group: '2 - Clinically important supporting data',
      status: supportingAttachments.length === 0 ? 'not_applicable' : (group2Complete ? 'delivered' : 'partial'),
      totalItems: supportingAttachments.length,
      completedItems: supportingAttachments.filter(a => a.uploadStatus === 'completed').length,
      attachments: supportingAttachments,
    };

    // Group 3: Additional Documents (lab reports, previous prescriptions)
    const documentAttachments = consultation.attachments.filter(a => a.priority > 2);
    const group3Complete = documentAttachments.every(a => a.uploadStatus === 'completed');
    const group3Status = {
      group: '3 - Additional supporting documents',
      status: documentAttachments.length === 0 ? 'not_applicable' : (group3Complete ? 'delivered' : 'partial'),
      totalItems: documentAttachments.length,
      completedItems: documentAttachments.filter(a => a.uploadStatus === 'completed').length,
      attachments: documentAttachments,
    };

    return {
      consultationId: consultation.id,
      overallStatus: consultation.status,
      syncStatus: consultation.syncStatus,
      transmissionGroups: {
        group1: group1Status,
        group2: group2Status,
        group3: group3Status,
      },
      responses: consultation.responses.map(r => ({
        id: r.id,
        doctorId: r.doctorId,
        doctorName: r.doctorName,
        deliveryStatus: r.deliveryStatus,
        reviewedAt: r.reviewDate,
      })),
    };
  }
}

module.exports = new ConsultationService();
