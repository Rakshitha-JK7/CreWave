/**
 * CareWave Consolidated Sync Manager
 * Manages background synchronization lifecycle, reactive sync state events,
 * and low-bandwidth priority polling.
 */

import { syncQueue } from '@communication/syncQueue';
import { responseSync } from '@communication/responseSync';
import { networkMonitor } from '@communication/networkMonitor';
import { getPendingOutboxItems } from '@communication/localDB';

class SyncManager {
  constructor() {
    this.state = {
      lastSync: (typeof localStorage !== 'undefined' && localStorage.getItem('carewave_last_sync')) || null,
      isSyncing: false,
      pendingCount: 0,
      failedCount: 0,
      connectionStatus: typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline',
      effectiveType: 'unknown',
    };

    this.listeners = new Set();
    this.initSyncHooks();
  }

  initSyncHooks() {
    // Listen to network monitor status changes
    networkMonitor.on('change', (net) => {
      this.updateSyncState({
        connectionStatus: net.online ? 'online' : 'offline',
        effectiveType: net.effectiveType,
      });

      // If connection restored, automatically kick off queue processing
      if (net.online) {
        this.startSync().catch(() => {});
      }
    });

    // Listen to syncQueue state changes
    syncQueue.on('change', async () => {
      try {
        const pending = await getPendingOutboxItems();
        const pendingCount = (pending || []).length;
        const failedCount = (pending || []).filter((i) => i.status === 'failed').length;

        this.updateSyncState({
          isSyncing: syncQueue.isProcessing,
          pendingCount,
          failedCount,
        });
      } catch (e) {
        console.warn('Sync hook update error:', e);
      }
    });

    // Start background response polling
    if (typeof window !== 'undefined') {
      try {
        responseSync.startPolling();
      } catch (e) {
        console.warn('Response polling start warning:', e);
      }
    }
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

    try {
      // 1. Process outbound pending queue (Group 1 summaries & Group 2/3 chunked uploads)
      await syncQueue.processQueue();

      // 2. Poll for incoming doctor clinical responses
      await responseSync.poll();

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
