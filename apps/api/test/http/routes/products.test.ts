import { ErrorCode, type SearchResponse, searchMessages } from '@catalogue/shared';
import { describe, expect, it } from 'vitest';
import { failingProductSource } from '../../helpers/doubles.ts';
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
