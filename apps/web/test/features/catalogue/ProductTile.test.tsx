import { fireEvent, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_IMAGE } from '../../../src/features/catalogue/product-image.ts';
import { ProductGrid } from '../../../src/features/catalogue/ProductGrid.tsx';
import { ProductTile } from '../../../src/features/catalogue/ProductTile.tsx';
import { renderWithRouter } from '../../helpers/render.tsx';
import { aProduct } from '../../mocks/data.ts';

describe('ProductTile (GLB-02)', () => {
  const product = aProduct({ id: '1', title: 'Fjallraven Backpack', price: 109.95 });

  it('shows image, title, price and rating', () => {
    renderWithRouter(<ProductTile product={product} />);

    expect(screen.getByRole('img', { name: 'Fjallraven Backpack' })).toHaveAttribute(
      'src',
      '/api/v1/products/1/image',
    );
    expect(screen.getByRole('heading', { name: 'Fjallraven Backpack' })).toBeInTheDocument();
    expect(screen.getByText('$109.95')).toBeInTheDocument();
    expect(screen.getByText('3.9 (120)', { exact: false })).toBeInTheDocument();
  });

  it('A20: the whole tile is one link to the product page', () => {
    renderWithRouter(<ProductTile product={product} />);

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', '/product/1');
    expect(link).toContainElement(screen.getByRole('heading'));
    expect(link).toContainElement(screen.getByText('$109.95'));
  });

  it('PRD-01: clicking the tile navigates to the product page', async () => {
    const { user, router } = renderWithRouter(<ProductTile product={product} />);

    await user.click(screen.getByRole('heading', { name: 'Fjallraven Backpack' }));

    expect(router.state.location.pathname).toBe('/product/1');
  });

  it('A4a: opaque IDs are encoded in the link', () => {
    renderWithRouter(<ProductTile product={aProduct({ id: 'SKU/1 2' })} />);
    expect(screen.getByRole('link')).toHaveAttribute('href', '/product/SKU%2F1%202');
  });

  it('NEW-06: a broken image is replaced by the placeholder, once', () => {
    renderWithRouter(<ProductTile product={product} />);
    const image = screen.getByRole('img', { name: 'Fjallraven Backpack' });

    fireEvent.error(image);
    expect(image.getAttribute('src')).toBe(PLACEHOLDER_IMAGE);

    fireEvent.error(image); // the placeholder failing too must not loop
    expect(image.getAttribute('src')).toBe(PLACEHOLDER_IMAGE);
  });

  it('NEW-07: no rating shown for an unrated product', () => {
    renderWithRouter(<ProductTile product={aProduct({ rating: null })} />);
    expect(screen.queryByText(/\(\d+\)/)).not.toBeInTheDocument();
  });

  it('NEW-08: a price of 0 is shown as $0.00', () => {
    renderWithRouter(<ProductTile product={aProduct({ price: 0 })} />);
    expect(screen.getByText('$0.00')).toBeInTheDocument();
  });

  it('NEW-05: a long title is kept in full for screen readers (truncation is visual only)', () => {
    const title = 'A '.repeat(100).trim();
    renderWithRouter(<ProductTile product={aProduct({ title })} />);
    expect(screen.getByRole('heading')).toHaveTextContent(title);
  });
});

describe('ProductGrid', () => {
  it('renders a labelled list with one tile per product, in order', () => {
    const products = [aProduct({ id: '1', title: 'One' }), aProduct({ id: '2', title: 'Two' })];
    renderWithRouter(<ProductGrid products={products} label="Top rated" />);

    const list = screen.getByRole('list', { name: 'Top rated' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getAllByRole('heading').map((heading) => heading.textContent)).toEqual([
      'One',
      'Two',
    ]);
  });
});
