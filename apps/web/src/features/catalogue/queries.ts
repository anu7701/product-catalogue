import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client.ts';

/** Every category, alphabetical (GLB-01, HOM-02). */
export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => api.categories(signal),
  });
}
