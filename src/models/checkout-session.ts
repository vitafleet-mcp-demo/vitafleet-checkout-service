/**
 * Checkout Session Model
 * Represents a customer's checkout session in VitaFleet
 */

import { PaymentIntentStatus, PaymentMethodType } from './payment-intent';

/**
 * Checkout session status
 */
export enum CheckoutSessionStatus {
  Open = 'open',
  InProgress = 'in_progress',
  Complete = 'complete',
  Expired = 'expired',
  Failed = 'failed',
}

/**
 * Represents a customer checkout session
 */
export interface CheckoutSession {
  // Session identification
  sessionId: string;
  orderId: string;
  customerId: string;
  
  // Customer contact
  customerEmail: string;
  customerName?: string;
  
  // Cart contents
  items: CartItem[];
  subtotalCents: number;
  taxCents: number;
  feeCents: number;
  totalCents: number;
  currency: string;
  
  // Shipping
  shippingAddressId?: string;
  shippingMethod?: string;
  
  // Billing
  billingAddressId?: string;
  
  // Payment state
  status: CheckoutSessionStatus;
  paymentMethodType?: PaymentMethodType;
  stripePaymentIntentId?: string;
  paymentIntentStatus?: PaymentIntentStatus;
  paymentMethodId?: string;
  
  // Session lifecycle
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
  completedAt?: Date;
  
  // Failure tracking
  failureReason?: string;
  failureCount: number;
  lastFailureTime?: Date;
  
  // Metadata
  userAgent?: string;
  ipAddress?: string;
  referrer?: string;
}

/**
 * Item in a checkout session
 */
export interface CartItem {
  sku: string;
  name: string;
  quantity: number;
  priceCents: number;
  taxCents: number;
  totalCents: number;
}

/**
 * Checkout session creation request
 */
export interface CreateCheckoutSessionRequest {
  customerId: string;
  customerEmail: string;
  customerName?: string;
  items: CartItem[];
  shippingMethod?: string;
  taxCents: number;
  feeCents?: number;
  currency: string;
  returnUrl?: string;
}

/**
 * Payment attempt tracking
 */
export interface PaymentAttempt {
  attemptId: string;
  sessionId: string;
  paymentIntentId: string;
  paymentMethodType: PaymentMethodType;
  amountCents: number;
  status: 'pending' | 'succeeded' | 'failed';
  errorCode?: string;
  errorMessage?: string;
  createdAt: Date;
  completedAt?: Date;
}
