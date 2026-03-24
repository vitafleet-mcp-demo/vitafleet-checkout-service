/**
 * PaymentIntent Model and Types
 * Represents Stripe v3 PaymentIntents API objects
 */

/**
 * Status of a PaymentIntent
 * @see https://stripe.com/docs/api/payment_intents/object#payment_intent_object-status
 */
export enum PaymentIntentStatus {
  RequiresPaymentMethod = 'requires_payment_method',
  RequiresConfirmation = 'requires_confirmation',
  RequiresAction = 'requires_action',
  Processing = 'processing',
  RequiresCapture = 'requires_capture',
  Canceled = 'canceled',
  Succeeded = 'succeeded',
}

/**
 * Payment method types supported by VitaFleet
 */
export enum PaymentMethodType {
  Card = 'card',
  ACHDebit = 'us_bank_account',
  ApplePay = 'apple_pay',
  GooglePay = 'google_pay',
}

/**
 * Stripe PaymentIntent object (simplified)
 * Contains essential fields for VitaFleet's payment processing
 */
export interface StripePaymentIntent {
  id: string;
  object: 'payment_intent';
  
  // Amount and currency
  amount: number;
  currency: string;
  
  // Status
  status: PaymentIntentStatus;
  
  // Customer and metadata
  customer?: string;
  metadata?: Record<string, string>;
  description?: string;
  
  // Payment method
  payment_method?: string;
  
  // Confirmation
  confirmation_method: 'automatic' | 'manual';
  confirm: boolean;
  
  // Return URLs for 3D Secure
  return_url?: string;
  
  // Charge reference
  charges?: {
    object: 'list';
    data: Array<{
      id: string;
      payment_method_details?: {
        card?: {
          brand?: string;
          last4?: string;
        };
      };
    }>;
  };
  
  // Timestamps
  created: number;
  
  // Client secret for frontend
  client_secret?: string;
}

/**
 * VitaFleet internal PaymentSession
 * Represents a checkout session with payment processing state
 */
export interface PaymentSession {
  sessionId: string;
  orderId: string;
  
  // Customer info
  customerId?: string;
  customerEmail: string;
  
  // Amount
  amountCents: number;
  currency: string;
  
  // Stripe payment intent
  stripePaymentIntentId?: string;
  paymentIntentStatus?: PaymentIntentStatus;
  
  // Payment method
  paymentMethodType?: PaymentMethodType;
  paymentMethodId?: string;
  
  // Cart details
  itemCount: number;
  description: string;
  
  // Session state
  status: 'pending' | 'processing' | 'succeeded' | 'failed' | 'canceled';
  
  // Error tracking
  lastError?: {
    code: string;
    message: string;
    timestamp: Date;
  };
  
  // Timestamps
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

/**
 * Request payload for creating a payment intent
 */
export interface CreatePaymentIntentRequest {
  orderId: string;
  customerId?: string;
  customerEmail: string;
  amountCents: number;
  currency: string;
  paymentMethodType: PaymentMethodType;
  paymentMethodId?: string;
  description: string;
  metadata?: Record<string, string>;
  returnUrl?: string;
}

/**
 * Response from payment processing
 */
export interface PaymentProcessingResponse {
  success: boolean;
  paymentIntentId?: string;
  status?: PaymentIntentStatus;
  clientSecret?: string;
  requiresAction?: boolean;
  error?: {
    code: string;
    message: string;
    type: string;
  };
}
