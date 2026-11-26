import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { documentTitle, useDocumentTitle } from '../../src/app/useDocumentTitle.ts';
import { renderApp } from '../helpers/render.tsx';

function Titled({ title }: { title?: string }) {
  useDocumentTitle(title);
  return null;
}

describe('document titles (CFG-04, NEW-29)', () => {
  it('formats "Page | Store", or the store name alone', () => {
    expect(documentTitle('Backpack')).toBe('Backpack | Catalogue');
    expect(documentTitle()).toBe('Catalogue');
  });

  it('sets and updates the browser tab title', () => {
    const { rerender } = render(<Titled title="Backpack" />);
    expect(document.title).toBe('Backpack | Catalogue');

    rerender(<Titled title="Gold ring" />);
    expect(document.title).toBe('Gold ring | Catalogue');
  });

  it('the not-found page sets its title', async () => {
    renderApp('/nope');
    await screen.findByRole('heading', { name: 'Page not found' });
    expect(document.title).toBe('Page not found | Catalogue');
  });
});
