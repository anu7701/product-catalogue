import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import recordedCategories from '../adapters/fakestore/recordings/categories.json' with { type: 'json' };
import recordedProducts from '../adapters/fakestore/recordings/products.json' with { type: 'json' };
import { FakeStoreProductSource } from '../../src/adapters/fakestore/fakestore-product-source.ts';
import { FixtureProductSource } from '../../src/adapters/fixture/fixture-product-source.ts';
import { silentLogger } from '../../src/logging/logger.ts';
import type { ProductSource } from '../../src/ports/product-source.ts';

/**
 * The ProductSource contract (ARCHITECTURE §14.2 #15). Every adapter must
 * pass the same suite, so services can rely on identical behaviour whichever
 * source is configured. To add a source, add an entry to `adapters`.
 */

// The real host, so recorded image URLs pass the adapter's host allow-list.
// MSW intercepts everything; no request reaches the network.
const FAKESTORE = 'https://fakestoreapi.com';

// Fake Store, replaying responses recorded from the live API.
const server = setupServer(
  http.get(`${FAKESTORE}/products`, () => HttpResponse.json(recordedProducts)),
  http.get(`${FAKESTORE}/products/categories`, () => HttpResponse.json(recordedCategories)),
  http.get(`${FAKESTORE}/products/:id`, ({ params }) => {
    const product = recordedProducts.find((candidate) => String(candidate.id) === params.id);
    // Real Fake Store behaviour for unknown IDs: 200 with an empty body.
    return product ? HttpResponse.json(product) : new HttpResponse('');
  }),
  http.get(
    `${FAKESTORE}/img/:file`,
    () =>
      new HttpResponse(new Uint8Array([0x89, 0x50, 0x4e, 0x47]), {
        headers: { 'content-type': 'image/png' },
      }),
  ),
);
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterAll(() => server.close());

const adapters: [name: string, create: () => Promise<ProductSource>][] = [
  ['FixtureProductSource', () => FixtureProductSource.load()],
  [
    'FakeStoreProductSource',
    () => Promise.resolve(new FakeStoreProductSource({ baseUrl: FAKESTORE, logger: silentLogger })),
  ],
];

describe.each(adapters)('ProductSource contract: %s', (_name, create) => {
  let source: ProductSource;

  beforeAll(async () => {
    source = await create();
  });

  it('lists products with unique, non-empty string IDs (A4a)', async () => {
    const products = await source.listProducts();
    const ids = products.map((product) => product.id);

    expect(products.length).toBeGreaterThan(0);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('returns products in our shape (no source field names)', async () => {
    for (const product of await source.listProducts()) {
      expect(Object.keys(product).sort()).toEqual(
        ['categoryName', 'description', 'id', 'imageRef', 'price', 'rating', 'title'].sort(),
      );
      expect(product.rating === null || typeof product.rating.average === 'number').toBe(true);
    }
  });

  it('NEW-20: returns products in a stable source order', async () => {
    const first = (await source.listProducts()).map((product) => product.id);
    const second = (await source.listProducts()).map((product) => product.id);
    expect(second).toEqual(first);
  });

  it('gets a product by ID, matching the listed product', async () => {
    const [listed] = await source.listProducts();
    if (!listed) throw new Error('source has no products');

    expect(await source.getProduct(listed.id)).toEqual(listed);
  });

  it.each(['does-not-exist', '999999', 'SKU-1042', 'a/b'])(
    'PRD-02: unknown ID %j resolves to null, not an error',
    async (id) => {
      expect(await source.getProduct(id)).toBeNull();
    },
  );

  it('lists unique categories that match the products', async () => {
    const categories = await source.listCategories();
    const usedByProducts = new Set((await source.listProducts()).map((p) => p.categoryName));

    expect(categories.length).toBeGreaterThan(0);
    expect(new Set(categories).size).toBe(categories.length);
    expect(new Set(categories)).toEqual(usedByProducts);
  });

  it("serves a listed product's image as image/*", async () => {
    const [product] = await source.listProducts();
    if (!product) throw new Error('source has no products');

    const image = await source.getImage(product.imageRef);
    expect(image?.contentType).toMatch(/^image\//);
    expect(image?.body.length).toBeGreaterThan(0);
  });

  it('an unusable image reference resolves to null, not an error', async () => {
    expect(await source.getImage('../../etc/passwd')).toBeNull();
  });
});
