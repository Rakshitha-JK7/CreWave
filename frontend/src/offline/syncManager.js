/**
 * CareWave Sync Manager
 * Manages background synchronization lifecycle, sync state events, and persistent timestamps.
 */

class SyncManager {
  constructor() {
    this.state = {
      lastSync: (typeof localStorage !== 'undefined' && localStorage.getItem('carewave_last_sync')) || null,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      connectionStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
    };

    this.listeners = new Set();
  }

  getSyncState() {
    return { ...this.state };
  }

  updateSyncState(updates) {
    this.state = { ...this.state, ...updates };

    if (updates.lastSync && typeof localStorage !== 'undefined') {
      localStorage.setItem('carewave_last_sync', updates.lastSync);
    }

    this.notify();
  }

  onSyncStateChange(callback) {
    this.listeners.add(callback);
    // Immediately call with current state
    try {
      callback(this.getSyncState());
    } catch (e) {
      console.error('Error in sync listener initial call:', e);
    }
    return () => this.listeners.delete(callback);
  }

  notify() {
    const currentState = this.getSyncState();
    this.listeners.forEach((callback) => {
      try {
        callback(currentState);
      } catch (err) {
        console.error('Error invoking sync listener:', err);
      }
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('carewave:sync-change', { detail: currentState }));
    }
  }

  async startSync() {
    if (this.state.isSyncing) return false;

    this.updateSyncState({ isSyncing: true });

    // Emulate sync cycle or invoke communication module hook
    try {
      if (typeof window !== 'undefined' && window.__carewave_comm_sync) {
        await window.__carewave_comm_sync();
      }
      this.endSync(true);
      return true;
    } catch (err) {
      console.warn('Sync cycle encounter:', err);
      this.endSync(false, err.message);
      return false;
    }
  }

  endSync(success = true, error = null) {
    const updates = {
      isSyncing: false,
      lastSync: success ? new Date().toISOString() : this.state.lastSync,
      error: success ? null : error,
    };
    this.updateSyncState(updates);
  }
}

export const syncManager = new SyncManager();
export default syncManager;
