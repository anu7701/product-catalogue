import type { SearchResponse } from '@catalogue/shared';
import type { FastifyInstance } from 'fastify';
import type { SearchService } from '../../services/search-service.ts';

/** Product routes (ARCHITECTURE §6.2). Thin: parse, call a service, shape the response. */
export function productRoutes(app: FastifyInstance, deps: { search: SearchService }): void {
  // Search filters the product collection (T14): `q` is required.
  app.get<{ Querystring: { q?: unknown } }>(
    '/api/v1/products',
    (request): Promise<SearchResponse> => deps.search.search(request.query.q),
  );
}
