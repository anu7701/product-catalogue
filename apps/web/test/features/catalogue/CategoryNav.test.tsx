import { ErrorCode } from '@catalogue/shared';
import { screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it } from 'vitest';
import { CategoryNav } from '../../../src/features/catalogue/CategoryNav.tsx';
import { renderWithRouter } from '../../helpers/render.tsx';
import { electronics, jewelery } from '../../mocks/data.ts';
import { problem } from '../../mocks/handlers.ts';
import { server } from '../../mocks/server.ts';

describe('CategoryNav (GLB-01)', () => {
  it('links to every category, in the order the API returns (alphabetical)', async () => {
    renderWithRouter(<CategoryNav />);

    const nav = await screen.findByRole('navigation', { name: 'Categories' });
    const links = [...nav.querySelectorAll('a')];
    expect(links.map((link) => link.textContent)).toEqual(['Electronics', 'Jewelery']);
    expect(links.map((link) => link.getAttribute('href'))).toEqual([
      `/category/${electronics.id}`,
      `/category/${jewelery.id}`,
    ]);
  });

  it('marks the current category page', async () => {
    renderWithRouter(<CategoryNav />, `/category/${jewelery.id}`);

    expect(await screen.findByRole('link', { name: 'Jewelery' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Electronics' })).not.toHaveAttribute('aria-current');
  });

  it('GLB-01 error: categories unavailable → no links, nothing broken', async () => {
    server.use(
      http.get('/api/v1/categories', () => problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE)),
    );
    const { container, queryClient } = renderWithRouter(<CategoryNav />);

    await waitFor(() => expect(queryClient.getQueryState(['categories'])?.status).toBe('error'));
    expect(screen.queryByRole('navigation')).not.toBeInTheDocument();
    expect(container).toBeEmptyDOMElement();
  });
});
