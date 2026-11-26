import type { FastifyInstance } from 'fastify';

/**
 * Liveness check. Deliberately does not call the product source, so an
 * upstream outage doesn't make the API look dead (ARCHITECTURE §6.2).
 */
export function healthRoutes(app: FastifyInstance): void {
  app.get('/api/v1/health', () => ({ status: 'ok' }));
}
