import type { Product, ProductId } from '@catalogue/shared';
import type { CatalogueProduct } from '../domain/catalogue-product.ts';
import { toCategory } from './category.ts';

/** Our image proxy URL for a product; the browser never sees the source's image URL (constraint 2). */
export function productImagePath(id: ProductId): string {
  return `/api/v1/products/${encodeURIComponent(id)}/image`;
}

/** Source product → API product: derived category ID + label (T15, NEW-02) and proxied image URL. */
export function toApiProduct(product: CatalogueProduct): Product {
  return {
    id: product.id,
    title: product.title,
    price: product.price,
    description: product.description,
    category: toCategory(product.categoryName),
    imageUrl: productImagePath(product.id),
    rating: product.rating,
  };
}
