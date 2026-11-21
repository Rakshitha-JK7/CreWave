import { networkSimulator } from './networkSimulator.js';
import { defaultRetryManager } from './retryManager.js';
import { updateConsultationStatus } from './localDB.js';
import { ConsultationStatus } from './constants.js';

export class ResponseSync {
  constructor({ apiBaseUrl = '/api', pollIntervalMs = 15000, onResponseReceived = null } = {}) {
    this.apiBaseUrl = apiBaseUrl;
    this.pollIntervalMs = pollIntervalMs;
    this.onResponseReceived = onResponseReceived;
    this.timerId = null;
    this.isPolling = false;
  }

  startPolling() {
    if (this.timerId) return;
    this.isPolling = true;
    this.poll();
    this.timerId = setInterval(() => this.poll(), this.pollIntervalMs);
  }

  stopPolling() {
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.isPolling = false;
  }

  /**
   * Poll for doctor responses intended for this clinic/healthworker
   */
  async poll() {
    try {
      const responses = await defaultRetryManager.executeWithRetry(async () => {
        const res = await networkSimulator.simulatedFetch(`${this.apiBaseUrl}/sync/responses`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) {
          throw new Error(`Polling failed: HTTP ${res.status}`);
        }
        return res.json();
      });

      if (Array.isArray(responses) && responses.length > 0) {
        for (const item of responses) {
          await this.processIncomingResponse(item);
        }
      }
    } catch (err) {
      // Quietly handle poll failures when offline or intermittent
      console.warn('ResponseSync poll attempt failed:', err.message);
    }
  }

  /**
   * Check status for a specific consultation
   */
  async fetchConsultationResponses(consultationId) {
    const res = await networkSimulator.simulatedFetch(
      `${this.apiBaseUrl}/consultations/${consultationId}/responses`
    );
    if (!res.ok) throw new Error(`Failed to fetch responses: HTTP ${res.status}`);
    const data = await res.json();
    return data;
  }

  async processIncomingResponse(responseItem) {
    const { id, consultationId } = responseItem;

    // Update local consultation status
    await updateConsultationStatus(consultationId, ConsultationStatus.RESPONSE_RECEIVED);

    // Acknowledge receipt to server
    try {
      await networkSimulator.simulatedFetch(`${this.apiBaseUrl}/responses/${id}/acknowledge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ acknowledgedAt: new Date().toISOString() }),
      });
    } catch (err) {
      console.warn(`Failed to acknowledge response ${id} immediately:`, err.message);
    }

    if (this.onResponseReceived) {
      this.onResponseReceived(responseItem);
    }
  }
}

export const responseSync = new ResponseSync();
