import { EventEmitter } from '../src/communication/eventEmitter.js';
import { RetryManager } from '../src/communication/retryManager.js';
import { NetworkSimPreset, ComponentPriority, ConsultationStatus } from '../src/communication/constants.js';
import { computeSHA256 } from '../src/communication/cryptoUtils.js';

async function runTests() {
  console.log('--- Running Communication Layer Self-Tests ---');

  // Test 1: EventEmitter
  console.log('1. Testing EventEmitter...');
  const emitter = new EventEmitter();
  let received = null;
  const unsub = emitter.on('test-event', (data) => { received = data; });
  emitter.emit('test-event', { ok: true });
  if (received && received.ok === true) {
    console.log('   [PASS] EventEmitter delivered event correctly.');
  } else {
    throw new Error('EventEmitter failed');
  }
  unsub();
  received = null;
  emitter.emit('test-event', { ok: true });
  if (received === null) {
    console.log('   [PASS] Unsubscribe works.');
  } else {
    throw new Error('EventEmitter unsubscribe failed');
  }

  // Test 2: RetryManager (exponential backoff & jitter)
  console.log('2. Testing RetryManager...');
  const retry = new RetryManager({ initialDelayMs: 10, maxDelayMs: 50, maxRetries: 3, jitter: false });
  if (retry.getDelay(1) === 10 && retry.getDelay(2) === 20 && retry.getDelay(3) === 40 && retry.getDelay(4) === 50) {
    console.log('   [PASS] Exponential backoff calculation correct.');
  } else {
    throw new Error('RetryManager backoff progression failed');
  }

  let attempts = 0;
  try {
    await retry.executeWithRetry(async () => {
      attempts++;
      if (attempts < 3) throw new Error('Simulated network error');
      return 'success';
    });
    console.log(`   [PASS] Retry succeeded on attempt ${attempts}.`);
  } catch (e) {
    throw new Error(`executeWithRetry failed: ${e.message}`);
  }

  // Test 3: SHA-256 Hashing with Crypto
  console.log('3. Testing SHA-256 Hashing...');
  const testString = 'CareWave Telemedicine Test Data';
  const hash = await computeSHA256(testString);
  if (typeof hash === 'string' && hash.length === 64) {
    console.log(`   [PASS] SHA-256 generated valid 64-char hex hash: ${hash}`);
  } else {
    throw new Error('computeSHA256 failed');
  }

  // Test 4: Constants & Priority Hierarchy Verification
  console.log('4. Verifying Constants...');
  if (ComponentPriority.GROUP_1_ESSENTIAL < ComponentPriority.GROUP_2_CLINICAL &&
      ComponentPriority.GROUP_2_CLINICAL < ComponentPriority.GROUP_3_DOCUMENTS) {
    console.log('   [PASS] Priority hierarchy strictly adheres to Group 1 > Group 2 > Group 3.');
  } else {
    throw new Error('Priority hierarchy invalid');
  }

  console.log('\nAll self-verifying tests passed successfully!');
}

runTests().catch(err => {
  console.error('[FAIL]', err);
  process.exit(1);
});
