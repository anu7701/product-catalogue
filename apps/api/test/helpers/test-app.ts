import type { FastifyBaseLogger, FastifyInstance } from 'fastify';
import { FixtureProductSource } from '../../src/adapters/fixture/fixture-product-source.ts';
import { createServices } from '../../src/composition.ts';
import { buildApp } from '../../src/http/app.ts';
import { createLogger } from '../../src/logging/create-logger.ts';
import type { Notifier } from '../../src/ports/notifier.ts';
import type { ProductSource } from '../../src/ports/product-source.ts';
import { RecordingNotifier } from './doubles.ts';

export interface TestAppOptions {
  productSource?: ProductSource;
  logger?: FastifyBaseLogger;
  trustProxyHops?: number;
  featuredProductIds?: string[];
  categoryTopRatedCount?: number;
  notifier?: Notifier;
  enquiryRateLimit?: { max: number; windowMinutes: number };
}

/** Defaults mirror .env.example. */
export const TEST_FEATURED_IDS = ['1', '5', '9', '15', '18'];

/**
 * The real app with the same wiring as main.ts (createServices), backed by
 * the fixture product source unless a test supplies another.
 */
export async function buildTestApp(options: TestAppOptions = {}): Promise<FastifyInstance> {
  const logger = options.logger ?? createLogger({ level: 'silent' });
  const services = createServices({
    productSource: options.productSource ?? (await FixtureProductSource.load()),
    logger,
    catalogue: {
      featuredProductIds: options.featuredProductIds ?? TEST_FEATURED_IDS,
      categoryTopRatedCount: options.categoryTopRatedCount ?? 3,
    },
    notifier: options.notifier ?? new RecordingNotifier(),
    publicSiteUrl: 'http://localhost:8080',
  });
  return buildApp({
    logger,
    services,
    trustProxyHops: options.trustProxyHops ?? 0,
    enquiryRateLimit: options.enquiryRateLimit ?? { max: 5, windowMinutes: 15 },
  });
}

/** A logger that captures parsed JSON log lines. */
export function captureLogger(level = 'info') {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    level,
    destination: {
      write: (line: string) => lines.push(JSON.parse(line) as Record<string, unknown>),
    },
  });
  return { logger, lines };
}
