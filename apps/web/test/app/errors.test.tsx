import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import { ErrorBoundary } from '../../src/app/ErrorBoundary.tsx';
import { Layout } from '../../src/app/Layout.tsx';
import { createQueryClient } from '../../src/app/query-client.ts';
import { RouteError } from '../../src/app/RouteError.tsx';

function Broken(): never {
  throw new Error('db password is hunter2');
}

let consoleError: MockInstance<typeof console.error>;
beforeEach(() => {
  // React and the boundaries log the crash; keep test output clean.
  consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  consoleError.mockRestore();
});

describe('error boundaries (ARCHITECTURE §8.2)', () => {
  it('a page that crashes shows the fallback below the header', async () => {
    // Same structure as routes.tsx: layout → error scope → page.
    const router = createMemoryRouter([
      {
        path: '/',
        element: <Layout />,
        children: [
          { errorElement: <RouteError />, children: [{ index: true, element: <Broken /> }] },
        ],
      },
    ]);
    render(
      <QueryClientProvider client={createQueryClient()}>
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );

    expect(
      await screen.findByRole('heading', { name: 'Something went wrong' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Reload the page' })).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('hunter2');
    expect(consoleError).toHaveBeenCalled();
  });

  it('the outer boundary catches anything else, with no technical details', () => {
    render(
      <ErrorBoundary>
        <Broken />
      </ErrorBoundary>,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Something went wrong. Please try again.');
    expect(document.body).not.toHaveTextContent('hunter2');
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
