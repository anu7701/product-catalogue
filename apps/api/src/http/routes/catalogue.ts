import type { FeaturedProductsResponse } from '@catalogue/shared';
import type { FastifyInstance } from 'fastify';
import type { CatalogueService } from '../../services/catalogue-service.ts';

/** Catalogue read routes (ARCHITECTURE §6.2). Thin: parse, call the service, shape the response. */
export function catalogueRoutes(app: FastifyInstance, catalogue: CatalogueService): void {
  app.get('/api/v1/featured-products', async (): Promise<FeaturedProductsResponse> => ({
    items: await catalogue.featured(),
  }));
}
