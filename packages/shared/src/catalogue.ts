/**
 * Catalogue data shapes shared by the API and the web app (P1.1).
 *
 * These are our own domain shapes. No data source's field names appear here:
 * adapters map their source into these types (ARCHITECTURE §3.2).
 * Types only; validation schemas are added by the task that first needs them.
 */

/**
 * Opaque product identifier. Never parse, compare numerically or assume a
 * format: a future data source may use IDs like `SKU-1042` (A4a).
 */
export type ProductId = string;

/** Customer rating summary from the data source (GLB-02, A7). */
export interface Rating {
  /** Average score, e.g. 3.9. */
  average: number;
  /** Number of ratings the average is based on. */
  count: number;
}

/** A product category. */
export interface Category {
  /** Identifier used in URLs, e.g. `/category/{slug}` (GLB-04). */
  slug: string;
  /** Display label, e.g. "Men's clothing" (NEW-02). */
  name: string;
}

/** A product as returned by the API. */
export interface Product {
  id: ProductId;
  title: string;
  /** Display price in USD; not a binding quote (A22). */
  price: number;
  description: string;
  category: Category;
  /** URL of the product image served by our API, never the data source (constraint 2). */
  imageUrl: string;
  /** `null` when the product has no rating (NEW-07). */
  rating: Rating | null;
}

/** Collection envelope; leaves room for pagination metadata later (ARCHITECTURE §6.1). */
export interface ListResponse<T> {
  items: T[];
}

/** `GET /api/v1/featured-products` (HOM-01). Owner's order, missing products skipped. */
export type FeaturedProductsResponse = ListResponse<Product>;

/** `GET /api/v1/categories` (GLB-01, HOM-02). */
export type CategoriesResponse = ListResponse<Category>;

/** `GET /api/v1/categories/{category}/products` (CAT-01). Already split by the API. */
export interface CategoryProductsResponse {
  category: Category;
  /** Highest customer-rated products in the category (A7, A8). */
  topRated: Product[];
  /** Every other product in the category; never repeats a top-rated product (A9). */
  more: Product[];
}

/** `GET /api/v1/products?q={term}` (SRC-02). */
export interface SearchResponse {
  /** The search term as applied by the API (trimmed). */
  query: string;
  items: Product[];
}

/** `GET /api/v1/products/{id}` (PRD-01). */
export type ProductResponse = Product;
