import { QueryClient } from '@tanstack/react-query';
import { isRetryable } from '../api/client.ts';

/**
 * Server-state handling (ARCHITECTURE §2, T4). TanStack Query is used for
 * request state (loading / error / retry), not as a cache: data is always
 * refetched when a page is opened, and nothing is kept once unused.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 0,
        gcTime: 0,
        refetchOnWindowFocus: false,
        // Retry a failed read once, only when the server or network failed (ARCHITECTURE §8.2).
        retry: (failureCount, error) => failureCount < 1 && isRetryable(error),
      },
      mutations: {
        // Never resubmit automatically: a retried enquiry could send two emails (NEW-42).
        retry: false,
      },
    },
  });
}
