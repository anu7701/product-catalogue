import {
  ErrorCode,
  type ProductResponse,
  type SearchResponse,
  searchMessages,
} from '@catalogue/shared';
import { describe, expect, it } from 'vitest';
import { aProduct, failingProductSource, inMemoryProductSource } from '../../helpers/doubles.ts';
import { expectProblem, expectSourceUnavailable, get } from '../../helpers/http.ts';

describe('GET /api/v1/products?q=', () => {
  it('SRC-02: 200 with the term as applied and only matching products', async () => {
    const response = await get('/api/v1/products?q=slim%20fit');

    expect(response.statusCode).toBe(200);
    const body = response.json<SearchResponse>();
    expect(body.query).toBe('slim fit');
    expect(body.items.map((product) => product.id)).toEqual(['2', '4']);
  });

  it('SRC-03: no matches → 200 with an empty list', async () => {
    const response = await get('/api/v1/products?q=zzzz');
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ query: 'zzzz', items: [] });
  });

  it.each([
    ['/api/v1/products', searchMessages.empty],
    ['/api/v1/products?q=', searchMessages.empty],
    ['/api/v1/products?q=%20%20', searchMessages.empty],
    [`/api/v1/products?q=${'a'.repeat(101)}`, searchMessages.tooLong],
  ])('SRC-01: %s → 400 VALIDATION_FAILED on q', async (url, message) => {
    const response = await get(url);

    expect(expectProblem(response, 400, ErrorCode.VALIDATION_FAILED).errors).toEqual({
      q: message,
    });
  });

  it('GLB-03: product source down → 502, never "no results"', async () => {
    expectSourceUnavailable(
      await get('/api/v1/products?q=bag', { productSource: failingProductSource() }),
    );
  });
});

describe('GET /api/v1/products/{id}', () => {
  it('PRD-01: 200 with the product', async () => {
    const response = await get('/api/v1/products/9');

    expect(response.statusCode).toBe(200);
    expect(response.json<ProductResponse>()).toMatchObject({
      id: '9',
      category: { name: 'Electronics' },
      imageUrl: '/api/v1/products/9/image',
    });
  });

  it.each(['999', 'abc', 'SKU-1042', 'featured', 'search'])(
    'PRD-02 / T14: unknown ID %j → 404 PRODUCT_NOT_FOUND',
    async (id) => {
      expectProblem(await get(`/api/v1/products/${id}`), 404, ErrorCode.PRODUCT_NOT_FOUND);
    },
  );

  it('PRD-02: source down → 502, never "product not found"', async () => {
    expectSourceUnavailable(
      await get('/api/v1/products/1', { productSource: failingProductSource() }),
    );
  });
});

describe('GET /api/v1/products/{id}/image (constraint 2)', () => {
  it('200 with the image bytes and type, not cacheable, strict CSP', async () => {
    const response = await get('/api/v1/products/1/image');

    expect(response.statusCode).toBe(200);
    expect(response.headers['content-type']).toBe('image/svg+xml');
    expect(response.body).toContain('<svg');
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.headers['content-security-policy']).toContain("default-src 'none'");
  });

  it('unknown product → 404 PRODUCT_NOT_FOUND', async () => {
    expectProblem(await get('/api/v1/products/999/image'), 404, ErrorCode.PRODUCT_NOT_FOUND);
  });

  it('NEW-06: image unavailable → 404 NOT_FOUND (the UI shows a placeholder)', async () => {
    const productSource = inMemoryProductSource([aProduct({ id: '1', imageRef: 'gone.unknown' })]);
    expectProblem(
      await get('/api/v1/products/1/image', { productSource }),
      404,
      ErrorCode.NOT_FOUND,
    );
  });

  it('source down → 502', async () => {
    expectSourceUnavailable(
      await get('/api/v1/products/1/image', { productSource: failingProductSource() }),
    );
  });
});
