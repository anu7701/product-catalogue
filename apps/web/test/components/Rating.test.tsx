import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Rating } from '../../src/components/Rating.tsx';

describe('Rating', () => {
  it('NEW-04: shows "3.9 (120)" with a full description for screen readers', () => {
    render(<Rating rating={{ average: 3.9, count: 120 }} />);

    expect(
      screen.getByRole('img', { name: 'Rated 3.9 out of 5 from 120 ratings' }),
    ).toHaveTextContent('3.9 (120)');
  });

  it('always shows one decimal', () => {
    render(<Rating rating={{ average: 4, count: 1 }} />);
    expect(screen.getByRole('img', { name: 'Rated 4.0 out of 5 from 1 rating' })).toHaveTextContent(
      '4.0 (1)',
    );
  });

  it('NEW-07: renders nothing when unrated', () => {
    const { container } = render(<Rating rating={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
