# VitaFleet Checkout Service

[![Build Status](https://img.shields.io/badge/status-active-brightgreen)](https://github.com/vitafleet-mcp-demo/vitafleet-checkout-service)
[![Stripe API](https://img.shields.io/badge/stripe-v3-blue)](https://stripe.com/docs/api)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/typescript-5.0-blue)](https://www.typescriptlang.org)

A production-ready payment processing service for **VitaFleet**, a fictional e-commerce platform. This service handles secure payment processing using the Stripe v3 PaymentIntents API.

## Overview

**VitaFleet** is a leading e-commerce platform specializing in fleet management and logistics services. The checkout service is responsible for:

- Processing customer payments via credit cards, debit cards, and alternative payment methods
- Creating and managing Stripe PaymentIntents for secure payment handling
- Handling payment webhooks from Stripe
- Providing payment status tracking and cancellation capabilities
- Implementing retry logic with exponential backoff for resilient payment processing

## Architecture

```
vitafleet-checkout-service/
├── src/
│   ├── payments/                 # Payment processing logic
│   │   ├── payment-controller.ts # Express routes for /api/checkout/payment
│   │   ├── payment-service.ts    # Core payment business logic
│   │   ├── stripe-client.ts      # Stripe API client wrapper
│   │   └── error-handler.ts      # Error code mapping (⚠️ HAS KNOWN BUG)
│   │
│   ├── webhooks/                 # Stripe webhook handling
│   │   ├── webhook-controller.ts # Express routes for /webhooks/stripe
│   │   └── signature-validator.ts # HMAC-SHA256 signature verification
│   │
│   ├── models/                   # TypeScript interfaces and types
│   │   ├── payment-intent.ts     # PaymentIntent types
│   │   ├── checkout-session.ts   # Checkout session types
│   │   └── error-codes.ts        # Error code enumerations
│   │
│   ├── config/                   # Configuration
│   │   ├── stripe-config.ts      # Stripe API configuration
│   │   └── retry-config.ts       # Retry/backoff configuration
│   │
│   └── index.ts                  # Main application entry point
│
├── tests/                        # Unit and integration tests
│   ├── payment-service.test.ts
│   └── webhook-controller.test.ts
│
├── package.json
├── tsconfig.json
├── jest.config.js
└── README.md (this file)
```

## Key Features

### ✅ Payment Processing
- Create Stripe PaymentIntents for new payments
- Confirm payments with customer payment methods
- Handle automatic and manual confirmation flows
- Support for multiple payment method types (cards, ACH, Apple Pay, Google Pay)

### ✅ Webhook Handling
- Receive and process Stripe webhook events
- Validate webhook signatures using HMAC-SHA256
- Handle key events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`
- Protect against replay attacks with timestamp validation

### ✅ Resilience
- Automatic retry logic with exponential backoff
- Configurable retry parameters
- Jitter to prevent thundering herd
- Support for idempotent operations

### ✅ Error Handling
- Comprehensive error code mapping from Stripe to VitaFleet responses
- HTTP status codes aligned with error types (402 for payment failures, 429 for rate limits, etc.)
- User-facing error messages vs. internal logging

## Recent Changes - v2.0.0

### Stripe v2 → v3 Migration (PR #1)
In v2.0.0, we migrated from the Stripe Charges API (v2) to the PaymentIntents API (v3):

**Changes:**
- ✅ Replaced `charges.create()` with `paymentIntents.create()` and `paymentIntents.confirm()`
- ✅ Updated webhook handling for v3 event structure
- ✅ Implemented client secret flow for frontend payment confirmation
- ✅ Enhanced retry configuration for improved reliability

**Known Issues:**
- ⚠️ **CRITICAL BUG**: Error handling for Stripe v3 error codes is incomplete
  - See [Error Handling Bug](#error-handling-bug) section below

## API Endpoints

### POST `/api/checkout/payment`

Process a payment for a customer checkout.

**Request:**
```json
{
  "orderId": "order_abc123",
  "customerId": "cust_xyz789",
  "customerEmail": "customer@example.com",
  "amountCents": 10000,
  "currency": "usd",
  "paymentMethodType": "card",
  "paymentMethodId": "pm_card_visa",
  "description": "Order #123 - Premium Subscription",
  "returnUrl": "https://example.com/checkout/confirm"
}
```

**Response (Success):**
```json
{
  "success": true,
  "paymentIntentId": "pi_1234567890",
  "status": "succeeded",
  "clientSecret": "pi_1234567890_secret_abcdef",
  "requiresAction": false
}
```

**Response (Error):**
```json
{
  "success": false,
  "error": {
    "code": "PAYMENT_DECLINED",
    "message": "Your card was declined",
    "type": "card_error"
  }
}
```

**Status Codes:**
- `200 OK` - Payment processed (success or client error like declined card)
- `400 Bad Request` - Invalid request parameters
- `429 Too Many Requests` - Rate limited by Stripe
- `500 Internal Server Error` - Server error (or incorrectly returned for card errors - see bug)
- `502 Bad Gateway` - Stripe API unavailable

### GET `/api/checkout/payment/:paymentIntentId`

Retrieve the current status of a payment.

**Response:**
```json
{
  "success": true,
  "paymentIntentId": "pi_1234567890",
  "status": "succeeded"
}
```

### POST `/api/checkout/payment/:paymentIntentId/cancel`

Cancel a pending payment intent.

**Response:**
```json
{
  "success": true,
  "paymentIntentId": "pi_1234567890",
  "status": "canceled"
}
```

### POST `/webhooks/stripe`

Receive webhook events from Stripe (requires valid signature).

**Headers:**
- `stripe-signature`: Stripe signature header containing timestamp and HMAC-SHA256 signature

**Handled Events:**
- `payment_intent.succeeded` - Payment completed successfully
- `payment_intent.payment_failed` - Payment failed (card declined, insufficient funds, etc.)
- `payment_intent.canceled` - Payment intent was canceled
- `charge.refunded` - Charge was refunded

## Error Handling Bug

### Issue Description

After the Stripe v2 → v3 migration (PR #1), error handling for common card errors is broken.

**Affected Error Codes:**
- `card_declined` - Card was declined by issuer
- `insufficient_funds` - Card has insufficient funds
- `expired_card` - Card has expired
- `incorrect_cvc` - CVC verification failed
- And other v3-specific error codes

**Root Cause:**
In `src/payments/error-handler.ts`, the old v2 Charges API error handling code was removed during migration, but the v3 PaymentIntents API error codes were never properly mapped. This causes:

1. Stripe returns a v3 error code like `card_declined` 
2. `error-handler.ts` tries to map it but falls through to the default case
3. The function returns `PAYMENT_PROCESSING_ERROR` (500 status code)
4. Client receives a 500 error instead of 402 (Payment Required)

**Example:**
```typescript
// In error-handler.ts, the card_declined case is broken:
case StripeV3ErrorCode.CardDeclined:
case StripeV3ErrorCode.InsufficientFunds:
  // ... these cases don't have mappings
  break; // Falls through!

default:
  // Everything unmapped hits here
  return VitaFleetErrorCode.PaymentProcessingError; // ❌ Wrong status code
```

**Impact:**
- Customers see cryptic "500 Internal Server Error" messages instead of "Your card was declined"
- Support team can't distinguish between payment failures and actual server errors
- Monitoring/alerting incorrectly treats payment declines as critical incidents

**Fix:**
Map Stripe v3 error codes properly in `error-handler.ts`:
```typescript
case StripeV3ErrorCode.CardDeclined:
case StripeV3ErrorCode.InsufficientFunds:
case StripeV3ErrorCode.ExpiredCard:
  return VitaFleetErrorCode.PaymentFailed; // ✅ Returns 402 status
```

## Configuration

### Environment Variables

```bash
# Stripe API credentials
STRIPE_API_KEY=sk_live_xxx...
STRIPE_WEBHOOK_SECRET=whsec_xxx...

# Server configuration
PORT=3000
NODE_ENV=production
```

### Retry Configuration

Configured in `src/config/retry-config.ts`:

```typescript
{
  maxRetries: 3,           // Max 3 retry attempts
  initialDelayMs: 200,     // Start with 200ms delay
  maxDelayMs: 5000,        // Cap at 5 seconds
  backoffMultiplier: 2,    // Exponential backoff (2x)
  jitterFactor: 0.25       // ±25% jitter
}
```

## Testing

Run the test suite:

```bash
npm test                 # Run all tests
npm run test:watch      # Run in watch mode
```

**Note:** Current test coverage does NOT include v3 error code handling, which is why the bug wasn't caught before deployment.

## Development

### Setup

```bash
npm install
npm run build
npm run dev
```

### Type Checking

```bash
npx tsc --noEmit
```

### Linting

```bash
npm run lint
```

## Security Considerations

### Webhook Signature Validation
- All incoming webhooks are verified using HMAC-SHA256
- Signatures must be less than 5 minutes old to prevent replay attacks
- Constant-time comparison used to prevent timing attacks

### API Keys
- Stripe API key should only be used server-side
- Never expose the key in client-side code or logs
- Rotate keys regularly in production

### Error Messages
- Sensitive information (full error messages from Stripe) is not exposed to clients
- Only user-facing error messages are returned in API responses
- Full error details are logged server-side for debugging

## Deployment

### Production Checklist

- [ ] Set production Stripe API keys in environment
- [ ] Enable HTTPS for all connections
- [ ] Configure webhook endpoints in Stripe Dashboard
- [ ] Set up monitoring and alerting for 500+ errors
- [ ] Configure log aggregation
- [ ] Set up database for order/payment persistence
- [ ] Review error handling code (especially `error-handler.ts`)
- [ ] Add comprehensive tests for error scenarios

## Monitoring & Observability

### Key Metrics to Track
- Payment success rate
- Average payment processing time
- Webhook processing latency
- Error rates by error code
- Retry success rate

### Logging
- All payment operations logged at INFO level
- Errors logged at ERROR level with full context
- Webhook events logged for audit trail

## Support & Documentation

- **Issue Tracker:** https://github.com/vitafleet-mcp-demo/vitafleet-checkout-service/issues
- **Stripe Docs:** https://stripe.com/docs/api
- **Internal Wiki:** [VitaFleet Engineering Docs]

## License

MIT License - See LICENSE file for details

---

**Last Updated:** March 24, 2026
**Maintainer:** VitaFleet Engineering Team
**Status:** Production (with known v2→v3 migration bug in error handling)
