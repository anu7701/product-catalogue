import { ErrorCode, problemDetailsSchema } from '@catalogue/shared';
import type { LightMyRequestResponse } from 'fastify';
import { expect } from 'vitest';
import { buildTestApp, type TestAppOptions } from './test-app.ts';

/** GET a URL on a fresh test app (closed afterwards). */
export async function get(url: string, options?: TestAppOptions): Promise<LightMyRequestResponse> {
  const app = await buildTestApp(options);
  try {
    return await app.inject({ url });
  } finally {
    await app.close();
  }
}

/** Assert a Problem Details response with the given status and code; returns the body. */
export function expectProblem(response: LightMyRequestResponse, status: number, code: ErrorCode) {
  expect(response.statusCode).toBe(status);
  const body = problemDetailsSchema.parse(response.json());
  expect(body.code).toBe(code);
  return body;
}

export function expectSourceUnavailable(response: LightMyRequestResponse) {
  return expectProblem(response, 502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE);
}
