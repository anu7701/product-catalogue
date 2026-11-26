import { ErrorCode } from '@catalogue/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { FixtureProductSource } from '../../src/adapters/fixture/fixture-product-source.ts';
import { createLogger } from '../../src/logging/create-logger.ts';
import { buildApp } from '../../src/http/app.ts';
import { BODY_LIMIT_BYTES } from '../../src/http/security.ts';

let app: FastifyInstance;

beforeEach(async () => {
  app = buildApp({
    logger: createLogger({ level: 'silent' }),
    productSource: await FixtureProductSource.load(),
    trustProxyHops: 0,
  });
  app.post('/test/echo', (request) => ({ size: JSON.stringify(request.body).length }));
});

afterEach(async () => {
  await app.close();
});

describe('security baseline (ARCHITECTURE §10.1)', () => {
  it('sends security headers with a strict CSP', async () => {
    const { headers } = await app.inject({ url: '/api/v1/health' });

    expect(headers['content-security-policy']).toBe("default-src 'none';frame-ancestors 'none'");
    expect(headers['x-content-type-options']).toBe('nosniff');
    expect(headers['referrer-policy']).toBe('no-referrer');
    expect(headers['x-frame-options']).toBe('SAMEORIGIN');
    expect(headers['x-powered-by']).toBeUndefined();
  });

  it('T4: responses are not cacheable by default', async () => {
    const ok = await app.inject({ url: '/api/v1/health' });
    const notFound = await app.inject({ url: '/api/v1/nope' });

    expect(ok.headers['cache-control']).toBe('no-store');
    expect(notFound.headers['cache-control']).toBe('no-store');
  });

  it('a route can still set its own Cache-Control', async () => {
    app.get('/test/cached', (_request, reply) =>
      reply.header('cache-control', 'max-age=60').send({}),
    );
    expect((await app.inject({ url: '/test/cached' })).headers['cache-control']).toBe('max-age=60');
  });

  it('no CORS: cross-origin requests get no Access-Control-Allow-Origin', async () => {
    const get = await app.inject({
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example' },
    });
    const preflight = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/health',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });

    expect(get.headers['access-control-allow-origin']).toBeUndefined();
    expect(preflight.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('accepts a body under the 10 KB limit', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      payload: { message: 'x'.repeat(1000) },
    });
    expect(response.statusCode).toBe(200);
  });

  it('rejects a body over the 10 KB limit with 413 Problem Details', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/test/echo',
      payload: { message: 'x'.repeat(BODY_LIMIT_BYTES) },
    });

    expect(response.statusCode).toBe(413);
    expect(response.json()).toMatchObject({ status: 413, code: ErrorCode.VALIDATION_FAILED });
  });
});

describe('client IP behind proxies (R-07)', () => {
  async function ipSeenWith(trustProxyHops: number) {
    const ipApp = buildApp({
      logger: createLogger({ level: 'silent' }),
      productSource: await FixtureProductSource.load(),
      trustProxyHops,
    });
    ipApp.get('/test/ip', (request) => ({ ip: request.ip }));
    // The client forged 6.6.6.6; the one trusted proxy (Nginx) appended the real 203.0.113.7.
    const response = await ipApp.inject({
      url: '/test/ip',
      remoteAddress: '10.0.0.2',
      headers: { 'x-forwarded-for': '6.6.6.6, 203.0.113.7' },
    });
    await ipApp.close();
    return response.json<{ ip: string }>().ip;
  }

  it('with 1 trusted hop, uses the address the proxy saw, not the forged one', async () => {
    expect(await ipSeenWith(1)).toBe('203.0.113.7');
  });

  it('with 0 trusted hops, ignores X-Forwarded-For entirely', async () => {
    expect(await ipSeenWith(0)).toBe('10.0.0.2');
  });
});
