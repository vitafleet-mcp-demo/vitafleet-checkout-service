# VitaFleet Checkout Service - Complete File Structure

This document provides an overview of all files created for the VitaFleet Checkout Service demo repository.

## Directory Tree

```
vitafleet-checkout-service/
├── src/
│   ├── config/
│   │   ├── retry-config.ts           # Retry logic configuration with exponential backoff
│   │   └── stripe-config.ts          # Stripe API v3 configuration
│   │
│   ├── models/
│   │   ├── checkout-session.ts       # CheckoutSession types and PaymentAttempt tracking
│   │   ├── error-codes.ts            # Error code enums (v2, v3, VitaFleet) - HAS v3 CODES DEFINED
│   │   └── payment-intent.ts         # PaymentIntent types and request/response models
│   │
│   ├── payments/
│   │   ├── error-handler.ts          # ⚠️ THE BUG: Incomplete v3 error code mapping
│   │   ├── payment-controller.ts     # Express routes for /api/checkout/payment
│   │   ├── payment-service.ts        # Core payment processing logic
│   │   └── stripe-client.ts          # Stripe API client wrapper (v3 PaymentIntents)
│   │
│   ├── webhooks/
│   │   ├── signature-validator.ts    # HMAC-SHA256 webhook signature validation
│   │   └── webhook-controller.ts     # Express routes for /webhooks/stripe
│   │
│   └── index.ts                      # Main application entry point
│
├── tests/
│   ├── payment-service.test.ts       # Tests happy path only (NO error path tests)
│   └── webhook-controller.test.ts    # Webhook signature validation tests
│
├── .env.example                      # Environment variable template
├── .gitignore                        # Git ignore rules
├── jest.config.js                    # Jest test configuration
├── LICENSE                           # MIT License
├── package.json                      # NPM dependencies and scripts
├── tsconfig.json                     # TypeScript compiler configuration
├── README.md                         # Complete documentation
├── INCIDENT.md                       # Post-mortem incident analysis (THE DEMO NARRATIVE)
└── STRUCTURE.md                      # This file

```

## Key Files for the Demo Narrative

### The Bug: `src/payments/error-handler.ts`

**Lines 56-110:** The incomplete error mapping function that demonstrates the bug:

```typescript
function mapStripeErrorCodeToVitaFleet(stripeErrorCode: string): VitaFleetErrorCode {
  switch (stripeErrorCode) {
    // ISSUE: These cases defined but have no return statement
    case StripeV3ErrorCode.CardDeclined:
    case StripeV3ErrorCode.InsufficientFunds:
    case StripeV3ErrorCode.ExpiredCard:
    case StripeV3ErrorCode.IncorrectCVC:
      // OLD v2 CODE WAS REMOVED HERE
      break; // Falls through to default!

    default:
      return VitaFleetErrorCode.PaymentProcessingError; // ❌ Wrong: returns 500
  }
}
```

**Why it's subtle:**
- The v3 error codes ARE defined in `error-codes.ts`
- The switch cases ARE listed for card errors
- But there's no return statement, so they fall through
- Anyone glancing at the code might miss the missing mapping
- Only shows up in production when actual card_declined errors occur

### Evidence of Incomplete Migration: `src/models/error-codes.ts`

**Lines 1-60:** Shows that v3 error codes ARE defined:

```typescript
export enum StripeV3ErrorCode {
  CardDeclined = 'card_declined',           // ✅ Exists but not mapped in handler
  InsufficientFunds = 'insufficient_funds', // ✅ Exists but not mapped in handler
  ExpiredCard = 'expired_card',             // ✅ Exists but not mapped in handler
  // ... all v3 codes defined
}
```

But these codes are never actually used to return the correct status codes in `error-handler.ts`.

### Missing Tests: `tests/payment-service.test.ts`

**What exists:**
- ✅ Test for successful payment
- ✅ Test for 3D Secure (requires_action)
- ✅ Test for payment status retrieval
- ✅ Test for cancel payment

**What's missing (the comment shows this):**
```typescript
/**
 * MISSING TEST CASE: This test is intentionally NOT included
 * 
 * The following test case SHOULD exist but doesn't:
 * - processPayment handles card_declined error correctly
 * - processPayment handles insufficient_funds error correctly
 * - processPayment handles expired_card error correctly
 * - etc.
 */
```

This is why the bug wasn't caught before deployment.

### The Incident Analysis: `INCIDENT.md`

Complete post-mortem that explains:
- What went wrong (card errors returning 500 instead of 402)
- Why it happened (v2→v3 migration incomplete)
- Root cause (missing error mappings in error-handler.ts)
- Why tests didn't catch it (no error path tests)
- Impact (2,400 failed payments, $45K revenue loss, 127 support tickets)
- Prevention measures (comprehensive fixes and process improvements)

## How to Use This for the Demo

### Scenario: Root Cause Analysis of Payment Service Incident

1. **Discovery Phase:**
   - Run the service, show that happy path works
   - Make a payment request with a card_declined error
   - Show it returns HTTP 500 instead of 402
   
2. **Investigation Phase:**
   - Look at error logs
   - Use Teamwork Graph to query who committed what
   - Find PR #1 by marcus.chen
   - Review the changes - note what was removed vs. added

3. **Root Cause Analysis:**
   - Open `error-handler.ts`
   - Point out the card error cases with no return statements
   - Show `error-codes.ts` where v3 codes ARE defined
   - Highlight the gap between definition and implementation

4. **Why Tests Failed:**
   - Look at `payment-service.test.ts`
   - Point out the comment about missing error handling tests
   - Show that only happy path is tested
   - Explain how error paths would have caught this

5. **Timeline:**
   - Check `INCIDENT.md` for complete post-mortem
   - Show customer impact timeline
   - Demonstrate proper incident documentation

## Files Summary

| File | Purpose | Key Points |
|------|---------|-----------|
| `error-handler.ts` | Payment error mapping | ⚠️ THE BUG: Incomplete v3 error code mappings |
| `error-codes.ts` | Error code definitions | Shows v3 codes exist but aren't used in handler |
| `payment-service.test.ts` | Unit tests | Only tests happy path, missing error cases |
| `payment-controller.ts` | HTTP routes | Uses error codes to set HTTP status |
| `stripe-client.ts` | Stripe API wrapper | Updated for v3 PaymentIntents API |
| `payment-service.ts` | Business logic | Calls error handler when payment fails |
| `INCIDENT.md` | Post-mortem | Complete analysis for the demo |
| `README.md` | Documentation | Mentions the bug in "Error Handling Bug" section |

## Demonstration Flow

```
┌─────────────────────────────────────────────────────────────┐
│ 1. Show the service handles payments (happy path)           │
│    GET /health → Shows "Stripe v3 PaymentIntents"          │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 2. Trigger a card_declined error                            │
│    POST /api/checkout/payment with declined card            │
│    Expected: HTTP 402 with "card_declined"                  │
│    Actual: HTTP 500 with "PAYMENT_PROCESSING_ERROR"         │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 3. Investigate the code                                      │
│    Open: src/payments/error-handler.ts                      │
│    Find: The incomplete switch case for card errors         │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 4. Check what was defined                                   │
│    Open: src/models/error-codes.ts                          │
│    Show: CardDeclined, InsufficientFunds enums exist        │
│    Note: They're defined but NOT USED in error-handler      │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 5. Examine the gap                                           │
│    Show: Why tests didn't catch this (missing error tests)  │
│    Open: tests/payment-service.test.ts                      │
│    Note: Only happy path tested                             │
└──────────────────┬──────────────────────────────────────────┘
                   │
┌──────────────────▼──────────────────────────────────────────┐
│ 6. View the post-mortem                                      │
│    Open: INCIDENT.md                                        │
│    Review: Impact, timeline, root cause, prevention         │
└─────────────────────────────────────────────────────────────┘
```

---

**Created:** March 24, 2026  
**For:** Atlassian Teamwork Graph MCP Demo - Incident Response Root Cause Analysis  
**Repository:** https://github.com/vitafleet-mcp-demo/vitafleet-checkout-service
