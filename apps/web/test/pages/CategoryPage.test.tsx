import { ErrorCode } from '@catalogue/shared';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../helpers/render.tsx';
import { aProduct, electronics } from '../mocks/data.ts';
import { problem } from '../mocks/handlers.ts';
import { server } from '../mocks/server.ts';

function categoryPage(topRated: string[], more: string[]) {
  server.use(
    http.get('/api/v1/categories/:categoryId/products', () =>
      HttpResponse.json({
        category: electronics,
        topRated: topRated.map((id) => aProduct({ id, title: `Product ${id}` })),
        more: more.map((id) => aProduct({ id, title: `Product ${id}` })),
      }),
    ),
  );
}

const titlesIn = (list: HTMLElement) =>
  within(list)
    .getAllByRole('heading')
    .map((heading) => heading.textContent);

describe('CategoryPage', () => {
  it('CAT-01 AC: shows top rated products, then additional products, under the category name', async () => {
    categoryPage(['12', '11', '9'], ['10', '13', '14']);
    renderApp(`/category/${electronics.id}`);

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Electronics' }),
    ).toBeInTheDocument();
    expect(titlesIn(screen.getByRole('list', { name: 'Top rated in Electronics' }))).toEqual([
      'Product 12',
      'Product 11',
      'Product 9',
    ]);
    expect(titlesIn(screen.getByRole('list', { name: 'More in Electronics' }))).toEqual([
      'Product 10',
      'Product 13',
      'Product 14',
    ]);
    expect(document.title).toBe('Electronics | Catalogue');
  });

  it('BR8: no "More in…" products → that section is hidden', async () => {
    categoryPage(['1', '2'], []);
    renderApp(`/category/${electronics.id}`);

    await screen.findByRole('list', { name: 'Top rated in Electronics' });
    expect(screen.queryByRole('heading', { name: 'More in Electronics' })).not.toBeInTheDocument();
  });

  it('NEW-07: no rated products → "Top rated" section hidden, all under "More in…"', async () => {
    categoryPage([], ['1', '2']);
    renderApp(`/category/${electronics.id}`);

    await screen.findByRole('list', { name: 'More in Electronics' });
    expect(
      screen.queryByRole('heading', { name: 'Top rated in Electronics' }),
    ).not.toBeInTheDocument();
  });

  it('NEW-22: category with no products → empty message', async () => {
    categoryPage([], []);
    renderApp(`/category/${electronics.id}`);

    expect(
      await screen.findByText('There are no products in this category yet.'),
    ).toBeInTheDocument();
  });

  it('CAT-02 AC: unknown category → not-found with links to every real category', async () => {
    renderApp('/category/00000000-0000-5000-8000-000000000000');

    expect(
      await screen.findByRole('heading', { name: "We couldn't find that category." }),
    ).toBeInTheDocument();
    const links = await screen.findByRole('list', { name: 'All categories' });
    expect(
      within(links)
        .getAllByRole('link')
        .map((link) => link.textContent),
    ).toEqual(['Electronics', 'Jewelery']);
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toBeInTheDocument();
  });

  it('CAT-02 AC: source unavailable → error with Try again, not "category not found"', async () => {
    server.use(
      http.get('/api/v1/categories/:categoryId/products', () =>
        problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE),
      ),
    );
    renderApp(`/category/${electronics.id}`);

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText("We couldn't find that category.")).not.toBeInTheDocument();
  });

  it('PRD-01: clicking a tile opens the product page', async () => {
    categoryPage(['12'], []);
    const { user, router } = renderApp(`/category/${electronics.id}`);

    await user.click(await screen.findByRole('heading', { name: 'Product 12' }));

    expect(router.state.location.pathname).toBe('/product/12');
  });
});
