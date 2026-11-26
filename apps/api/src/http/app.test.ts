import { afterEach, describe, expect, it } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { FakeStoreProductSource } from '../adapters/fakestore/fakestore-product-source.ts';
import { FixtureProductSource } from '../adapters/fixture/fixture-product-source.ts';
import { createProductSource } from '../composition.ts';
import { createLogger } from '../logging/create-logger.ts';
import { silentLogger } from '../logging/logger.ts';
import { buildApp } from './app.ts';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

async function makeApp() {
  app = buildApp({
    logger: createLogger({ level: 'silent' }),
    productSource: await FixtureProductSource.load(),
    trustProxyHops: 0,
  });
  return app;
}

describe('buildApp', () => {
  it('GET /api/v1/health → 200 {status: "ok"}', async () => {
    const response = await (await makeApp()).inject({ method: 'GET', url: '/api/v1/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: 'ok' });
  });

  it('health does not touch the product source', async () => {
    app = buildApp({
      logger: createLogger({ level: 'silent' }),
      productSource: {
        listProducts: () => Promise.reject(new Error('should not be called')),
        getProduct: () => Promise.reject(new Error('should not be called')),
        listCategories: () => Promise.reject(new Error('should not be called')),
      },
      trustProxyHops: 0,
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
