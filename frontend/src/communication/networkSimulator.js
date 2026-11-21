import { NetworkSimPreset, NetworkQuality } from './constants.js';

class NetworkSimulator {
  constructor() {
    this.currentPreset = NetworkSimPreset.NORMAL;
    this.customConfig = null;
    this.listeners = new Set();
  }

  getPreset() {
    return this.currentPreset;
  }

  setPreset(preset) {
    if (!Object.values(NetworkSimPreset).includes(preset)) {
      throw new Error(`Unknown preset: ${preset}`);
    }
    this.currentPreset = preset;
    this.notify();
  }

  onChange(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify() {
    for (const cb of this.listeners) {
      try {
        cb(this.currentPreset);
      } catch (e) {
        console.error('Error in simulator listener:', e);
      }
    }
  }

  /**
   * Helper delay utility
   */
  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Intercept and throttle fetch calls based on simulation settings
   * Presets:
   * - normal: direct fetch with minimal overhead
   * - 2g: 800ms latency + ~40kbps transfer throttling
   * - flaky: 20% random drop + 400-800ms jitter
   * - offline: immediate rejection
   */
  async simulatedFetch(input, init = {}) {
    if (this.currentPreset === NetworkSimPreset.OFFLINE) {
      await this.sleep(100);
      throw new TypeError('Failed to fetch (Simulated Offline)');
    }

    if (this.currentPreset === NetworkSimPreset.FLAKY) {
      const dropRoll = Math.random();
      if (dropRoll < 0.20) {
        // 20% failure rate
        const delay = 300 + Math.random() * 500;
        await this.sleep(delay);
        throw new TypeError('Failed to fetch (Simulated Flaky Drop)');
      }
      // Add jitter latency
      const jitter = 300 + Math.random() * 400;
      await this.sleep(jitter);
    } else if (this.currentPreset === NetworkSimPreset.POOR_2G) {
      // Base 2G latency (~800ms)
      await this.sleep(800);

      // If uploading body (Blob/ArrayBuffer), simulate ~40 kbps = 5 KB/s
      if (init && init.body) {
        let byteSize = 0;
        if (init.body instanceof Blob) {
          byteSize = init.body.size;
        } else if (init.body instanceof ArrayBuffer) {
          byteSize = init.body.byteLength;
        } else if (typeof init.body === 'string') {
          byteSize = init.body.length;
        }

        if (byteSize > 0) {
          const simulatedSpeedBytesPerSec = 5 * 1024; // 5 KB/s (~40 kbps)
          const transferTimeMs = Math.min((byteSize / simulatedSpeedBytesPerSec) * 1000, 10000); // capped at 10s
          await this.sleep(transferTimeMs);
        }
      }
    }

    // Call real fetch
    const response = await fetch(input, init);

    // If 2G or Flaky, we could also throttle response reading if necessary
    return response;
  }
}

export const networkSimulator = new NetworkSimulator();
