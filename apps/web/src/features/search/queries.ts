import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.ts';

/** Search results for a valid term; does nothing until `enabled` (SRC-02). */
export function useSearch(term: string, enabled: boolean) {
  return useQuery({
    queryKey: ['search', term],
    queryFn: ({ signal }) => api.search(term, signal),
    enabled,
  });
}
