import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';

/** Max request body size (ARCHITECTURE §7, §10.1). An enquiry is well under 2 KB. */
export const BODY_LIMIT_BYTES = 10 * 1024;

/**
 * Security baseline for every API response (ARCHITECTURE §10.1):
 * - Helmet headers with a strict CSP. The API only serves JSON and images,
 *   so nothing may load from it as a page or be framed. The web page's own
 *   CSP is set by the web server, not here.
 * - `Cache-Control: no-store` unless a route sets its own (no caching yet, T4).
 * - No CORS: the browser reaches the API on the same origin via the web
 *   proxy, so no cross-origin access is granted.
 */
export function registerSecurity(app: FastifyInstance): void {
  void app.register(helmet, {
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        defaultSrc: ["'none'"],
        frameAncestors: ["'none'"],
      },
    },
    crossOriginResourcePolicy: { policy: 'same-origin' },
  });

  app.addHook('onSend', (_request, reply, payload, done) => {
    if (!reply.hasHeader('cache-control')) {
      void reply.header('cache-control', 'no-store');
    }
    done(null, payload);
  });
}
