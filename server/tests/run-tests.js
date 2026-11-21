const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { EventEmitter } = require('events');
const app = require('../src/app');
const db = require('../src/models/db');
const seed = require('../src/scripts/seed');

// Pure in-process HTTP dispatcher: runs tests directly through Express middleware pipeline
function request(method, urlPath, { headers = {}, body = null, isRaw = false } = {}) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(urlPath, 'http://127.0.0.1:5000');
    const reqHeaders = {};
    for (const [k, v] of Object.entries(headers)) {
      reqHeaders[k.toLowerCase()] = String(v);
    }

    let bodyBuffer = null;
    if (body !== null && body !== undefined) {
      if (isRaw || Buffer.isBuffer(body)) {
        bodyBuffer = body;
        if (!reqHeaders['content-type']) reqHeaders['content-type'] = 'application/octet-stream';
      } else if (typeof body === 'object') {
        bodyBuffer = Buffer.from(JSON.stringify(body));
        if (!reqHeaders['content-type']) reqHeaders['content-type'] = 'application/json';
      } else {
        bodyBuffer = Buffer.from(String(body));
      }
      reqHeaders['content-length'] = String(bodyBuffer.length);
    }

    let sent = false;
    const req = new Readable({
      read() {
        if (!sent && bodyBuffer) {
          this.push(bodyBuffer);
          sent = true;
        }
        this.push(null);
      },
    });

    // Create a mock socket with EventEmitter so node:_http_incoming doesn't throw
    const mockSocket = new EventEmitter();
    mockSocket.remoteAddress = '127.0.0.1';
    mockSocket.encrypted = false;
    mockSocket.writable = true;
    mockSocket.destroy = () => {};
    mockSocket.setTimeout = () => {};

    req.method = method.toUpperCase();
    req.url = parsedUrl.pathname + parsedUrl.search;
    req.originalUrl = req.url;
    req.headers = reqHeaders;
    req.connection = mockSocket;
    req.socket = mockSocket;
    req.complete = true;

    const res = new EventEmitter();
    res.statusCode = 200;
    res.headers = {};
    const resChunks = [];

    res.setHeader = (name, value) => {
      res.headers[name.toLowerCase()] = value;
    };
    res.getHeader = (name) => res.headers[name.toLowerCase()];
    res.removeHeader = (name) => {
      delete res.headers[name.toLowerCase()];
    };

    res.status = (code) => {
      res.statusCode = code;
      return res;
    };

    res.write = (chunk) => {
      if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      return true;
    };

    res.end = (chunk) => {
      if (chunk) resChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      const raw = Buffer.concat(resChunks).toString('utf8');
      let json = null;
      try {
        json = JSON.parse(raw);
      } catch (e) {
        json = null;
      }
      resolve({
        statusCode: res.statusCode,
        headers: res.headers,
        body: json || raw,
        raw,
      });
    };

    res.writeHead = (code, headers) => {
      res.statusCode = code;
      if (headers) {
        Object.entries(headers).forEach(([k, v]) => res.setHeader(k, v));
      }
      return res;
    };

    try {
      app.handle(req, res, (err) => {
        if (err) reject(err);
      });
    } catch (err) {
      reject(err);
    }
  });
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runTestSuite() {
  console.log('================================================================');
  console.log('   Starting CareWave Comprehensive Backend Verification Suite   ');
  console.log('================================================================');

  // 1. Initialize DB and Seed Demo Data
  await seed();

  let passedTests = 0;
  let totalTests = 0;

  async function test(name, fn) {
    totalTests++;
    try {
      process.stdout.write(`TEST ${totalTests}: ${name} ... `);
      await fn();
      console.log('PASSED');
      passedTests++;
    } catch (err) {
      console.log('FAILED');
      console.error(`  Error: ${err.message}`);
      if (err.stack) console.error(err.stack);
    }
  }

  let doctorToken = '';
  let hwToken = '';
  const testPatientRef = `PAT-TEST-${Date.now()}`;
  const testConsultationId = `CW-TEST-${Date.now()}`;
  const testIdempotencyKey = `IDEMP-KEY-${Date.now()}`;
  let testUploadId = '';
  let testResponseId = '';

  // TEST 1: Health & Ping
  await test('GET /api/health and /api/ping endpoints', async () => {
    const res = await request('GET', '/api/health');
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.status === 'ok', 'Status should be "ok"');
    assert(res.body.timestamp !== undefined, 'Timestamp should be present');
    assert(res.body.dbEngine !== undefined, 'DB engine should be returned');
  });

  // TEST 2: Authentication - Login with seeded doctor
  await test('POST /api/auth/login (Doctor login)', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { username: 'doctor1', password: 'password123' },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.success === true, 'Login should succeed');
    assert(res.body.data.token, 'Token should be returned');
    assert(res.body.data.user.role === 'doctor', 'Role should be doctor');
    doctorToken = res.body.data.token;
  });

  // TEST 3: Authentication - Login with seeded health worker
  await test('POST /api/auth/login (Health Worker login)', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { username: 'worker1', password: 'password123' },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.user.role === 'health_worker', 'Role should be health_worker');
    hwToken = res.body.data.token;
  });

  // TEST 4: Authentication - Profile Me verification
  await test('GET /api/auth/me (Verify JWT profile)', async () => {
    const res = await request('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.username === 'doctor1', 'Username should match');
  });

  // TEST 5: Patients - Create new patient
  await test('POST /api/patients (Register new rural patient)', async () => {
    const res = await request('POST', '/api/patients', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: {
        referenceId: testPatientRef,
        name: 'Sunita Bai',
        age: 38,
        sex: 'Female',
        village: 'Kalyanpur Post 3',
        contactNumber: '+91 94112 33445',
        consent: true,
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.referenceId === testPatientRef, 'Reference ID should match');
    assert(res.body.data.village === 'Kalyanpur Post 3', 'Village should match');
  });

  // TEST 6: Patients - List and Search
  await test('GET /api/patients?search=Sunita', async () => {
    const res = await request('GET', `/api/patients?search=Sunita`);
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.count >= 1, 'Should find at least 1 matching patient');
    assert(res.body.data[0].referenceId === testPatientRef, 'Found patient should match');
  });

  // TEST 7: Patients - Get by Reference ID with history
  await test('GET /api/patients/:id (Retrieve patient profile)', async () => {
    const res = await request('GET', `/api/patients/${testPatientRef}`);
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.name === 'Sunita Bai', 'Name should match');
    assert(Array.isArray(res.body.data.consultations), 'Consultations array should be present');
  });

  // TEST 8: Consultation - Create consultation with complete clinical summary and vitals
  await test('POST /api/consultations (Create consultation)', async () => {
    const payload = {
      consultationId: testConsultationId,
      idempotencyKey: testIdempotencyKey,
      patientId: testPatientRef,
      clinicId: 'CLINIC-RURAL-01',
      priority: 'urgent',
      urgencyCategory: 'Moderate',
      clinicalSummary: {
        mainComplaint: 'Acute chest pain and dizziness',
        symptoms: 'Substernal chest tightness radiating to left shoulder',
        onset: '4 hours ago',
        duration: 'Intermittent for 4 hours',
        severityProgression: 'Worsening on exertion',
        medicalHistory: 'Hypertension diagnosed 2 years ago',
        medications: 'Amlodipine 5mg irregular',
        allergies: 'None known',
        healthWorkerObservations: 'Patient appears anxious and diaphoretic',
      },
      vitals: {
        temperature: 37.1,
        heartRate: 104,
        bloodPressure: '150/95',
        spo2: 95,
        respiratoryRate: 22,
        bloodGlucose: 140,
        weight: 58,
      },
      attachments: [
        {
          id: `ATT-ECG-${Date.now()}`,
          fileName: 'ecg_trace_lead2.dat',
          fileSize: 4096,
          type: 'ecg',
          priority: 2,
        },
      ],
    };

    const res = await request('POST', '/api/consultations', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: payload,
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.success === true, 'Consultation creation should succeed');
    assert(res.body.isDuplicate === false, 'Should not be marked duplicate');
    assert(res.body.data.id === testConsultationId, 'Consultation ID should match');
    assert(res.body.data.vitals.heartRate === 104, 'Vitals heart rate should be parsed');
    assert(res.body.data.clinicalSummary.mainComplaint.includes('chest pain'), 'Summary should be present');
  });

  // TEST 9: Consultation - Idempotency Key Duplicate Prevention
  await test('POST /api/consultations (Idempotent retry with same key)', async () => {
    const payload = {
      consultationId: testConsultationId,
      idempotencyKey: testIdempotencyKey, // EXACT SAME KEY
      patientId: testPatientRef,
      clinicalSummary: { mainComplaint: 'Duplicate attempt' },
    };

    const res = await request('POST', '/api/consultations', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: payload,
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.isDuplicate === true, 'Must identify duplicate idempotency key!');
    assert(res.body.data.id === testConsultationId, 'Must return original consultation record');
    assert(res.body.data.vitals.heartRate === 104, 'Must retain original vitals without overwriting');
  });

  // TEST 10: Consultation - Retrieve consultation details
  await test('GET /api/consultations/:id (Details & attachments)', async () => {
    const res = await request('GET', `/api/consultations/${testConsultationId}`);
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.patient.village === 'Kalyanpur Post 3', 'Patient village should be joined');
    assert(res.body.data.attachmentStats.total >= 1, 'Attachments should be counted');
    assert(res.body.data.attachmentStats.pending >= 1, 'Should show pending attachment');
  });

  // TEST 11: Doctor Queue - Urgent/Emergency prioritization
  await test('GET /api/doctor/consultations (Prioritized incoming queue)', async () => {
    const res = await request('GET', '/api/doctor/consultations', {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.count >= 1, 'Queue should contain consultations');
    const firstItem = res.body.data[0];
    assert(['emergency', 'urgent'].includes(firstItem.priority), 'Top item should be urgent/emergency');
    assert(firstItem.attachmentStatus !== undefined, 'Queue item must display attachment status breakdown');
  });

  // TEST 12: Doctor Review Status - Update to in_review
  await test('PATCH /api/consultations/:id/review (Doctor starts review)', async () => {
    const res = await request('PATCH', `/api/consultations/${testConsultationId}/review`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: { status: 'in_review', doctorName: 'Dr. Ramesh Sharma' },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.status === 'in_review', 'Status should be "in_review"');
  });

  // TEST 13: Chunked Upload - Init Upload Session
  const sampleFileSize = 10000; // 10,000 bytes
  const sampleChunkSize = 3500;  // 3 chunks (3500 + 3500 + 3000)
  const fullSampleData = Buffer.alloc(sampleFileSize);
  for (let i = 0; i < sampleFileSize; i++) {
    fullSampleData[i] = (i * 7) % 256;
  }
  const expectedSha256 = crypto.createHash('sha256').update(fullSampleData).digest('hex');

  await test('POST /api/uploads/init (Initialize chunked upload session)', async () => {
    const res = await request('POST', '/api/uploads/init', {
      body: {
        consultationId: testConsultationId,
        fileName: 'ecg_high_res_lead2.dat',
        fileSize: sampleFileSize,
        chunkSize: sampleChunkSize,
        totalChunks: 3,
        checksum: expectedSha256,
        checksumAlgorithm: 'sha256',
        mimeType: 'application/octet-stream',
        priority: 2,
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.uploadId, 'Should return uploadId');
    assert(res.body.data.totalChunks === 3, 'Total chunks should be 3');
    testUploadId = res.body.data.uploadId;
  });

  // TEST 14: Chunked Upload - Upload Chunk 0
  await test('PUT /api/uploads/:uploadId/chunks/0 (Upload chunk 0)', async () => {
    const chunk0 = fullSampleData.subarray(0, sampleChunkSize);
    const chunk0Checksum = crypto.createHash('sha256').update(chunk0).digest('hex');

    const res = await request('PUT', `/api/uploads/${testUploadId}/chunks/0`, {
      headers: {
        'content-type': 'application/octet-stream',
        'x-checksum': chunk0Checksum,
      },
      body: chunk0,
      isRaw: true,
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.chunkIndex === 0, 'Chunk index should be 0');
    assert(res.body.data.totalChunksReceived === 1, 'Total received chunks should be 1');
  });

  // TEST 15: Chunked Upload - Upload Chunk 2 (Intentionally skip Chunk 1 to test resume tracking)
  await test('PUT /api/uploads/:uploadId/chunks/2 (Out-of-order chunk 2)', async () => {
    const chunk2 = fullSampleData.subarray(sampleChunkSize * 2);
    const chunk2Checksum = crypto.createHash('sha256').update(chunk2).digest('hex');

    const res = await request('PUT', `/api/uploads/${testUploadId}/chunks/2`, {
      headers: {
        'content-type': 'application/octet-stream',
        'x-checksum': chunk2Checksum,
      },
      body: chunk2,
      isRaw: true,
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.chunkIndex === 2, 'Chunk index should be 2');
    assert(res.body.data.totalChunksReceived === 2, 'Total received chunks should be 2');
  });

  // TEST 16: Chunked Upload - Check Status: Verify Chunk 1 is identified as missing
  await test('GET /api/uploads/:uploadId/status (Identify missing chunks for resume)', async () => {
    const res = await request('GET', `/api/uploads/${testUploadId}/status`);
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.receivedChunks.includes(0), 'Chunk 0 should be marked received');
    assert(res.body.data.receivedChunks.includes(2), 'Chunk 2 should be marked received');
    assert(res.body.data.missingChunks.includes(1), 'Chunk 1 MUST be in missingChunks list!');
    assert(res.body.data.isComplete === false, 'Upload must not be marked complete yet');
  });

  // TEST 17: Chunked Upload - Idempotent re-upload of Chunk 0 (Simulating network retry)
  await test('PUT /api/uploads/:uploadId/chunks/0 (Idempotent duplicate chunk upload)', async () => {
    const chunk0 = fullSampleData.subarray(0, sampleChunkSize);
    const res = await request('PUT', `/api/uploads/${testUploadId}/chunks/0`, {
      headers: { 'content-type': 'application/octet-stream' },
      body: chunk0,
      isRaw: true,
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.totalChunksReceived === 2, 'Total chunks received must still be 2 (no duplicate count)');
  });

  // TEST 18: Chunked Upload - Complete failure when chunks are missing
  await test('POST /api/uploads/:uploadId/complete (Must reject incomplete upload)', async () => {
    const res = await request('POST', `/api/uploads/${testUploadId}/complete`, {
      body: { finalChecksum: expectedSha256 },
    });
    assert(res.statusCode === 400, `Expected 400, got ${res.statusCode}`);
    assert(res.body.code === 'CHUNKS_MISSING', 'Error code should be CHUNKS_MISSING');
  });

  // TEST 19: Chunked Upload - Resume by uploading missing Chunk 1
  await test('PUT /api/uploads/:uploadId/chunks/1 (Upload missing chunk 1)', async () => {
    const chunk1 = fullSampleData.subarray(sampleChunkSize, sampleChunkSize * 2);
    const chunk1Checksum = crypto.createHash('sha256').update(chunk1).digest('hex');

    const res = await request('PUT', `/api/uploads/${testUploadId}/chunks/1`, {
      headers: {
        'content-type': 'application/octet-stream',
        'x-checksum': chunk1Checksum,
      },
      body: chunk1,
      isRaw: true,
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.isComplete === true, 'All 3 chunks should now be received');
  });

  // TEST 20: Chunked Upload - Complete, reassemble file, and verify checksum
  await test('POST /api/uploads/:uploadId/complete (Verify integrity and assemble)', async () => {
    const res = await request('POST', `/api/uploads/${testUploadId}/complete`, {
      body: { finalChecksum: expectedSha256 },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.status === 'completed', 'Status should be completed');
    assert(res.body.data.verified === true, 'File checksum must be verified');
    assert(res.body.data.checksum === expectedSha256, 'Checksum should match expected SHA-256');
    assert(fs.existsSync(res.body.data.storagePath), 'Assembled file must physically exist on disk');

    // Verify file content on disk
    const diskContent = fs.readFileSync(res.body.data.storagePath);
    assert(diskContent.equals(fullSampleData), 'Reassembled file on disk must be identical to original payload');
  });

  // TEST 21: Doctor Response - Submit assessment and recommendation
  await test('POST /api/consultations/:id/responses (Doctor submits response)', async () => {
    const res = await request('POST', `/api/consultations/${testConsultationId}/responses`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: {
        assessment: 'Suspected unstable angina or early acute coronary syndrome with uncontrolled hypertension.',
        recommendedSteps: 'Administer Aspirin 300mg immediately if not contraindicated. Keep patient resting and calm. Monitor SpO2 continuously.',
        followUpAdvice: 'Immediate transfer to district hospital cardiac unit required. Do not delay.',
        referralRequired: true,
        referralDetails: 'Urgent referral to District General Hospital Cardiology Unit. Call ambulance immediately.',
        prescriptionText: 'Tab. Aspirin 300mg stat (chewable); Tab. Sorbitrate 5mg sublingual if SBP > 100 mmHg.',
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.id, 'Response ID should be generated');
    assert(res.body.data.referralRequired === true, 'Referral required should be true');
    testResponseId = res.body.data.id;
  });

  // TEST 22: Clinic Sync - Poll pending doctor responses for the rural clinic
  await test('GET /api/sync/responses (Clinic reverse synchronization)', async () => {
    const res = await request('GET', `/api/sync/responses?clinicId=CLINIC-RURAL-01`, {
      headers: { Authorization: `Bearer ${hwToken}` },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.count >= 1, 'Should find pending responses for clinic');
    const target = res.body.data.find(r => r.id === testResponseId);
    assert(target !== undefined, 'Target response must be in sync queue');
    assert(target.patient.name === 'Sunita Bai', 'Patient name should be attached');
  });

  // TEST 23: Response Acknowledgment - Clinic confirms receipt
  await test('PATCH /api/responses/:id/acknowledge (Clinic acknowledges advice)', async () => {
    const res = await request('PATCH', `/api/responses/${testResponseId}/acknowledge`, {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: { healthWorkerId: 'HW-DEMO-01' },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.deliveryStatus === 'acknowledged', 'Status should be acknowledged');
    assert(res.body.data.consultationStatus === 'response_received_by_clinic', 'Consultation status should advance to response_received_by_clinic');
  });

  // TEST 24: Consultation Sync Status - Transmission groups 1, 2, 3 verification
  await test('GET /api/consultations/:id/sync-status (Transmission groups breakdown)', async () => {
    const res = await request('GET', `/api/consultations/${testConsultationId}/sync-status`);
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.transmissionGroups.group1.status === 'delivered', 'Group 1 essential summary delivered');
    assert(res.body.data.overallStatus === 'response_received_by_clinic', 'Full round-trip completed');
  });

  console.log('\n================================================================');
  console.log(`   Verification Finished: ${passedTests}/${totalTests} Tests Passed`);
  console.log('================================================================');

  if (passedTests !== totalTests) {
    process.exit(1);
  }
}

runTestSuite().catch(err => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
