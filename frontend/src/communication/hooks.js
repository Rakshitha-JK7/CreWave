import { useState, useEffect, useSyncExternalStore } from 'react';
import { networkMonitor } from './networkMonitor.js';
import { networkSimulator } from './networkSimulator.js';
import { syncQueue } from './syncQueue.js';
import {
  getAllOutboxItems,
  getConsultation,
  getComponentsByConsultation,
} from './localDB.js';
import { TransferState } from './constants.js';

// ==================== 1. useNetworkStatus ====================

/**
 * Returns: { online, quality: 'offline' | 'poor' | 'good', rtt, effectiveType, simulatedPreset, setPreset }
 */
export function useNetworkStatus() {
  const subscribe = (callback) => {
    return networkMonitor.on('change', callback);
  };

  const getSnapshot = () => {
    return JSON.stringify(networkMonitor.getStatus());
  };

  const rawStatus = useSyncExternalStore(subscribe, getSnapshot);
  const status = JSON.parse(rawStatus);

  return {
    ...status,
    setSimulatedPreset: (preset) => networkSimulator.setPreset(preset),
  };
}

// ==================== 2. useSyncQueue ====================

/**
 * Returns: { pending, active, failed, completed, retry(id), pause(), resume(), isPaused }
 */
export function useSyncQueue() {
  const [items, setItems] = useState([]);
  const [isPaused, setIsPaused] = useState(syncQueue.isPaused);

  const fetchItems = async () => {
    const all = await getAllOutboxItems();
    setItems(all);
    setIsPaused(syncQueue.isPaused);
  };

  useEffect(() => {
    fetchItems();
    const unsubChange = syncQueue.on('change', fetchItems);
    const unsubProgress = syncQueue.on('progress', fetchItems);

    return () => {
      unsubChange();
      unsubProgress();
    };
  }, []);

  const pending = items.filter(i => i.status === TransferState.PENDING);
  const active = items.filter(i => i.status === TransferState.UPLOADING);
  const failed = items.filter(i => i.status === TransferState.FAILED);
  const completed = items.filter(i => i.status === TransferState.COMPLETED);

  return {
    items,
    pending,
    active,
    failed,
    completed,
    isPaused,
    retry: (id) => syncQueue.retryItem(id),
    pause: () => syncQueue.pause(),
    resume: () => syncQueue.resume(),
    enqueueConsultation: (consultation, attachments) =>
      syncQueue.enqueueConsultation(consultation, attachments),
  };
}

// ==================== 3. useConsultationStatus ====================

/**
 * Returns: { consultation, components, overallProgress }
 */
export function useConsultationStatus(consultationId) {
  const [data, setData] = useState({
    consultation: null,
    components: [],
    overallProgress: 0,
  });

  const loadData = async () => {
    if (!consultationId) return;
    const cons = await getConsultation(consultationId);
    const comps = await getComponentsByConsultation(consultationId);

    // Compute progress across components
    let totalProgress = 0;
    if (comps.length > 0) {
      const sum = comps.reduce((acc, c) => {
        if (c.status === TransferState.COMPLETED) return acc + 100;
        if (c.totalChunks > 0) {
          return acc + Math.round(((c.uploadedChunks || 0) / c.totalChunks) * 100);
        }
        return acc;
      }, 0);
      totalProgress = Math.round(sum / comps.length);
    } else if (cons && cons.syncStatus !== 'Upload pending') {
      totalProgress = 100;
    }

    setData({
      consultation: cons,
      components: comps,
      overallProgress: totalProgress,
    });
  };

  useEffect(() => {
    loadData();
    const unsub = syncQueue.on('change', loadData);
    const unsubProg = syncQueue.on('progress', (info) => {
      loadData();
    });

    return () => {
      unsub();
      unsubProg();
    };
  }, [consultationId]);

  return data;
}
