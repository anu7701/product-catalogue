import type { Category, CategoryProductsResponse, Product } from '@catalogue/shared';
import type { CatalogueProduct } from '../domain/catalogue-product.ts';
import { CategoryNotFoundError } from '../domain/errors.ts';
import { LogEvent, type Logger } from '../logging/logger.ts';
import type { ProductSource } from '../ports/product-source.ts';
import { categoryId, isSameCategoryId, toCategory } from './category.ts';
import { toApiProduct } from './product-mapper.ts';

/**
 * How many products the category page's "Top rated" section shows.
 * Current spec (CAT-01 BR3/BR8): the configured maximum, regardless of
 * category size. Open decision R-04 may change this (e.g. leave at least one
 * product for "More in…"); it is isolated here so that is a one-line change.
 */
export function topRatedLimit(_categorySize: number, configuredMax: number): number {
  return configuredMax;
}

/**
 * Rated products, best first: average rating descending, then number of
 * ratings descending (A7). Remaining ties keep the data source's order
 * (stable sort): the R-08 default, which works for any ID format.
 * Unrated products are never ranked (NEW-07).
 */
export function rankByRating(products: CatalogueProduct[]): CatalogueProduct[] {
  return products
    .filter((product) => product.rating !== null)
    .sort(
      (a, b) =>
        (b.rating?.average ?? 0) - (a.rating?.average ?? 0) ||
        (b.rating?.count ?? 0) - (a.rating?.count ?? 0),
    );
}

export interface CatalogueServiceOptions {
  productSource: ProductSource;
  logger: Logger;
  /** Owner's featured list, already normalised by config (CFG-01). */
  featuredProductIds: readonly string[];
  /** Max products in a category page's "Top rated" section (A8). */
  categoryTopRatedCount: number;
}

/** Catalogue browsing rules (ARCHITECTURE §3.4). No HTTP, no source specifics. */
export class CatalogueService {
  private readonly productSource: ProductSource;
  private readonly logger: Logger;
  private readonly featuredProductIds: readonly string[];
  private readonly categoryTopRatedCount: number;

  constructor(options: CatalogueServiceOptions) {
    this.productSource = options.productSource;
    this.logger = options.logger;
    this.featuredProductIds = options.featuredProductIds;
    this.categoryTopRatedCount = options.categoryTopRatedCount;
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

  /** All categories, alphabetical by display label (GLB-01, HOM-02, NEW-02, NEW-03). */
  async categories(): Promise<Category[]> {
    return (await this.productSource.listCategories())
      .map(toCategory)
      .sort((a, b) => a.name.localeCompare(b.name, 'en'));
  }

  /**
   * A category page, already split (CAT-01): "Top rated" = best customer
   * ratings (A7, rankByRating), up to topRatedLimit; "More in…" = every other
   * product in source order (A9, NEW-20). Each product appears exactly once.
   * Unknown category ID → CategoryNotFoundError (CAT-02).
   */
  async categoryPage(id: string): Promise<CategoryProductsResponse> {
    const sourceName = (await this.productSource.listCategories()).find((name) =>
      isSameCategoryId(categoryId(name), id),
    );
    if (sourceName === undefined) {
      throw new CategoryNotFoundError(id);
    }

    const inCategory = (await this.productSource.listProducts()).filter(
      (product) => product.categoryName === sourceName,
    );
    const limit = topRatedLimit(inCategory.length, this.categoryTopRatedCount);
    const topRated = rankByRating(inCategory).slice(0, limit);
    const topRatedIds = new Set(topRated.map((product) => product.id));

    return {
      category: toCategory(sourceName),
      topRated: topRated.map(toApiProduct),
      more: inCategory.filter((product) => !topRatedIds.has(product.id)).map(toApiProduct),
    };
  }
}
