import type { CatalogueProduct } from '../domain/catalogue-product.ts';

/**
 * Where product data comes from (ARCHITECTURE §3.3). Fake Store and the
 * committed fixture are the PoC adapters; a database or CMS would be another.
 *
 * Contract (checked for every adapter by the shared contract test suite):
 * - Results are in the source's own order (NEW-20).
 * - Unknown IDs resolve to `null`, never throw.
 * - Failures to reach or read the source throw UpstreamUnavailableError.
 * - Records that don't match our shape are dropped, not returned (NEW-10).
 */
export interface ProductSource {
  listProducts(): Promise<CatalogueProduct[]>;
  getProduct(id: string): Promise<CatalogueProduct | null>;
  /** Category names as the source provides them. */
  listCategories(): Promise<string[]>;
}
