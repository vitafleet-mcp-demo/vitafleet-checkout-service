/**
 * Stripe API Configuration
 * Version: 3.x (PaymentIntents API)
 * 
 * Migration from Stripe Charges API (v2) to PaymentIntents API (v3) completed in PR #1
 */

export const stripeConfig = {
  /**
   * API Key for Stripe v3 PaymentIntents API
   * Should be loaded from environment variables
   */
  apiKey: process.env.STRIPE_API_KEY || '',
  
  /**
   * Webhook signing secret for Stripe events
   * Should be loaded from environment variables
   */
  webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
  
  /**
   * API version string for requests
   * Stripe v3 uses the PaymentIntents API
   */
  apiVersion: '2023-10-16',
  
  /**
   * Timeout for Stripe API calls (milliseconds)
   */
  timeout: 30000,
  
  /**
   * Current API major version
   * Updated from v2 (Charges API) to v3 (PaymentIntents API)
   */
  majorVersion: 3,
  
  /**
   * Feature flags for API capabilities
   */
  features: {
    /**
     * PaymentIntents API is the primary payment method
     * Charges API (v2) is no longer used
     */
    usePaymentIntents: true,
    chargesApiDeprecated: true,
    
    /**
     * Webhook signature validation using Endpoint Secret
     */
    validateWebhookSignature: true,
  },
};

export type StripeConfig = typeof stripeConfig;
