import type { Product } from '@catalogue/shared';
import { LogEvent, type Logger } from '../logging/logger.ts';
import type { ProductSource } from '../ports/product-source.ts';
import { toApiProduct } from './product-mapper.ts';

export interface CatalogueServiceOptions {
  productSource: ProductSource;
  logger: Logger;
  /** Owner's featured list, already normalised by config (CFG-01). */
  featuredProductIds: readonly string[];
}

/** Catalogue browsing rules (ARCHITECTURE §3.4). No HTTP, no source specifics. */
export class CatalogueService {
  private readonly productSource: ProductSource;
  private readonly logger: Logger;
  private readonly featuredProductIds: readonly string[];

  constructor(options: CatalogueServiceOptions) {
    this.productSource = options.productSource;
    this.logger = options.logger;
    this.featuredProductIds = options.featuredProductIds;
  }

  /**
   * The owner's featured products (HOM-01): in configured order (A3); IDs that
   * match no product are skipped with a warning, never replaced (A4, NEW-17).
   * One source call for the whole list (ARCHITECTURE §3.5).
   */
  async featured(): Promise<Product[]> {
    if (this.featuredProductIds.length === 0) return [];

    const byId = new Map(
      (await this.productSource.listProducts()).map((product) => [product.id, product]),
    );
    const featured: Product[] = [];
    for (const id of this.featuredProductIds) {
      const product = byId.get(id);
      if (product) {
        featured.push(toApiProduct(product));
      } else {
        this.logger.warn(
          { event: LogEvent.featuredIdMissing, productId: id },
          'Featured product ID not found in catalogue; skipped',
        );
      }
    }
    return featured;
  }
}
