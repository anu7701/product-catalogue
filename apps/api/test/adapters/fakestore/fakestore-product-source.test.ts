import { delay, http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { UpstreamUnavailableError } from '../../../src/domain/errors.ts';
import { LogEvent, type Logger } from '../../../src/logging/logger.ts';
import { FakeStoreProductSource } from '../../../src/adapters/fakestore/fakestore-product-source.ts';
import recordedProducts from './recordings/products.json' with { type: 'json' };

// Behaviour shared with every ProductSource is covered by the contract suite
// (product-source.contract.test.ts). These tests cover Fake Store specifics,
// against responses recorded from the real API.

const BASE = 'https://fakestore.test';
const server = setupServer();

beforeAll(() => server.listen({ onUnhandledFrame: 'error' }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

function makeLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies Logger;
}

function makeSource(logger: Logger = makeLogger(), timeoutMs?: number) {
  return new FakeStoreProductSource({ baseUrl: `${BASE}/`, logger, timeoutMs });
}

const backpack = recordedProducts[0];

describe('FakeStoreProductSource', () => {
  it('ARCH §3.2: maps Fake Store fields into our shape', async () => {
    server.use(http.get(`${BASE}/products/1`, () => HttpResponse.json(backpack)));

    expect(await makeSource().getProduct('1')).toEqual({
      id: '1',
      title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops',
      price: 109.95,
      description: backpack?.description,
      categoryName: "men's clothing",
      imageRef: 'https://fakestoreapi.com/img/81fPKd-2AYL._AC_SL1500_t.png',
      rating: { average: 3.9, count: 120 },
    });
  });

  it('NEW-07: a missing rating maps to null', async () => {
    const { rating: _ignored, ...unrated } = { ...backpack };
    server.use(http.get(`${BASE}/products/1`, () => HttpResponse.json(unrated)));

    expect((await makeSource().getProduct('1'))?.rating).toBeNull();
  });

  it('ARCH §3.5: unknown ID — 200 with an empty body (real Fake Store behaviour) → null', async () => {
    server.use(http.get(`${BASE}/products/999`, () => new HttpResponse('', { status: 200 })));

    expect(await makeSource().getProduct('999')).toBeNull();
  });

  it('unknown ID — 404 → null', async () => {
    server.use(http.get(`${BASE}/products/999`, () => new HttpResponse(null, { status: 404 })));

    expect(await makeSource().getProduct('999')).toBeNull();
  });

  it('A4a: IDs are URL-encoded, not assumed numeric', async () => {
    let requestedPath = '';
    server.use(
      http.get(`${BASE}/products/:id`, ({ request }) => {
        requestedPath = new URL(request.url).pathname;
        return new HttpResponse('');
      }),
    );

    await makeSource().getProduct('a/b c');
    expect(requestedPath).toBe('/products/a%2Fb%20c');
  });

  it('NEW-10: malformed records are dropped and logged; valid ones are kept', async () => {
    const logger = makeLogger();
    server.use(
      http.get(`${BASE}/products`, () =>
        HttpResponse.json([backpack, { id: 2, title: '' }, { ...backpack, id: 3, price: 'free' }]),
      ),
    );

    const products = await makeSource(logger).listProducts();

    expect(products.map((product) => product.id)).toEqual(['1']);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: LogEvent.productSourceRecordInvalid, index: 1 }),
      expect.any(String),
    );
  });

  it('NEW-09: a slow response times out → UpstreamUnavailableError', async () => {
    server.use(
      http.get(`${BASE}/products`, async () => {
        await delay(200);
        return HttpResponse.json([]);
      }),
    );

    await expect(makeSource(makeLogger(), 20).listProducts()).rejects.toThrow(/timed out/);
  });

  it.each([
    ['server error', () => new HttpResponse(null, { status: 503 })],
    ['network failure', () => HttpResponse.error()],
    ['invalid JSON', () => new HttpResponse('<html>', { status: 200 })],
    ['not a list', () => HttpResponse.json({ products: [] })],
  ])('GLB-03: %s from /products → UpstreamUnavailableError', async (_label, resolver) => {
    server.use(http.get(`${BASE}/products`, resolver));

    await expect(makeSource().listProducts()).rejects.toThrow(UpstreamUnavailableError);
  });

  it('a server error for one product is a failure, not "not found"', async () => {
    server.use(http.get(`${BASE}/products/1`, () => new HttpResponse(null, { status: 500 })));

    await expect(makeSource().getProduct('1')).rejects.toThrow(UpstreamUnavailableError);
  });

  it('categories with an unexpected shape → UpstreamUnavailableError', async () => {
    server.use(http.get(`${BASE}/products/categories`, () => HttpResponse.json([1, 2])));

    await expect(makeSource().listCategories()).rejects.toThrow(UpstreamUnavailableError);
  });
});

describe('FakeStoreProductSource.getImage (ARCHITECTURE §10.3)', () => {
  const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
  const imageUrl = `${BASE}/img/backpack.png`;

  it('fetches an image from the configured Fake Store host', async () => {
    server.use(
      http.get(imageUrl, () => new HttpResponse(PNG, { headers: { 'content-type': 'image/png' } })),
    );

    const image = await makeSource().getImage(imageUrl);
    expect(image?.contentType).toBe('image/png');
    expect([...(image?.body ?? [])]).toEqual([...PNG]);
  });

  it.each([
    ['another host', 'https://evil.example/img/x.png'],
    ['a subdomain', 'https://evil.fakestore.test/img/x.png'],
    ['a non-http scheme', 'file:///etc/passwd'],
    ['not a URL', 'placeholder.svg'],
  ])('refuses %s without making any request (SSRF)', async (_label, ref) => {
    // onUnhandledFrame: 'error' fails the test if any request is attempted.
    const logger = makeLogger();
    expect(await makeSource(logger).getImage(ref)).toBeNull();
    expect(logger.warn).toHaveBeenCalledWith(
      expect.objectContaining({ event: LogEvent.productSourceImageRefused }),
      expect.any(String),
    );
  });

  it('refuses a response that is not an image', async () => {
    server.use(http.get(imageUrl, () => HttpResponse.text('<script>alert(1)</script>')));
    expect(await makeSource().getImage(imageUrl)).toBeNull();
  });

  it('refuses an image over the size cap', async () => {
    server.use(
      http.get(
        imageUrl,
        () => new HttpResponse(new Uint8Array(64), { headers: { 'content-type': 'image/png' } }),
      ),
    );
    const source = new FakeStoreProductSource({
      baseUrl: BASE,
      logger: makeLogger(),
      maxImageBytes: 32,
    });
    expect(await source.getImage(imageUrl)).toBeNull();
  });

  it('does not follow redirects (could lead to another host)', async () => {
    server.use(
      http.get(
        imageUrl,
        () =>
          new HttpResponse(null, {
            status: 302,
            headers: { location: 'https://evil.example/x.png' },
          }),
      ),
    );
    await expect(makeSource().getImage(imageUrl)).rejects.toThrow(UpstreamUnavailableError);
  });

  it('missing image (404) → null; server error → UpstreamUnavailableError', async () => {
    server.use(http.get(imageUrl, () => new HttpResponse(null, { status: 404 })));
    expect(await makeSource().getImage(imageUrl)).toBeNull();

    server.use(http.get(imageUrl, () => new HttpResponse(null, { status: 500 })));
    await expect(makeSource().getImage(imageUrl)).rejects.toThrow(UpstreamUnavailableError);
  });
});
