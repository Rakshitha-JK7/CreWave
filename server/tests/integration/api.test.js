const crypto = require('crypto');
const { request, assert } = require('../test-helper');
const seed = require('../../src/scripts/seed');

async function runApiIntegrationTests() {
  console.log('\n--- SUITE 2: API & ENDPOINT INTEGRATION TESTS ---');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      process.stdout.write(`  [API ${total}] ${name} ... `);
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err) {
      console.log('FAILED');
      console.error(`    Error: ${err.message}`);
      throw err;
    }
  }

  await seed();

  let doctorToken = '';
  let hwToken = '';

  // Auth Integration
  await test('POST /api/auth/login succeeds for doctor', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { username: 'doctor1', password: 'password123' },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.token, 'Token present');
    doctorToken = res.body.data.token;
  });

  await test('POST /api/auth/login succeeds for health worker', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: { username: 'worker1', password: 'password123' },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    hwToken = res.body.data.token;
  });

  await test('GET /api/auth/me rejects missing token with 401', async () => {
    const res = await request('GET', '/api/auth/me');
    assert(res.statusCode === 401, `Expected 401, got ${res.statusCode}`);
    assert(res.body.code === 'UNAUTHORIZED', 'Error code UNAUTHORIZED');
  });

  await test('GET /api/auth/me rejects invalid malformed token with 403', async () => {
    const res = await request('GET', '/api/auth/me', {
      headers: { Authorization: 'Bearer this_is_a_completely_fake_jwt_token' },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    assert(res.body.code === 'FORBIDDEN', 'Error code FORBIDDEN');
  });

  // Patient API Integration
  const patRef = `PAT-INT-${Date.now()}`;
  await test('POST /api/patients creates patient successfully', async () => {
    const res = await request('POST', '/api/patients', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: {
        referenceId: patRef,
        name: 'Gita Devi',
        age: 29,
        village: 'Rampur Hamlet 2',
        contactNumber: '+91 97766 55443',
        consent: true,
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.referenceId === patRef, 'Reference ID matches');
  });

  await test('GET /api/patients supports village filtering', async () => {
    const res = await request('GET', '/api/patients?village=Rampur');
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.some(p => p.referenceId === patRef), 'Found created patient');
  });

  // Consultation API Integration
  const consId = `CW-INT-${Date.now()}`;
  const idempKey = `IDEMP-INT-${Date.now()}`;
  await test('POST /api/consultations creates structured consultation', async () => {
    const res = await request('POST', '/api/consultations', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: {
        consultationId: consId,
        idempotencyKey: idempKey,
        patientId: patRef,
        priority: 'emergency',
        urgencyCategory: 'Emergency',
        clinicalSummary: {
          mainComplaint: 'Severe breathlessness and cyanosis',
          duration: '3 hours',
        },
        vitals: {
          spo2: 84,
          heartRate: 130,
          respiratoryRate: 34,
        },
      },
    });
    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.priority === 'emergency', 'Priority is emergency');
    assert(res.body.data.vitals.spo2 === 84, 'SpO2 84 recorded');
  });

  await test('PATCH /api/consultations/:id updates consultation fields', async () => {
    const res = await request('PATCH', `/api/consultations/${consId}`, {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: {
        immediateAction: 'High-flow oxygen administered via mask. Ambulatory referral called.',
      },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.immediateAction.includes('High-flow oxygen'), 'Immediate action updated');
  });

  await test('GET /api/doctor/consultations puts emergency consultation at the top', async () => {
    const res = await request('GET', '/api/doctor/consultations', {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    const topItem = res.body.data[0];
    assert(topItem.priority === 'emergency', `Top item should be emergency, got ${topItem.priority}`);
  });

  // Upload Base64 Format Test
  await test('PUT /api/uploads/:uploadId/chunks/:index supports base64 chunk body', async () => {
    const payload = Buffer.from('CareWave Base64 Chunk Upload Test');
    const checksum = crypto.createHash('sha256').update(payload).digest('hex');

    const initRes = await request('POST', '/api/uploads/init', {
      body: {
        consultationId: consId,
        fileName: 'base64_attachment.txt',
        fileSize: payload.length,
        chunkSize: payload.length,
        totalChunks: 1,
        checksum,
      },
    });
    const uploadId = initRes.body.data.uploadId;

    const chunkRes = await request('PUT', `/api/uploads/${uploadId}/chunks/0`, {
      headers: { 'content-type': 'application/json' },
      body: { chunk: payload.toString('base64') },
    });
    assert(chunkRes.statusCode === 200, `Expected 200, got ${chunkRes.statusCode}`);
    assert(chunkRes.body.data.totalChunksReceived === 1, 'Chunk received via base64');

    const compRes = await request('POST', `/api/uploads/${uploadId}/complete`, {
      body: { finalChecksum: checksum },
    });
    assert(compRes.statusCode === 200, `Expected 200, got ${compRes.statusCode}`);
    assert(compRes.body.data.status === 'completed', 'Completed via base64 chunk');
  });

  // 404 Route Test
  await test('GET /api/non_existent_route returns 404 with standard format', async () => {
    const res = await request('GET', '/api/non_existent_route');
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
    assert(res.body.success === false, 'success is false');
    assert(res.body.code === 'NOT_FOUND', 'code is NOT_FOUND');
  });

  console.log(`\n  API Integration Tests Completed: ${passed}/${total} Passed.`);
  return { passed, total };
}

module.exports = runApiIntegrationTests;

if (require.main === module) {
  runApiIntegrationTests().catch(() => process.exit(1));
}
