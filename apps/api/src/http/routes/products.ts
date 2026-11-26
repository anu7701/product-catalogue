import type { ProductResponse, SearchResponse } from '@catalogue/shared';
import type { FastifyInstance } from 'fastify';
import type { CatalogueService } from '../../services/catalogue-service.ts';
import type { SearchService } from '../../services/search-service.ts';

interface ProductRouteDeps {
  search: SearchService;
  catalogue: CatalogueService;
}

/** Product routes (ARCHITECTURE §6.2). Thin: parse, call a service, shape the response. */
export function productRoutes(app: FastifyInstance, deps: ProductRouteDeps): void {
  // Search filters the product collection (T14): `q` is required.
  app.get<{ Querystring: { q?: unknown } }>(
    '/api/v1/products',
    (request): Promise<SearchResponse> => deps.search.search(request.query.q),
  );

  app.get<{ Params: { id: string } }>('/api/v1/products/:id', (request): Promise<ProductResponse> =>
    deps.catalogue.product(request.params.id),
  );

  // Image proxy: the browser never contacts the data source (constraint 2).
  app.get<{ Params: { id: string } }>('/api/v1/products/:id/image', async (request, reply) => {
    const image = await deps.catalogue.productImage(request.params.id);
    return reply.type(image.contentType).send(image.body);
  });
}
