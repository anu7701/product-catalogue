import { searchMessages } from '@catalogue/shared';
import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { searchPath, SearchBar } from '../../../src/features/search/SearchBar.tsx';
import { renderApp, renderWithRouter } from '../../helpers/render.tsx';

function input() {
  return screen.getByRole('searchbox', { name: 'Search products' });
}

describe('SearchBar (SRC-01)', () => {
  it('has a labelled search field and a Search button inside a search landmark', () => {
    renderWithRouter(<SearchBar />);

    expect(screen.getByRole('search')).toContainElement(input());
    expect(screen.getByRole('button', { name: 'Search' })).toBeInTheDocument();
  });

  it('SRC-01 AC: clicking Search goes to the results for the term', async () => {
    const { user, router } = renderWithRouter(<SearchBar />);

    await user.type(input(), 'backpack');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(router.state.location.pathname).toBe('/search');
    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('backpack');
  });

  it('A15: pressing Enter also searches', async () => {
    const { user, router } = renderWithRouter(<SearchBar />);

    await user.type(input(), 'backpack{Enter}');

    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('backpack');
  });

  it('A13: the term is trimmed; inner spaces are kept', async () => {
    const { user, router } = renderWithRouter(<SearchBar />);

    await user.type(input(), '  slim  fit {Enter}');

    expect(new URLSearchParams(router.state.location.search).get('q')).toBe('slim  fit');
  });

  it.each(['', '   '])('A13: blank term %j → hint, no navigation', async (term) => {
    const { user, router } = renderWithRouter(<SearchBar />, '/product/1');

    if (term) await user.type(input(), term);
    await user.click(screen.getByRole('button', { name: 'Search' }));

    expect(screen.getByText(searchMessages.empty)).toBeInTheDocument();
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    expect(input()).toHaveAccessibleDescription(searchMessages.empty);
    expect(router.state.location.pathname).toBe('/product/1');
  });

  it('the hint clears when the customer types again', async () => {
    const { user } = renderWithRouter(<SearchBar />);

    await user.click(screen.getByRole('button', { name: 'Search' }));
    await user.type(input(), 'b');

    expect(screen.queryByText(searchMessages.empty)).not.toBeInTheDocument();
  });

  it.each(["men's", 'a & b', '50%', 'what?', '#1', '<b>x</b>'])(
    'SRC-01: special characters survive into the URL: %j',
    async (term) => {
      const { user, router } = renderWithRouter(<SearchBar />);

      await user.type(input(), term);
      await user.click(screen.getByRole('button', { name: 'Search' }));

      expect(new URLSearchParams(router.state.location.search).get('q')).toBe(term);
    },
  );

  it('NEW-24: the field does not accept more than 100 characters', () => {
    renderWithRouter(<SearchBar />);
    expect(input()).toHaveAttribute('maxLength', '100');
  });

  it('NEW-25: pre-filled with the current term on the results page', () => {
    renderWithRouter(<SearchBar />, '/search?q=slim%20fit');
    expect(input()).toHaveValue('slim fit');
  });

  it('NEW-25: follows the URL when a new search happens', async () => {
    const { user } = renderWithRouter(<SearchBar />, '/search?q=bag');

    await user.clear(input());
    await user.type(input(), 'ring{Enter}');

    expect(input()).toHaveValue('ring');
  });

  it('searchPath builds an encoded results URL', () => {
    expect(searchPath('a & b')).toBe('/search?q=a+%26+b');
  });

  it('A19: the search bar is on every page', async () => {
    renderApp('/does-not-exist');
    expect(await screen.findByRole('search')).toBeInTheDocument();
  });
});
