import type { ProductId, Rating } from '@catalogue/shared';

/**
 * A product as supplied by a ProductSource (ARCHITECTURE §3.2, §3.3).
 *
 * Source-neutral: adapters map their own shape into this, and no source's
 * field names appear here. It differs from the API's `Product` in two ways
 * that the service layer resolves:
 * - `categoryName` is the source's category name; the API derives the
 *   category ID (UUID v5, T15) and display label from it.
 * - `imageRef` is meaningful only to the adapter that produced it (an
 *   upstream URL, a local file name…); the API exposes images through its
 *   own proxy URL instead (constraint 2).
 */
export interface CatalogueProduct {
  id: ProductId;
  title: string;
  /** Price in USD (A22). */
  price: number;
  description: string;
  categoryName: string;
  imageRef: string;
  /** `null` when the source has no rating (NEW-07). */
  rating: Rating | null;
}
