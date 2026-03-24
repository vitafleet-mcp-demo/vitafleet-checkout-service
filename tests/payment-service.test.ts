/**
 * Payment Service Unit Tests
 * 
 * NOTE: These tests intentionally do NOT cover error handling for v3 error codes.
 * The bug manifests when card_declined or insufficient_funds errors are returned,
 * but these test cases only test the happy path (successful payments).
 * 
 * This is realistic for a repo where the v3 migration happened quickly and
 * the error handling wasn't thoroughly tested before deployment.
 */

import { PaymentService } from '../src/payments/payment-service';
import { PaymentMethodType, PaymentIntentStatus } from '../src/models/payment-intent';

// Mock the Stripe client
jest.mock('../src/payments/stripe-client', () => ({
  stripeClient: {
    createPaymentIntent: jest.fn(),
    confirmPaymentIntent: jest.fn(),
    retrievePaymentIntent: jest.fn(),
    cancelPaymentIntent: jest.fn(),
  },
}));

import { stripeClient } from '../src/payments/stripe-client';

describe('PaymentService', () => {
  let paymentService: PaymentService;

  beforeEach(() => {
    paymentService = new PaymentService();
    jest.clearAllMocks();
  });

  describe('processPayment', () => {
    it('should successfully process a payment and return payment intent ID', async () => {
      // Arrange
      const mockPaymentIntent = {
        id: 'pi_test123',
        object: 'payment_intent',
        amount: 10000,
        currency: 'usd',
        status: PaymentIntentStatus.Succeeded,
        confirmation_method: 'manual' as const,
        confirm: true,
        metadata: {},
        created: Math.floor(Date.now() / 1000),
        client_secret: 'pi_test123_secret',
      };

      (stripeClient.createPaymentIntent as jest.Mock).mockResolvedValue(
        mockPaymentIntent
      );
      (stripeClient.confirmPaymentIntent as jest.Mock).mockResolvedValue(
        mockPaymentIntent
      );

      const request = {
        orderId: 'order_123',
        customerId: 'cust_456',
        customerEmail: 'test@vitafleet.com',
        amountCents: 10000,
        currency: 'usd',
        paymentMethodType: PaymentMethodType.Card,
        paymentMethodId: 'pm_test789',
        description: 'VitaFleet Order #123',
      };

      // Act
      const result = await paymentService.processPayment(request);

      // Assert
      expect(result.success).toBe(true);
      expect(result.paymentIntentId).toBe('pi_test123');
      expect(result.status).toBe(PaymentIntentStatus.Succeeded);
      expect(result.clientSecret).toBe('pi_test123_secret');
      expect(stripeClient.createPaymentIntent).toHaveBeenCalledWith(
        expect.objectContaining({
          orderId: 'order_123',
          amountCents: 10000,
        })
      );
    });

    it('should handle payment that requires action (3D Secure)', async () => {
      // Arrange
      const mockPaymentIntent = {
        id: 'pi_test456',
        object: 'payment_intent',
        amount: 10000,
        currency: 'usd',
        status: PaymentIntentStatus.RequiresAction,
        confirmation_method: 'manual' as const,
        confirm: false,
        metadata: {},
        created: Math.floor(Date.now() / 1000),
        client_secret: 'pi_test456_secret',
      };

      (stripeClient.createPaymentIntent as jest.Mock).mockResolvedValue(
        mockPaymentIntent
      );

      const request = {
        orderId: 'order_456',
        customerId: 'cust_789',
        customerEmail: 'test2@vitafleet.com',
        amountCents: 10000,
        currency: 'usd',
        paymentMethodType: PaymentMethodType.Card,
        description: 'VitaFleet Order #456',
      };

      // Act
      const result = await paymentService.processPayment(request);

      // Assert
      expect(result.success).toBe(false); // Requires action means not immediately successful
      expect(result.requiresAction).toBe(true);
      expect(result.clientSecret).toBe('pi_test456_secret');
    });

    /**
     * MISSING TEST CASE: This test is intentionally NOT included
     * 
     * The following test case SHOULD exist but doesn't:
     * - processPayment handles card_declined error correctly (returns 402 Payment Required)
     * - processPayment handles insufficient_funds error correctly (returns 402 Payment Required)
     * - processPayment handles expired_card error correctly
     * - etc.
     * 
     * The absence of these tests is why the bug in error-handler.ts wasn't caught
     * before deployment. The error handling code was removed during v3 migration,
     * but there were no tests to verify the mapping still worked.
     */
  });

  describe('getPaymentStatus', () => {
    it('should retrieve payment status successfully', async () => {
      // Arrange
      const mockPaymentIntent = {
        id: 'pi_test789',
        object: 'payment_intent',
        amount: 10000,
        currency: 'usd',
        status: PaymentIntentStatus.Succeeded,
        confirmation_method: 'manual' as const,
        confirm: true,
        metadata: {},
        created: Math.floor(Date.now() / 1000),
      };

      (stripeClient.retrievePaymentIntent as jest.Mock).mockResolvedValue(
        mockPaymentIntent
      );

      // Act
      const result = await paymentService.getPaymentStatus('pi_test789');

      // Assert
      expect(result.success).toBe(true);
      expect(result.paymentIntentId).toBe('pi_test789');
      expect(result.status).toBe(PaymentIntentStatus.Succeeded);
    });
  });

  describe('cancelPayment', () => {
    it('should cancel a payment intent', async () => {
      // Arrange
      const mockPaymentIntent = {
        id: 'pi_cancel123',
        object: 'payment_intent',
        amount: 10000,
        currency: 'usd',
        status: PaymentIntentStatus.Canceled,
        confirmation_method: 'manual' as const,
        confirm: false,
        metadata: {},
        created: Math.floor(Date.now() / 1000),
      };

      (stripeClient.cancelPaymentIntent as jest.Mock).mockResolvedValue(
        mockPaymentIntent
      );

      // Act
      const result = await paymentService.cancelPayment('pi_cancel123');

      // Assert
      expect(result.success).toBe(true);
      expect(result.status).toBe(PaymentIntentStatus.Canceled);
    });
  });

  describe('createCheckoutSession', () => {
    it('should create a checkout session with correct totals', () => {
      // Arrange
      const request = {
        customerId: 'cust_123',
        customerEmail: 'customer@vitafleet.com',
        customerName: 'John Doe',
        items: [
          {
            sku: 'PROD_001',
            name: 'Premium Subscription',
            quantity: 1,
            priceCents: 9999,
            taxCents: 0,
            totalCents: 9999,
          },
        ],
        taxCents: 1000,
        feeCents: 0,
        currency: 'usd',
      };

      // Act
      const session = paymentService.createCheckoutSession(request);

      // Assert
      expect(session.customerId).toBe('cust_123');
      expect(session.customerEmail).toBe('customer@vitafleet.com');
      expect(session.subtotalCents).toBe(9999);
      expect(session.taxCents).toBe(1000);
      expect(session.totalCents).toBe(10999);
      expect(session.status).toBe('open');
      expect(session.failureCount).toBe(0);
    });
  });
});
