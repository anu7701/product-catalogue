import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { FakeStoreProductSource } from '../../src/adapters/fakestore/fakestore-product-source.ts';
import { FixtureProductSource } from '../../src/adapters/fixture/fixture-product-source.ts';
import { createProductSource } from '../../src/composition.ts';
import { silentLogger } from '../../src/logging/logger.ts';
import { buildTestApp } from '../helpers/test-app.ts';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function makeApp() {
  app = await buildTestApp();
  return app;
}

describe('buildApp', () => {
  it('GET /api/v1/health → 200 {status: "ok"}', async () => {
    const response = await (await makeApp()).inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('health does not touch the product source', async () => {
    app = await buildTestApp({
      productSource: {
        listProducts: () => Promise.reject(new Error('should not be called')),
        getProduct: () => Promise.reject(new Error('should not be called')),
        listCategories: () => Promise.reject(new Error('should not be called')),
      },
    });

    expect((await app.inject({ url: '/api/v1/health' })).statusCode).toBe(200);
  });
});

describe('createProductSource (T13)', () => {
  it('PRODUCT_SOURCE=fixture → the committed snapshot', async () => {
    const source = await createProductSource({ kind: 'fixture', url: 'unused' }, silentLogger);
    expect(source).toBeInstanceOf(FixtureProductSource);
  });

  it('PRODUCT_SOURCE=fakestore → the live Fake Store adapter', async () => {
    const source = await createProductSource(
      { kind: 'fakestore', url: 'https://fakestoreapi.com' },
      silentLogger,
    );
    expect(source).toBeInstanceOf(FakeStoreProductSource);
  });
});
