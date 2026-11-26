import { QueryClientProvider } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { createMemoryRouter, RouterProvider, type RouteObject } from 'react-router';
import { createQueryClient } from '../../src/app/query-client.ts';
import { routes as appRoutes } from '../../src/app/routes.tsx';

/** Render the whole app at a URL, with a fresh query client (no retries, so errors show at once). */
export function renderApp(url = '/') {
  return renderRoutes(appRoutes, url);
}

/** Render a single element inside a router (for components that use Link etc.). */
export function renderWithRouter(element: ReactElement, url = '/') {
  return renderRoutes([{ path: '*', element }], url);
}

function renderRoutes(routes: RouteObject[], url: string) {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({
    queries: { ...queryClient.getDefaultOptions().queries, retry: false },
  });
  const router = createMemoryRouter(routes, { initialEntries: [url] });
  const user = userEvent.setup();
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router, user, queryClient };
}
