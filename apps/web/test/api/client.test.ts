import { ErrorCode, errorMessages } from '@catalogue/shared';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { ApiError, api, isNotFound, isRetryable } from '../../src/api/client.ts';
import { problem } from '../mocks/handlers.ts';
import { server } from '../mocks/server.ts';

async function errorFrom(promise: Promise<unknown>): Promise<ApiError> {
  const error = await promise.then(
    () => undefined,
    (caught: unknown) => caught,
  );
  if (!(error instanceof ApiError)) throw new Error(`expected an ApiError, got ${String(error)}`);
  return error;
}

describe('api client (ARCHITECTURE §2.2, §8.2)', () => {
  it('calls our own API on the same origin and returns the typed body', async () => {
    let requested = '';
    server.use(
      http.get('/api/v1/products/:productId', ({ request }) => {
        requested = request.url;
        return HttpResponse.json({ id: '1' });
      }),
    );

    expect(await api.product('1')).toEqual({ id: '1' });
    expect(new URL(requested).origin).toBe(window.location.origin);
  });

  it('A4a: product and category IDs are URL-encoded path segments', async () => {
    const paths: string[] = [];
    server.use(
      http.get('*', ({ request }) => {
        paths.push(new URL(request.url).pathname);
        return HttpResponse.json({});
      }),
    );

    await api.product('a/b c');
    await api.categoryProducts('x?y');
    expect(paths).toEqual(['/api/v1/products/a%2Fb%20c', '/api/v1/categories/x%3Fy/products']);
  });

  it('SRC-01: search terms are sent as typed, special characters included', async () => {
    let q: string | null = null;
    server.use(
      http.get('/api/v1/products', ({ request }) => {
        q = new URL(request.url).searchParams.get('q');
        return HttpResponse.json({ query: q, items: [] });
      }),
    );

    await api.search("men's & 50% <b>");
    expect(q).toBe("men's & 50% <b>");
  });

  it.each([
    [404, ErrorCode.PRODUCT_NOT_FOUND, true, false],
    [404, ErrorCode.CATEGORY_NOT_FOUND, true, false],
    [502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE, false, true],
    [500, ErrorCode.INTERNAL_ERROR, false, true],
    [429, ErrorCode.RATE_LIMITED, false, false],
  ] as const)(
    'Problem Details %i %s → ApiError (not found: %s, retryable: %s)',
    async (status, code, notFound, retryable) => {
      server.use(http.get('/api/v1/products/:productId', () => problem(status, code)));

      const error = await errorFrom(api.product('1'));
      expect(error).toMatchObject({ status, code, message: errorMessages[code] });
      expect(isNotFound(error)).toBe(notFound);
      expect(isRetryable(error)).toBe(retryable);
    },
  );

  it('ENQ-02: validation errors carry per-field messages', async () => {
    server.use(
      http.post('/api/v1/enquiries', () =>
        problem(400, ErrorCode.VALIDATION_FAILED, { email: 'Please enter your email address.' }),
      ),
    );

    const error = await errorFrom(api.submitEnquiry({ productId: '1', name: 'J', email: '' }));
    expect(error.code).toBe(ErrorCode.VALIDATION_FAILED);
    expect(error.fieldErrors).toEqual({ email: 'Please enter your email address.' });
    expect(error.requestId).toBe('test-request');
  });

  it('a non-API error page (e.g. proxy 504 HTML) → generic retryable ApiError', async () => {
    server.use(
      http.get(
        '/api/v1/categories',
        () => new HttpResponse('<html>Gateway Timeout</html>', { status: 504 }),
      ),
    );

    const error = await errorFrom(api.categories());
    expect(error).toMatchObject({ status: 504, code: ErrorCode.INTERNAL_ERROR });
    expect(isRetryable(error)).toBe(true);
  });

  it('no response at all (offline) → status 0, retryable', async () => {
    server.use(http.get('/api/v1/categories', () => HttpResponse.error()));

    const error = await errorFrom(api.categories());
    expect(error.status).toBe(0);
    expect(isRetryable(error)).toBe(true);
  });

  it('ENQ-03: submitEnquiry resolves on 202 and sends JSON', async () => {
    let body: unknown;
    server.use(
      http.post('/api/v1/enquiries', async ({ request }) => {
        body = await request.json();
        return new HttpResponse(null, { status: 202 });
      }),
    );

    await expect(
      api.submitEnquiry({ productId: '1', name: 'Jane', email: 'jane@example.com' }),
    ).resolves.toBeUndefined();
    expect(body).toEqual({ productId: '1', name: 'Jane', email: 'jane@example.com' });
  });

  it('isNotFound / isRetryable are false for non-API errors', () => {
    expect(isNotFound(new Error('x'))).toBe(false);
    expect(isRetryable(new Error('x'))).toBe(false);
  });
});
