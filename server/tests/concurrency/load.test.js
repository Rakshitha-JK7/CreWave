const crypto = require('crypto');
const { request, assert } = require('../test-helper');

async function runConcurrencyTests() {
  console.log('\n--- SUITE 5: CONCURRENCY, RACE CONDITIONS & STRESS TESTS ---');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      process.stdout.write(`  [CONC ${total}] ${name} ... `);
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err) {
      console.log('FAILED');
      console.error(`    Error: ${err.message}`);
      throw err;
    }
  }

  // 1. Concurrent Distinct Consultations
  await test('10 concurrent distinct consultation submissions all succeed without corruption', async () => {
    const promises = [];
    const count = 10;
    const baseId = Date.now();

    for (let i = 0; i < count; i++) {
      const p = request('POST', '/api/consultations', {
        body: {
          consultationId: `CW-LOAD-${baseId}-${i}`,
          idempotencyKey: `IDEMP-LOAD-${baseId}-${i}`,
          patientId: 'PAT-DEMO-1024',
          priority: i % 2 === 0 ? 'urgent' : 'normal',
          clinicalSummary: { mainComplaint: `Concurrent consultation test batch ${i}` },
          vitals: { heartRate: 70 + i },
        },
      });
      promises.push(p);
    }

    const results = await Promise.all(promises);
    assert(results.length === count, 'All 10 promises resolved');

    for (let i = 0; i < count; i++) {
      assert(results[i].statusCode === 201, `Item ${i} status should be 201, got ${results[i].statusCode}`);
      assert(results[i].body.data.id === `CW-LOAD-${baseId}-${i}`, `Item ${i} ID matches`);
    }
  });

  // 2. Concurrent Idempotent Retries Race Condition (Thundering herd with same idempotency key)
  await test('5 concurrent retry requests with the SAME idempotency key return original safely', async () => {
    const sharedKey = `IDEMP-RACE-${Date.now()}`;
    const sharedConsId = `CW-RACE-${Date.now()}`;

    // Fire 5 requests simultaneously with the same key
    const promises = Array.from({ length: 5 }, (_, idx) =>
      request('POST', '/api/consultations', {
        body: {
          consultationId: sharedConsId,
          idempotencyKey: sharedKey,
          patientId: 'PAT-DEMO-1024',
          clinicalSummary: { mainComplaint: `Race condition test payload ${idx}` },
        },
      })
    );

    const responses = await Promise.all(promises);

    // All 5 must succeed with 200 or 201 without unhandled crash
    let createdCount = 0;
    let duplicateCount = 0;

    for (const r of responses) {
      assert([200, 201].includes(r.statusCode), `Expected 200 or 201, got ${r.statusCode}`);
      if (r.statusCode === 201) createdCount++;
      if (r.statusCode === 200) duplicateCount++;
      assert(r.body.data.id === sharedConsId, 'All responses must resolve to the identical consultation record');
    }

    assert(createdCount >= 1, 'At least 1 request created the record');
    assert(createdCount + duplicateCount === 5, 'All 5 requests resolved gracefully');
  });

  // 3. Concurrent Chunk Uploads
  await test('5 chunks uploaded concurrently in parallel succeed and reassemble accurately', async () => {
    const totalChunks = 5;
    const chunkSize = 2000;
    const totalBytes = totalChunks * chunkSize;
    const fullBuffer = Buffer.alloc(totalBytes);
    for (let i = 0; i < totalBytes; i++) {
      fullBuffer[i] = (i * 13) % 256;
    }
    const expectedChecksum = crypto.createHash('sha256').update(fullBuffer).digest('hex');

    const initRes = await request('POST', '/api/uploads/init', {
      body: {
        consultationId: 'CW-DEMO-001',
        fileName: 'concurrent_ecg.bin',
        fileSize: totalBytes,
        chunkSize,
        totalChunks,
        checksum: expectedChecksum,
      },
    });
    const uploadId = initRes.body.data.uploadId;

    // Fire all 5 chunks concurrently
    const chunkPromises = Array.from({ length: totalChunks }, (_, idx) => {
      const chunk = fullBuffer.subarray(idx * chunkSize, (idx + 1) * chunkSize);
      return request('PUT', `/api/uploads/${uploadId}/chunks/${idx}`, {
        headers: { 'content-type': 'application/octet-stream' },
        body: chunk,
        isRaw: true,
      });
    });

    const chunkResults = await Promise.all(chunkPromises);
    for (const res of chunkResults) {
      assert(res.statusCode === 200, `Concurrent chunk upload must return 200, got ${res.statusCode}`);
    }

    // Complete and verify
    const compRes = await request('POST', `/api/uploads/${uploadId}/complete`, {
      body: { finalChecksum: expectedChecksum },
    });

    assert(compRes.statusCode === 200, `Complete should return 200, got ${compRes.statusCode}`);
    assert(compRes.body.data.verified === true, 'Parallel chunk assembly checksum verified');
  });

  console.log(`\n  Concurrency Tests Completed: ${passed}/${total} Passed.`);
  return { passed, total };
}

module.exports = runConcurrencyTests;

if (require.main === module) {
  runConcurrencyTests().catch(() => process.exit(1));
}
