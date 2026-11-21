const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const db = require('../models/db');
const { generateToken } = require('../middleware/auth');

class AuthService {
  async register({ username, password, name, role, clinicId, contactNumber }) {
    if (!username || !password || !name || !role) {
      const err = new Error('Username, password, name, and role are required.');
      err.statusCode = 400;
      throw err;
    }

    const validRoles = ['health_worker', 'doctor', 'patient', 'admin'];
    if (!validRoles.includes(role)) {
      const err = new Error(`Invalid role: ${role}. Valid roles are: ${validRoles.join(', ')}`);
      err.statusCode = 400;
      throw err;
    }

    const existing = await db.get('SELECT id FROM users WHERE username = ?', [username]);
    if (existing) {
      const err = new Error('Username already exists.');
      err.statusCode = 409;
      err.code = 'USER_ALREADY_EXISTS';
      throw err;
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);
    const id = `USR-${uuidv4().substring(0, 8).toUpperCase()}`;

    await db.run(
      `INSERT INTO users (id, username, password_hash, name, role, clinic_id, contact_number, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [id, username, passwordHash, name, role, clinicId || null, contactNumber || null]
    );

    const user = { id, username, name, role, clinicId, contactNumber };
    const token = generateToken(user);

    return { user, token };
  }

  async login({ username, password }) {
    if (!username || !password) {
      const err = new Error('Username and password are required.');
      err.statusCode = 400;
      throw err;
    }

    const user = await db.get(
      `SELECT id, username, password_hash, name, role, clinic_id, contact_number, created_at
       FROM users WHERE username = ?`,
      [username]
    );

    if (!user) {
      const err = new Error('Invalid credentials.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      const err = new Error('Invalid credentials.');
      err.statusCode = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    const userPayload = {
      id: user.id,
      username: user.username,
      name: user.name,
      role: user.role,
      clinicId: user.clinic_id,
      contactNumber: user.contact_number,
    };

    const token = generateToken(userPayload);
    return { user: userPayload, token };
  }

  async getUserById(id) {
    const user = await db.get(
      `SELECT id, username, name, role, clinic_id as "clinicId", contact_number as "contactNumber", created_at as "createdAt"
       FROM users WHERE id = ?`,
      [id]
    );

    if (!user) {
      const err = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    return user;
  }
}

module.exports = new AuthService();
