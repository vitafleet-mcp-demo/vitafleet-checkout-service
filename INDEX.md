# VitaFleet Checkout Service - Complete Index

## 📋 Quick Navigation

### Start Here
- **[README.md](README.md)** - Complete service documentation and architecture
- **[DEMO_GUIDE.md](DEMO_GUIDE.md)** - How to use this repository for demos
- **[INCIDENT.md](INCIDENT.md)** - The incident post-mortem (the key narrative)

### Understanding the Bug
1. Read: [INCIDENT.md](INCIDENT.md) - Executive summary
2. Look at: [src/payments/error-handler.ts](src/payments/error-handler.ts) - Lines 56-110
3. Compare: [src/models/error-codes.ts](src/models/error-codes.ts) - Lines 30-60
4. Review: [tests/payment-service.test.ts](tests/payment-service.test.ts) - Missing error tests

### Repository Navigation
- [STRUCTURE.md](STRUCTURE.md) - Detailed file organization
- [DEMO_GUIDE.md](DEMO_GUIDE.md) - 5-phase demo walkthrough

---

## 📁 All Files (24 total)

### Configuration & Setup
- `package.json` - NPM dependencies and scripts
- `tsconfig.json` - TypeScript compiler configuration
- `jest.config.js` - Jest testing framework configuration
- `.env.example` - Environment variable template
- `.gitignore` - Git ignore rules
- `LICENSE` - MIT License

### Source Code (14 TypeScript files)

#### Configuration
- `src/config/stripe-config.ts` - Stripe API v3 configuration
- `src/config/retry-config.ts` - Exponential backoff and retry logic

#### Models & Types
- `src/models/error-codes.ts` - Error code enums (v2, v3, VitaFleet)
- `src/models/payment-intent.ts` - PaymentIntent types and interfaces
- `src/models/checkout-session.ts` - Checkout session models

#### Payment Processing (⚠️ Contains the bug)
- `src/payments/error-handler.ts` - **THE BUG IS HERE** - Incomplete error mapping
- `src/payments/payment-controller.ts` - Express routes for payment endpoints
- `src/payments/payment-service.ts` - Core payment processing logic
- `src/payments/stripe-client.ts` - Stripe API v3 client wrapper

#### Webhook Handling
- `src/webhooks/webhook-controller.ts` - Stripe webhook event routes
- `src/webhooks/signature-validator.ts` - HMAC-SHA256 signature verification

#### Entry Point
- `src/index.ts` - Main Express application

### Tests (2 TypeScript test files)
- `tests/payment-service.test.ts` - Payment service tests (happy path only)
- `tests/webhook-controller.test.ts` - Webhook validation tests

### Documentation (4 markdown files)
- `README.md` - Service documentation with bug explanation (11KB)
- `INCIDENT.md` - Post-mortem analysis and root cause (9.4KB)
- `STRUCTURE.md` - File organization and navigation
- `DEMO_GUIDE.md` - How to use for demos (this document)
- `INDEX.md` - This file

---

## 🐛 The Bug: Quick Reference

**Location:** `src/payments/error-handler.ts`, lines 56-110

**What:** Stripe v2→v3 migration incomplete
- v2 error handling code was removed
- v3 error mapping was never implemented
- Card error cases fall through to default

**Result:** 
- Card declines return HTTP 500 instead of HTTP 402
- Customer sees "Internal Server Error" instead of "Card declined"

**Why tests missed it:**
- `tests/payment-service.test.ts` only tests happy path
- No tests for card_declined, insufficient_funds, expired_card, etc.
- Error scenarios not covered

**Evidence:**
1. `error-codes.ts` defines v3 error codes ✅
2. `error-handler.ts` lists card error cases but has no return statements ❌
3. Cases fall through to default returning wrong status code ❌

---

## 🎯 Use Cases

### Code Review Discussion
"What went wrong in this PR?"
- Open `src/payments/error-handler.ts`
- Point out missing return statements
- Discuss code review process for migrations

### Root Cause Analysis
"Customer reported 500 errors. Let's investigate."
- Follow the error flow through payment-service.ts
- Check error-handler.ts mapping
- Notice the incomplete switch cases
- Review INCIDENT.md for timeline

### Testing Strategy
"Why didn't tests catch this?"
- Review `tests/payment-service.test.ts`
- Show missing error path tests
- Discuss comprehensive test coverage needs

### Incident Response
"Walk us through the incident timeline."
- Open `INCIDENT.md`
- Review impact metrics and timeline
- Discuss prevention measures
- Show monitoring/alerting recommendations

### API Migration Best Practices
"How should we migrate between API versions?"
- Review the migration approach in the code
- Discuss error handling strategy
- Examine incomplete migration in error-handler.ts
- Learn from mistakes documented in INCIDENT.md

---

## 📊 Repository Statistics

```
Total Files:              24
TypeScript Source:        14 files (~2,500 LOC)
Tests:                    2 files (~300 LOC)
Configuration:            4 files
Documentation:            4 files (~2,000 LOC)

Total Lines of Code:      ~4,950 lines
```

---

## 🚀 Getting Started

### 1. Explore the Architecture
Start with `README.md` to understand:
- What VitaFleet checkout service does
- API endpoints
- Stripe v3 integration
- Known bug section

### 2. Find the Bug
Look at these three files in order:
1. `src/payments/error-handler.ts` - Where the bug is
2. `src/models/error-codes.ts` - What's defined vs. used
3. `tests/payment-service.test.ts` - What's not tested

### 3. Understand the Impact
Read `INCIDENT.md` to see:
- What happened (timeline)
- Why it happened (root cause)
- Impact metrics (revenue, customers affected)
- How to prevent in future

### 4. Use in Demo
Follow `DEMO_GUIDE.md` for:
- 5-phase walkthrough
- Discussion points
- How to present to different audiences
- Connection to Teamwork Graph MCP

---

## 💡 Key Insights

### What Makes This Realistic
✅ Professional code quality
✅ Subtle bug (not immediately obvious)
✅ Only manifests with real errors in production
✅ Common in API migrations
✅ Complete incident narrative

### Learning Points
1. Error handling is often overlooked in migrations
2. Both happy path AND error paths need testing
3. Code review discipline is critical
4. Missing return statements can hide bugs
5. Good monitoring catches issues quickly

### For Teamwork Graph Demo
This repository shows how MCP tools help with:
- Finding who made changes (marcus.chen's PR #1)
- Understanding code history and diffs
- Tracing impact across codebase
- Building incident response workflows
- Connecting development to business impact

---

## 📞 Support & Questions

### Looking for the bug?
→ Start with `INCIDENT.md` Executive Summary

### Want to understand the code?
→ Read `README.md` then explore `src/payments/`

### Need a demo walkthrough?
→ Follow `DEMO_GUIDE.md` step-by-step

### Want to extend this?
→ See "Next Steps" section in `DEMO_GUIDE.md`

---

## 📌 File Cross-References

### Understanding the Error Mapping Bug
```
error-handler.ts    ← The incomplete mapping function
error-codes.ts      ← Shows codes are defined but not used
payment-service.ts  ← Calls error handler when payment fails
payment-controller.ts ← Uses error codes for HTTP status
INCIDENT.md         ← Root cause analysis
```

### Understanding Why Tests Failed
```
payment-service.test.ts  ← Happy path tests only
INCIDENT.md              ← Explains missing error tests
DEMO_GUIDE.md           ← Phase 4 discusses test coverage
```

### Understanding the Impact
```
INCIDENT.md          ← Timeline and metrics
README.md            ← Error Handling Bug section
DEMO_GUIDE.md        ← Business impact explanation
```

---

## 🎓 Educational Value

This repository teaches:
1. **Software Architecture** - Real Express.js payment service
2. **API Integration** - Stripe v3 PaymentIntents API
3. **Error Handling** - Common pitfalls and best practices
4. **Testing** - Why comprehensive test coverage matters
5. **Incident Response** - How to investigate and document
6. **Code Review** - What to look for in migrations
7. **DevOps** - Monitoring and alerting for payments

---

**Repository:** https://github.com/vitafleet-mcp-demo/vitafleet-checkout-service
**Company:** VitaFleet (fictional e-commerce)
**Purpose:** Atlassian Teamwork Graph MCP Demo
**Created:** March 24, 2026

---

*Last Updated: March 24, 2026*
