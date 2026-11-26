import { ErrorCode, type FeaturedProductsResponse, problemDetailsSchema } from '@catalogue/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { failingProductSource } from '../../helpers/doubles.ts';
import { buildTestApp, type TestAppOptions } from '../../helpers/test-app.ts';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function get(url: string, options?: TestAppOptions) {
  app = await buildTestApp(options);
  return app.inject({ url });
}

function expectSourceUnavailable(response: Awaited<ReturnType<typeof get>>) {
  expect(response.statusCode).toBe(502);
  expect(problemDetailsSchema.parse(response.json()).code).toBe(
    ErrorCode.PRODUCT_SOURCE_UNAVAILABLE,
  );
}

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
