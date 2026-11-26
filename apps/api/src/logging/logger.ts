/**
 * Minimal structured-logger interface used outside the HTTP layer, so
 * adapters and services don't depend on Fastify or pino directly.
 * Fastify's pino logger satisfies it.
 */
export interface Logger {
  info(fields: LogFields, message: string): void;
  warn(fields: LogFields, message: string): void;
  error(fields: LogFields, message: string): void;
}

/** Every log line with an `event` uses one of these names (ARCHITECTURE §9.1). */
export const LogEvent = {
  featuredIdMissing: 'featured.id_missing',
  configFeaturedNormalised: 'config.featured_normalised',
  productSourceFailed: 'product_source.failed',
  productSourceRecordInvalid: 'product_source.record_invalid',
  enquirySent: 'enquiry.sent',
  enquiryFailed: 'enquiry.failed',
  enquiryRateLimited: 'enquiry.rate_limited',
} as const;

export type LogEventName = (typeof LogEvent)[keyof typeof LogEvent];

export interface LogFields {
  event?: LogEventName;
  [key: string]: unknown;
}

/** A logger that discards everything; for tests and tools. */
export const silentLogger: Logger = {
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
