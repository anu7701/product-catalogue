import Fastify, { type FastifyBaseLogger, type FastifyInstance } from 'fastify';
import type { Services } from '../composition.ts';
import { generateRequestId, registerErrorHandling } from './errors.ts';
import { catalogueRoutes } from './routes/catalogue.ts';
import { enquiryRoutes, type EnquiryRateLimit } from './routes/enquiries.ts';
import { healthRoutes } from './routes/health.ts';
import { productRoutes } from './routes/products.ts';
import { BODY_LIMIT_BYTES, registerSecurity } from './security.ts';

export interface AppDependencies {
  logger: FastifyBaseLogger;
  services: Services;
  /** Trusted proxy hops in front of the API (R-07); 0 = trust none. */
  trustProxyHops: number;
  enquiryRateLimit: EnquiryRateLimit;
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
    bodyLimit: BODY_LIMIT_BYTES,
  });

  registerSecurity(app);
  registerErrorHandling(app);
  healthRoutes(app);
  catalogueRoutes(app, deps.services.catalogue);
  productRoutes(app, deps.services);
  enquiryRoutes(app, { enquiry: deps.services.enquiry, rateLimit: deps.enquiryRateLimit });

  return app;
}
