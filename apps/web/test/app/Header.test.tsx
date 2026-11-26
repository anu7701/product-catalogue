import { ErrorCode } from '@catalogue/shared';
import { screen, within } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../helpers/render.tsx';
import { problem } from '../mocks/handlers.ts';
import { server } from '../mocks/server.ts';

describe('Header (GLB-01)', () => {
  it.each(['/', '/product/1', '/search?q=bag', '/does-not-exist'])(
    'GLB-01.FR1: on %s shows the store name, search and category links',
    async (url) => {
      renderApp(url);

      const header = screen.getByRole('banner');
      expect(within(header).getByRole('link', { name: 'Catalogue' })).toHaveAttribute('href', '/');
      expect(within(header).getByRole('search')).toBeInTheDocument();
      expect(
        await within(header).findByRole('navigation', { name: 'Categories' }),
      ).toBeInTheDocument();
    },
  );

  it('GLB-01 AC: clicking the store name goes home', async () => {
    const { user, router } = renderApp('/product/1');

    await user.click(within(screen.getByRole('banner')).getByRole('link', { name: 'Catalogue' }));

    expect(router.state.location.pathname).toBe('/');
  });

  it('GLB-01 error: categories unavailable → header still has name and search', async () => {
    server.use(
      http.get('/api/v1/categories', () => problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE)),
    );
    renderApp('/does-not-exist');

    const header = screen.getByRole('banner');
    expect(within(header).getByRole('link', { name: 'Catalogue' })).toBeInTheDocument();
    expect(within(header).getByRole('search')).toBeInTheDocument();
    await screen.findByRole('heading', { name: 'Page not found' });
    expect(within(header).queryByRole('navigation')).not.toBeInTheDocument();
  });
});
