process.env.NODE_ENV = 'test';
const crypto = require('crypto');
const { request, assert } = require('./test-helper');
const seed = require('../src/scripts/seed');

async function runE2EWorkflow() {
  console.log('================================================================');
  console.log('       CAREWAVE END-TO-END ROLE & WORKFLOW INTEGRATION TEST     ');
  console.log('================================================================');

  let passed = 0;
  let total = 0;

  async function step(description, fn) {
    total++;
    process.stdout.write(`  [STEP ${total}] ${description} ... `);
    try {
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

  const timestamp = Date.now();
  const patientEmail = `patient_${timestamp}@carewave.org`;
  const doctorEmail = `doctor_${timestamp}@carewave.org`;
  const hwEmail = `hw_${timestamp}@carewave.org`;

  let patientToken = '';
  let adminToken = '';
  let doctorId = '';
  let doctorToken = '';
  let hwId = '';
  let hwToken = '';
  let createdPatientRef = `PAT-E2E-${timestamp}`;
  let consultationId = `CW-E2E-${timestamp}`;
  let uploadId = '';
  let responseId = '';

  // 1. Patient Self-Registration
  await step('Patient registers: immediately active and receives JWT', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        name: 'Asha Devi',
        email: patientEmail,
        password: 'password123',
        role: 'patient',
        age: 32,
        sex: 'Female',
        village: 'Rampur Tola 4',
        contactNumber: '+91 98765 11223',
        bloodGroup: 'O+',
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.user.status === 'active', 'Patient status must be active');
    assert(res.body.data.user.role === 'patient', 'Role must be patient');
    assert(res.body.data.token, 'Must return JWT token immediately for active patient');
    patientToken = res.body.data.token;
  });

  // 2. Doctor Registration
  await step('Doctor registers: status set to pending approval without JWT', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        name: 'Dr. Vikram Chandra',
        email: doctorEmail,
        password: 'password123',
        role: 'doctor',
        specialization: 'Cardiology',
        licenseNumber: `MCI-${timestamp}`,
        contactNumber: '+91 98111 22334',
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.user.status === 'pending', 'Doctor account must be pending approval');
    assert(res.body.data.token === null, 'Must NOT issue JWT for pending privileged account');
    doctorId = res.body.data.user.id;
  });

  // 3. Doctor Login Blocked While Pending
  await step('Doctor login attempt while pending is rejected with 403 ACCOUNT_PENDING_APPROVAL', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: {
        username: doctorEmail,
        password: 'password123',
      },
    });

    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    assert(res.body.code === 'ACCOUNT_PENDING_APPROVAL', 'Must return code ACCOUNT_PENDING_APPROVAL');
  });

  // 4. Health Worker Registration
  await step('Health Worker registers: status set to pending approval', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        name: 'Meena Sharma',
        email: hwEmail,
        password: 'password123',
        role: 'health_worker',
        clinicId: 'Rampur Primary Health Centre',
        village: 'Rampur Main',
        contactNumber: '+91 97222 33445',
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.user.status === 'pending', 'Health worker account must be pending approval');
    hwId = res.body.data.user.id;
  });

  // 5. Admin Registration Rejected Publicly
  await step('Public registration as admin is rejected with 403 Forbidden', async () => {
    const res = await request('POST', '/api/auth/register', {
      body: {
        name: 'Attacker Admin',
        email: `hacker_${timestamp}@evil.com`,
        password: 'password123',
        role: 'admin',
      },
    });

    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
    assert(res.body.code === 'ADMIN_REGISTRATION_FORBIDDEN', 'Must reject public admin creation');
  });

  // 6. Admin Login
  await step('System administrator logs in successfully', async () => {
    const res = await request('POST', '/api/auth/login', {
      body: {
        username: 'admin',
        password: 'admin123',
      },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.data.user.role === 'admin', 'Role must be admin');
    assert(res.body.data.token, 'Must return admin JWT');
    adminToken = res.body.data.token;
  });

  // 7. Admin Lists Pending Approvals
  await step('Admin retrieves pending approvals queue', async () => {
    const res = await request('GET', '/api/admin/pending-users', {
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(Array.isArray(res.body.data), 'Must return array of pending users');
    const hasDoctor = res.body.data.some(u => u.id === doctorId);
    const hasHW = res.body.data.some(u => u.id === hwId);
    assert(hasDoctor, 'Pending queue must contain registered doctor');
    assert(hasHW, 'Pending queue must contain registered health worker');
  });

  // 8. Admin Approves Doctor and Health Worker
  await step('Admin approves doctor and health worker accounts', async () => {
    const docApprove = await request('PATCH', `/api/admin/users/${doctorId}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(docApprove.statusCode === 200, `Expected 200, got ${docApprove.statusCode}`);
    assert(docApprove.body.data.status === 'active', 'Doctor status must now be active');

    const hwApprove = await request('PATCH', `/api/admin/users/${hwId}/approve`, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(hwApprove.statusCode === 200, `Expected 200, got ${hwApprove.statusCode}`);
    assert(hwApprove.body.data.status === 'active', 'HW status must now be active');
  });

  // 9. Approved Users Log In Successfully
  await step('Doctor and Health Worker log in and receive signed JWTs', async () => {
    const docLogin = await request('POST', '/api/auth/login', {
      body: { username: doctorEmail, password: 'password123' },
    });
    assert(docLogin.statusCode === 200, `Doctor login failed: ${docLogin.statusCode}`);
    assert(docLogin.body.data.user.role === 'doctor', 'Role must be doctor');
    doctorToken = docLogin.body.data.token;

    const hwLogin = await request('POST', '/api/auth/login', {
      body: { username: hwEmail, password: 'password123' },
    });
    assert(hwLogin.statusCode === 200, `HW login failed: ${hwLogin.statusCode}`);
    assert(hwLogin.body.data.user.role === 'health_worker', 'Role must be health_worker');
    hwToken = hwLogin.body.data.token;
  });

  // 10. Health Worker Registers Rural Patient
  await step('Health Worker registers rural patient record', async () => {
    const res = await request('POST', '/api/patients', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: {
        referenceId: createdPatientRef,
        name: 'Suresh Patel',
        age: 54,
        sex: 'Male',
        village: 'Kalyanpur',
        contactNumber: '+91 94112 99887',
        bloodGroup: 'A+',
        emergencyContact: 'Rani Patel (+91 94112 99888)',
        consent: true,
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.referenceId === createdPatientRef, 'Reference ID must match');
  });

  // 11. Health Worker Submits Essential Consultation (Group 1 Priority)
  await step('Health Worker creates emergency consultation with clinical summary and vitals', async () => {
    const res = await request('POST', '/api/consultations', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: {
        consultationId,
        idempotencyKey: `IDEMP-${consultationId}`,
        patientId: createdPatientRef,
        priority: 'emergency',
        clinicalSummary: {
          mainComplaint: 'Acute retrosternal chest pain radiating to left arm',
          duration: '45 minutes',
        },
        vitals: {
          bloodPressure: { systolic: 165, diastolic: 105 },
          heartRate: 115,
          spo2: 92,
          temperature: 37.2,
        },
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.priority === 'emergency', 'Priority must be emergency');
  });

  // 12. Chunked ECG Telemetry Upload (Group 2 Priority)
  await step('Health Worker performs chunked resumable upload of ECG diagnostic file', async () => {
    const fileData = Buffer.from('CARE_WAVE_ECG_LEAD_II_DATA_128HZ_SAMPLING_AUTHENTIC_STREAM');
    const checksum = crypto.createHash('sha256').update(fileData).digest('hex');

    // 12a. Init upload session
    const initRes = await request('POST', '/api/uploads/init', {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: {
        consultationId,
        fileName: 'ecg_lead2_emergency.dat',
        fileSize: fileData.length,
        chunkSize: 32,
        totalChunks: 2,
        checksum,
        mimeType: 'application/octet-stream',
        priority: 2,
      },
    });

    assert(initRes.statusCode === 201, `Expected 201, got ${initRes.statusCode}`);
    uploadId = initRes.body.data.uploadId;

    // 12b. Upload Chunk 0
    const chunk0 = fileData.subarray(0, 32);
    const chunk0Hash = crypto.createHash('sha256').update(chunk0).digest('hex');
    const c0Res = await request('PUT', `/api/uploads/${uploadId}/chunks/0`, {
      headers: {
        Authorization: `Bearer ${hwToken}`,
        'content-type': 'application/octet-stream',
        'x-checksum': chunk0Hash,
      },
      body: chunk0,
      isRaw: true,
    });
    assert(c0Res.statusCode === 200, `Expected 200, got ${c0Res.statusCode}`);

    // 12c. Upload Chunk 1
    const chunk1 = fileData.subarray(32);
    const chunk1Hash = crypto.createHash('sha256').update(chunk1).digest('hex');
    const c1Res = await request('PUT', `/api/uploads/${uploadId}/chunks/1`, {
      headers: {
        Authorization: `Bearer ${hwToken}`,
        'content-type': 'application/octet-stream',
        'x-checksum': chunk1Hash,
      },
      body: chunk1,
      isRaw: true,
    });
    assert(c1Res.statusCode === 200, `Expected 200, got ${c1Res.statusCode}`);

    // 12d. Complete Upload
    const compRes = await request('POST', `/api/uploads/${uploadId}/complete`, {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: { finalChecksum: checksum },
    });
    assert(compRes.statusCode === 200, `Expected 200, got ${compRes.statusCode}`);
    assert(compRes.body.data.isComplete === true || compRes.body.data.status === 'completed', 'Upload must be marked complete');
  });

  // 13. Doctor Reviews Case and Prioritized Queue
  await step('Doctor retrieves queue: emergency case prioritized at index 0', async () => {
    const res = await request('GET', '/api/doctor/consultations', {
      headers: { Authorization: `Bearer ${doctorToken}` },
    });

    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    assert(res.body.count >= 1, 'Queue must not be empty');
    assert(res.body.data[0].id === consultationId, 'Emergency consultation must be top of queue');

    // Update review status to in_review
    const reviewRes = await request('PATCH', `/api/consultations/${consultationId}/review`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: { status: 'in_review', doctorName: 'Dr. Vikram Chandra' },
    });
    assert(reviewRes.statusCode === 200, `Expected 200, got ${reviewRes.statusCode}`);
  });

  // 14. Doctor Submits Clinical Response
  await step('Doctor submits assessment, prescription, and emergency referral', async () => {
    const res = await request('POST', `/api/consultations/${consultationId}/responses`, {
      headers: { Authorization: `Bearer ${doctorToken}` },
      body: {
        assessment: 'Suspected Acute Coronary Syndrome (STEMI). High risk.',
        recommendations: 'Administer Aspirin 300mg immediately. Initiate oxygen. Arrange emergency cardiac transport.',
        prescriptions: [
          { medicineName: 'Aspirin', dosage: '300mg', frequency: 'Stat chewable', duration: 'Immediate', instructions: 'Chew and swallow' },
          { medicineName: 'Clopidogrel', dosage: '300mg', frequency: 'Stat oral', duration: 'Immediate', instructions: 'Take with water' },
        ],
        followUpInstructions: 'Immediate transfer to District Hospital ICU. Continuous ECG telemetry.',
        referral: { recommended: true, facility: 'Sitapur District Hospital Cardiac Unit', urgency: 'Immediate' },
      },
    });

    assert(res.statusCode === 201, `Expected 201, got ${res.statusCode}`);
    assert(res.body.data.id, 'Must return response id');
    responseId = res.body.data.id;
  });

  // 15. Rural Clinic Polls and Acknowledges Advice
  await step('Rural Health Worker synchronizes responses and submits acknowledgment', async () => {
    // 15a. Poll for responses
    const pollRes = await request('GET', '/api/sync/responses', {
      headers: { Authorization: `Bearer ${hwToken}` },
    });
    assert(pollRes.statusCode === 200, `Expected 200, got ${pollRes.statusCode}`);
    const list = Array.isArray(pollRes.body) ? pollRes.body : (pollRes.body && pollRes.body.data ? pollRes.body.data : []);
    const foundResponse = list.find(r => r.id === responseId);
    assert(foundResponse !== undefined, 'Pending response must be returned in clinic sync batch');

    // 15b. Acknowledge receipt
    const ackRes = await request('PATCH', `/api/responses/${responseId}/acknowledge`, {
      headers: { Authorization: `Bearer ${hwToken}` },
      body: { acknowledgedAt: new Date().toISOString() },
    });
    assert(ackRes.statusCode === 200, `Expected 200, got ${ackRes.statusCode}`);
    assert(ackRes.body.data.deliveryStatus === 'acknowledged', 'Status must be acknowledged');
  });

  console.log('\n================================================================');
  console.log(` E2E WORKFLOW VERIFICATION COMPLETE: ${passed}/${total} STEPS PASSED`);
  console.log('================================================================\n');

  return { passed, total };
}

if (require.main === module) {
  runE2EWorkflow().then(() => process.exit(0)).catch((err) => {
    console.error('E2E Workflow Fatal Error:', err);
    process.exit(1);
  });
}

module.exports = runE2EWorkflow;
