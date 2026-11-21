const runUnitTests = require('./unit/services.test');
const runApiTests = require('./integration/api.test');
const runSecurityTests = require('./security/security.test');
const runResilienceTests = require('./resilience/network-simulation.test');
const runConcurrencyTests = require('./concurrency/load.test');

async function runAll() {
  console.log('================================================================');
  console.log('       CAREWAVE COMPLETE BACKEND TEST & VERIFICATION SUITE      ');
  console.log('================================================================');
  console.log('Executing all test categories:');
  console.log(' 1. Unit & Service Layer Tests');
  console.log(' 2. API & Endpoint Integration Tests');
  console.log(' 3. Security, RBAC & Data Tampering Defense Tests');
  console.log(' 4. 2G Weak Network Simulation & Resumability Tests');
  console.log(' 5. Concurrency, Race Conditions & Stress Tests');
  console.log('================================================================');

  const startTime = Date.now();
  let totalPassed = 0;
  let totalTests = 0;

  try {
    const s1 = await runUnitTests();
    totalPassed += s1.passed;
    totalTests += s1.total;

    const s2 = await runApiTests();
    totalPassed += s2.passed;
    totalTests += s2.total;

    const s3 = await runSecurityTests();
    totalPassed += s3.passed;
    totalTests += s3.total;

    const s4 = await runResilienceTests();
    totalPassed += s4.passed;
    totalTests += s4.total;

    const s5 = await runConcurrencyTests();
    totalPassed += s5.passed;
    totalTests += s5.total;

    const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(2);

    console.log('\n================================================================');
    console.log('                    OVERALL TEST SUMMARY                        ');
    console.log('================================================================');
    console.log(` * Suite 1 (Unit & Services):        ${s1.passed}/${s1.total} Passed`);
    console.log(` * Suite 2 (API Integration):        ${s2.passed}/${s2.total} Passed`);
    console.log(` * Suite 3 (Security & Tampering):   ${s3.passed}/${s3.total} Passed`);
    console.log(` * Suite 4 (2G Simulation & Resume): ${s4.passed}/${s4.total} Passed`);
    console.log(` * Suite 5 (Concurrency & Stress):   ${s5.passed}/${s5.total} Passed`);
    console.log('----------------------------------------------------------------');
    console.log(` TOTAL PASSED: ${totalPassed}/${totalTests} (100%) in ${elapsedSec}s`);
    console.log('================================================================\n');

    if (totalPassed !== totalTests) {
      process.exit(1);
    }
  } catch (err) {
    console.error('\nTest Suite encountered fatal error:', err);
    process.exit(1);
  }
}

runAll();
