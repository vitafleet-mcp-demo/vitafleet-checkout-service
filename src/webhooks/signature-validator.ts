/**
 * Stripe Webhook Signature Validation
 * 
 * Validates that webhook events are authentically from Stripe
 * using HMAC-SHA256 signature verification
 * 
 * Updated for Stripe v3 API webhook format
 */

import crypto from 'crypto';

/**
 * Stripe webhook signature header format:
 * t=timestamp,v1=signature,v0=older_signature
 */
interface WebhookSignatureHeader {
  timestamp: number;
  signatures: string[];
}

/**
 * Parses the stripe-signature header
 * 
 * @param signatureHeader - The stripe-signature header value
 * @returns Parsed timestamp and signatures
 */
function parseSignatureHeader(signatureHeader: string): WebhookSignatureHeader {
  const parts = signatureHeader.split(',');
  const timestamp = parseInt(
    parts
      .find((part) => part.startsWith('t='))
      ?.substring(2) || '0',
    10
  );

  const signatures = parts
    .filter((part) => part.startsWith('v1='))
    .map((part) => part.substring(3));

  if (!timestamp || signatures.length === 0) {
    throw new Error('Invalid stripe-signature header format');
  }

  return { timestamp, signatures };
}

/**
 * Computes HMAC-SHA256 signature for webhook payload
 * 
 * @param payload - The raw webhook payload
 * @param secret - The webhook signing secret
 * @param timestamp - The timestamp from the header
 * @returns Computed signature
 */
function computeSignature(
  payload: string,
  secret: string,
  timestamp: number
): string {
  const signedContent = `${timestamp}.${payload}`;
  return crypto
    .createHmac('sha256', secret)
    .update(signedContent)
    .digest('hex');
}

/**
 * Validates webhook signature with tolerance for time skew
 * 
 * Stripe requires verification to happen within 5 minutes of event creation
 * to prevent replay attacks.
 * 
 * @param payload - The webhook payload (as string or object)
 * @param signatureHeader - The stripe-signature header value
 * @param secret - The webhook signing secret
 * @param tolerance - Time tolerance in seconds (default: 300 = 5 minutes)
 * @returns Parsed webhook event if signature is valid
 * @throws Error if signature is invalid or timestamp is too old
 */
export function validateWebhookSignature(
  payload: any,
  signatureHeader: string,
  secret: string,
  tolerance: number = 300
): any {
  // Ensure payload is a string
  const payloadString = typeof payload === 'string' ? payload : JSON.stringify(payload);

  // Parse signature header
  const { timestamp, signatures } = parseSignatureHeader(signatureHeader);

  // Check timestamp is within tolerance
  const now = Math.floor(Date.now() / 1000);
  const age = now - timestamp;

  if (age > tolerance) {
    throw new Error(`Webhook timestamp too old: ${age} seconds`);
  }

  if (age < -tolerance) {
    throw new Error(`Webhook timestamp in future: ${age} seconds`);
  }

  // Verify signature
  const expectedSignature = computeSignature(payloadString, secret, timestamp);

  // Use constant-time comparison to prevent timing attacks
  const signatureValid = signatures.some((sig) => constantTimeCompare(sig, expectedSignature));

  if (!signatureValid) {
    throw new Error('Webhook signature verification failed');
  }

  // Parse and return the webhook event
  return JSON.parse(payloadString);
}

/**
 * Constant-time string comparison
 * Prevents timing attacks by taking the same time regardless of where strings differ
 * 
 * @param a - First string to compare
 * @param b - Second string to compare
 * @returns true if strings are equal
 */
function constantTimeCompare(a: string, b: string): boolean {
  // Ensure both strings are same length
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}
