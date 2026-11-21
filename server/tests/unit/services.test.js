const { assert, assertRejects } = require('../test-helper');
const authService = require('../../src/services/authService');
const patientService = require('../../src/services/patientService');
const consultationService = require('../../src/services/consultationService');
const uploadService = require('../../src/services/uploadService');
const responseService = require('../../src/services/responseService');
const db = require('../../src/models/db');

async function runUnitTests() {
  console.log('\n--- SUITE 1: UNIT & SERVICE LAYER TESTS ---');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      process.stdout.write(`  [UNIT ${total}] ${name} ... `);
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err) {
      console.log('FAILED');
      console.error(`    Error: ${err.message}`);
      throw err;
    }
  }

  await db.init();

  // AUTH SERVICE UNIT TESTS
  await test('AuthService: Register rejects missing fields', async () => {
    await assertRejects(
      authService.register({ username: 'missing_fields' }),
      'Username, password, name, and role are required',
      'Should reject missing fields'
    );
  });

  await test('AuthService: Register rejects invalid role', async () => {
    await assertRejects(
      authService.register({ username: 'inv_role', password: '123', name: 'Test', role: 'superhero' }),
      'Invalid role',
      'Should reject invalid role'
    );
  });

  await test('AuthService: Register rejects duplicate username', async () => {
    const username = `dup_${Date.now()}`;
    await authService.register({ username, password: 'password123', name: 'User 1', role: 'health_worker' });
    await assertRejects(
      authService.register({ username, password: 'password123', name: 'User 2', role: 'doctor' }),
      'Username already exists',
      'Should reject duplicate username'
    );
  });

  await test('AuthService: Login rejects non-existent username', async () => {
    await assertRejects(
      authService.login({ username: 'non_existent_user_99999', password: 'password123' }),
      'Invalid credentials',
      'Should reject non-existent user'
    );
  });

  await test('AuthService: Login rejects incorrect password', async () => {
    const username = `wrongpw_${Date.now()}`;
    await authService.register({ username, password: 'correct_password', name: 'Test User', role: 'doctor' });
    await assertRejects(
      authService.login({ username, password: 'wrong_password' }),
      'Invalid credentials',
      'Should reject wrong password'
    );
  });

  // PATIENT SERVICE UNIT TESTS
  await test('PatientService: Rejects patient creation without village', async () => {
    await assertRejects(
      patientService.createPatient({ name: 'No Village', age: 25 }),
      'Village/location is required',
      'Should require village'
    );
  });

  await test('PatientService: Rejects patient creation without age or DOB', async () => {
    await assertRejects(
      patientService.createPatient({ name: 'No Age', village: 'Village A' }),
      'Age or date of birth is required',
      'Should require age or DOB'
    );
  });

  await test('PatientService: Rejects duplicate patient reference ID', async () => {
    const refId = `PAT-UNIT-DUP-${Date.now()}`;
    await patientService.createPatient({ referenceId: refId, name: 'P1', age: 30, village: 'V1' });
    await assertRejects(
      patientService.createPatient({ referenceId: refId, name: 'P2', age: 35, village: 'V2' }),
      'already exists',
      'Should reject duplicate referenceId'
    );
  });

  await test('PatientService: Throws 404 on non-existent patient reference', async () => {
    await assertRejects(
      patientService.getPatientById('NON_EXISTENT_REF_999'),
      'Patient not found',
      'Should 404 for missing patient'
    );
  });

  // CONSULTATION SERVICE UNIT TESTS
  await test('ConsultationService: Rejects creation without idempotencyKey', async () => {
    await assertRejects(
      consultationService.createConsultation({ patientId: 'PAT-DEMO-1024' }),
      'idempotencyKey is required',
      'Should require idempotencyKey'
    );
  });

  await test('ConsultationService: Rejects consultation for non-existent patient', async () => {
    await assertRejects(
      consultationService.createConsultation({
        idempotencyKey: `IDEMP-NONE-${Date.now()}`,
        patientId: 'NON-EXISTENT-PAT-000',
      }),
      'Patient not found',
      'Should reject missing patient'
    );
  });

  await test('ConsultationService: Normalizes and preserves vitals object structure', async () => {
    const ref = `PAT-VITALS-${Date.now()}`;
    await patientService.createPatient({ referenceId: ref, name: 'Vitals Test', age: 50, village: 'Village V' });
    const idemp = `IDEMP-VIT-${Date.now()}`;
    const result = await consultationService.createConsultation({
      idempotencyKey: idemp,
      patientId: ref,
      vitals: {
        temperature: 38.5,
        heartRate: 110,
        bloodPressure: '140/90',
        spo2: 92,
        bloodGlucose: null,
      },
    });

    assert(result.consultation.vitals.temperature === 38.5, 'Temperature preserved');
    assert(result.consultation.vitals.spo2 === 92, 'SpO2 preserved');
    assert(result.consultation.vitals.bloodGlucose === null, 'null bloodGlucose preserved without coercion');
  });

  // UPLOAD SERVICE UNIT TESTS
  await test('UploadService: Init upload rejects missing consultationId', async () => {
    await assertRejects(
      uploadService.initUpload({ fileName: 'file.dat', fileSize: 100 }),
      'consultationId is required',
      'Should require consultationId'
    );
  });

  await test('UploadService: Chunk save rejects invalid negative chunkIndex', async () => {
    const sess = await uploadService.initUpload({
      consultationId: 'CW-DEMO-001',
      fileName: 'test.dat',
      fileSize: 1000,
      chunkSize: 500,
      totalChunks: 2,
    });

    await assertRejects(
      uploadService.saveChunk(sess.uploadId, -1, Buffer.from('hello')),
      'Invalid chunkIndex',
      'Should reject negative chunkIndex'
    );
  });

  await test('UploadService: Chunk save rejects chunkIndex >= totalChunks', async () => {
    const sess = await uploadService.initUpload({
      consultationId: 'CW-DEMO-001',
      fileName: 'test.dat',
      fileSize: 1000,
      chunkSize: 500,
      totalChunks: 2,
    });

    await assertRejects(
      uploadService.saveChunk(sess.uploadId, 2, Buffer.from('hello')),
      'Invalid chunkIndex',
      'Should reject chunkIndex >= totalChunks'
    );
  });

  await test('UploadService: Chunk save detects per-chunk checksum mismatch', async () => {
    const sess = await uploadService.initUpload({
      consultationId: 'CW-DEMO-001',
      fileName: 'checksum_test.dat',
      fileSize: 1000,
      chunkSize: 1000,
      totalChunks: 1,
    });

    await assertRejects(
      uploadService.saveChunk(sess.uploadId, 0, Buffer.from('real content'), 'fake_corrupted_checksum_12345'),
      'Chunk checksum mismatch',
      'Should reject corrupted chunk checksum'
    );
  });

  // RESPONSE SERVICE UNIT TESTS
  await test('ResponseService: Rejects response without assessment', async () => {
    await assertRejects(
      responseService.createResponse('CW-DEMO-001', {}),
      'Doctor assessment is required',
      'Should require assessment'
    );
  });

  await test('ResponseService: Rejects response for non-existent consultation', async () => {
    await assertRejects(
      responseService.createResponse('CW-NON-EXISTENT-999', { assessment: 'Good' }),
      'Consultation not found',
      'Should reject missing consultation'
    );
  });

  console.log(`\n  Unit Tests Completed: ${passed}/${total} Passed.`);
  return { passed, total };
}

module.exports = runUnitTests;

if (require.main === module) {
  runUnitTests().catch(() => process.exit(1));
}
