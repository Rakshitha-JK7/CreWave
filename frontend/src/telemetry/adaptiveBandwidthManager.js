/**
 * CareBridge Adaptive Bandwidth Management Engine
 * Intelligent network monitoring and adaptation for 2G GSM, GPRS, EDGE, and constrained rural networks.
 * Adjusts transport parameters, timeouts, and retry policies without altering medical data.
 */

export const NetworkClass = {
  FAST: 'FAST',           // Broadband / 4G / Good WiFi (> 250 kbps)
  MODERATE: 'MODERATE',   // 3G / Stable mobile (100 - 250 kbps)
  SLOW: 'SLOW',           // Basic 3G / High EDGE (50 - 100 kbps)
  VERY_SLOW: 'VERY_SLOW', // Real 2G GPRS / EDGE (15 - 50 kbps)
  UNSTABLE: 'UNSTABLE',   // High packet drops / intermittent interruptions
  OFFLINE: 'OFFLINE',     // No connectivity
};

export class AdaptiveBandwidthManager {
  constructor(options = {}) {
    this.history = [];
    this.maxHistorySize = options.maxHistorySize || 10;
    this.consecutiveFailures = 0;
    this.lastMeasuredThroughputKbps = options.initialThroughput || 45; // Default assume 2G EDGE
    this.lastLatencyMs = 300;
    this.currentClass = NetworkClass.VERY_SLOW;
    this.listeners = new Set();

    // Check navigator status if in browser
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleNetworkEvent(true));
      window.addEventListener('offline', () => this.handleNetworkEvent(false));
      if (!navigator.onLine) {
        this.currentClass = NetworkClass.OFFLINE;
      }
    }
  }

  handleNetworkEvent(isOnline) {
    if (!isOnline) {
      this.currentClass = NetworkClass.OFFLINE;
    } else {
      // Re-evaluate based on previous throughput
      this.reclassify();
    }
    this.notifyListeners();
  }

  /**
   * Records a completed or failed transfer event
   * @param {object} metric
   * @param {number} metric.bytes - total bytes sent
   * @param {number} metric.durationMs - time taken in milliseconds
   * @param {boolean} metric.success - whether request succeeded
   * @param {boolean} [metric.interrupted=false] - whether request dropped
   */
  recordTransfer(metric) {
    const { bytes, durationMs, success, interrupted } = metric;
    const timestamp = Date.now();

    if (!success || interrupted) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= 2) {
        this.currentClass = NetworkClass.UNSTABLE;
      }
    } else {
      this.consecutiveFailures = 0;
      // Calculate throughput in kbps: (bytes * 8) / (durationMs / 1000) / 1000 = (bytes * 8) / durationMs
      if (durationMs > 0 && bytes > 0) {
        const kbps = Number(((bytes * 8) / durationMs).toFixed(1));
        this.lastMeasuredThroughputKbps = kbps;
        this.history.unshift({ bytes, durationMs, kbps, timestamp });
        if (this.history.length > this.maxHistorySize) {
          this.history.pop();
        }
      }
      this.reclassify();
    }

    this.notifyListeners();
  }

  /**
   * Re-classifies network condition based on measured throughput and failure frequency
   */
  reclassify() {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.currentClass = NetworkClass.OFFLINE;
      return;
    }

    if (this.consecutiveFailures >= 2) {
      this.currentClass = NetworkClass.UNSTABLE;
      return;
    }

    const kbps = this.getAverageThroughputKbps();
    if (kbps >= 250) {
      this.currentClass = NetworkClass.FAST;
    } else if (kbps >= 100) {
      this.currentClass = NetworkClass.MODERATE;
    } else if (kbps >= 50) {
      this.currentClass = NetworkClass.SLOW;
    } else {
      this.currentClass = NetworkClass.VERY_SLOW;
    }
  }

  getAverageThroughputKbps() {
    if (this.history.length === 0) return this.lastMeasuredThroughputKbps;
    const sum = this.history.reduce((acc, h) => acc + h.kbps, 0);
    return Number((sum / this.history.length).toFixed(1));
  }

  /**
   * Returns recommended HTTP request timeout in milliseconds for current condition
   */
  getRequestTimeoutMs(payloadSizeBytes = 100000) {
    const kbps = Math.max(10, this.getAverageThroughputKbps());
    // Estimated transfer duration + 100% buffer + 10s base margin
    const estimatedSec = (payloadSizeBytes * 8) / (kbps * 1000);
    const calculatedTimeoutMs = Math.ceil(estimatedSec * 2 * 1000) + 15000;

    switch (this.currentClass) {
      case NetworkClass.FAST:
        return Math.max(30000, Math.min(60000, calculatedTimeoutMs));
      case NetworkClass.MODERATE:
        return Math.max(60000, Math.min(120000, calculatedTimeoutMs));
      case NetworkClass.SLOW:
        return Math.max(120000, Math.min(240000, calculatedTimeoutMs));
      case NetworkClass.VERY_SLOW:
      case NetworkClass.UNSTABLE:
      default:
        // 2G EDGE / GPRS: Allow up to 300 seconds (5 minutes) for full payload
        return Math.max(180000, Math.min(360000, calculatedTimeoutMs));
    }
  }

  /**
   * Returns recommended retry delay with exponential backoff & jitter
   * @param {number} attempt - 1-based attempt counter
   * @returns {number} delay in milliseconds
   */
  getRetryDelayMs(attempt = 1) {
    const baseDelay = this.currentClass === NetworkClass.UNSTABLE ? 8000 : 4000;
    // Exponential backoff: base * 2^(attempt - 1), capped at 60s
    const expDelay = Math.min(60000, baseDelay * Math.pow(1.8, Math.max(0, attempt - 1)));
    // Full jitter: random between 50% and 100% of expDelay
    const jitter = 0.5 + Math.random() * 0.5;
    return Math.floor(expDelay * jitter);
  }

  /**
   * Returns recommended GZIP compression level (1-9) for future records
   * Balance between CPU compression time on mobile devices vs 2G transmission savings
   */
  getRecommendedCompressionLevel() {
    switch (this.currentClass) {
      case NetworkClass.FAST:
        return 4; // Fast compression
      case NetworkClass.MODERATE:
        return 6; // Balanced
      case NetworkClass.SLOW:
      case NetworkClass.VERY_SLOW:
      case NetworkClass.UNSTABLE:
      default:
        return 7; // Higher compression to save precious 2G bytes
    }
  }

  /**
   * Subscribe to network classification updates
   */
  subscribe(callback) {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notifyListeners() {
    const state = this.getState();
    for (const cb of this.listeners) {
      try { cb(state); } catch (e) { /* ignore */ }
    }
  }

  getState() {
    return {
      classification: this.currentClass,
      throughputKbps: this.getAverageThroughputKbps(),
      consecutiveFailures: this.consecutiveFailures,
      recommendedTimeoutMs: this.getRequestTimeoutMs(),
      recommendedLevel: this.getRecommendedCompressionLevel(),
      isOnline: this.currentClass !== NetworkClass.OFFLINE,
    };
  }
}

// Global shared singleton
export const adaptiveBandwidthManager = new AdaptiveBandwidthManager();
export default adaptiveBandwidthManager;
