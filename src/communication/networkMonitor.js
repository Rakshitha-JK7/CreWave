import { NetworkQuality, NetworkSimPreset } from './constants.js';
import { networkSimulator } from './networkSimulator.js';
import { EventEmitter } from './eventEmitter.js';

class NetworkMonitor extends EventEmitter {
  constructor() {
    super();
    this.online = (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean')
      ? navigator.onLine
      : true;
    this.quality = NetworkQuality.GOOD;
    this.rtt = 50; // ms
    this.effectiveType = '4g';
    this.pingEndpoint = '/api/health';
    this.pingIntervalMs = 10000;
    this.timerId = null;

    this.init();
  }

  init() {
    if (typeof window !== 'undefined') {
      window.addEventListener('online', () => this.handleSystemOnlineChange(true));
      window.addEventListener('offline', () => this.handleSystemOnlineChange(false));

      // Network Information API if supported
      if (navigator.connection) {
        navigator.connection.addEventListener('change', () => this.updateFromConnectionAPI());
        this.updateFromConnectionAPI();
      }
    }

    // Subscribe to NetworkSimulator changes
    networkSimulator.onChange((preset) => {
      this.handleSimulatorPresetChange(preset);
    });

    this.startActiveProbing();
  }

  handleSystemOnlineChange(isOnline) {
    if (networkSimulator.getPreset() === NetworkSimPreset.OFFLINE) {
      // Simulator overrides
      return;
    }
    this.online = isOnline;
    if (!isOnline) {
      this.quality = NetworkQuality.OFFLINE;
    }
    this.notifyStatus();
  }

  handleSimulatorPresetChange(preset) {
    if (preset === NetworkSimPreset.OFFLINE) {
      this.online = false;
      this.quality = NetworkQuality.OFFLINE;
      this.rtt = 0;
      this.effectiveType = 'offline';
    } else if (preset === NetworkSimPreset.POOR_2G) {
      this.online = true;
      this.quality = NetworkQuality.POOR;
      this.rtt = 800;
      this.effectiveType = '2g';
    } else if (preset === NetworkSimPreset.FLAKY) {
      this.online = true;
      this.quality = NetworkQuality.POOR;
      this.rtt = 500;
      this.effectiveType = '3g';
    } else {
      // Normal
      this.online = (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean')
        ? navigator.onLine
        : true;
      this.quality = NetworkQuality.GOOD;
      this.rtt = 50;
      this.effectiveType = '4g';
      this.updateFromConnectionAPI();
    }
    this.notifyStatus();
  }

  updateFromConnectionAPI() {
    if (networkSimulator.getPreset() !== NetworkSimPreset.NORMAL) return;

    if (typeof navigator !== 'undefined' && navigator.connection) {
      const conn = navigator.connection;
      this.effectiveType = conn.effectiveType || '4g';
      this.rtt = conn.rtt || 50;

      if (!navigator.onLine) {
        this.quality = NetworkQuality.OFFLINE;
        this.online = false;
      } else if (this.effectiveType === '2g' || this.effectiveType === 'slow-2g' || this.rtt > 600) {
        this.quality = NetworkQuality.POOR;
        this.online = true;
      } else {
        this.quality = NetworkQuality.GOOD;
        this.online = true;
      }
    }
  }

  /**
   * Active Reachability & Latency check
   */
  async checkReachability() {
    if (networkSimulator.getPreset() === NetworkSimPreset.OFFLINE) {
      this.online = false;
      this.quality = NetworkQuality.OFFLINE;
      this.notifyStatus();
      return false;
    }

    const start = performance.now();
    try {
      // Use simulator fetch wrapper
      const response = await networkSimulator.simulatedFetch(this.pingEndpoint, {
        method: 'GET',
        cache: 'no-store',
      });
      const end = performance.now();
      const latency = Math.round(end - start);
      this.rtt = latency;
      this.online = response.ok || response.status < 500;

      if (!this.online) {
        this.quality = NetworkQuality.OFFLINE;
      } else if (latency > 600 || networkSimulator.getPreset() === NetworkSimPreset.POOR_2G) {
        this.quality = NetworkQuality.POOR;
        this.effectiveType = '2g';
      } else {
        this.quality = NetworkQuality.GOOD;
        this.effectiveType = latency > 250 ? '3g' : '4g';
      }
    } catch (err) {
      // Reachability failed
      if (networkSimulator.getPreset() === NetworkSimPreset.FLAKY) {
        this.quality = NetworkQuality.POOR;
        this.online = true; // still treats as intermittently reachable
      } else {
        this.online = false;
        this.quality = NetworkQuality.OFFLINE;
      }
    }

    this.notifyStatus();
    return this.online;
  }

  startActiveProbing() {
    // Only auto-probe in browser environments
    if (typeof window === 'undefined') return;
    if (this.timerId) clearInterval(this.timerId);
    this.timerId = setInterval(() => {
      this.checkReachability();
    }, this.pingIntervalMs);
  }

  stopActiveProbing() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
  }

  getStatus() {
    return {
      online: this.online,
      quality: this.quality,
      rtt: this.rtt,
      effectiveType: this.effectiveType,
      simulatedPreset: networkSimulator.getPreset(),
    };
  }

  notifyStatus() {
    this.emit('change', this.getStatus());
  }

  /**
   * Determines optimal chunk size based on measured network quality
   * Adaptive chunking: 32 KB on poor, 64 KB normal, 128 KB fast
   */
  getOptimalChunkSize() {
    if (this.quality === NetworkQuality.POOR || this.rtt > 500) {
      return 32 * 1024; // 32 KB
    }
    if (this.quality === NetworkQuality.GOOD && this.rtt < 100) {
      return 128 * 1024; // 128 KB
    }
    return 64 * 1024; // 64 KB default
  }
}

export const networkMonitor = new NetworkMonitor();
