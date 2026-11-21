const bcrypt = require('bcryptjs');
const db = require('../models/db');

async function seed() {
  console.log('[CareWave Seed] Initializing database...');
  await db.init();

  console.log('[CareWave Seed] Seeding demo users...');
  const salt = await bcrypt.genSalt(10);
  const commonPasswordHash = await bcrypt.hash('password123', salt);

  const users = [
    {
      id: 'HW-DEMO-01',
      username: 'worker1',
      passwordHash: commonPasswordHash,
      name: 'Asha Devi (Community Health Worker)',
      role: 'health_worker',
      clinicId: 'CLINIC-RURAL-01',
      contactNumber: '+91 98765 43210',
    },
    {
      id: 'DOC-DEMO-01',
      username: 'doctor1',
      passwordHash: commonPasswordHash,
      name: 'Dr. Ramesh Sharma (Tele-Specialist)',
      role: 'doctor',
      clinicId: null,
      contactNumber: '+91 91234 56789',
    },
    {
      id: 'PAT-USER-1024',
      username: 'patient1',
      passwordHash: commonPasswordHash,
      name: 'Rajesh Kumar',
      role: 'patient',
      clinicId: 'CLINIC-RURAL-01',
      contactNumber: '+91 99887 76655',
    },
  ];

  for (const u of users) {
    const existing = await db.get('SELECT id FROM users WHERE id = ? OR username = ?', [u.id, u.username]);
    if (!existing) {
      await db.run(
        `INSERT INTO users (id, username, password_hash, name, role, clinic_id, contact_number, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
        [u.id, u.username, u.passwordHash, u.name, u.role, u.clinicId, u.contactNumber]
      );
      console.log(`  + Created user: ${u.username} (${u.role})`);
    }
  }

  console.log('[CareWave Seed] Seeding demo patient (PAT-DEMO-1024)...');
  const patientId = 'PAT-DEMO-1024';
  const existingPatient = await db.get('SELECT id FROM patients WHERE reference_id = ?', [patientId]);

  let internalPatientId = patientId;
  if (!existingPatient) {
    internalPatientId = 'P-DEMO-1024';
    await db.run(
      `INSERT INTO patients (
        id, reference_id, name, age, date_of_birth, sex, village, contact_number, consent, created_by, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        internalPatientId,
        patientId,
        'Rajesh Kumar',
        45,
        '1981-05-15',
        'Male',
        'Sample Village, Block B',
        '+91 99887 76655',
        'HW-DEMO-01',
      ]
    );
    console.log('  + Created patient: Rajesh Kumar (PAT-DEMO-1024)');
  } else {
    internalPatientId = existingPatient.id;
  }

  console.log('[CareWave Seed] Seeding demo consultation (CW-DEMO-001)...');
  const consultationId = 'CW-DEMO-001';
  const existingConsultation = await db.get('SELECT id FROM consultations WHERE id = ?', [consultationId]);

  if (!existingConsultation) {
    const sampleVitals = {
      temperature: 38.2,
      temperatureUnit: '°C',
      heartRate: 96,
      heartRateUnit: 'bpm',
      bloodPressure: '120/80',
      bloodPressureUnit: 'mmHg',
      spo2: 94,
      spo2Unit: '%',
      respiratoryRate: 20,
      respiratoryRateUnit: 'breaths/min',
      bloodGlucose: null,
      weight: 64,
      weightUnit: 'kg',
      measuredAt: new Date().toISOString(),
    };

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
        CURRENT_TIMESTAMP, 'urgent', 'available_to_doctor', 'delivered',
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, 1,
        ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      )`,
      [
        consultationId,
        'IDEMP-CW-DEMO-001-KEY',
        internalPatientId,
        'HW-DEMO-01',
        'CLINIC-RURAL-01',
        'Fever and cough with mild shortness of breath',
        'Fever for 3 days; cough for 2 days. Patient reports difficulty breathing since morning.',
        '3 days ago',
        'Fever: 3 days, Cough: 2 days, Dyspnea: 6 hours',
        'Moderate, worsening since morning',
        'No prior chronic respiratory illness reported',
        'Paracetamol 500mg taken yesterday evening',
        'No known medicine allergies',
        'Mild tachypnea observed. Chest sounds clear on initial auscultation.',
        'Synthetic example record for software testing only',
        'Blood glucose and ECG device unavailable at remote post',
        'Moderate / Urgent clinic protocol referral candidate',
        'Kept in well-ventilated room, advised hydration',
        JSON.stringify(sampleVitals),
      ]
    );
    console.log('  + Created demo consultation: CW-DEMO-001');

    // Add demo attachments metadata
    await db.run(
      `INSERT INTO attachments (
        id, consultation_id, component_id, type, priority, file_name, file_size,
        mime_type, checksum, checksum_algorithm, upload_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        'ATT-DEMO-ECG-01',
        consultationId,
        'ecg_recording',
        'ecg',
        2,
        'sample_ecg_lead2.pdf',
        245760, // 240 KB
        'application/pdf',
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'sha256',
      ]
    );

    await db.run(
      `INSERT INTO attachments (
        id, consultation_id, component_id, type, priority, file_name, file_size,
        mime_type, checksum, checksum_algorithm, upload_status, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [
        'ATT-DEMO-CHEST-01',
        consultationId,
        'clinical_image',
        'clinical_image',
        2,
        'throat_examination.jpg',
        524288, // 512 KB
        'image/jpeg',
        'ca978112ca1bbdcaf064278e4a1f2c3a6abf5b3a864f7b60098f98c8c73b320d',
        'sha256',
      ]
    );

    console.log('  + Created sample attachment placeholders for CW-DEMO-001');
  }

  console.log('[CareWave Seed] Seeding complete! Demo data is ready.');
}

if (require.main === module) {
  seed().then(() => process.exit(0)).catch(err => {
    console.error('[CareWave Seed] Error:', err);
    process.exit(1);
  });
}

module.exports = seed;
