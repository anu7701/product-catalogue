import { ErrorCode } from '@catalogue/shared';
import { screen, within } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../helpers/render.tsx';
import { aProduct, electronics, jewelery } from '../mocks/data.ts';
import { problem } from '../mocks/handlers.ts';
import { server } from '../mocks/server.ts';

function featured(...ids: string[]) {
  server.use(
    http.get('/api/v1/featured-products', () =>
      HttpResponse.json({ items: ids.map((id) => aProduct({ id, title: `Product ${id}` })) }),
    ),
  );
}

describe('HomePage', () => {
  it('HOM-01 AC: shows exactly the featured products, in the configured order', async () => {
    featured('3', '7', '12', '1', '18');
    renderApp('/');

    const list = await screen.findByRole('list', { name: 'Top rated products' });
    expect(
      within(list)
        .getAllByRole('heading')
        .map((heading) => heading.textContent),
    ).toEqual(['Product 3', 'Product 7', 'Product 12', 'Product 1', 'Product 18']);
    expect(screen.getByRole('heading', { level: 2, name: 'Top rated' })).toBeInTheDocument();
  });

  it('HOM-01: each featured tile links to its product page', async () => {
    featured('3');
    renderApp('/');

    const list = await screen.findByRole('list', { name: 'Top rated products' });
    expect(within(list).getByRole('link')).toHaveAttribute('href', '/product/3');
  });

  it('NEW-17: no featured products → no "Top rated" section; categories still shown', async () => {
    featured();
    renderApp('/');

    expect(await screen.findByRole('list', { name: 'Categories' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Top rated' })).not.toBeInTheDocument();
  });

  it('HOM-02: "Shop by category" links to every category page', async () => {
    renderApp('/');

    const list = await screen.findByRole('list', { name: 'Categories' });
    expect(within(list).getByRole('link', { name: 'Electronics' })).toHaveAttribute(
      'href',
      `/category/${electronics.id}`,
    );
    expect(within(list).getByRole('link', { name: 'Jewelery' })).toHaveAttribute(
      'href',
      `/category/${jewelery.id}`,
    );
  });

  it('HOM-02 AC: clicking a category goes to that category page', async () => {
    const { user, router } = renderApp('/');

    const list = await screen.findByRole('list', { name: 'Categories' });
    await user.click(within(list).getByRole('link', { name: 'Electronics' }));

    expect(router.state.location.pathname).toBe(`/category/${electronics.id}`);
  });

  it('GLB-03: featured products unavailable → error with Try again; categories still shown', async () => {
    server.use(
      http.get('/api/v1/featured-products', () =>
        problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE),
      ),
    );
    renderApp('/');

    expect(await screen.findByRole('alert')).toHaveTextContent(
      "We couldn't load products right now.",
    );
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(await screen.findByRole('list', { name: 'Categories' })).toBeInTheDocument();
  });

  it('HOM-02: categories unavailable → featured products still shown', async () => {
    server.use(
      http.get('/api/v1/categories', () => problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE)),
    );
    renderApp('/');

    expect(await screen.findByRole('list', { name: 'Top rated products' })).toBeInTheDocument();
  });

  it('the tab title is the store name', async () => {
    renderApp('/');
    await screen.findByRole('list', { name: 'Top rated products' });
    expect(document.title).toBe('Catalogue');
  });
});
