import { pino, type DestinationStream, type Logger as PinoLogger } from 'pino';

export interface CreateLoggerOptions {
  level: string;
  /** Where to write log lines; stdout by default. Tests pass a capture stream. */
  destination?: DestinationStream;
}

/**
 * The API's single structured JSON logger (ARCHITECTURE §9.1), shared by
 * Fastify and the adapters. Writes JSON lines to stdout so containers ship
 * them unchanged.
 */
export function createLogger({ level, destination }: CreateLoggerOptions): PinoLogger {
  return pino({ level }, destination);
}
