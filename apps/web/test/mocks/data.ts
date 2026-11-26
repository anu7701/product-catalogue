import type { Category, Product } from '@catalogue/shared';

/** Sample API data, typed by the shared contract so it can't drift from the API. */
export const electronics: Category = {
  id: '8d88b533-1111-5000-8000-000000000001',
  name: 'Electronics',
};
export const jewelery: Category = { id: '5a53ae9c-2222-5000-8000-000000000002', name: 'Jewelery' };
export const categories: Category[] = [electronics, jewelery];

export function aProduct(overrides: Partial<Product> = {}): Product {
  const id = overrides.id ?? '1';
  return {
    id,
    title: `Product ${id}`,
    price: 109.95,
    description: 'A sample product description.',
    category: electronics,
    imageUrl: `/api/v1/products/${id}/image`,
    rating: { average: 3.9, count: 120 },
    ...overrides,
  };
}

export const products: Product[] = [
  aProduct({ id: '1', title: 'Backpack' }),
  aProduct({ id: '2', title: 'Hard drive', price: 64 }),
  aProduct({ id: '3', title: 'Gold ring', category: jewelery, rating: null }),
];
