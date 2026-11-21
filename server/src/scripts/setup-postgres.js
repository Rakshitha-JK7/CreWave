/**
 * PostgreSQL Database Provisioning & Seed Script for CareWave
 * Usage: node src/scripts/setup-postgres.js
 */
const { Client, Pool } = require('pg');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

const pgConfig = {
  host: process.env.PGHOST || '127.0.0.1',
  port: parseInt(process.env.PGPORT, 10) || 5432,
  user: process.env.PGUSER || 'postgres',
  password: process.env.PGPASSWORD || 'root',
};

async function setupPostgres() {
  console.log('\n================================================================');
  console.log('         CAREWAVE POSTGRESQL PROVISIONING & MIGRATION');
  console.log('================================================================');
  console.log(` Target Host: ${pgConfig.host}:${pgConfig.port}`);
  console.log(` Superuser:   ${pgConfig.user}`);

  // 1. Connect to default 'postgres' database to create 'carewave' if not exists
  const rootClient = new Client({
    ...pgConfig,
    database: 'postgres',
  });

  try {
    await rootClient.connect();
    console.log('[1/4] Connected to PostgreSQL server.');

    const checkDb = await rootClient.query(
      "SELECT 1 FROM pg_database WHERE datname = 'carewave'"
    );

    if (checkDb.rows.length === 0) {
      console.log('      Creating database "carewave"...');
      await rootClient.query('CREATE DATABASE carewave');
      console.log('      Database "carewave" created successfully.');
    } else {
      console.log('      Database "carewave" already exists.');
    }
  } catch (err) {
    console.error('Failed during database check/creation:', err.message);
    throw err;
  } finally {
    await rootClient.end();
  }

  // 2. Connect to 'carewave' database and apply schema
  const carewavePool = new Pool({
    ...pgConfig,
    database: 'carewave',
  });

  try {
    console.log('[2/4] Connecting to "carewave" database and applying schema...');
    const schemaPath = path.resolve(__dirname, '../../migrations/001_initial_schema.sql');
    const schemaSql = fs.readFileSync(schemaPath, 'utf8');
    await carewavePool.query(schemaSql);
    console.log('      Initial schema and indexes applied successfully.');

    // 3. Seed users and demo data
    console.log('[3/4] Seeding initial roles and demo data...');
    const salt = await bcrypt.genSalt(10);
    const hwPassword = await bcrypt.hash('health123', salt);
    const docPassword = await bcrypt.hash('doctor123', salt);
    const adminPassword = await bcrypt.hash('admin123', salt);
    const defaultPassword = await bcrypt.hash('password123', salt);

    const users = [
      {
        id: 'HW-PRIYA-01',
        username: 'hw_priya',
        password_hash: hwPassword,
        name: 'Priya Sharma (Community Health Worker)',
        role: 'health_worker',
        clinic_id: 'CLINIC-RURAL-01',
        contact_number: '+91 98765 43210',
      },
      {
        id: 'DOC-ANJALI-01',
        username: 'dr_anjali',
        password_hash: docPassword,
        name: 'Dr. Anjali Mehta (Consulting Physician)',
        role: 'doctor',
        clinic_id: null,
        contact_number: '+91 98765 00001',
      },
      {
        id: 'ADMIN-01',
        username: 'admin',
        password_hash: adminPassword,
        name: 'System Administrator',
        role: 'admin',
        clinic_id: null,
        contact_number: '+91 98765 99999',
      },
      {
        id: 'HW-DEMO-01',
        username: 'worker1',
        password_hash: defaultPassword,
        name: 'Asha Devi (Community Health Worker)',
        role: 'health_worker',
        clinic_id: 'CLINIC-RURAL-01',
        contact_number: '+91 98765 43210',
      },
      {
        id: 'DOC-DEMO-01',
        username: 'doctor1',
        password_hash: defaultPassword,
        name: 'Dr. Ramesh Sharma (Tele-Specialist)',
        role: 'doctor',
        clinic_id: null,
        contact_number: '+91 91234 56789',
      },
      {
        id: 'PAT-USER-1024',
        username: 'patient1',
        password_hash: defaultPassword,
        name: 'Rajesh Kumar',
        role: 'patient',
        clinic_id: 'CLINIC-RURAL-01',
        contact_number: '+91 99887 76655',
      },
    ];

    for (const u of users) {
      await carewavePool.query(
        `INSERT INTO users (id, username, password_hash, name, role, clinic_id, contact_number, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
         ON CONFLICT (id) DO NOTHING`,
        [u.id, u.username, u.password_hash, u.name, u.role, u.clinic_id, u.contact_number]
      );
    }
    console.log(`      Seeded ${users.length} initial accounts (hw_priya, dr_anjali, admin, worker1, doctor1, patient1).`);

    // Seed Demo Patient
    await carewavePool.query(
      `INSERT INTO patients (id, reference_id, name, age, date_of_birth, sex, village, contact_number, consent, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
       ON CONFLICT (id) DO NOTHING`,
      [
        'PAT-DEMO-1024',
        'PAT-DEMO-1024',
        'Sunita Devi',
        42,
        '1984-06-15',
        'female',
        'Rampur',
        '+91 98765 11223',
        true,
        'HW-PRIYA-01',
      ]
    );
    console.log('      Seeded demo patient: Sunita Devi (PAT-DEMO-1024, Rampur).');

    // Seed Demo Consultation
    const vitals = JSON.stringify({
      temperature: 38.6,
      heartRate: 104,
      bloodPressureSystolic: 140,
      bloodPressureDiastolic: 90,
      oxygenSaturation: 94,
      respiratoryRate: 22,
      bloodGlucose: null,
      weight: 58,
    });

    await carewavePool.query(
      `INSERT INTO consultations (
        id, idempotency_key, patient_id, health_worker_id, clinic_id,
        consultation_date, priority, status, sync_status,
        main_complaint, symptoms, symptom_onset, symptom_duration, severity_progression,
        medical_history, medications, allergies, health_worker_observations, health_worker_notes,
        measurements_unavailable, urgency_category, immediate_action, consent_status,
        vitals, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5,
        CURRENT_TIMESTAMP, $6, $7, $8,
        $9, $10, $11, $12, $13,
        $14, $15, $16, $17, $18,
        $19, $20, $21, $22,
        $23, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) ON CONFLICT (id) DO NOTHING`,
      [
        'CW-DEMO-001',
        'IDEMP-DEMO-001-SEED',
        'PAT-DEMO-1024',
        'HW-PRIYA-01',
        'CLINIC-RURAL-01',
        'urgent',
        'available_to_doctor',
        'delivered',
        'High fever with persistent cough and chest tightness',
        'Fever, productive cough with yellow sputum, shortness of breath on exertion, fatigue',
        '3 days ago',
        '3 days',
        'Worsening over last 24 hours',
        'Mild hypertension, no known diabetes',
        'Amlodipine 5mg OD',
        'No known drug allergies',
        'Patient appears visibly fatigued and tachypneic. Auscultation reveals bilateral crepitations in lower lung zones.',
        'Immediate teleconsultation initiated due to worsening respiratory symptoms and low SpO2.',
        'Blood glucose meter unavailable at sub-center',
        'urgent',
        'Administered Paracetamol 650mg, instructed rest and hydration, kept on room-air SpO2 monitoring',
        true,
        vitals,
      ]
    );
    console.log('      Seeded demo consultation: CW-DEMO-001 (urgent priority).');

    // 4. Verify counts
    console.log('[4/4] Verifying table counts in PostgreSQL...');
    const userCount = await carewavePool.query('SELECT COUNT(*) FROM users');
    const patientCount = await carewavePool.query('SELECT COUNT(*) FROM patients');
    const consultCount = await carewavePool.query('SELECT COUNT(*) FROM consultations');

    console.log(`      Users:         ${userCount.rows[0].count}`);
    console.log(`      Patients:      ${patientCount.rows[0].count}`);
    console.log(`      Consultations: ${consultCount.rows[0].count}`);

    console.log('================================================================');
    console.log(' CAREWAVE POSTGRESQL SETUP COMPLETED SUCCESSFULLY! ');
    console.log('================================================================\n');
  } catch (err) {
    console.error('PostgreSQL setup error:', err);
    throw err;
  } finally {
    await carewavePool.end();
  }
}

if (require.main === module) {
  setupPostgres()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}

module.exports = setupPostgres;
