/**
 * Stripe Webhook Controller
 * Handles incoming webhook events from Stripe v3 PaymentIntents API
 * 
 * Routes:
 * POST /webhooks/stripe - Receive and process Stripe events
 * 
 * Event types handled:
 * - payment_intent.succeeded
 * - payment_intent.payment_failed
 * - payment_intent.canceled
 * - charge.refunded
 */

import { Request, Response, Router } from 'express';
import { validateWebhookSignature } from './signature-validator';
import { stripeConfig } from '../config/stripe-config';

const router = Router();

/**
 * Interface for Stripe webhook event
 */
interface StripeEvent {
  id: string;
  object: 'event';
  api_version: string;
  created: number;
  data: {
    object: any;
    previous_attributes?: any;
  };
  livemode: boolean;
  pending_webhooks: number;
  request: {
    id?: string;
    idempotency_key?: string;
  } | null;
  type: string;
}

/**
 * POST /webhooks/stripe
 * 
 * Receives webhook events from Stripe
 * 
 * This endpoint processes PaymentIntent events from Stripe v3 API:
 * - payment_intent.succeeded - Payment was successful
 * - payment_intent.payment_failed - Payment failed (e.g., card declined)
 * - payment_intent.canceled - Payment intent was canceled
 * - charge.refunded - Charge was refunded
 * 
 * The signature is validated using the webhook signing secret
 * configured in environment variables.
 * 
 * Request body: Raw JSON body from Stripe webhook
 * Header: stripe-signature containing timestamp and signature
 * 
 * Response: 200 OK with { received: true } on successful processing
 * 
 * Status codes:
 * 200 OK - Webhook processed successfully
 * 400 Bad Request - Invalid request body
 * 401 Unauthorized - Invalid webhook signature
 * 500 Internal Server Error - Processing error
 */
router.post('/webhooks/stripe', async (req: Request, res: Response) => {
  try {
    // Get the raw body (Express middleware should provide this)
    const body = req.body;
    const signature = req.headers['stripe-signature'] as string;

    if (!signature) {
      console.warn('Webhook request missing stripe-signature header');
      return res.status(401).json({
        error: 'Missing signature header',
      });
    }

    // Validate webhook signature
    let event: StripeEvent;
    try {
      event = validateWebhookSignature(body, signature, stripeConfig.webhookSecret);
    } catch (error) {
      console.warn('Webhook signature validation failed', {
        error: (error as Error).message,
      });
      return res.status(401).json({
        error: 'Invalid signature',
      });
    }

    console.info('Webhook event received', {
      eventId: event.id,
      eventType: event.type,
      timestamp: new Date(event.created * 1000).toISOString(),
    });

    // Process event based on type
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentIntentSucceeded(event);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event);
        break;

      case 'payment_intent.canceled':
        await handlePaymentIntentCanceled(event);
        break;

      case 'charge.refunded':
        await handleChargeRefunded(event);
        break;

      default:
        console.debug('Unhandled webhook event type', {
          eventType: event.type,
        });
    }

    // Always return 200 to acknowledge receipt
    res.status(200).json({ received: true });
  } catch (error) {
    console.error('Error processing webhook', error);
    // Still return 200 to prevent Stripe from retrying
    // (The event has been received and logged, even if processing failed)
    res.status(200).json({ received: true });
  }
});

/**
 * Handles payment_intent.succeeded event
 * Called when a PaymentIntent successfully completes
 */
async function handlePaymentIntentSucceeded(event: StripeEvent): Promise<void> {
  const paymentIntent = event.data.object;
  
  console.info('Payment succeeded', {
    paymentIntentId: paymentIntent.id,
    orderId: paymentIntent.metadata?.orderId,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
  });

  // TODO: Update order status in database to "paid"
  // TODO: Trigger order fulfillment workflow
  // TODO: Send confirmation email to customer
}

/**
 * Handles payment_intent.payment_failed event
 * Called when a PaymentIntent fails (e.g., card declined)
 */
async function handlePaymentIntentFailed(event: StripeEvent): Promise<void> {
  const paymentIntent = event.data.object;
  const lastPaymentError = paymentIntent.last_payment_error;

  console.warn('Payment failed', {
    paymentIntentId: paymentIntent.id,
    orderId: paymentIntent.metadata?.orderId,
    errorCode: lastPaymentError?.code,
    errorMessage: lastPaymentError?.message,
  });

  // TODO: Update order status in database to "payment_failed"
  // TODO: Notify customer of payment failure
  // TODO: Provide options to retry with different payment method
}

/**
 * Handles payment_intent.canceled event
 * Called when a PaymentIntent is canceled
 */
async function handlePaymentIntentCanceled(event: StripeEvent): Promise<void> {
  const paymentIntent = event.data.object;

  console.info('Payment intent canceled', {
    paymentIntentId: paymentIntent.id,
    orderId: paymentIntent.metadata?.orderId,
  });

  // TODO: Update order status in database to "canceled"
  // TODO: Release any reserved inventory
  // TODO: Send cancellation confirmation email
}

/**
 * Handles charge.refunded event
 * Called when a charge is refunded
 */
async function handleChargeRefunded(event: StripeEvent): Promise<void> {
  const charge = event.data.object;

  console.info('Charge refunded', {
    chargeId: charge.id,
    amount: charge.amount_refunded,
    currency: charge.currency,
  });

  // TODO: Update order status in database to "refunded"
  // TODO: Update inventory to account for return
  // TODO: Send refund notification email
}

export const webhookRouter = router;
