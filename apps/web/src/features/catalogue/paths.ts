/** Address of a product page (GLB-04). IDs are opaque, so always encoded (A4a). */
export function productPath(productId: string): string {
  return `/product/${encodeURIComponent(productId)}`;
}

/** Address of a category page (GLB-04, T15). */
export function categoryPath(categoryId: string): string {
  return `/category/${encodeURIComponent(categoryId)}`;
}
