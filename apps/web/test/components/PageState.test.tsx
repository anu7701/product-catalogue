import { ErrorCode } from '@catalogue/shared';
import { useQuery } from '@tanstack/react-query';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { api } from '../../src/api/client.ts';
import { QueryView } from '../../src/components/PageState.tsx';
import { problem } from '../mocks/handlers.ts';
import { server } from '../mocks/server.ts';
import { renderWithRouter } from '../helpers/render.tsx';

/** A tiny page using QueryView over the real API client. */
function CategoriesProbe() {
  const query = useQuery({
    queryKey: ['categories'],
    queryFn: ({ signal }) => api.categories(signal),
  });
  return (
    <QueryView
      query={query}
      notFound={<p>Custom not found</p>}
      empty={<p>No categories yet.</p>}
      isEmpty={(data) => data.items.length === 0}
    >
      {(data) => (
        <ul>
          {data.items.map((category) => (
            <li key={category.id}>{category.name}</li>
          ))}
        </ul>
      )}
    </QueryView>
  );
}

describe('QueryView (GLB-03)', () => {
  it('GLB-03.FR1: shows a loading status, then the content', async () => {
    renderWithRouter(<CategoriesProbe />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading…');
    expect(await screen.findByText('Electronics')).toBeInTheDocument();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('GLB-03.FR2: source down → friendly alert, no technical details', async () => {
    server.use(
      http.get('/api/v1/categories', () => problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE)),
    );
    renderWithRouter(<CategoriesProbe />);

    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent("We couldn't load products right now.");
    expect(alert).not.toHaveTextContent(/502|request|stack/i);
  });

  it('GLB-03 AC: Try again reloads, and the content appears once the API recovers', async () => {
    server.use(
      http.get('/api/v1/categories', () => problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE), {
        once: true,
      }),
    );
    const { user } = renderWithRouter(<CategoriesProbe />);

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByText('Electronics')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('Try again while still down shows the error again, without crashing', async () => {
    server.use(
      http.get('/api/v1/categories', () => problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE)),
    );
    const { user } = renderWithRouter(<CategoriesProbe />);

    await user.click(await screen.findByRole('button', { name: 'Try again' }));

    expect(await screen.findByRole('alert')).toBeInTheDocument();
  });

  it('an unexpected or non-API error → generic message', async () => {
    server.use(http.get('/api/v1/categories', () => new HttpResponse('<html>', { status: 500 })));
    renderWithRouter(<CategoriesProbe />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Something went wrong. Please try again.',
    );
  });

  it('CAT-02 / PRD-02: a not-found code shows the not-found view, not the error', async () => {
    server.use(http.get('/api/v1/categories', () => problem(404, ErrorCode.CATEGORY_NOT_FOUND)));
    renderWithRouter(<CategoriesProbe />);

    expect(await screen.findByText('Custom not found')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('GLB-03.FR3: empty data shows the empty state', async () => {
    server.use(http.get('/api/v1/categories', () => HttpResponse.json({ items: [] })));
    renderWithRouter(<CategoriesProbe />);

    expect(await screen.findByText('No categories yet.')).toBeInTheDocument();
  });
});
