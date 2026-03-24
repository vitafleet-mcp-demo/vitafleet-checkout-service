/**
 * Payment Error Code Enumerations
 * 
 * Contains error codes from both Stripe v2 (Charges API) and v3 (PaymentIntents API)
 * for reference and migration purposes.
 */

/**
 * Stripe v2 Charges API Error Codes (DEPRECATED)
 * These codes were returned by the old Charges API.
 * This enum is kept for historical reference but should NOT be used in new code.
 * 
 * @deprecated Use StripeV3ErrorCode instead
 */
export enum StripeV2ErrorCode {
  CardDeclined = 'card_declined',
  InsufficientFunds = 'insufficient_funds',
  LostCard = 'lost_card',
  StolenCard = 'stolen_card',
  ExpiredCard = 'expired_card',
  IncorrectCVC = 'incorrect_cvc',
  ProcessingError = 'processing_error',
  RateLimited = 'rate_limited',
  AuthenticationError = 'authentication_error',
  InvalidRequestError = 'invalid_request_error',
  APIConnectionError = 'api_connection_error',
  APIError = 'api_error',
}

/**
 * Stripe v3 PaymentIntents API Error Codes
 * These codes are returned by the PaymentIntents API and should be used
 * for error handling in the current version.
 * 
 * @see https://stripe.com/docs/api/errors
 */
export enum StripeV3ErrorCode {
  // Card errors
  CardDeclined = 'card_declined',
  InsufficientFunds = 'insufficient_funds',
  LostCard = 'lost_card',
  StolenCard = 'stolen_card',
  ExpiredCard = 'expired_card',
  IncorrectCVC = 'incorrect_cvc',
  ProcessingError = 'processing_error',
  
  // PaymentIntent specific errors
  PaymentIntentAuthenticationFailure = 'authentication_failure',
  PaymentIntentInvalidParameter = 'invalid_parameter',
  PaymentIntentUnexpectedState = 'unexpected_state',
  
  // Rate limiting
  RateLimited = 'rate_limited',
  
  // Authentication/authorization
  AuthenticationError = 'authentication_error',
  InvalidRequestError = 'invalid_request_error',
  
  // Connection errors
  APIConnectionError = 'api_connection_error',
  APIError = 'api_error',
}

/**
 * VitaFleet internal error response codes
 * These are mapped from Stripe error codes for consistent API responses
 */
export enum VitaFleetErrorCode {
  PaymentDeclined = 'PAYMENT_DECLINED',
  PaymentFailed = 'PAYMENT_FAILED',
  PaymentAuthenticationFailed = 'PAYMENT_AUTHENTICATION_FAILED',
  PaymentProcessingError = 'PAYMENT_PROCESSING_ERROR',
  PaymentInvalidRequest = 'PAYMENT_INVALID_REQUEST',
  PaymentRateLimited = 'PAYMENT_RATE_LIMITED',
  PaymentGatewayError = 'PAYMENT_GATEWAY_ERROR',
  InternalServerError = 'INTERNAL_SERVER_ERROR',
}

/**
 * Error category classification
 */
export enum ErrorCategory {
  CardError = 'card_error',
  RateLimitError = 'rate_limit_error',
  AuthenticationError = 'authentication_error',
  InvalidRequestError = 'invalid_request_error',
  APIError = 'api_error',
  Unknown = 'unknown',
}

/**
 * HTTP status codes for error responses
 */
export const ErrorStatusCodes = {
  [VitaFleetErrorCode.PaymentDeclined]: 402,
  [VitaFleetErrorCode.PaymentFailed]: 402,
  [VitaFleetErrorCode.PaymentAuthenticationFailed]: 403,
  [VitaFleetErrorCode.PaymentProcessingError]: 500,
  [VitaFleetErrorCode.PaymentInvalidRequest]: 400,
  [VitaFleetErrorCode.PaymentRateLimited]: 429,
  [VitaFleetErrorCode.PaymentGatewayError]: 502,
  [VitaFleetErrorCode.InternalServerError]: 500,
} as const;
