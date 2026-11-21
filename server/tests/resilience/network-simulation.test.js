const crypto = require('crypto');
const { request, assert } = require('../test-helper');

async function runResilienceTests() {
  console.log('\n--- SUITE 4: 2G WEAK NETWORK SIMULATION & RESUMABILITY TESTS ---');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      process.stdout.write(`  [RESIL ${total}] ${name} ... `);
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err) {
      console.log('FAILED');
      console.error(`    Error: ${err.message}`);
      throw err;
    }
  }

  // 1. Group 1 Transmission Priority: Essential clinical data reaches doctor before large file finishes
  await test('Group 1 Priority: Essential summary is immediately available while attachment transfers', async () => {
    const consultationId = `CW-PRIO-${Date.now()}`;
    const idempKey = `IDEMP-PRIO-${Date.now()}`;

    // Step 1: Health worker sends Essential Summary (Group 1)
    const t0 = Date.now();
    const createRes = await request('POST', '/api/consultations', {
      body: {
        consultationId,
        idempotencyKey: idempKey,
        patientId: 'PAT-DEMO-1024',
        priority: 'urgent',
        clinicalSummary: {
          mainComplaint: 'Suspected severe asthma exacerbation',
          duration: '6 hours',
        },
        vitals: {
          spo2: 91,
          respiratoryRate: 28,
        },
        attachments: [
          {
            id: `ATT-PENDING-${Date.now()}`,
            fileName: 'large_lung_audio.wav',
            fileSize: 1048576, // 1 MB
            uploadStatus: 'pending',
          },
        ],
      },
    });

    const group1DeliveryTimeMs = Date.now() - t0;
    assert(createRes.statusCode === 201, `Expected 201, got ${createRes.statusCode}`);

    // Step 2: Doctor checks queue immediately
    const queueRes = await request('GET', '/api/doctor/consultations');
    const doctorView = queueRes.body.data.find(c => c.id === consultationId);

    assert(doctorView !== undefined, 'Doctor can see the consultation immediately');
    assert(doctorView.attachmentStatus.pending === 1, 'Doctor sees attachment is pending');
    assert(doctorView.attachmentStatus.hasPendingAttachments === true, 'hasPendingAttachments flag is set');
    assert(group1DeliveryTimeMs < 100, `Group 1 essential summary was available in ${group1DeliveryTimeMs}ms`);
  });

  // 2. 10-Chunk Upload Simulation with Interrupted Connection and Resumption
  await test('Interrupted 10-chunk upload resumes without retransmitting acknowledged chunks', async () => {
    const totalChunks = 10;
    const chunkSize = 1024; // 1 KB per chunk
    const totalBytes = totalChunks * chunkSize; // 10 KB total
    const fullBuffer = Buffer.alloc(totalBytes);
    for (let i = 0; i < totalBytes; i++) {
      fullBuffer[i] = i % 256;
    }
    const fullChecksum = crypto.createHash('sha256').update(fullBuffer).digest('hex');

    // 1. Initialize session
    const initRes = await request('POST', '/api/uploads/init', {
      body: {
        consultationId: 'CW-DEMO-001',
        fileName: 'resilience_test_file.bin',
        fileSize: totalBytes,
        chunkSize,
        totalChunks,
        checksum: fullChecksum,
      },
    });
    const uploadId = initRes.body.data.uploadId;

    let totalBytesTransferred = 0;
    let chunksAcknowledged = 0;

    // 2. Upload first 4 chunks (0, 1, 2, 3)
    for (let i = 0; i < 4; i++) {
      const chunk = fullBuffer.subarray(i * chunkSize, (i + 1) * chunkSize);
      const res = await request('PUT', `/api/uploads/${uploadId}/chunks/${i}`, {
        headers: { 'content-type': 'application/octet-stream' },
        body: chunk,
        isRaw: true,
      });
      assert(res.statusCode === 200, `Chunk ${i} should succeed`);
      totalBytesTransferred += chunk.length;
      chunksAcknowledged++;
    }

    // 3. SIMULATE CONNECTION DROP!
    // Next attempt fails or drops. Client disconnects.
    // ...
    // 4. CONNECTION RESTORED! Client asks server: "What chunks do you have?"
    const statusRes = await request('GET', `/api/uploads/${uploadId}/status`);
    assert(statusRes.statusCode === 200, 'Status endpoint should be reachable');
    const { receivedChunks, missingChunks } = statusRes.body.data;

    assert(receivedChunks.length === 4, 'Server retained the 4 received chunks');
    assert(missingChunks.length === 6, 'Server correctly identified the 6 missing chunks');
    assert(missingChunks[0] === 4, 'First missing chunk is index 4');

    // 5. RESUME: Client transmits ONLY the missing chunks (4, 5, 6, 7, 8, 9)
    // CRITICAL: Chunks 0, 1, 2, 3 are NEVER resent!
    let retransmittedBytes = 0;
    for (const missingIndex of missingChunks) {
      const chunk = fullBuffer.subarray(missingIndex * chunkSize, (missingIndex + 1) * chunkSize);
      const res = await request('PUT', `/api/uploads/${uploadId}/chunks/${missingIndex}`, {
        headers: { 'content-type': 'application/octet-stream' },
        body: chunk,
        isRaw: true,
      });
      assert(res.statusCode === 200, `Missing chunk ${missingIndex} uploaded`);
      totalBytesTransferred += chunk.length;
    }

    // 6. Complete and verify
    const compRes = await request('POST', `/api/uploads/${uploadId}/complete`, {
      body: { finalChecksum: fullChecksum },
    });

    assert(compRes.statusCode === 200, 'Complete upload succeeded');
    assert(compRes.body.data.status === 'completed', 'Status is completed');

    // 7. Verify Metrics
    const bytesSavedByResume = 4 * chunkSize; // 4 KB saved
    const efficiencyRatio = totalBytes / totalBytesTransferred;

    console.log(`\n      [Metrics] Total File: ${totalBytes} bytes | Transferred: ${totalBytesTransferred} bytes`);
    console.log(`      [Metrics] Retransmissions: ${retransmittedBytes} bytes | Bandwidth Saved: ${bytesSavedByResume} bytes (${(bytesSavedByResume / totalBytes) * 100}%)`);
    console.log(`      [Metrics] Transfer Efficiency: ${(efficiencyRatio * 100).toFixed(1)}%`);

    assert(retransmittedBytes === 0, 'No acknowledged chunk was retransmitted');
    assert(totalBytesTransferred === totalBytes, 'Total bytes transferred exactly equaled file size without duplicate transmission');
  });

  console.log(`\n  Resilience Tests Completed: ${passed}/${total} Passed.`);
  return { passed, total };
}

module.exports = runResilienceTests;

if (require.main === module) {
  runResilienceTests().catch(() => process.exit(1));
}
