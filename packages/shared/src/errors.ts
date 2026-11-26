import { z } from 'zod';

/**
 * Machine-readable error codes returned by the API (ARCHITECTURE §8.1).
 * Clients switch on `code`, never on status or message text.
 */
export const ErrorCode = {
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  NOT_FOUND: 'NOT_FOUND',
  PRODUCT_NOT_FOUND: 'PRODUCT_NOT_FOUND',
  CATEGORY_NOT_FOUND: 'CATEGORY_NOT_FOUND',
  PRODUCT_UNAVAILABLE: 'PRODUCT_UNAVAILABLE',
  RATE_LIMITED: 'RATE_LIMITED',
  PRODUCT_SOURCE_UNAVAILABLE: 'PRODUCT_SOURCE_UNAVAILABLE',
  EMAIL_DELIVERY_FAILED: 'EMAIL_DELIVERY_FAILED',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type ErrorCode = (typeof ErrorCode)[keyof typeof ErrorCode];

/**
 * Customer-facing message for each code: shown by the web app and returned
 * as the Problem Details `title`. Wording comes from the functional spec
 * where it defines one.
 */
export const errorMessages: Record<ErrorCode, string> = {
  VALIDATION_FAILED: 'Please check the highlighted information and try again.',
  NOT_FOUND: 'Page not found.',
  PRODUCT_NOT_FOUND: "We couldn't find that product. It may no longer be available.", // PRD-02.FR1
  CATEGORY_NOT_FOUND: "We couldn't find that category.", // CAT-02
  PRODUCT_UNAVAILABLE: 'Sorry, this product is no longer available.', // NEW-36
  RATE_LIMITED: "You've sent several enquiries recently. Please try again later.", // ENQ-06.FR1
  PRODUCT_SOURCE_UNAVAILABLE: "We couldn't load products right now.", // GLB-03.FR2
  EMAIL_DELIVERY_FAILED: "Sorry, we couldn't send your enquiry. Please try again in a moment.", // ENQ-05.FR1
  INTERNAL_ERROR: 'Something went wrong. Please try again.', // GLB-03
};

/**
 * Error response body (RFC 9457 Problem Details, `application/problem+json`).
 * Never contains stack traces, upstream URLs or provider messages (A43).
 */
export const problemDetailsSchema = z.object({
  type: z.string(),
  title: z.string().min(1),
  status: z.number().int().min(400).max(599),
  code: z.enum(ErrorCode),
  /** Correlates the response with server log lines. */
  requestId: z.string().min(1),
  /** Per-field messages, only for VALIDATION_FAILED. */
  errors: z.record(z.string(), z.string()).optional(),
});

export type ProblemDetails = z.infer<typeof problemDetailsSchema>;
