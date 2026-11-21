const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { request, assert } = require('./test-helper');
const seed = require('../src/scripts/seed');
const db = require('../src/models/db');

async function auditEveryApi() {
  console.log('========================================================================================');
  console.log('                 CAREWAVE EXHAUSTIVE API AUDIT & VERIFICATION MATRIX                   ');
  console.log('========================================================================================\n');

  await seed();

  let passedCount = 0;
  let failedCount = 0;
  const auditResults = [];

  async function checkApi({ category, method, endpoint, description, expectedStatus, run }) {
    const testNum = passedCount + failedCount + 1;
    process.stdout.write(`[API #${testNum.toString().padStart(2, '0')}] ${method.padEnd(6)} ${endpoint.padEnd(42)} ... `);
    try {
      const res = await run();
      assert(res.statusCode === expectedStatus, `Expected HTTP ${expectedStatus}, received ${res.statusCode}. Body: ${JSON.stringify(res.body)}`);
      console.log(`PASSED (HTTP ${res.statusCode})`);
      passedCount++;
      auditResults.push({
        num: testNum,
        category,
        method,
        endpoint,
        description,
        status: res.statusCode,
        result: 'PASSED',
      });
      return res;
    } catch (err) {
      console.log(`FAILED! (${err.message})`);
      failedCount++;
      auditResults.push({
        num: testNum,
        category,
        method,
        endpoint,
        description,
        status: 'FAIL',
        result: 'FAILED',
        error: err.message,
      });
      throw err;
    }
  }

  let doctorToken = '';
  let hwToken = '';
  const now = Date.now();
  let testPatientRef = `PAT-AUDIT-${now}`;
  let testPatientId = '';
  let testConsultationId = `CW-AUDIT-${now}`;
  let testIdempotencyKey = `IDEMP-AUDIT-${now}`;
  let testUploadId = '';
  let testResponseId = '';
  let assembledFilePath = '';

  // -------------------------------------------------------------------------
  // 1. HEALTH & DIAGNOSTIC APIS
  // -------------------------------------------------------------------------
  await checkApi({
    category: 'System',
    method: 'GET',
    endpoint: '/api/health',
    description: 'System health check and database engine report',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/health');
      assert(res.body.status === 'ok', 'Status must be ok');
      assert(res.body.dbEngine, 'dbEngine must be reported');
      return res;
    },
  });

  await checkApi({
    category: 'System',
    method: 'GET',
    endpoint: '/api/ping',
    description: 'Network latency and reachability ping for Individual 3 network monitor',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/ping');
      assert(res.body.timestamp !== undefined, 'Timestamp must be present');
      return res;
    },
  });

  // -------------------------------------------------------------------------
  // 2. AUTHENTICATION APIS (/api/auth)
  // -------------------------------------------------------------------------
  const auditUsername = `audit_user_${now}`;
  await checkApi({
    category: 'Auth',
    method: 'POST',
    endpoint: '/api/auth/register',
    description: 'Register a new health worker account',
    expectedStatus: 201,
    run: async () => {
      const res = await request('POST', '/api/auth/register', {
        body: {
          username: auditUsername,
          password: 'Password123!',
          name: 'Audit Nurse Sunita',
          role: 'health_worker',
          clinicId: 'CLINIC-RURAL-02',
          contactNumber: '+91 91122 33445',
        },
      });
      assert(res.body.data.user.username === auditUsername, 'Username must match');
      assert(res.body.data.token, 'JWT token must be issued on registration');
      return res;
    },
  });

  await checkApi({
    category: 'Auth',
    method: 'POST',
    endpoint: '/api/auth/register',
    description: 'Validation: Rejects registration with missing required fields (400)',
    expectedStatus: 400,
    run: async () => request('POST', '/api/auth/register', { body: { username: 'incomplete' } }),
  });

  await checkApi({
    category: 'Auth',
    method: 'POST',
    endpoint: '/api/auth/register',
    description: 'Validation: Rejects invalid role assignment (400)',
    expectedStatus: 400,
    run: async () => request('POST', '/api/auth/register', {
      body: { username: 'bad_role', password: '123', name: 'Name', role: 'invalid_role' },
    }),
  });

  await checkApi({
    category: 'Auth',
    method: 'POST',
    endpoint: '/api/auth/register',
    description: 'Conflict: Rejects duplicate username registration (409)',
    expectedStatus: 409,
    run: async () => request('POST', '/api/auth/register', {
      body: { username: auditUsername, password: 'Password123!', name: 'Duplicate User', role: 'doctor' },
    }),
  });

  await checkApi({
    category: 'Auth',
    method: 'POST',
    endpoint: '/api/auth/login',
    description: 'Doctor login credentials authentication and JWT issuing',
    expectedStatus: 200,
    run: async () => {
      const res = await request('POST', '/api/auth/login', {
        body: { username: 'doctor1', password: 'password123' },
      });
      assert(res.body.data.token, 'Must return JWT token');
      assert(res.body.data.user.role === 'doctor', 'Role must be doctor');
      doctorToken = res.body.data.token;
      return res;
    },
  });

  await checkApi({
    category: 'Auth',
    method: 'POST',
    endpoint: '/api/auth/login',
    description: 'Health worker login credentials authentication',
    expectedStatus: 200,
    run: async () => {
      const res = await request('POST', '/api/auth/login', {
        body: { username: 'worker1', password: 'password123' },
      });
      assert(res.body.data.user.role === 'health_worker', 'Role must be health_worker');
      hwToken = res.body.data.token;
      return res;
    },
  });

  await checkApi({
    category: 'Auth',
    method: 'POST',
    endpoint: '/api/auth/login',
    description: 'Auth Failure: Rejects incorrect password with 401',
    expectedStatus: 401,
    run: async () => request('POST', '/api/auth/login', {
      body: { username: 'doctor1', password: 'wrong_password_xyz' },
    }),
  });

  await checkApi({
    category: 'Auth',
    method: 'POST',
    endpoint: '/api/auth/login',
    description: 'Auth Failure: Rejects non-existent username with 401',
    expectedStatus: 401,
    run: async () => request('POST', '/api/auth/login', {
      body: { username: 'unknown_ghost_user_999', password: 'password123' },
    }),
  });

  await checkApi({
    category: 'Auth',
    method: 'GET',
    endpoint: '/api/auth/me',
    description: 'Inspect authenticated user profile with valid Bearer token',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/auth/me', {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      assert(res.body.data.username === 'doctor1', 'Token username must match');
      return res;
    },
  });

  await checkApi({
    category: 'Auth',
    method: 'GET',
    endpoint: '/api/auth/me',
    description: 'Security: Rejects access without token (401)',
    expectedStatus: 401,
    run: async () => request('GET', '/api/auth/me'),
  });

  await checkApi({
    category: 'Auth',
    method: 'GET',
    endpoint: '/api/auth/me',
    description: 'Security: Rejects forged or invalid JWT signature (403)',
    expectedStatus: 403,
    run: async () => request('GET', '/api/auth/me', {
      headers: { Authorization: 'Bearer invalid.token.signature' },
    }),
  });

  await checkApi({
    category: 'Auth',
    method: 'POST',
    endpoint: '/api/auth/logout',
    description: 'User logout endpoint',
    expectedStatus: 200,
    run: async () => request('POST', '/api/auth/logout'),
  });

  // -------------------------------------------------------------------------
  // 3. PATIENT APIS (/api/patients)
  // -------------------------------------------------------------------------
  await checkApi({
    category: 'Patients',
    method: 'POST',
    endpoint: '/api/patients',
    description: 'Register rural patient with complete clinical demographics',
    expectedStatus: 201,
    run: async () => {
      const res = await request('POST', '/api/patients', {
        headers: { Authorization: `Bearer ${hwToken}` },
        body: {
          referenceId: testPatientRef,
          name: 'Meena Kumari',
          age: 42,
          dateOfBirth: '1984-07-12',
          sex: 'Female',
          village: 'Shyampur North',
          contactNumber: '+91 98765 11223',
          consent: true,
        },
      });
      assert(res.body.data.referenceId === testPatientRef, 'referenceId must match');
      assert(res.body.data.id, 'Internal ID must be generated');
      testPatientId = res.body.data.id;
      return res;
    },
  });

  await checkApi({
    category: 'Patients',
    method: 'POST',
    endpoint: '/api/patients',
    description: 'Register patient with minimal required fields (age + village)',
    expectedStatus: 201,
    run: async () => {
      const res = await request('POST', '/api/patients', {
        headers: { Authorization: `Bearer ${hwToken}` },
        body: {
          referenceId: `PAT-MINIMAL-${now}`,
          age: 60,
          village: 'Bhopalpur Block 1',
        },
      });
      assert(res.body.data.village === 'Bhopalpur Block 1', 'Minimal patient created');
      return res;
    },
  });

  await checkApi({
    category: 'Patients',
    method: 'POST',
    endpoint: '/api/patients',
    description: 'Validation: Rejects patient creation without village (400)',
    expectedStatus: 400,
    run: async () => request('POST', '/api/patients', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: { name: 'No Village Patient', age: 30 },
    }),
  });

  await checkApi({
    category: 'Patients',
    method: 'POST',
    endpoint: '/api/patients',
    description: 'Validation: Rejects patient creation without age or date of birth (400)',
    expectedStatus: 400,
    run: async () => request('POST', '/api/patients', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: { name: 'No Age Patient', village: 'Some Village' },
    }),
  });

  await checkApi({
    category: 'Patients',
    method: 'POST',
    endpoint: '/api/patients',
    description: 'Conflict: Rejects duplicate patient referenceId (409)',
    expectedStatus: 409,
    run: async () => request('POST', '/api/patients', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: { referenceId: testPatientRef, name: 'Duplicate', age: 25, village: 'Village' },
    }),
  });

  await checkApi({
    category: 'Patients',
    method: 'GET',
    endpoint: '/api/patients',
    description: 'List patients with pagination limit and offset',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/patients?limit=10&offset=0');
      assert(Array.isArray(res.body.data), 'data must be array');
      assert(res.body.count > 0, 'Count must be > 0');
      return res;
    },
  });

  await checkApi({
    category: 'Patients',
    method: 'GET',
    endpoint: '/api/patients?search=Meena',
    description: 'Search patients by name / keyword',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/patients?search=Meena');
      assert(res.body.data.some(p => p.referenceId === testPatientRef), 'Must find Meena');
      return res;
    },
  });

  await checkApi({
    category: 'Patients',
    method: 'GET',
    endpoint: '/api/patients?village=Shyampur',
    description: 'Filter patients by catchment village',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/patients?village=Shyampur');
      assert(res.body.data.length >= 1, 'Must find village match');
      return res;
    },
  });

  await checkApi({
    category: 'Patients',
    method: 'GET',
    endpoint: `/api/patients/:referenceId`,
    description: 'Retrieve patient profile and consultation history by Reference ID',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', `/api/patients/${testPatientRef}`);
      assert(res.body.data.referenceId === testPatientRef, 'Reference ID must match');
      assert(Array.isArray(res.body.data.consultations), 'Consultations array attached');
      return res;
    },
  });

  await checkApi({
    category: 'Patients',
    method: 'GET',
    endpoint: `/api/patients/:internalId`,
    description: 'Retrieve patient profile by internal UUID',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', `/api/patients/${testPatientId}`);
      assert(res.body.data.id === testPatientId, 'Internal ID must match');
      return res;
    },
  });

  await checkApi({
    category: 'Patients',
    method: 'GET',
    endpoint: '/api/patients/NON_EXISTENT_ID_9999',
    description: 'Not Found: Rejects invalid patient reference with 404',
    expectedStatus: 404,
    run: async () => request('GET', '/api/patients/NON_EXISTENT_ID_9999'),
  });

  // -------------------------------------------------------------------------
  // 4. CONSULTATION APIS (/api/consultations)
  // -------------------------------------------------------------------------
  const consultationPayload = {
    consultationId: testConsultationId,
    idempotencyKey: testIdempotencyKey,
    patientId: testPatientRef,
    clinicId: 'CLINIC-RURAL-01',
    priority: 'urgent',
    urgencyCategory: 'Urgent',
    mainComplaint: 'Acute progressive dyspnea and wheezing',
    clinicalSummary: {
      mainComplaint: 'Acute progressive dyspnea and wheezing',
      symptoms: 'Wheezing, breathlessness, dry cough',
      onset: '2 days ago',
      duration: '48 hours',
      severityProgression: 'Worsening progressively at night',
      medicalHistory: 'Childhood asthma',
      medications: 'Salbutamol inhaler PRN',
      allergies: 'Dust, pollen',
      healthWorkerObservations: 'Bilateral expiratory wheezing heard on auscultation.',
    },
    vitals: {
      temperature: 37.4,
      heartRate: 108,
      bloodPressure: '135/88',
      spo2: 92,
      respiratoryRate: 26,
      bloodGlucose: null,
      weight: 56,
    },
    measurementsUnavailable: 'Blood glucose test strips expired',
    immediateAction: 'Salbutamol nebulization 2.5mg administered at clinic.',
    consentStatus: true,
    attachments: [
      {
        id: `ATT-ECG-${now}`,
        componentId: 'comp_ecg_lead2',
        type: 'ecg',
        priority: 2,
        fileName: 'ecg_trace_lead2.pdf',
        fileSize: 8192,
      },
    ],
  };

  await checkApi({
    category: 'Consultations',
    method: 'POST',
    endpoint: '/api/consultations',
    description: 'Create consultation with structured summary, vitals, and attachments',
    expectedStatus: 201,
    run: async () => {
      const res = await request('POST', '/api/consultations', {
        headers: { Authorization: `Bearer ${hwToken}` },
        body: consultationPayload,
      });
      assert(res.body.data.id === testConsultationId, 'Consultation ID must match');
      assert(res.body.data.vitals.spo2 === 92, 'SpO2 must be preserved');
      assert(res.body.isDuplicate === false, 'Must not be duplicate');
      return res;
    },
  });

  await checkApi({
    category: 'Consultations',
    method: 'POST',
    endpoint: '/api/consultations',
    description: 'Idempotency: Resending same idempotencyKey returns original record (200 OK)',
    expectedStatus: 200,
    run: async () => {
      const res = await request('POST', '/api/consultations', {
        headers: { Authorization: `Bearer ${hwToken}` },
        body: consultationPayload,
      });
      assert(res.body.isDuplicate === true, 'Must identify duplicate idempotency key');
      assert(res.body.data.id === testConsultationId, 'Must return same consultation record');
      return res;
    },
  });

  await checkApi({
    category: 'Consultations',
    method: 'POST',
    endpoint: '/api/consultations',
    description: 'Header Compatibility: Accepts Idempotency-Key header from Individual 3 SyncQueue',
    expectedStatus: 201,
    run: async () => {
      const newConsId = `CW-HDR-${now}`;
      const newIdemp = `IDEMP-HDR-${now}`;
      const res = await request('POST', '/api/consultations', {
        headers: {
          Authorization: `Bearer ${hwToken}`,
          'Idempotency-Key': newIdemp,
        },
        body: {
          consultationId: newConsId,
          patientId: testPatientRef,
          clinicalSummary: { mainComplaint: 'Idempotency header test' },
        },
      });
      assert(res.body.data.id === newConsId, 'Created using header idempotency key');
      return res;
    },
  });

  await checkApi({
    category: 'Consultations',
    method: 'POST',
    endpoint: '/api/consultations',
    description: 'Validation: Rejects consultation without idempotencyKey (400)',
    expectedStatus: 400,
    run: async () => request('POST', '/api/consultations', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: { patientId: testPatientRef, clinicalSummary: { mainComplaint: 'No key' } },
    }),
  });

  await checkApi({
    category: 'Consultations',
    method: 'POST',
    endpoint: '/api/consultations',
    description: 'Validation: Rejects consultation for non-existent patient (404)',
    expectedStatus: 404,
    run: async () => request('POST', '/api/consultations', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: {
        idempotencyKey: `IDEMP-NO-PAT-${now}`,
        patientId: 'PAT-DOES-NOT-EXIST-000',
        clinicalSummary: { mainComplaint: 'Missing patient' },
      },
    }),
  });

  await checkApi({
    category: 'Consultations',
    method: 'GET',
    endpoint: `/api/consultations/:id`,
    description: 'Get full consultation details, parsed vitals, and attachment stats',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', `/api/consultations/${testConsultationId}`);
      assert(res.body.data.patient.name === 'Meena Kumari', 'Patient name joined');
      assert(res.body.data.attachmentStats.pending >= 1, 'Pending attachments identified');
      return res;
    },
  });

  await checkApi({
    category: 'Consultations',
    method: 'GET',
    endpoint: '/api/consultations/CW-NON-EXISTENT-999',
    description: 'Not Found: Rejects invalid consultation ID with 404',
    expectedStatus: 404,
    run: async () => request('GET', '/api/consultations/CW-NON-EXISTENT-999'),
  });

  await checkApi({
    category: 'Consultations',
    method: 'PATCH',
    endpoint: `/api/consultations/:id`,
    description: 'Update consultation fields and health worker notes',
    expectedStatus: 200,
    run: async () => {
      const res = await request('PATCH', `/api/consultations/${testConsultationId}`, {
        headers: { Authorization: `Bearer ${hwToken}` },
        body: {
          immediateAction: 'Nebulization completed. Patient reports mild symptom relief.',
          healthWorkerNotes: 'Patient stable, breathing comfortably now.',
        },
      });
      assert(res.body.data.immediateAction.includes('Nebulization completed'), 'immediateAction updated');
      return res;
    },
  });

  await checkApi({
    category: 'Consultations',
    method: 'PATCH',
    endpoint: '/api/consultations/CW-NON-EXISTENT-999',
    description: 'Not Found: Rejects patch on non-existent consultation with 404',
    expectedStatus: 404,
    run: async () => request('PATCH', '/api/consultations/CW-NON-EXISTENT-999', { body: { priority: 'normal' } }),
  });

  await checkApi({
    category: 'Consultations',
    method: 'PATCH',
    endpoint: `/api/consultations/:id/review`,
    description: 'Doctor initiates case review (status -> in_review)',
    expectedStatus: 200,
    run: async () => {
      const res = await request('PATCH', `/api/consultations/${testConsultationId}/review`, {
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: { status: 'in_review', doctorName: 'Dr. Ramesh Sharma' },
      });
      assert(res.body.data.status === 'in_review', 'Status must be in_review');
      return res;
    },
  });

  await checkApi({
    category: 'Consultations',
    method: 'PATCH',
    endpoint: `/api/consultations/:id/review`,
    description: 'Validation: Rejects invalid review status transition (400)',
    expectedStatus: 400,
    run: async () => request('PATCH', `/api/consultations/${testConsultationId}/review`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: { status: 'invalid_review_state' },
    }),
  });

  await checkApi({
    category: 'Consultations',
    method: 'GET',
    endpoint: `/api/consultations/:id/sync-status`,
    description: 'Check consultation transmission groups 1, 2, 3 delivery status',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', `/api/consultations/${testConsultationId}/sync-status`);
      assert(res.body.data.transmissionGroups.group1.status === 'delivered', 'Group 1 delivered');
      assert(res.body.data.transmissionGroups.group2 !== undefined, 'Group 2 defined');
      return res;
    },
  });

  // -------------------------------------------------------------------------
  // 5. DOCTOR QUEUE APIS (/api/doctor)
  // -------------------------------------------------------------------------
  await checkApi({
    category: 'Doctor',
    method: 'GET',
    endpoint: '/api/doctor/consultations',
    description: 'Doctor queue with urgency prioritization (emergency > urgent > normal)',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/doctor/consultations', {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      assert(Array.isArray(res.body.data), 'Queue must be an array');
      assert(res.body.data.length >= 1, 'Queue must contain incoming cases');
      const first = res.body.data[0];
      assert(['emergency', 'urgent'].includes(first.priority), 'Top case must be urgent/emergency');
      return res;
    },
  });

  await checkApi({
    category: 'Doctor',
    method: 'GET',
    endpoint: '/api/doctor/consultations?priority=urgent',
    description: 'Doctor queue filtered by priority',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/doctor/consultations?priority=urgent', {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      assert(res.body.data.every(c => c.priority === 'urgent'), 'All returned cases must be urgent');
      return res;
    },
  });

  await checkApi({
    category: 'Doctor',
    method: 'GET',
    endpoint: '/api/doctor/consultations?clinicId=CLINIC-RURAL-01',
    description: 'Doctor queue filtered by facility / clinic ID',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/doctor/consultations?clinicId=CLINIC-RURAL-01', {
        headers: { Authorization: `Bearer ${doctorToken}` },
      });
      assert(res.body.data.every(c => c.clinicId === 'CLINIC-RURAL-01'), 'Filtered by clinic ID');
      return res;
    },
  });

  // -------------------------------------------------------------------------
  // 6. CHUNKED ATTACHMENT UPLOAD APIS (/api/uploads)
  // -------------------------------------------------------------------------
  const sampleFileSize = 6000;
  const sampleChunkSize = 2000;
  const sampleFileBuffer = Buffer.alloc(sampleFileSize);
  for (let i = 0; i < sampleFileSize; i++) {
    sampleFileBuffer[i] = (i * 3) % 256;
  }
  const sampleChecksum = crypto.createHash('sha256').update(sampleFileBuffer).digest('hex');

  await checkApi({
    category: 'Uploads',
    method: 'POST',
    endpoint: '/api/uploads/init',
    description: 'Initialize chunked upload session with standard payload',
    expectedStatus: 201,
    run: async () => {
      const res = await request('POST', '/api/uploads/init', {
        body: {
          consultationId: testConsultationId,
          fileName: 'audit_test_ecg.dat',
          fileSize: sampleFileSize,
          chunkSize: sampleChunkSize,
          totalChunks: 3,
          checksum: sampleChecksum,
          checksumAlgorithm: 'sha256',
        },
      });
      assert(res.body.uploadId, 'uploadId must be returned');
      assert(res.body.totalChunks === 3, 'totalChunks must be 3');
      testUploadId = res.body.uploadId;
      return res;
    },
  });

  await checkApi({
    category: 'Uploads',
    method: 'POST',
    endpoint: '/api/uploads/init',
    description: 'Compatibility: Initialize upload using size and fileHash from communication layer',
    expectedStatus: 201,
    run: async () => {
      const res = await request('POST', '/api/uploads/init', {
        body: {
          consultationId: testConsultationId,
          componentId: 'comp_client_hash_test',
          name: 'comm_ecg.dat',
          size: 1000,
          chunkSize: 500,
          totalChunks: 2,
          fileHash: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
      });
      assert(res.body.uploadId, 'uploadId returned for communication layer payload');
      return res;
    },
  });

  await checkApi({
    category: 'Uploads',
    method: 'POST',
    endpoint: '/api/uploads/init',
    description: 'Validation: Rejects upload init without consultationId (400)',
    expectedStatus: 400,
    run: async () => request('POST', '/api/uploads/init', { body: { fileSize: 100 } }),
  });

  await checkApi({
    category: 'Uploads',
    method: 'PUT',
    endpoint: `/api/uploads/:uploadId/chunks/0`,
    description: 'Upload Chunk 0 using raw binary application/octet-stream',
    expectedStatus: 200,
    run: async () => {
      const chunk0 = sampleFileBuffer.subarray(0, sampleChunkSize);
      const chunk0Hash = crypto.createHash('sha256').update(chunk0).digest('hex');
      const res = await request('PUT', `/api/uploads/${testUploadId}/chunks/0`, {
        headers: {
          'content-type': 'application/octet-stream',
          'x-checksum': chunk0Hash,
        },
        body: chunk0,
        isRaw: true,
      });
      assert(res.body.data.chunkIndex === 0, 'Chunk index 0 recorded');
      assert(res.body.data.totalChunksReceived === 1, 'Total received is 1');
      return res;
    },
  });

  await checkApi({
    category: 'Uploads',
    method: 'PUT',
    endpoint: `/api/uploads/:uploadId/chunks/0`,
    description: 'Idempotency: Re-uploading chunk 0 succeeds without duplicate storage (200)',
    expectedStatus: 200,
    run: async () => {
      const chunk0 = sampleFileBuffer.subarray(0, sampleChunkSize);
      const res = await request('PUT', `/api/uploads/${testUploadId}/chunks/0`, {
        headers: { 'content-type': 'application/octet-stream' },
        body: chunk0,
        isRaw: true,
      });
      assert(res.body.data.totalChunksReceived === 1, 'Total received remains 1');
      return res;
    },
  });

  await checkApi({
    category: 'Uploads',
    method: 'PUT',
    endpoint: `/api/uploads/:uploadId/chunks/1`,
    description: 'Upload Chunk 1 using JSON Base64 format',
    expectedStatus: 200,
    run: async () => {
      const chunk1 = sampleFileBuffer.subarray(sampleChunkSize, sampleChunkSize * 2);
      const res = await request('PUT', `/api/uploads/${testUploadId}/chunks/1`, {
        headers: { 'content-type': 'application/json' },
        body: { chunk: chunk1.toString('base64') },
      });
      assert(res.body.data.chunkIndex === 1, 'Chunk 1 received via Base64');
      return res;
    },
  });

  await checkApi({
    category: 'Uploads',
    method: 'PUT',
    endpoint: `/api/uploads/:uploadId/chunks/99`,
    description: 'Validation: Rejects chunk index out of bounds (400)',
    expectedStatus: 400,
    run: async () => request('PUT', `/api/uploads/${testUploadId}/chunks/99`, {
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.from('overflow chunk'),
      isRaw: true,
    }),
  });

  await checkApi({
    category: 'Uploads',
    method: 'PUT',
    endpoint: `/api/uploads/:uploadId/chunks/2`,
    description: 'Validation: Rejects chunk when per-chunk checksum mismatches (400)',
    expectedStatus: 400,
    run: async () => {
      const chunk2 = sampleFileBuffer.subarray(sampleChunkSize * 2);
      return request('PUT', `/api/uploads/${testUploadId}/chunks/2`, {
        headers: {
          'content-type': 'application/octet-stream',
          'x-checksum': 'bad_corrupted_chunk_hash_000',
        },
        body: chunk2,
        isRaw: true,
      });
    },
  });

  await checkApi({
    category: 'Uploads',
    method: 'GET',
    endpoint: `/api/uploads/:uploadId/status`,
    description: 'Query upload session status and inspect missing chunks for resume',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', `/api/uploads/${testUploadId}/status`);
      assert(res.body.data.receivedChunks.includes(0), 'Chunk 0 received');
      assert(res.body.data.receivedChunks.includes(1), 'Chunk 1 received');
      assert(res.body.data.missingChunks.includes(2), 'Chunk 2 is missing');
      assert(res.body.data.isComplete === false, 'Upload is not complete');
      return res;
    },
  });

  await checkApi({
    category: 'Uploads',
    method: 'POST',
    endpoint: `/api/uploads/:uploadId/complete`,
    description: 'Validation: Rejects completion when chunks are missing (400 CHUNKS_MISSING)',
    expectedStatus: 400,
    run: async () => request('POST', `/api/uploads/${testUploadId}/complete`, {
      body: { finalChecksum: sampleChecksum },
    }),
  });

  await checkApi({
    category: 'Uploads',
    method: 'PUT',
    endpoint: `/api/uploads/:uploadId/chunks/2`,
    description: 'Upload final missing Chunk 2 to complete session chunks',
    expectedStatus: 200,
    run: async () => {
      const chunk2 = sampleFileBuffer.subarray(sampleChunkSize * 2);
      const chunk2Hash = crypto.createHash('sha256').update(chunk2).digest('hex');
      const res = await request('PUT', `/api/uploads/${testUploadId}/chunks/2`, {
        headers: {
          'content-type': 'application/octet-stream',
          'X-Chunk-Hash': chunk2Hash,
        },
        body: chunk2,
        isRaw: true,
      });
      assert(res.body.data.isComplete === true, 'All chunks received');
      return res;
    },
  });

  await checkApi({
    category: 'Uploads',
    method: 'POST',
    endpoint: `/api/uploads/:uploadId/complete`,
    description: 'Verify integrity, reassemble file on disk, update attachments table (200)',
    expectedStatus: 200,
    run: async () => {
      const res = await request('POST', `/api/uploads/${testUploadId}/complete`, {
        body: { finalChecksum: sampleChecksum },
      });
      assert(res.body.data.status === 'completed', 'Status completed');
      assert(res.body.data.verified === true, 'Integrity verified');
      assert(fs.existsSync(res.body.data.storagePath), 'File physically assembled');
      assembledFilePath = res.body.data.storagePath;
      return res;
    },
  });

  // -------------------------------------------------------------------------
  // 7. DOCTOR RESPONSES & CLINIC SYNC APIS (/api/responses & /api/sync)
  // -------------------------------------------------------------------------
  await checkApi({
    category: 'Responses',
    method: 'POST',
    endpoint: `/api/consultations/:id/responses`,
    description: 'Doctor submits clinical assessment, advice, referral, and prescription',
    expectedStatus: 201,
    run: async () => {
      const res = await request('POST', `/api/consultations/${testConsultationId}/responses`, {
        headers: { Authorization: `Bearer ${doctorToken}` },
        body: {
          assessment: 'Moderate acute asthma exacerbation responding partially to bronchodilators.',
          recommendedSteps: 'Continue Salbutamol nebulization 2.5mg every 4 hours. Start oral Prednisolone 40mg once daily for 5 days.',
          followUpAdvice: 'Review at clinic in 24 hours. Transfer to CHC if oxygen saturation drops below 92%.',
          referralRequired: false,
          prescriptionText: '1. Tab. Prednisolone 40mg OD x 5 days\n2. Salbutamol inhaler 2 puffs QDS PRN\n3. Paracetamol 500mg SOS',
        },
      });
      assert(res.body.data.id, 'Response ID generated');
      assert(res.body.data.deliveryStatus === 'submitted', 'Status is submitted');
      testResponseId = res.body.data.id;
      return res;
    },
  });

  await checkApi({
    category: 'Responses',
    method: 'POST',
    endpoint: `/api/consultations/:id/responses`,
    description: 'Validation: Rejects response without assessment (400)',
    expectedStatus: 400,
    run: async () => request('POST', `/api/consultations/${testConsultationId}/responses`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: { recommendedSteps: 'Steps only' },
    }),
  });

  await checkApi({
    category: 'Responses',
    method: 'GET',
    endpoint: `/api/consultations/:id/responses`,
    description: 'List all doctor responses associated with a consultation',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', `/api/consultations/${testConsultationId}/responses`, {
        headers: { Authorization: `Bearer ${hwToken}` },
      });
      assert(Array.isArray(res.body.data), 'data must be array');
      assert(res.body.data.some(r => r.id === testResponseId), 'Must find response');
      return res;
    },
  });

  await checkApi({
    category: 'Sync',
    method: 'GET',
    endpoint: '/api/sync/responses',
    description: 'Rural clinic polls for unacknowledged doctor responses (Direct Array format)',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/sync/responses?clinicId=CLINIC-RURAL-01', {
        headers: { Authorization: `Bearer ${hwToken}` },
      });
      assert(Array.isArray(res.body), 'Response must be direct array for responseSync compatibility');
      assert(res.body.some(r => r.id === testResponseId), 'Must contain test response');
      return res;
    },
  });

  await checkApi({
    category: 'Sync',
    method: 'GET',
    endpoint: '/api/sync/responses?envelope=true',
    description: 'Poll responses in enveloped format with metadata count',
    expectedStatus: 200,
    run: async () => {
      const res = await request('GET', '/api/sync/responses?envelope=true', {
        headers: { Authorization: `Bearer ${hwToken}` },
      });
      assert(res.body.success === true, 'Envelope success true');
      assert(Array.isArray(res.body.data), 'Enveloped data array');
      return res;
    },
  });

  await checkApi({
    category: 'Responses',
    method: 'PATCH',
    endpoint: `/api/responses/:id/acknowledge`,
    description: 'Rural clinic acknowledges response receipt (deliveryStatus -> acknowledged)',
    expectedStatus: 200,
    run: async () => {
      const res = await request('PATCH', `/api/responses/${testResponseId}/acknowledge`, {
        headers: { Authorization: `Bearer ${hwToken}` },
        body: { healthWorkerId: 'HW-DEMO-01' },
      });
      assert(res.body.data.deliveryStatus === 'acknowledged', 'deliveryStatus is acknowledged');
      assert(res.body.data.consultationStatus === 'response_received_by_clinic', 'Advanced consultation state');
      return res;
    },
  });

  await checkApi({
    category: 'Responses',
    method: 'PATCH',
    endpoint: '/api/responses/RES-NON-EXISTENT-999/acknowledge',
    description: 'Not Found: Rejects acknowledgment on non-existent response with 404',
    expectedStatus: 404,
    run: async () => request('PATCH', '/api/responses/RES-NON-EXISTENT-999/acknowledge'),
  });

  // -------------------------------------------------------------------------
  // 8. ERROR & 404 ROUTING HANDLER
  // -------------------------------------------------------------------------
  await checkApi({
    category: 'Routing',
    method: 'GET',
    endpoint: '/api/unsupported_service_endpoint',
    description: 'Global 404 handler returns clean error JSON structure',
    expectedStatus: 404,
    run: async () => {
      const res = await request('GET', '/api/unsupported_service_endpoint');
      assert(res.body.code === 'NOT_FOUND', 'code must be NOT_FOUND');
      return res;
    },
  });

  console.log('\n========================================================================================');
  console.log(`                     AUDIT SUMMARY: ${passedCount}/${passedCount + failedCount} ENDPOINTS VERIFIED                     `);
  console.log('========================================================================================\n');

  return { passedCount, failedCount, total: passedCount + failedCount, auditResults };
}

module.exports = auditEveryApi;

if (require.main === module) {
  auditEveryApi().catch(err => {
    console.error('Fatal audit failure:', err);
    process.exit(1);
  });
}
