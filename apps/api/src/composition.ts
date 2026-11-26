import { FakeStoreProductSource } from './adapters/fakestore/fakestore-product-source.ts';
import { FixtureProductSource } from './adapters/fixture/fixture-product-source.ts';
import type { Config } from './config/config.ts';
import type { Logger } from './logging/logger.ts';
import type { ProductSource } from './ports/product-source.ts';

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
