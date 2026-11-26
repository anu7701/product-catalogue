import { searchTermSchema, type SearchResponse } from '@catalogue/shared';
import { z } from 'zod';
import type { CatalogueProduct } from '../domain/catalogue-product.ts';
import type { ProductSource } from '../ports/product-source.ts';
import { toApiProduct } from './product-mapper.ts';
import { parseOrThrow } from './validation.ts';

const searchQuerySchema = z.object({ q: searchTermSchema });

/**
 * Does the product contain the term (SRC-02 BR1, A12)? Whole term, as literal
 * text (NEW-27), case-insensitive, anywhere in title, description or category.
 * No fuzzy matching, stemming or ranking (BR4).
 */
export function matchesSearchTerm(product: CatalogueProduct, term: string): boolean {
  const needle = term.toLowerCase();
  return [product.title, product.description, product.categoryName].some((text) =>
    text.toLowerCase().includes(needle),
  );
}

/** Catalogue search (ARCHITECTURE §3.4). Fake Store can't search, so we do it here (A18). */
export class SearchService {
  private readonly productSource: ProductSource;

  constructor(options: { productSource: ProductSource }) {
    this.productSource = options.productSource;
  }

  /**
   * Validates the raw `q` (SRC-01: trimmed, 1–100 chars) and returns only
   * matching products from the whole catalogue (A14), in source order (NEW-20).
   * Invalid term → ValidationFailedError on field `q`.
   */
  async search(rawQuery: unknown): Promise<SearchResponse> {
    const { q } = parseOrThrow(searchQuerySchema, { q: rawQuery });
    const products = await this.productSource.listProducts();
    return {
      query: q,
      items: products.filter((product) => matchesSearchTerm(product, q)).map(toApiProduct),
    };
  }
}
