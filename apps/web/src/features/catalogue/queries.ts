import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.ts';

/** Every category, alphabetical (GLB-01, HOM-02). */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => api.categories(signal),
  });
}

/** The owner's featured products, in order (HOM-01). */
export function useFeaturedProducts() {
  return useQuery({
    queryKey: ['featured-products'],
    queryFn: ({ signal }) => api.featuredProducts(signal),
  });
}

/** A category page, already split by the API (CAT-01). */
export function useCategoryProducts(categoryId: string) {
  return useQuery({
    queryKey: ['category-products', categoryId],
    queryFn: ({ signal }) => api.categoryProducts(categoryId, signal),
  });
}

/** One product (PRD-01). */
export function useProduct(productId: string) {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: ({ signal }) => api.product(productId, signal),
  });
}
