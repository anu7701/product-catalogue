import { ErrorCode, searchMessages } from '@catalogue/shared';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { productCount } from '../../src/pages/SearchPage.tsx';
import { renderApp } from '../helpers/render.tsx';
import { aProduct } from '../mocks/data.ts';
import { problem } from '../mocks/handlers.ts';
import { server } from '../mocks/server.ts';

/** Record search requests so tests can assert whether the API was called. */
function trackSearches() {
  const terms: (string | null)[] = [];
  server.use(
    http.get('/api/v1/products', ({ request }) => {
      const q = new URL(request.url).searchParams.get('q');
      terms.push(q);
      return HttpResponse.json({ query: q, items: [] });
    }),
  );
  return terms;
}

describe('SearchPage', () => {
  it('SRC-02 AC: shows the term, the count and only the matching products', async () => {
    server.use(
      http.get('/api/v1/products', () =>
        HttpResponse.json({
          query: 'slim fit',
          items: [
            aProduct({ id: '2', title: 'Slim Fit Tee' }),
            aProduct({ id: '4', title: 'Slim Fit Jacket' }),
          ],
        }),
      ),
    );
    renderApp('/search?q=slim%20fit');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Results for “slim fit”' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('2 products')).toBeInTheDocument();
    const list = screen.getByRole('list', { name: 'Search results' });
    expect(
      within(list)
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual(['Slim Fit Tee', 'Slim Fit Jacket']);
    expect(document.title).toBe('Results for "slim fit" | Catalogue');
  });

  it('SRC-02: sends the term as typed, special characters included', async () => {
    const terms = trackSearches();
    renderApp(`/search?q=${encodeURIComponent("men's & 50%")}`);

    await screen.findByText(/No products match/);
    expect(terms).toEqual(["men's & 50%"]);
  });

  it('SRC-02.FR3: the term is shown as text, never as markup', async () => {
    trackSearches();
    renderApp(`/search?q=${encodeURIComponent('<b>x</b>')}`);

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(
      'Results for “<b>x</b>”',
    );
  });

  it('SRC-03 AC: no matches → message, link home and category links', async () => {
    trackSearches();
    renderApp('/search?q=zzzz');

    expect(await screen.findByText('No products match “zzzz”.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute(
      'href',
      '/',
    );
    expect(await screen.findByRole('list', { name: 'Categories' })).toBeInTheDocument();
  });

  it('SRC-03.FR3 / NEW-25: the search bar stays pre-filled with the term', async () => {
    trackSearches();
    renderApp('/search?q=zzzz');

    await screen.findByText(/No products match/);
    expect(screen.getByRole('searchbox', { name: 'Search products' })).toHaveValue('zzzz');
  });

  it.each(['/search', '/search?q=', '/search?q=%20%20'])(
    'NEW-26: %s → "Enter a search term", no request made',
    async (url) => {
      const terms = trackSearches();
      renderApp(url);

      expect(await screen.findByText(searchMessages.empty)).toBeInTheDocument();
      expect(screen.queryByRole('list', { name: 'Search results' })).not.toBeInTheDocument();
      expect(terms).toEqual([]);
    },
  );

  it('R-14: a term over 100 characters in the URL → length message, no request made', async () => {
    const terms = trackSearches();
    renderApp(`/search?q=${'a'.repeat(101)}`);

    expect(await screen.findByText(searchMessages.tooLong)).toBeInTheDocument();
    expect(terms).toEqual([]);
  });

  it('A13: the term is trimmed before searching', async () => {
    const terms = trackSearches();
    renderApp('/search?q=%20%20bag%20');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Results for “bag”' }),
    ).toBeInTheDocument();
    expect(terms).toEqual(['bag']);
  });

  it('GLB-03: source unavailable → error with Try again, never "no results"', async () => {
    server.use(
      http.get('/api/v1/products', () => problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE)),
    );
    renderApp('/search?q=bag');

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText(/No products match/)).not.toBeInTheDocument();
  });

  it('SRC-01 → SRC-02: searching from the header shows the results page', async () => {
    const { user } = renderApp('/');

    await user.type(screen.getByRole('searchbox', { name: 'Search products' }), 'backpack{Enter}');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Results for “backpack”' }),
    ).toBeInTheDocument();
    expect(await screen.findByText('1 product')).toBeInTheDocument();
  });

  it('SRC-02.FR1: "1 product" / "N products"', () => {
    expect(productCount(1)).toBe('1 product');
    expect(productCount(0)).toBe('0 products');
    expect(productCount(3)).toBe('3 products');
  });
});
