import { pino, type DestinationStream, type Logger as PinoLogger } from 'pino';

export interface CreateLoggerOptions {
  level: string;
  /** Where to write log lines; stdout by default. Tests pass a capture stream. */
  destination?: DestinationStream;
}

export const REDACTED = '[REDACTED]';

const CUSTOMER_FIELDS = ['name', 'email', 'phone', 'message'];

/**
 * Paths whose values are replaced with [REDACTED] in every log line.
 * Customer personal data never reaches the logs (A37, ARCHITECTURE §9.1):
 * enquiry request bodies (`body`, `req.body`) and EnquiryNotification-style
 * objects (`customer`, `<anything>.customer`). Secrets in headers too.
 */
export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  ...CUSTOMER_FIELDS.flatMap((field) => [`body.${field}`, `req.body.${field}`, `*.body.${field}`]),
  'customer',
  '*.customer',
];

/**
 * The API's single structured JSON logger (ARCHITECTURE §9.1), shared by
 * Fastify and the adapters. Writes JSON lines to stdout so containers ship
 * them unchanged. Fastify adds the request ID (`reqId`) to request log lines.
 */
export function createLogger({ level, destination }: CreateLoggerOptions): PinoLogger {
  return pino({ level, redact: { paths: REDACT_PATHS, censor: REDACTED } }, destination);
}
