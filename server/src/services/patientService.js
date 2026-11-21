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
      email,
      age,
      dateOfBirth,
      sex,
      village,
      contactNumber,
      phone,
      consent = true,
      bloodGroup,
      blood_group,
      emergencyContact,
      emergency_contact,
      medicalHistory,
      medical_history,
      conditions,
      allergies,
      userId,
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

    // Auto-generate referenceId if not provided in format Name-87263
    const cleanName = (name || 'Patient').trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '') || 'Patient';
    const randomDigits = Math.floor(10000 + Math.random() * 90000);
    const finalRefId = referenceId || `${cleanName}-${randomDigits}`;
    const id = `P-${uuidv4()}`;
    const finalEmail = (email || '').trim().toLowerCase() || null;

    const finalBloodGroup = bloodGroup || blood_group || 'Unknown';
    const finalEmergencyContact = typeof emergencyContact === 'object'
      ? JSON.stringify(emergencyContact)
      : (emergencyContact || emergency_contact || null);
    const finalMedicalHistory = Array.isArray(conditions)
      ? conditions.join(', ')
      : (medicalHistory || medical_history || null);
    const finalAllergies = Array.isArray(allergies)
      ? allergies.join(', ')
      : (allergies || null);
    const finalPhone = contactNumber || phone || null;

    // Check for existing referenceId
    const existing = await db.get('SELECT id FROM patients WHERE reference_id = ?', [finalRefId]);
    if (existing) {
      const err = new Error(`Patient with reference ID "${finalRefId}" already exists.`);
      err.statusCode = 409;
      err.code = 'PATIENT_ALREADY_EXISTS';
      throw err;
    }

    // Auto-provision patient portal user account if email or patient record is created
    let finalUserId = userId || null;
    try {
      const bcrypt = require('bcryptjs');
      const patientLoginEmail = finalEmail || `${finalRefId.toLowerCase()}@carewave.patient`;
      const existingUser = await db.get('SELECT id FROM users WHERE LOWER(email) = LOWER(?) OR LOWER(username) = LOWER(?)', [patientLoginEmail, finalRefId]);
      if (existingUser) {
        finalUserId = existingUser.id;
      } else {
        const userUuid = `U-${uuidv4()}`;
        // Patient password defaults to their email or their reference ID
        const initialPassword = finalEmail || finalRefId;
        const passwordHash = await bcrypt.hash(initialPassword, 10);
        await db.run(
          `INSERT INTO users (id, username, email, password_hash, name, role, status, contact_number, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, 'patient', 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [userUuid, finalRefId, patientLoginEmail, passwordHash, name || 'Patient', finalPhone]
        );
        finalUserId = userUuid;
      }
    } catch (userErr) {
      console.warn('Could not auto-provision user account for patient:', userErr.message);
    }

    await db.run(
      `INSERT INTO patients (
        id, reference_id, user_id, name, email, age, date_of_birth, sex, village, contact_number,
        consent, blood_group, emergency_contact, medical_history, allergies, created_by,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        id,
        finalRefId,
        finalUserId,
        name || null,
        finalEmail,
        age !== undefined ? parseInt(age, 10) : null,
        dateOfBirth || null,
        sex || null,
        village,
        finalPhone,
        consent ? 1 : 0,
        finalBloodGroup,
        finalEmergencyContact,
        finalMedicalHistory,
        finalAllergies,
        createdBy || null,
      ]
    );

    return this.getPatientById(id);
  }

  /**
   * List or search patients
   */
  async getPatients({ search, village, limit = 50, offset = 0 } = {}) {
    let sql = `SELECT id, reference_id as "referenceId", user_id as "userId", name, email, age, date_of_birth as "dateOfBirth",
                      sex, village, contact_number as "contactNumber", consent,
                      blood_group as "bloodGroup", emergency_contact as "emergencyContact",
                      medical_history as "medicalHistory", allergies,
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
    return patients.map(p => {
      let conditions = [];
      if (p.medicalHistory) {
        conditions = p.medicalHistory.split(',').map(s => s.trim()).filter(Boolean);
      }
      let parsedAllergies = [];
      if (p.allergies) {
        parsedAllergies = p.allergies.split(',').map(s => s.trim()).filter(Boolean);
      }
      return {
        ...p,
        id: p.referenceId || p.id,
        internalId: p.id,
        phone: p.contactNumber,
        bloodGroup: p.bloodGroup || 'Unknown',
        conditions,
        allergies: parsedAllergies,
        consent: Boolean(p.consent),
      };
    });
  }

  /**
   * Get patient details by internal ID or reference ID, including consultation history
   */
  async getPatientById(idOrRef) {
    const patient = await db.get(
      `SELECT id, reference_id as "referenceId", user_id as "userId", name, email, age, date_of_birth as "dateOfBirth",
              sex, village, contact_number as "contactNumber", consent,
              blood_group as "bloodGroup", emergency_contact as "emergencyContact",
              medical_history as "medicalHistory", allergies,
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

    let conditions = [];
    if (patient.medicalHistory) {
      conditions = patient.medicalHistory.split(',').map(s => s.trim()).filter(Boolean);
    }
    let parsedAllergies = [];
    if (patient.allergies) {
      parsedAllergies = patient.allergies.split(',').map(s => s.trim()).filter(Boolean);
    }

    return {
      ...patient,
      id: patient.referenceId || patient.id,
      internalId: patient.id,
      phone: patient.contactNumber,
      bloodGroup: patient.bloodGroup || 'Unknown',
      conditions,
      allergies: parsedAllergies,
      consent: Boolean(patient.consent),
      consultations: consultations || [],
    };
  }
}

module.exports = new PatientService();
