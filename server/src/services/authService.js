const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const { generateToken } = require('../middleware/auth');

class AuthService {
  /**
   * Register a new user with role-based validation and approval rules
   */
  async register(payload) {
    const {
      username,
      email,
      password,
      name,
      role,
      clinicId,
      contactNumber,
      phone,
      specialization,
      licenseNumber,
      age,
      dateOfBirth,
      sex,
      village,
    } = payload;

    const finalUsername = (username || email || '').trim();
    if (!name || !password || !role || !finalUsername) {
      const err = new Error('Username, password, name, and role are required.');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    // Email validation if email provided
    const finalEmail = (email || (finalUsername.includes('@') ? finalUsername : null));
    if (finalEmail) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(finalEmail)) {
        const err = new Error('Invalid email format.');
        err.statusCode = 400;
        err.code = 'INVALID_EMAIL';
        throw err;
      }
    }

    // Valid role check
    const validRoles = ['health_worker', 'doctor', 'patient'];
    if (role === 'admin') {
      const err = new Error('Public registration for administrator role is forbidden.');
      err.statusCode = 403;
      err.code = 'ADMIN_REGISTRATION_FORBIDDEN';
      throw err;
    }

    if (!validRoles.includes(role)) {
      const err = new Error(`Invalid role: "${role}". Allowed registration roles: ${validRoles.join(', ')}.`);
      err.statusCode = 400;
      err.code = 'INVALID_ROLE';
      throw err;
    }

    // Password requirements (min 6 characters)
    if (password.length < 6) {
      const err = new Error('Password must be at least 6 characters long.');
      err.statusCode = 400;
      err.code = 'WEAK_PASSWORD';
      throw err;
    }

    // Duplicate check on username
    const existingUser = await db.get('SELECT id FROM users WHERE username = ?', [finalUsername]);
    if (existingUser) {
      const err = new Error('Username already exists.');
      err.statusCode = 409;
      err.code = 'USER_ALREADY_EXISTS';
      throw err;
    }

    // Duplicate check on email if provided
    if (finalEmail) {
      const existingEmail = await db.get('SELECT id FROM users WHERE email = ?', [finalEmail]);
      if (existingEmail) {
        const err = new Error('Email address already registered.');
        err.statusCode = 409;
        err.code = 'EMAIL_ALREADY_EXISTS';
        throw err;
      }
    }

    // Approval workflow: Privileged accounts (doctor, health_worker) require approval
    // Patient accounts are active immediately
    const status = role === 'patient' ? 'active' : 'pending';

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const userId = `USR-${uuidv4().substring(0, 8).toUpperCase()}`;
    const finalContact = contactNumber || phone || null;

    // Use transaction if available
    let linkedPatient = null;
    await db.transaction(async (tx) => {
      await tx.run(
        `INSERT INTO users (
          id, username, email, password_hash, name, role, status,
          clinic_id, contact_number, specialization, license_number,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [
          userId,
          finalUsername,
          finalEmail,
          passwordHash,
          name,
          role,
          status,
          clinicId || null,
          finalContact,
          specialization || null,
          licenseNumber || null,
        ]
      );

      // If patient, create linked record in patients table
      if (role === 'patient') {
        const patientRefId = `PAT-${uuidv4().substring(0, 8).toUpperCase()}`;
        const patientId = `P-${uuidv4().substring(0, 8).toUpperCase()}`;
        const patientVillage = village || 'Rampur';
        const patientAge = age ? parseInt(age, 10) : 30;

        await tx.run(
          `INSERT INTO patients (
            id, reference_id, user_id, name, age, date_of_birth, sex, village, contact_number, consent, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [
            patientId,
            patientRefId,
            userId,
            name,
            patientAge,
            dateOfBirth || null,
            sex || 'Other',
            patientVillage,
            finalContact,
          ]
        );

        linkedPatient = {
          id: patientId,
          referenceId: patientRefId,
          village: patientVillage,
          age: patientAge,
          sex: sex || 'Other',
        };
      }
    });

    const userPayload = {
      id: userId,
      username: finalUsername,
      email: finalEmail,
      name,
      role,
      status,
      clinicId: clinicId || null,
      contactNumber: finalContact,
      specialization: specialization || null,
      licenseNumber: licenseNumber || null,
      patient: linkedPatient,
      patientId: linkedPatient?.id || null,
      referenceId: linkedPatient?.referenceId || null,
      village: linkedPatient?.village || null,
    };

    if (status === 'pending') {
      return {
        user: userPayload,
        token: null,
        status: 'pending',
        message: 'Account registered successfully. Your account is pending administrator approval before you can sign in.',
      };
    }

    const token = generateToken(userPayload);
    return {
      user: userPayload,
      token,
      status: 'active',
      message: 'Registration successful.',
    };
  }

  /**
   * Login with email or username and verify approval status
   */
  async login({ username, email, password }) {
    const identifier = (username || email || '').trim();
    if (!identifier || !password) {
      const err = new Error('Username/email and password are required.');
      err.statusCode = 400;
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    let user = await db.get(
      `SELECT id, username, email, password_hash, name, role, status, clinic_id,
              contact_number, specialization, license_number, created_at
       FROM users
       WHERE LOWER(username) = LOWER(?) OR LOWER(email) = LOWER(?)`,
      [identifier, identifier]
    );

    let isMatch = false;

    if (user) {
      // 1. Standard bcrypt password comparison
      isMatch = await bcrypt.compare(password, user.password_hash).catch(() => false);

      // 2. If password didn't match via bcrypt, check if user is a patient whose password is their email or username/referenceId
      if (!isMatch && user.role === 'patient') {
        const cleanPass = password.trim().toLowerCase();
        if (
          (user.email && user.email.toLowerCase() === cleanPass) ||
          (user.username && user.username.toLowerCase() === cleanPass)
        ) {
          isMatch = true;
        }
      }
    }

    // 3. If user not found in users table or password didn't match, check patients table
    if (!user || !isMatch) {
      const patientMatch = await db.get(
        `SELECT id, reference_id, user_id, name, email, village, contact_number, blood_group
         FROM patients
         WHERE LOWER(reference_id) = LOWER(?) OR LOWER(email) = LOWER(?) OR LOWER(id) = LOWER(?)`,
        [identifier, identifier, identifier]
      );

      if (patientMatch) {
        const cleanPass = password.trim().toLowerCase();
        const pEmail = (patientMatch.email || '').trim().toLowerCase();
        const pRef = (patientMatch.reference_id || '').trim().toLowerCase();

        // If password matches either the patient's registered email OR reference ID
        if ((pEmail && cleanPass === pEmail) || (pRef && cleanPass === pRef)) {
          isMatch = true;
          if (patientMatch.user_id) {
            user = await db.get('SELECT * FROM users WHERE id = ?', [patientMatch.user_id]);
          }
          if (!user) {
            const userUuid = patientMatch.user_id || `U-${uuidv4()}`;
            const pwdHash = await bcrypt.hash(pEmail || pRef, 10);
            await db.run(
              `INSERT INTO users (id, username, email, password_hash, name, role, status, contact_number, created_at, updated_at)
               VALUES (?, ?, ?, ?, ?, 'patient', 'active', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
              [userUuid, patientMatch.reference_id, patientMatch.email || `${pRef}@carewave.patient`, pwdHash, patientMatch.name || 'Patient', patientMatch.contact_number]
            );
            user = {
              id: userUuid,
              username: patientMatch.reference_id,
              email: patientMatch.email || `${pRef}@carewave.patient`,
              name: patientMatch.name || 'Patient',
              role: 'patient',
              status: 'active',
              contact_number: patientMatch.contact_number,
            };
            await db.run('UPDATE patients SET user_id = ? WHERE id = ?', [userUuid, patientMatch.id]);
          }
        }
      }
    }

    if (!user || !isMatch) {
      const err = new Error('Invalid credentials. Patients may sign in using their Patient ID and registered Email.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // Check account status and approval
    const userStatus = user.status || 'active';
    if (userStatus === 'pending') {
      const err = new Error('Your account is pending administrator approval. Please contact your clinic administrator.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_PENDING_APPROVAL';
      err.status = 'pending';
      throw err;
    }

    if (userStatus === 'rejected') {
      const err = new Error('Your account registration was not approved.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_REJECTED';
      throw err;
    }

    if (userStatus === 'suspended') {
      const err = new Error('Your account has been suspended.');
      err.statusCode = 403;
      err.code = 'ACCOUNT_SUSPENDED';
      throw err;
    }

    // If patient, find linked patient record
    let linkedPatient = null;
    if (user.role === 'patient') {
      linkedPatient = await db.get(
        'SELECT id, reference_id as "referenceId", village, age, sex, blood_group as "bloodGroup" FROM patients WHERE user_id = ? OR id = ? OR reference_id = ? OR reference_id = ?',
        [user.id, user.id, user.id, user.username]
      );
    }

    const userPayload = {
      id: user.id,
      username: user.username,
      email: user.email,
      name: user.name,
      role: user.role,
      status: userStatus,
      clinicId: user.clinic_id,
      contactNumber: user.contact_number,
      specialization: user.specialization,
      licenseNumber: user.license_number,
      patientId: linkedPatient?.id || null,
      referenceId: linkedPatient?.referenceId || null,
      village: linkedPatient?.village || null,
      bloodGroup: linkedPatient?.bloodGroup || null,
    };

    const token = generateToken(userPayload);
    return { user: userPayload, token };
  }

  async getUserById(id) {
    const user = await db.get(
      `SELECT id, username, email, name, role, status, clinic_id as "clinicId",
              contact_number as "contactNumber", specialization, license_number as "licenseNumber",
              created_at as "createdAt"
       FROM users WHERE id = ?`,
      [id]
    );

    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      err.code = 'USER_NOT_FOUND';
      throw err;
    }

    let linkedPatient = null;
    if (user.role === 'patient') {
      linkedPatient = await db.get(
        'SELECT id, reference_id as "referenceId", village, age, sex, blood_group as "bloodGroup" FROM patients WHERE user_id = ? OR id = ? OR reference_id = ? OR reference_id = ?',
        [user.id, user.id, user.id, user.username]
      );
    }

    return {
      ...user,
      patientId: linkedPatient?.id || null,
      referenceId: linkedPatient?.referenceId || null,
      village: linkedPatient?.village || null,
      bloodGroup: linkedPatient?.bloodGroup || null,
    };
  }

  // --- Admin Approval Methods ---

  async getPendingUsers() {
    const rows = await db.all(
      `SELECT id, username, email, name, role, status, clinic_id as "clinicId",
              specialization, license_number as "licenseNumber", contact_number as "contactNumber",
              created_at as "createdAt"
       FROM users
       WHERE status = 'pending'
       ORDER BY created_at ASC`
    );
    return rows;
  }

  async getAllUsers() {
    const rows = await db.all(
      `SELECT id, username, email, name, role, status, clinic_id as "clinicId",
              specialization, license_number as "licenseNumber", contact_number as "contactNumber",
              created_at as "createdAt"
       FROM users
       ORDER BY created_at DESC`
    );
    return rows;
  }

  async approveUser(userId) {
    const user = await this.getUserById(userId);
    await db.run(
      `UPDATE users SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId]
    );
    return { ...user, status: 'active' };
  }

  async rejectUser(userId) {
    const user = await this.getUserById(userId);
    await db.run(
      `UPDATE users SET status = 'rejected', updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
      [userId]
    );
    return { ...user, status: 'rejected' };
  }
}

module.exports = new AuthService();
