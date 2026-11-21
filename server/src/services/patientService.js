const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');

class PatientService {
  /**
   * Create a new patient
   */
  async createPatient(data, createdBy = null) {
    const {
      referenceId,
      name,
      age,
      dateOfBirth,
      sex,
      village,
      contactNumber,
      consent = true,
    } = data;

    if (!village) {
      const err = new Error('Village/location is required.');
      err.statusCode = 400;
      throw err;
    }

    if (age === undefined && !dateOfBirth) {
      const err = new Error('Age or date of birth is required.');
      err.statusCode = 400;
      throw err;
    }

    // Auto-generate referenceId if not provided (e.g. PAT-XXXX-XXXX)
    const finalRefId = referenceId || `PAT-${uuidv4().substring(0, 8).toUpperCase()}`;
    const id = `P-${uuidv4()}`;

    // Check for existing referenceId
    const existing = await db.get('SELECT id FROM patients WHERE reference_id = ?', [finalRefId]);
    if (existing) {
      const err = new Error(`Patient with reference ID "${finalRefId}" already exists.`);
      err.statusCode = 409;
      err.code = 'PATIENT_ALREADY_EXISTS';
      throw err;
    }

    await db.run(
      `INSERT INTO patients (
        id, reference_id, name, age, date_of_birth, sex, village, contact_number, consent, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        finalRefId,
        name || null,
        age !== undefined ? parseInt(age, 10) : null,
        dateOfBirth || null,
        sex || null,
        village,
        contactNumber || null,
        consent ? 1 : 0,
        createdBy || null,
      ]
    );

    return this.getPatientById(id);
  }

  /**
   * List or search patients
   */
  async getPatients({ search, village, limit = 50, offset = 0 } = {}) {
    let sql = `SELECT id, reference_id as "referenceId", name, age, date_of_birth as "dateOfBirth",
                      sex, village, contact_number as "contactNumber", consent,
                      created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
               FROM patients WHERE 1=1`;
    const params = [];

    if (search) {
      sql += ` AND (reference_id LIKE ? OR name LIKE ? OR contact_number LIKE ?)`;
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }

    if (village) {
      sql += ` AND village LIKE ?`;
      params.push(`%${village}%`);
    }

    sql += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
    params.push(parseInt(limit, 10), parseInt(offset, 10));

    const patients = await db.all(sql, params);
    return patients.map(p => ({
      ...p,
      consent: Boolean(p.consent),
    }));
  }

  /**
   * Get patient details by internal ID or reference ID, including consultation history
   */
  async getPatientById(idOrRef) {
    const patient = await db.get(
      `SELECT id, reference_id as "referenceId", name, age, date_of_birth as "dateOfBirth",
              sex, village, contact_number as "contactNumber", consent,
              created_by as "createdBy", created_at as "createdAt", updated_at as "updatedAt"
       FROM patients
       WHERE id = ? OR reference_id = ?`,
      [idOrRef, idOrRef]
    );

    if (!patient) {
      const err = new Error(`Patient not found with ID/Reference: ${idOrRef}`);
      err.statusCode = 404;
      err.code = 'PATIENT_NOT_FOUND';
      throw err;
    }

    // Fetch consultations for this patient
    const consultations = await db.all(
      `SELECT id, priority, status, sync_status as "syncStatus", main_complaint as "mainComplaint",
              urgency_category as "urgencyCategory", consultation_date as "consultationDate", created_at as "createdAt"
       FROM consultations
       WHERE patient_id = ?
       ORDER BY consultation_date DESC`,
      [patient.id]
    );

    return {
      ...patient,
      consent: Boolean(patient.consent),
      consultations: consultations || [],
    };
  }
}

module.exports = new PatientService();
