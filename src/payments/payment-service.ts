/**
 * Payment Service
 * Core business logic for payment processing
 * 
 * Handles the v3 PaymentIntents API workflow
 * Updated in PR #1 to remove v2 Charges API logic
 */

import { stripeClient } from './stripe-client';
import { handleStripeError, handlePaymentError, isRetryableError } from './error-handler';
import {
  CreatePaymentIntentRequest,
  PaymentProcessingResponse,
  PaymentIntentStatus,
} from '../models/payment-intent';
import { CreateCheckoutSessionRequest, CheckoutSession, CheckoutSessionStatus } from '../models/checkout-session';
import { defaultRetryConfig, calculateBackoffDelay } from '../config/retry-config';

/**
 * VitaFleet Payment Service
 * Orchestrates payment processing using Stripe v3 PaymentIntents API
 */
export class PaymentService {
  /**
   * Process a payment for a checkout session
   * 
   * This is the main entry point for payment processing.
   * For v3 PaymentIntents, this:
   * 1. Creates a PaymentIntent
   * 2. Confirms the intent with a payment method
   * 3. Handles the result with proper error mapping
   * 
   * @param request - Payment intent creation request
   * @returns Processing response with status and client secret
   */
  async processPayment(
    request: CreatePaymentIntentRequest
  ): Promise<PaymentProcessingResponse> {
    try {
      console.info('Processing payment for order', {
        orderId: request.orderId,
        amount: request.amountCents,
      });

      // Step 1: Create PaymentIntent
      const paymentIntent = await stripeClient.createPaymentIntent(request);

      console.debug('PaymentIntent created', {
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      });

      // Step 2: Confirm the PaymentIntent with payment method
      let confirmedIntent = paymentIntent;
      
      if (request.paymentMethodId) {
        confirmedIntent = await this.confirmPaymentWithRetry(
          paymentIntent.id,
          request.paymentMethodId
        );
      }

      console.info('Payment processed successfully', {
        orderId: request.orderId,
        paymentIntentId: confirmedIntent.id,
        status: confirmedIntent.status,
      });

      // Step 3: Return response
      return {
        success: confirmedIntent.status === PaymentIntentStatus.Succeeded,
        paymentIntentId: confirmedIntent.id,
        status: confirmedIntent.status,
        clientSecret: confirmedIntent.client_secret,
        requiresAction: confirmedIntent.status === PaymentIntentStatus.RequiresAction,
      };
    } catch (error) {
      // This is where the bug manifests:
      // When Stripe v3 returns a card_declined or insufficient_funds error,
      // handlePaymentError() maps it incorrectly, resulting in a 500 error
      // instead of the appropriate 402 status code
      const errorResponse = handlePaymentError(error, {
        orderId: request.orderId,
      });

      return {
        success: false,
        error: {
          code: errorResponse.error.code,
          message: errorResponse.error.message,
          type: errorResponse.error.category,
        },
      };
    }
  }

  /**
   * Confirm a payment intent with retry logic
   * 
   * Uses exponential backoff with jitter for transient failures
   * 
   * @param paymentIntentId - ID of the PaymentIntent
   * @param paymentMethodId - Payment method to confirm with
   * @returns Confirmed PaymentIntent
   */
  private async confirmPaymentWithRetry(
    paymentIntentId: string,
    paymentMethodId: string,
    attempt: number = 0
  ): Promise<any> {
    try {
      return await stripeClient.confirmPaymentIntent(
        paymentIntentId,
        paymentMethodId
      );
    } catch (error) {
      const stripeError = error as any;
      const errorCode = stripeError.code || 'unknown';

      // Check if we should retry
      if (
        isRetryableError(errorCode) &&
        attempt < defaultRetryConfig.maxRetries
      ) {
        const delayMs = calculateBackoffDelay(attempt, defaultRetryConfig);
        console.warn('Retrying payment confirmation', {
          paymentIntentId,
          errorCode,
          attempt: attempt + 1,
          delayMs,
        });

        await this.sleep(delayMs);
        return this.confirmPaymentWithRetry(
          paymentIntentId,
          paymentMethodId,
          attempt + 1
        );
      }

      // If not retryable or out of retries, throw
      throw error;
    }
  }

  /**
   * Retrieve payment intent status
   * 
   * @param paymentIntentId - ID of the PaymentIntent
   * @returns PaymentIntent object
   */
  async getPaymentStatus(paymentIntentId: string): Promise<PaymentProcessingResponse> {
    try {
      const paymentIntent = await stripeClient.retrievePaymentIntent(paymentIntentId);

      return {
        success: paymentIntent.status === PaymentIntentStatus.Succeeded,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      };
    } catch (error) {
      const errorResponse = handlePaymentError(error, {
        paymentIntentId,
      });

      return {
        success: false,
        error: {
          code: errorResponse.error.code,
          message: errorResponse.error.message,
          type: errorResponse.error.category,
        },
      };
    }
  }

  /**
   * Cancel a payment intent
   * 
   * Used when customer abandons checkout or merchant needs to cancel
   * 
   * @param paymentIntentId - ID of the PaymentIntent to cancel
   * @returns Canceled PaymentIntent
   */
  async cancelPayment(paymentIntentId: string): Promise<PaymentProcessingResponse> {
    try {
      const paymentIntent = await stripeClient.cancelPaymentIntent(paymentIntentId);

      return {
        success: true,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
      };
    } catch (error) {
      const errorResponse = handlePaymentError(error, {
        paymentIntentId,
      });

      return {
        success: false,
        error: {
          code: errorResponse.error.code,
          message: errorResponse.error.message,
          type: errorResponse.error.category,
        },
      };
    }
  }

  /**
   * Create a checkout session
   * 
   * @param request - Checkout session creation request
   * @returns New checkout session
   */
  createCheckoutSession(
    request: CreateCheckoutSessionRequest
  ): CheckoutSession {
    const now = new Date();
    const sessionId = `cs_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Calculate totals
    const subtotal = request.items.reduce((sum, item) => sum + item.totalCents, 0);
    const total = subtotal + request.taxCents + (request.feeCents || 0);

    const session: CheckoutSession = {
      sessionId,
      orderId: `order_${Date.now()}`,
      customerId: request.customerId,
      customerEmail: request.customerEmail,
      customerName: request.customerName,
      items: request.items,
      subtotalCents: subtotal,
      taxCents: request.taxCents,
      feeCents: request.feeCents || 0,
      totalCents: total,
      currency: request.currency,
      status: CheckoutSessionStatus.Open,
      failureCount: 0,
      createdAt: now,
      updatedAt: now,
      expiresAt: new Date(now.getTime() + 30 * 60 * 1000), // 30 minute expiry
    };

    console.info('Checkout session created', {
      sessionId: session.sessionId,
      customerId: request.customerId,
      totalCents: total,
    });

    return session;
  }

  /**
   * Sleep utility for retry delays
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Export singleton instance
export const paymentService = new PaymentService();
