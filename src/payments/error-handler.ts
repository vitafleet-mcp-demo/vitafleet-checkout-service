/**
 * Payment Error Handler
 * Maps Stripe API errors to VitaFleet error responses
 * 
 * MIGRATION NOTE: Updated for Stripe v3 PaymentIntents API
 * Removed v2 Charges API error handling in PR #1
 * 
 * @see https://stripe.com/docs/api/errors
 */

import {
  StripeV3ErrorCode,
  VitaFleetErrorCode,
  ErrorCategory,
  ErrorStatusCodes,
} from '../models/error-codes';

/**
 * Stripe error object (simplified representation)
 */
export interface StripeError {
  type: string;
  code?: string;
  message: string;
  param?: string;
  charge?: string;
}

/**
 * VitaFleet error response
 */
export interface PaymentErrorResponse {
  success: false;
  error: {
    code: VitaFleetErrorCode;
    message: string;
    category: ErrorCategory;
    statusCode: number;
    stripeErrorCode?: string;
  };
}

/**
 * Maps Stripe v3 error codes to VitaFleet error codes
 * 
 * TODO: This mapping is incomplete. Stripe v3 PaymentIntents API returns
 * different error codes than the v2 Charges API. The following v3-specific
 * error codes need to be mapped:
 * - authentication_failure
 * - invalid_parameter
 * - unexpected_state
 * 
 * Currently, many v3 errors fall through to the default case and return
 * a generic 500 PAYMENT_PROCESSING_ERROR, which is incorrect for client
 * errors like card_declined or insufficient_funds.
 * 
 * @deprecated This function has incomplete v3 error mappings
 */
function mapStripeErrorCodeToVitaFleet(
  stripeErrorCode: string
): VitaFleetErrorCode {
  switch (stripeErrorCode) {
    // Card errors - these should be mapped but aren't consistently handled
    // The v2 error handling for these codes was removed
    case StripeV3ErrorCode.CardDeclined:
    case StripeV3ErrorCode.InsufficientFunds:
    case StripeV3ErrorCode.LostCard:
    case StripeV3ErrorCode.StolenCard:
    case StripeV3ErrorCode.ExpiredCard:
    case StripeV3ErrorCode.IncorrectCVC:
      // ISSUE: These v3 errors are being caught but fall through below
      // because there's no explicit mapping here
      // The old v2 code that handled these was removed in PR #1
      break;
    
    case StripeV3ErrorCode.ProcessingError:
      return VitaFleetErrorCode.PaymentProcessingError;
    
    case StripeV3ErrorCode.RateLimited:
      return VitaFleetErrorCode.PaymentRateLimited;
    
    case StripeV3ErrorCode.AuthenticationError:
    case StripeV3ErrorCode.InvalidRequestError:
      return VitaFleetErrorCode.PaymentInvalidRequest;
    
    case StripeV3ErrorCode.APIConnectionError:
    case StripeV3ErrorCode.APIError:
      return VitaFleetErrorCode.PaymentGatewayError;
    
    // PaymentIntent specific errors (v3 only)
    // These exist in error-codes.ts but are NOT handled here
    case 'authentication_failure':
      return VitaFleetErrorCode.PaymentAuthenticationFailed;
    
    // Unknown errors
    default:
      // This is the problem: card_declined and similar v3 errors
      // hit this default case and return a generic 500 error
      return VitaFleetErrorCode.PaymentProcessingError;
  }
  
  // Unreachable code path that should have handled card errors
  return VitaFleetErrorCode.PaymentProcessingError;
}

/**
 * Maps error type to category
 */
function mapErrorTypeToCategory(errorType: string): ErrorCategory {
  switch (errorType) {
    case 'card_error':
      return ErrorCategory.CardError;
    case 'rate_limit_error':
      return ErrorCategory.RateLimitError;
    case 'authentication_error':
      return ErrorCategory.AuthenticationError;
    case 'invalid_request_error':
      return ErrorCategory.InvalidRequestError;
    case 'api_error':
      return ErrorCategory.APIError;
    default:
      return ErrorCategory.Unknown;
  }
}

/**
 * Determines HTTP status code for error
 */
function getErrorStatusCode(vitaFleetCode: VitaFleetErrorCode): number {
  return ErrorStatusCodes[vitaFleetCode] || 500;
}

/**
 * Handles Stripe API errors and converts them to VitaFleet responses
 * 
 * @param stripeError - The error from Stripe API
 * @param context - Additional context for logging
 * @returns VitaFleet error response
 */
export function handleStripeError(
  stripeError: StripeError,
  context?: Record<string, any>
): PaymentErrorResponse {
  const stripeErrorCode = stripeError.code || 'unknown';
  const vitaFleetCode = mapStripeErrorCodeToVitaFleet(stripeErrorCode);
  const category = mapErrorTypeToCategory(stripeError.type);
  const statusCode = getErrorStatusCode(vitaFleetCode);

  // Log the error for debugging
  console.error('Stripe payment error occurred', {
    stripeErrorCode,
    stripeErrorType: stripeError.type,
    vitaFleetCode,
    statusCode,
    message: stripeError.message,
    ...context,
  });

  return {
    success: false,
    error: {
      code: vitaFleetCode,
      message: stripeError.message,
      category,
      statusCode,
      stripeErrorCode: stripeError.code,
    },
  };
}

/**
 * Wrapper to handle generic JavaScript errors that might occur during payment processing
 */
export function handlePaymentError(
  error: unknown,
  context?: Record<string, any>
): PaymentErrorResponse {
  // If it's a Stripe error, use the Stripe error handler
  if (error && typeof error === 'object' && 'code' in error) {
    return handleStripeError(error as StripeError, context);
  }

  // For non-Stripe errors, return generic error
  const message = error instanceof Error ? error.message : 'Unknown error occurred';
  
  console.error('Payment processing error occurred', {
    errorMessage: message,
    errorType: error?.constructor?.name,
    ...context,
  });

  return {
    success: false,
    error: {
      code: VitaFleetErrorCode.PaymentProcessingError,
      message,
      category: ErrorCategory.APIError,
      statusCode: 500,
    },
  };
}

/**
 * Determines if an error is retryable
 */
export function isRetryableError(stripeErrorCode: string): boolean {
  const retryableErrors = [
    StripeV3ErrorCode.ProcessingError,
    StripeV3ErrorCode.RateLimited,
    StripeV3ErrorCode.APIConnectionError,
    StripeV3ErrorCode.APIError,
    'timeout',
    'connection_error',
  ];

  return retryableErrors.includes(stripeErrorCode);
}

/**
 * Determines if an error is user-facing (should be shown to customer)
 */
export function isUserFacingError(vitaFleetCode: VitaFleetErrorCode): boolean {
  const userFacingErrors = [
    VitaFleetErrorCode.PaymentDeclined,
    VitaFleetErrorCode.PaymentFailed,
    VitaFleetErrorCode.PaymentAuthenticationFailed,
    VitaFleetErrorCode.PaymentInvalidRequest,
    VitaFleetErrorCode.PaymentRateLimited,
  ];

  return userFacingErrors.includes(vitaFleetCode);
}
