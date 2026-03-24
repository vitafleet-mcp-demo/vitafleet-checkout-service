# VitaFleet Checkout Service - Demo Guide

## Quick Start

This repository contains a complete, realistic TypeScript checkout service with a **deliberate, subtle bug** designed for demonstrating incident response and root cause analysis using Atlassian Teamwork Graph MCP tools.

### What's Included

✅ **23 professional-grade TypeScript files**
- Full Express.js payment processing service
- Stripe v3 PaymentIntents API integration
- Webhook signature validation
- Comprehensive error handling (with intentional bug)
- Unit tests (incomplete - they miss the error paths)
- Production-ready configuration

✅ **The Bug: Incomplete Stripe v2→v3 Migration**
- PR #1 migrated from Stripe Charges API (v2) to PaymentIntents API (v3)
- Developer removed v2 error handling WITHOUT adding v3 equivalents
- Result: Card declines return HTTP 500 instead of HTTP 402
- Only manifests in production with actual payment errors

✅ **Documentation**
- README.md - Full service documentation with bug explanation
- INCIDENT.md - Detailed post-mortem analysis
- STRUCTURE.md - File organization and navigation guide

## The Narrative: Payment Service Incident

### Timeline

| Date | Event |
|------|-------|
| Mar 20 | PR #1 merged - Stripe v2→v3 migration (by marcus.chen) |
| Mar 23 | First customer complaint - "500 error but card is fine" |
| Mar 24 | Root cause identified - missing error mappings |

### The Problem

When customers try to pay with a declined card, they get:
```
HTTP 500 Internal Server Error
{
  "success": false,
  "error": {
    "code": "PAYMENT_PROCESSING_ERROR",
    "message": "An unexpected error occurred processing your payment"
  }
}
```

**Should be:**
```
HTTP 402 Payment Required
{
  "success": false,
  "error": {
    "code": "PAYMENT_DECLINED",
    "message": "Your card was declined"
  }
}
```

### Business Impact

- **Customer Complaints:** 127 support tickets
- **Failed Payments:** ~2,400 attempts
- **Lost Revenue:** ~$45,000
- **Time to Root Cause:** 4 days
- **Issue Duration:** 3 days (detected quickly due to customer feedback)

## Key Files for the Demo

### 1. The Bug Location
**File:** `src/payments/error-handler.ts` (lines 56-110)

Shows incomplete error mapping where card error cases fall through to default:
```typescript
case StripeV3ErrorCode.CardDeclined:
case StripeV3ErrorCode.InsufficientFunds:
  // ❌ Missing return statement - falls through!
  break;

default:
  return VitaFleetErrorCode.PaymentProcessingError; // Wrong for card errors
```

### 2. Evidence of Incomplete Migration
**File:** `src/models/error-codes.ts` (lines 30-60)

Shows that v3 error codes ARE defined but NOT USED:
```typescript
export enum StripeV3ErrorCode {
  CardDeclined = 'card_declined',           // ✅ Defined
  InsufficientFunds = 'insufficient_funds', // ✅ Defined
  ExpiredCard = 'expired_card',             // ✅ Defined
  // ... but never mapped in error-handler.ts
}
```

### 3. Why Tests Didn't Catch It
**File:** `tests/payment-service.test.ts` (lines 40-80)

Missing error path tests:
```typescript
/**
 * MISSING TEST CASE: This test is intentionally NOT included
 * 
 * The following test case SHOULD exist but doesn't:
 * - processPayment handles card_declined error correctly
 * - processPayment handles insufficient_funds error correctly
 * - processPayment handles expired_card error correctly
 */
```

### 4. Post-Mortem Analysis
**File:** `INCIDENT.md`

Complete incident analysis including:
- Executive summary
- Root cause analysis with code examples
- Impact analysis (2,400 failed payments, $45K revenue loss)
- Investigation timeline
- Prevention measures
- Lessons learned

## Demo Walkthrough

### Phase 1: Understand the Service

1. Open `README.md`
   - Shows what VitaFleet does
   - Lists API endpoints
   - Mentions "Error Handling Bug" section

2. Review `src/index.ts`
   - Simple Express app setup
   - Payment routes and webhook routes
   - Health check endpoint

### Phase 2: Identify the Bug

1. Open `src/payments/error-handler.ts`
   - Point out the `mapStripeErrorCodeToVitaFleet()` function
   - Show the card error cases (lines 75-81)
   - Highlight the missing return statements
   - Show how they fall through to default case (line 111)

2. Compare with `src/models/error-codes.ts`
   - Show StripeV3ErrorCode enum has CardDeclined, InsufficientFunds, etc.
   - Point out they're defined but never used in error-handler
   - This is the "gap" between definition and implementation

### Phase 3: Trace the Impact

1. Look at `src/payments/payment-controller.ts` (lines 70-90)
   - Shows how error response status codes are determined
   - Uses ErrorStatusCodes mapping
   - When error code is PAYMENT_PROCESSING_ERROR, returns 500

2. Look at `src/models/error-codes.ts` (lines 75-85)
   - ErrorStatusCodes maps PAYMENT_PROCESSING_ERROR to 500
   - PAYMENT_DECLINED would map to 402 (if error handler returned it)

### Phase 4: Why Tests Failed

1. Open `tests/payment-service.test.ts`
   - Scroll to "processPayment" describe block
   - Show it tests successful payment ✅
   - Show it tests 3D Secure ✅
   - Look for error tests ❌
   - Find the comment explaining missing error test cases

2. Point out webhook signature tests ARE present
   - Shows testing is possible
   - Just not done for payment error paths

### Phase 5: Review the Post-Mortem

Open `INCIDENT.md` to show:
- Executive summary of the issue
- Exact code that caused the bug (lines 100-150)
- Root cause section explaining the migration gap
- Impact analysis with numbers
- Investigation timeline
- Prevention measures for future

## How to Use with Teamwork Graph MCP

This repo is designed to demonstrate incident response scenarios:

### Scenario 1: Find Who Made the Change
```
Query: "Find the developer who changed error handling during the Stripe migration"
Expected: marcus.chen in PR #1
Tool: teamwork_graph.search_issues or grep for PR #1
```

### Scenario 2: Trace the Impact
```
Query: "Which developers worked on payment-related code after PR #1?"
Tool: teamwork_graph.get_activities_linked_to_project
Expected: Shows commits, PRs, and pull request reviews
```

### Scenario 3: Root Cause Analysis
```
Query: "What code changed in error-handler.ts between v1 and v2?"
Tool: Review the git history (simulate with file comparisons)
Expected: Shows removed v2 handling, incomplete v3 implementation
```

## File Statistics

```
Total Files Created:        23
TypeScript Source Files:    14
Test Files:                 2
Configuration Files:        3
Documentation Files:        3
Configuration/Misc:         1

Lines of Code:              ~2,500
Documentation Lines:        ~2,000
Total Repository Size:      ~4,500 lines
```

## Key Learning Points

1. **API Migrations are High-Risk**
   - Error handling must be thoroughly tested
   - Both happy path AND error paths need tests
   - Code review should verify all cases are handled

2. **Tests as a Safety Net**
   - The error path tests that should have existed would have caught this
   - Happy path tests aren't enough
   - Error scenarios should be tested as thoroughly as happy paths

3. **Code Review Discipline**
   - When removing old code, verify replacement is complete
   - Migrations should have clear verification checklist
   - Status code mappings are critical and easy to miss

4. **Monitoring and Alerting**
   - Generic "5xx errors" alert isn't specific enough
   - Payment-specific alerts would catch status code anomalies
   - Alert on error rate spikes, not just error codes

## Next Steps

1. **Explore the Code**
   - Start with README.md to understand architecture
   - Look at error-handler.ts to see the bug
   - Read INCIDENT.md for complete analysis

2. **Use with Teamwork Graph**
   - Imagine this is in your Jira/Confluence instance
   - Use MCP tools to find who worked on payment code
   - Trace the impact across the codebase
   - Build incident response workflows

3. **Extend the Demo**
   - Add more payment gateway integrations
   - Implement the fix
   - Add comprehensive error tests
   - Show how monitoring would have caught this earlier

---

**Repository:** https://github.com/vitafleet-mcp-demo/vitafleet-checkout-service
**Demo Purpose:** Incident Response & Root Cause Analysis using Atlassian Teamwork Graph MCP
**Created:** March 24, 2026
