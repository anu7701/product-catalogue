import {
  type CategoriesResponse,
  type CategoryProductsResponse,
  ErrorCode,
  type FeaturedProductsResponse,
} from '@catalogue/shared';
import { describe, expect, it } from 'vitest';
import { categoryId } from '../../../src/services/category.ts';
import { failingProductSource } from '../../helpers/doubles.ts';
import { expectProblem, expectSourceUnavailable, get } from '../../helpers/http.ts';

describe('GET /api/v1/featured-products', () => {
  it('HOM-01: 200 with the featured products in configured order', async () => {
    const response = await get('/api/v1/featured-products', {
      featuredProductIds: ['18', '1', '9'],
    });

    expect(response.statusCode).toBe(200);
    const body = response.json<FeaturedProductsResponse>();
    expect(body.items.map((product) => product.id)).toEqual(['18', '1', '9']);
    expect(body.items[0]?.imageUrl).toBe('/api/v1/products/18/image');
  });

  it('NEW-17: nothing to show → 200 with an empty list (the UI hides the section)', async () => {
    const response = await get('/api/v1/featured-products', { featuredProductIds: ['999'] });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ items: [] });
  });

  it('GLB-03: product source down → 502 PRODUCT_SOURCE_UNAVAILABLE', async () => {
    expectSourceUnavailable(
      await get('/api/v1/featured-products', { productSource: failingProductSource() }),
    );
  });
});

describe('GET /api/v1/categories', () => {
  it('GLB-01: 200 with every category, alphabetical', async () => {
    const response = await get('/api/v1/categories');

    expect(response.statusCode).toBe(200);
    expect(response.json<CategoriesResponse>().items.map((category) => category.name)).toEqual([
      'Electronics',
      'Jewelery',
      "Men's clothing",
      "Women's clothing",
    ]);
  });

  it('GLB-03: product source down → 502', async () => {
    expectSourceUnavailable(
      await get('/api/v1/categories', { productSource: failingProductSource() }),
    );
  });
});

describe('GET /api/v1/categories/{categoryId}/products', () => {
  it('CAT-01: 200 with the category and its split product lists', async () => {
    const response = await get(`/api/v1/categories/${categoryId('jewelery')}/products`);

    expect(response.statusCode).toBe(200);
    const body = response.json<CategoryProductsResponse>();
    expect(body.category).toEqual({ id: categoryId('jewelery'), name: 'Jewelery' });
    expect(body.topRated.map((product) => product.id)).toEqual(['5', '6', '7']);
    expect(body.more.map((product) => product.id)).toEqual(['8']);
  });

  it.each(['shoes', '00000000-0000-5000-8000-000000000000'])(
    'CAT-02: unknown category %j → 404 CATEGORY_NOT_FOUND',
    async (id) => {
      const response = await get(`/api/v1/categories/${id}/products`);

      expectProblem(response, 404, ErrorCode.CATEGORY_NOT_FOUND);
    },
  );

  it('CAT-02: source down → 502, never "category not found"', async () => {
    expectSourceUnavailable(
      await get(`/api/v1/categories/${categoryId('jewelery')}/products`, {
        productSource: failingProductSource(),
      }),
    );
  });
});
