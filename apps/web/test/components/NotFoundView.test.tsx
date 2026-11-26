import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { NotFoundView } from '../../src/components/NotFoundView.tsx';
import { renderApp, renderWithRouter } from '../helpers/render.tsx';

describe('NotFoundView (GLB-04.FR4)', () => {
  it('shows the title, message, extra links and a link home', () => {
    renderWithRouter(
      <NotFoundView title="We couldn't find that category." message="It may have moved.">
        <a href="/category/x">Electronics</a>
      </NotFoundView>,
    );

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(
      "We couldn't find that category.",
    );
    expect(screen.getByText('It may have moved.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Electronics' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute(
      'href',
      '/',
    );
  });

  it('NEW-12: an unknown address shows "Page not found" with a link home', async () => {
    renderApp('/does-not-exist');

    expect(await screen.findByRole('heading', { name: 'Page not found' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the home page' })).toHaveAttribute(
      'href',
      '/',
    );
  });
});
