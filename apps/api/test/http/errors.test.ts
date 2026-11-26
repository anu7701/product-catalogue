import { ErrorCode, errorMessages, problemDetailsSchema } from '@catalogue/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import {
  CategoryNotFoundError,
  EmailDeliveryFailedError,
  ProductNotFoundError,
  ProductUnavailableError,
  UpstreamUnavailableError,
  ValidationFailedError,
} from '../../src/domain/errors.ts';
import { LogEvent } from '../../src/logging/logger.ts';
import { buildTestApp, captureLogger } from '../helpers/test-app.ts';

let app: FastifyInstance | undefined;
let logLines: Record<string, unknown>[] = [];

afterEach(async () => {
  await app?.close();
  app = undefined;
  logLines = [];
});

/** App with one test route that throws `error`. */
async function appThrowing(error: unknown) {
  const captured = captureLogger();
  logLines = captured.lines;
  app = await buildTestApp({ logger: captured.logger });
  app.get('/test/throw', () => {
    throw error;
  });
  app.post('/test/echo', (request) => request.body);
  return app;
}

function expectProblem(
  response: { statusCode: number; headers: Record<string, unknown>; json: () => unknown },
  status: number,
  code: string,
) {
  const body = problemDetailsSchema.parse(response.json());
  expect(response.statusCode).toBe(status);
  expect(response.headers['content-type']).toContain('application/problem+json');
  expect(body).toMatchObject({ status, code, title: errorMessages[code as ErrorCode] });
  expect(body.requestId).toBe(response.headers['x-request-id']);
  return body;
}

describe('error handling (ARCHITECTURE §8)', () => {
  it.each([
    [new ProductNotFoundError('7'), 404, ErrorCode.PRODUCT_NOT_FOUND],
    [new CategoryNotFoundError('x'), 404, ErrorCode.CATEGORY_NOT_FOUND],
    [new ProductUnavailableError('7'), 422, ErrorCode.PRODUCT_UNAVAILABLE],
    [
      new UpstreamUnavailableError('Fake Store timed out'),
      502,
      ErrorCode.PRODUCT_SOURCE_UNAVAILABLE,
    ],
    [new EmailDeliveryFailedError('SMTP 554'), 502, ErrorCode.EMAIL_DELIVERY_FAILED],
  ])('%s → %i %s', async (error, status, code) => {
    const response = await (await appThrowing(error)).inject({ url: '/test/throw' });
    expectProblem(response, status, code);
  });

  it('ENQ-02: validation errors carry per-field messages', async () => {
    const error = new ValidationFailedError({ email: 'Please enter your email address.' });
    const response = await (await appThrowing(error)).inject({ url: '/test/throw' });

    const body = expectProblem(response, 400, ErrorCode.VALIDATION_FAILED);
    expect(body.errors).toEqual({ email: 'Please enter your email address.' });
  });

  it('A43: an unexpected error → 500 with no stack trace or internal message', async () => {
    const response = await (
      await appThrowing(new Error('db password is hunter2 at /srv/app.ts:42'))
    ).inject({ url: '/test/throw' });

    expectProblem(response, 500, ErrorCode.INTERNAL_ERROR);
    expect(response.body).not.toMatch(/hunter2|app\.ts|stack|at /);
    // …but the details are logged for operators.
    expect(logLines.some((line) => JSON.stringify(line).includes('hunter2'))).toBe(true);
  });

  it('A43: upstream details are logged, not returned, and tagged product_source.failed', async () => {
    const response = await (
      await appThrowing(
        new UpstreamUnavailableError('https://fakestoreapi.com/products responded 503'),
      )
    ).inject({ url: '/test/throw' });

    expect(response.body).not.toContain('fakestoreapi');
    expect(logLines).toContainEqual(
      expect.objectContaining({ event: LogEvent.productSourceFailed, level: 50 }),
    );
  });

  it('R-14: unknown API paths → 404 Problem Details, not HTML', async () => {
    const response = await (await appThrowing(new Error())).inject({ url: '/api/v1/nope' });
    expectProblem(response, 404, ErrorCode.NOT_FOUND);
  });

  it('malformed JSON body → 400 VALIDATION_FAILED', async () => {
    const response = await (
      await appThrowing(new Error())
    ).inject({
      method: 'POST',
      url: '/test/echo',
      headers: { 'content-type': 'application/json' },
      payload: '{"name":',
    });
    expectProblem(response, 400, ErrorCode.VALIDATION_FAILED);
  });
});

describe('request IDs', () => {
  it('reuses a safe incoming X-Request-Id', async () => {
    const response = await (
      await appThrowing(new ProductNotFoundError('1'))
    ).inject({
      url: '/test/throw',
      headers: { 'x-request-id': 'abc-123' },
    });
    expect(response.headers['x-request-id']).toBe('abc-123');
    expect(response.json()).toMatchObject({ requestId: 'abc-123' });
  });

  it('replaces an unsafe incoming X-Request-Id (log injection)', async () => {
    const response = await (
      await appThrowing(new ProductNotFoundError('1'))
    ).inject({
      url: '/test/throw',
      headers: { 'x-request-id': 'x\n{"level":60}' },
    });
    expect(response.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('every response carries a request ID, including successes', async () => {
    const response = await (await appThrowing(new Error())).inject({ url: '/api/v1/health' });
    expect(response.headers['x-request-id']).toEqual(expect.any(String));
  });
});
