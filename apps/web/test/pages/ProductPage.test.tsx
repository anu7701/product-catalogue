import { ErrorCode } from '@catalogue/shared';
import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../helpers/render.tsx';
import { aProduct, electronics } from '../mocks/data.ts';
import { problem } from '../mocks/handlers.ts';
import { server } from '../mocks/server.ts';

const backpack = aProduct({
  id: '1',
  title: 'Fjallraven Backpack',
  price: 109.95,
  description: 'Your perfect pack for everyday use.\nFits 15-inch laptops.',
  rating: { average: 3.9, count: 120 },
});

function serveProduct(product = backpack) {
  server.use(http.get('/api/v1/products/:productId', () => HttpResponse.json(product)));
}

describe('ProductPage', () => {
  it('PRD-01 AC: shows image, title, price, category, rating and full description', async () => {
    serveProduct();
    renderApp('/product/1');

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fjallraven Backpack' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Fjallraven Backpack' })).toHaveAttribute(
      'src',
      '/api/v1/products/1/image',
    );
    expect(screen.getByText('$109.95')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Rated 3.9 out of 5 from 120 ratings' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your perfect pack for everyday use\.\s+Fits 15-inch laptops\./),
    ).toBeInTheDocument();
  });

  it('PRD-01.FR3: the category links to its category page', async () => {
    serveProduct();
    const { user, router } = renderApp('/product/1');

    await user.click(await screen.findByRole('link', { name: 'Electronics' }));

    expect(router.state.location.pathname).toBe(`/category/${electronics.id}`);
  });

  it('PRD-01.FR5 / NEW-29: the tab title includes the product title', async () => {
    serveProduct();
    renderApp('/product/1');

    await screen.findByRole('heading', { level: 1, name: 'Fjallraven Backpack' });
    expect(document.title).toBe('Fjallraven Backpack | Catalogue');
  });

  it('NEW-07: an unrated product shows no rating', async () => {
    serveProduct(aProduct({ id: '1', title: 'Gold ring', rating: null }));
    renderApp('/product/1');

    await screen.findByRole('heading', { level: 1, name: 'Gold ring' });
    expect(screen.queryByRole('img', { name: /Rated/ })).not.toBeInTheDocument();
  });

  it.each(['999', 'SKU-1042'])(
    'PRD-02 AC: unknown ID %j → not-found with ways back',
    async (id) => {
      renderApp(`/product/${id}`);

      expect(
        await screen.findByRole('heading', { name: "We couldn't find that product." }),
      ).toBeInTheDocument();
      expect(screen.getByText('It may no longer be available.')).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute(
        'href',
        '/',
      );
      expect(await screen.findByRole('list', { name: 'Browse a category' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Enquire' })).not.toBeInTheDocument();
    },
  );

  it('PRD-02: source unavailable → error with Try again, not "product not found"', async () => {
    server.use(
      http.get('/api/v1/products/:productId', () =>
        problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE),
      ),
    );
    renderApp('/product/1');

    expect(await screen.findByRole('button', { name: 'Try again' })).toBeInTheDocument();
    expect(screen.queryByText("We couldn't find that product.")).not.toBeInTheDocument();
  });

  it('PRD-01 AC: clicking a tile elsewhere opens this page', async () => {
    const { user } = renderApp('/');

    await user.click(await screen.findByRole('heading', { name: 'Backpack' }));

    expect(await screen.findByRole('heading', { level: 1, name: 'Backpack' })).toBeInTheDocument();
  });
});
