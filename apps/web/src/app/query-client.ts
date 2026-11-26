import { QueryClient } from '@tanstack/react-query';

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
        retry: 1,
      },
      mutations: {
        // Never resubmit automatically: a retried enquiry could send two emails (NEW-42).
        retry: false,
      },
    },
  });
}
