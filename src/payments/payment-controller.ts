/**
 * Payment Controller
 * Express.js HTTP request handlers for payment endpoints
 * 
 * Routes:
 * POST /api/checkout/payment - Process a payment
 * GET /api/checkout/payment/:paymentIntentId - Get payment status
 * POST /api/checkout/payment/:paymentIntentId/cancel - Cancel a payment
 */

import { Request, Response, Router } from 'express';
import { paymentService } from './payment-service';
import { PaymentMethodType, CreatePaymentIntentRequest } from '../models/payment-intent';
import { ErrorStatusCodes } from '../models/error-codes';

const router = Router();

/**
 * POST /api/checkout/payment
 * 
 * Process a payment for a checkout order
 * 
 * Request body:
 * {
 *   orderId: string
 *   customerId: string (optional)
 *   customerEmail: string
 *   amountCents: number
 *   currency: string
 *   paymentMethodType: 'card' | 'us_bank_account' | 'apple_pay' | 'google_pay'
 *   paymentMethodId: string (optional, required for immediate confirmation)
 *   description: string
 *   returnUrl: string (optional)
 * }
 * 
 * Response on success:
 * {
 *   success: true
 *   paymentIntentId: string
 *   status: 'succeeded' | 'processing' | 'requires_action' | ...
 *   clientSecret: string (for frontend handling)
 *   requiresAction: boolean
 * }
 * 
 * Response on error:
 * {
 *   success: false
 *   error: {
 *     code: string (VitaFleet error code)
 *     message: string
 *     type: string (error category)
 *   }
 * }
 * 
 * Status codes:
 * 200 OK - Payment processed (success or client error like declined card)
 * 400 Bad Request - Invalid input
 * 429 Too Many Requests - Rate limited
 * 500 Internal Server Error - Server error (OR INCORRECTLY RETURNED FOR CARD ERRORS - THE BUG)
 * 502 Bad Gateway - Stripe API unavailable
 */
router.post('/api/checkout/payment', async (req: Request, res: Response) => {
  try {
    // Validate request body
    const {
      orderId,
      customerId,
      customerEmail,
      amountCents,
      currency,
      paymentMethodType,
      paymentMethodId,
      description,
      returnUrl,
      metadata,
    } = req.body;

    // Basic validation
    if (!orderId || !customerEmail || !amountCents || !currency) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_REQUEST',
          message: 'Missing required fields: orderId, customerEmail, amountCents, currency',
        },
      });
    }

    if (!Object.values(PaymentMethodType).includes(paymentMethodType)) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'INVALID_PAYMENT_METHOD',
          message: `Invalid payment method type: ${paymentMethodType}`,
        },
      });
    }

    // Create payment intent request
    const paymentRequest: CreatePaymentIntentRequest = {
      orderId,
      customerId,
      customerEmail,
      amountCents,
      currency,
      paymentMethodType,
      paymentMethodId,
      description,
      returnUrl,
      metadata,
    };

    // Process payment
    const result = await paymentService.processPayment(paymentRequest);

    // Determine response status code
    let statusCode = 200;
    if (!result.success && result.error) {
      // THIS IS WHERE THE BUG MANIFESTS:
      // When error codes like 'card_declined' or 'insufficient_funds' are returned
      // from the error handler, they fall through to the default case and return
      // PAYMENT_PROCESSING_ERROR with a 500 status code.
      // 
      // For example:
      // - card_declined should return 402 (Payment Required)
      // - insufficient_funds should return 402 (Payment Required)
      // - But instead, they return 500 (Internal Server Error)
      statusCode =
        ErrorStatusCodes[result.error.code as any] || 500;
    }

    res.status(statusCode).json(result);
  } catch (error) {
    console.error('Unexpected error in payment controller', error);
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: 'An unexpected error occurred processing your payment',
      },
    });
  }
});

/**
 * GET /api/checkout/payment/:paymentIntentId
 * 
 * Get the current status of a payment intent
 * 
 * Response:
 * {
 *   success: boolean
 *   paymentIntentId: string
 *   status: string
 *   error?: {...}
 * }
 */
router.get(
  '/api/checkout/payment/:paymentIntentId',
  async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'paymentIntentId is required',
          },
        });
      }

      const result = await paymentService.getPaymentStatus(paymentIntentId);
      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error('Error retrieving payment status', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error retrieving payment status',
        },
      });
    }
  }
);

/**
 * POST /api/checkout/payment/:paymentIntentId/cancel
 * 
 * Cancel a pending payment intent
 * 
 * Response:
 * {
 *   success: boolean
 *   paymentIntentId: string
 *   status: string
 *   error?: {...}
 * }
 */
router.post(
  '/api/checkout/payment/:paymentIntentId/cancel',
  async (req: Request, res: Response) => {
    try {
      const { paymentIntentId } = req.params;

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'INVALID_REQUEST',
            message: 'paymentIntentId is required',
          },
        });
      }

      const result = await paymentService.cancelPayment(paymentIntentId);
      res.status(result.success ? 200 : 500).json(result);
    } catch (error) {
      console.error('Error canceling payment', error);
      res.status(500).json({
        success: false,
        error: {
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Error canceling payment',
        },
      });
    }
  }
);

export const paymentRouter = router;
