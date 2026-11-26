import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../helpers/render.tsx';

describe('routes (GLB-04)', () => {
  it.each([
    ['/', 'Home'],
    ['/category/8d88b533-0000-5000-8000-000000000000', 'Category'],
    ['/search?q=bag', 'Search'],
    ['/product/1', 'Product'],
    ['/product/1/', 'Product'], // NEW-13: trailing slash is the same page
    ['/does-not-exist', 'Page not found'],
    ['/product', 'Page not found'],
  ])('%s renders the %s page inside the layout', async (url, heading) => {
    renderApp(url);

    expect(await screen.findByRole('heading', { level: 1, name: heading })).toBeInTheDocument();
    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
  });
});
