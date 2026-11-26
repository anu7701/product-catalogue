import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { formatPrice, Price } from '../../src/components/Price.tsx';

describe('Price (A22)', () => {
  it.each([
    [109.95, '$109.95'],
    [22.3, '$22.30'],
    [1109.5, '$1,109.50'],
    [0, '$0.00'], // NEW-08: shown, not hidden
  ])('%d → %s', (price, text) => {
    expect(formatPrice(price)).toBe(text);
  });

  it('renders the formatted price', () => {
    render(<Price price={64} />);
    expect(screen.getByText('$64.00')).toBeInTheDocument();
  });
});
