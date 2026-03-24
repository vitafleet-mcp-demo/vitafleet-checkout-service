/**
 * Retry and Backoff Configuration
 * 
 * Recently updated configuration for improved resilience
 * These values were adjusted during the Stripe v2 → v3 migration
 */

export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  jitterFactor: number;
}

/**
 * Default retry configuration for payment operations
 * Tuned for PaymentIntents API reliability
 */
export const defaultRetryConfig: RetryConfig = {
  /**
   * Maximum number of retry attempts
   * Increased from 2 to 3 during v3 migration for better reliability
   */
  maxRetries: 3,
  
  /**
   * Initial delay before first retry (milliseconds)
   * Updated from 100ms to 200ms for PaymentIntents API
   */
  initialDelayMs: 200,
  
  /**
   * Maximum delay between retries (milliseconds)
   * Caps exponential backoff at 5 seconds
   */
  maxDelayMs: 5000,
  
  /**
   * Exponential backoff multiplier
   * Each retry waits 2x longer than previous
   */
  backoffMultiplier: 2,
  
  /**
   * Add random jitter to prevent thundering herd
   * Jitter is ±25% of the current delay
   */
  jitterFactor: 0.25,
};

/**
 * Idempotent retry configuration
 * Used for operations that are safe to retry multiple times
 */
export const idempotentRetryConfig: RetryConfig = {
  maxRetries: 5,
  initialDelayMs: 100,
  maxDelayMs: 10000,
  backoffMultiplier: 2,
  jitterFactor: 0.25,
};

/**
 * Calculate backoff delay with jitter
 */
export function calculateBackoffDelay(
  attempt: number,
  config: RetryConfig
): number {
  const exponentialDelay = Math.min(
    config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
    config.maxDelayMs
  );
  
  const jitterAmount = exponentialDelay * config.jitterFactor;
  const jitter = (Math.random() - 0.5) * 2 * jitterAmount;
  
  return Math.max(0, exponentialDelay + jitter);
}
