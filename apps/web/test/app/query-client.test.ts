import { ErrorCode } from '@catalogue/shared';
import { describe, expect, it } from 'vitest';
import { ApiError } from '../../src/api/client.ts';
import { createQueryClient } from '../../src/app/query-client.ts';

describe('query client policy', () => {
  const { queries, mutations } = createQueryClient().getDefaultOptions();
  const retry = queries?.retry as (failureCount: number, error: unknown) => boolean;

  it('T4: no client-side caching (data refetched when a page opens)', () => {
    expect(queries?.staleTime).toBe(0);
    expect(queries?.gcTime).toBe(0);
  });

  it('ARCH §8.2: retries a read once on a server or network error', () => {
    const serverError = new ApiError({ status: 502, code: ErrorCode.PRODUCT_SOURCE_UNAVAILABLE });
    expect(retry(0, serverError)).toBe(true);
    expect(retry(1, serverError)).toBe(false);
    expect(retry(0, new ApiError({ status: 0, code: ErrorCode.INTERNAL_ERROR }))).toBe(true);
  });

  it('never retries not-found or other client errors', () => {
    expect(retry(0, new ApiError({ status: 404, code: ErrorCode.PRODUCT_NOT_FOUND }))).toBe(false);
    expect(retry(0, new ApiError({ status: 400, code: ErrorCode.VALIDATION_FAILED }))).toBe(false);
  });

  it('NEW-42: never retries a submission (no duplicate enquiry emails)', () => {
    expect(mutations?.retry).toBe(false);
  });
});
