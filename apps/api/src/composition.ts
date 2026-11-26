import { FakeStoreProductSource } from './adapters/fakestore/fakestore-product-source.ts';
import { FixtureProductSource } from './adapters/fixture/fixture-product-source.ts';
import type { Config } from './config/config.ts';
import type { Logger } from './logging/logger.ts';
import type { ProductSource } from './ports/product-source.ts';
import { CatalogueService } from './services/catalogue-service.ts';
import { SearchService } from './services/search-service.ts';

/**
 * The only place that reads PRODUCT_SOURCE and knows which adapters exist
 * (ARCHITECTURE §3.6, T13). Everything else depends on the ProductSource port.
 */
export async function createProductSource(
  config: Config['productSource'],
  logger: Logger,
): Promise<ProductSource> {
  switch (config.kind) {
    case 'fixture':
      return FixtureProductSource.load();
    case 'fakestore':
      return new FakeStoreProductSource({ baseUrl: config.url, logger });
  }
}

/** Every service the HTTP layer uses. */
export interface Services {
  catalogue: CatalogueService;
  search: SearchService;
}

export interface ServiceDependencies {
  productSource: ProductSource;
  logger: Logger;
  catalogue: Config['catalogue'];
}

/** Wires services to their ports. Used by main.ts and by tests, so both run the same wiring. */
export function createServices(deps: ServiceDependencies): Services {
  return {
    catalogue: new CatalogueService({
      productSource: deps.productSource,
      logger: deps.logger,
      featuredProductIds: deps.catalogue.featuredProductIds,
      categoryTopRatedCount: deps.catalogue.categoryTopRatedCount,
    }),
    search: new SearchService({ productSource: deps.productSource }),
  };
}
