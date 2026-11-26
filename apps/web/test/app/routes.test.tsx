import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../helpers/render.tsx';
import { electronics } from '../mocks/data.ts';

describe('routes (GLB-04)', () => {
  it.each([
    ['/', 'Home'],
    [`/category/${electronics.id}`, 'Electronics'],
    ['/search?q=bag', 'Results for “bag”'],
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
