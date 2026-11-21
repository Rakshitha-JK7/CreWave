/**
 * Exponential Backoff with Jitter
 */
export class RetryManager {
  constructor({
    initialDelayMs = 1000,
    maxDelayMs = 30000,
    factor = 2,
    jitter = true,
    maxRetries = 5,
  } = {}) {
    this.initialDelayMs = initialDelayMs;
    this.maxDelayMs = maxDelayMs;
    this.factor = factor;
    this.jitter = jitter;
    this.maxRetries = maxRetries;
  }

  getDelay(attemptNumber) {
    if (attemptNumber <= 0) return 0;
    let delay = this.initialDelayMs * Math.pow(this.factor, attemptNumber - 1);
    if (delay > this.maxDelayMs) {
      delay = this.maxDelayMs;
    }
    if (this.jitter) {
      // Full jitter: random between 0 and delay
      delay = Math.round(Math.random() * delay);
    }
    return delay;
  }

  shouldRetry(attemptNumber) {
    return attemptNumber <= this.maxRetries;
  }

  async sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Execute an async action with automatic retry & backoff
   */
  async executeWithRetry(action, onRetry = null) {
    let attempt = 0;
    while (true) {
      try {
        return await action();
      } catch (err) {
        attempt++;
        if (!this.shouldRetry(attempt)) {
          throw err;
        }
        const delay = this.getDelay(attempt);
        if (onRetry) {
          onRetry({ attempt, delay, error: err });
        }
        await this.sleep(delay);
      }
    }
  }
}

export const defaultRetryManager = new RetryManager();
