import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { ProductSource } from '../ports/product-source.ts';
import { generateRequestId, registerErrorHandling } from './errors.ts';
import { healthRoutes } from './routes/health.ts';

export interface AppDependencies {
  logger: FastifyBaseLogger;
  productSource: ProductSource;
  /** Trusted proxy hops in front of the API (R-07); 0 = trust none. */
  trustProxyHops: number;
}

/**
 * Builds the Fastify app from already-constructed dependencies. No I/O, no
 * environment access: main.ts wires real dependencies, tests wire fakes.
 */
export function buildApp(deps: AppDependencies): FastifyInstance {
  const app = Fastify({
    loggerInstance: deps.logger,
    // Trust only the configured number of proxy hops nearest the API, so a
    // client can't choose its own IP via X-Forwarded-For (R-07).
    trustProxy: (_address: string, hop: number) => hop < deps.trustProxyHops,
    // Request IDs: reuse a safe incoming X-Request-Id, else generate one.
    requestIdHeader: false,
    genReqId: generateRequestId,
  });

  registerErrorHandling(app);
  healthRoutes(app);

  return app;
}
