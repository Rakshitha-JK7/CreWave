const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { request, assert, generateToken } = require('../test-helper');
const config = require('../../src/config/config');

async function runSecurityTests() {
  console.log('\n--- SUITE 3: SECURITY, RBAC & INTEGRITY DEFENSE TESTS ---');
  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    try {
      process.stdout.write(`  [SEC ${total}] ${name} ... `);
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err) {
      console.log('FAILED');
      console.error(`    Error: ${err.message}`);
      throw err;
    }
  }

  // 1. SQL Injection attempt in patient search
  await test('SQL Injection in search query is safely escaped by parameter binding', async () => {
    const maliciousQuery = "' OR '1'='1' --";
    const res = await request('GET', `/api/patients?search=${encodeURIComponent(maliciousQuery)}`);
    assert(res.statusCode === 200, `Expected 200, got ${res.statusCode}`);
    // Should not return all patients because it's treated as literal text
    assert(res.body.count === 0, 'SQL injection must not bypass WHERE clause');
  });

  // 2. SQL Injection attempt in consultation retrieval
  await test('SQL Injection in consultation ID parameter is neutralized', async () => {
    const maliciousId = "CW-DEMO-001' UNION SELECT 1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17,18,19,20,21,22,23,24,25,26,27,28,29,30 --";
    const res = await request('GET', `/api/consultations/${encodeURIComponent(maliciousId)}`);
    assert(res.statusCode === 404, `Expected 404, got ${res.statusCode}`);
  });

  // 3. Path Traversal defense in chunked upload fileName
  await test('Path Traversal in fileName is neutralized to a safe filename', async () => {
    const maliciousFileName = '../../../../etc/passwd_evil.txt';
    const initRes = await request('POST', '/api/uploads/init', {
      body: {
        consultationId: 'CW-DEMO-001',
        fileName: maliciousFileName,
        fileSize: 10,
        chunkSize: 10,
        totalChunks: 1,
      },
    });

    assert(initRes.statusCode === 201, `Expected 201, got ${initRes.statusCode}`);
    const uploadId = initRes.body.data.uploadId;

    await request('PUT', `/api/uploads/${uploadId}/chunks/0`, {
      headers: { 'content-type': 'application/octet-stream' },
      body: Buffer.from('safe text!'),
      isRaw: true,
    });

    const compRes = await request('POST', `/api/uploads/${uploadId}/complete`);
    assert(compRes.statusCode === 200, `Expected 200, got ${compRes.statusCode}`);

    const storagePath = compRes.body.data.storagePath;
    assert(!storagePath.includes('..'), 'Storage path must not contain parent directory traversal');
    const rel = path.relative(config.completedDir, storagePath);
    assert(!rel.startsWith('..'), 'File must be strictly contained inside completed uploads directory');
  });

  // 4. File Integrity Tampering Detection (Byte corruption in transit)
  await test('Integrity Defense: 1-byte file corruption triggers 422 verification failure', async () => {
    const originalData = Buffer.from('Vital clinical ECG stream dataset for patient 1024');
    const originalChecksum = crypto.createHash('sha256').update(originalData).digest('hex');

    const initRes = await request('POST', '/api/uploads/init', {
      body: {
        consultationId: 'CW-DEMO-001',
        fileName: 'tampered_ecg.dat',
        fileSize: originalData.length,
        chunkSize: originalData.length,
        totalChunks: 1,
        checksum: originalChecksum,
      },
    });
    const uploadId = initRes.body.data.uploadId;

    // Tamper with 1 byte
    const tamperedData = Buffer.from(originalData);
    tamperedData[0] = tamperedData[0] ^ 0xFF; // flip bits of first byte

    await request('PUT', `/api/uploads/${uploadId}/chunks/0`, {
      headers: { 'content-type': 'application/octet-stream' },
      body: tamperedData,
      isRaw: true,
    });

    // Try to complete: server must calculate actual hash, see mismatch with expected, and reject with 422!
    const compRes = await request('POST', `/api/uploads/${uploadId}/complete`, {
      body: { finalChecksum: originalChecksum },
    });

    assert(compRes.statusCode === 422, `Expected 422 Unprocessable Entity, got ${compRes.statusCode}`);
    assert(compRes.body.code === 'INTEGRITY_VERIFICATION_FAILED', 'Must report INTEGRITY_VERIFICATION_FAILED');
  });

  // 5. Malicious JWT with tampered signature
  await test('Tampered JWT token signature is rejected by authentication middleware', async () => {
    const validToken = generateToken({ id: 'TEST-1', username: 'test', role: 'doctor' });
    const parts = validToken.split('.');
    // Tamper with the payload (middle segment)
    const tamperedPayload = Buffer.from(JSON.stringify({ id: 'HACKER', role: 'admin' })).toString('base64');
    const tamperedToken = `${parts[0]}.${tamperedPayload}.${parts[2]}`;

    const res = await request('GET', '/api/auth/me', {
      headers: { Authorization: `Bearer ${tamperedToken}` },
    });
    assert(res.statusCode === 403, `Expected 403, got ${res.statusCode}`);
  });

  console.log(`\n  Security Tests Completed: ${passed}/${total} Passed.`);
  return { passed, total };
}

module.exports = runSecurityTests;

if (require.main === module) {
  runSecurityTests().catch(() => process.exit(1));
}
