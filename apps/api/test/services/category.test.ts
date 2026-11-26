import { describe, expect, it } from 'vitest';
import {
  categoryId,
  categoryLabel,
  isSameCategoryId,
  toCategory,
  uuidV5,
} from '../../src/services/category.ts';

describe('uuidV5', () => {
  it('matches the RFC 9562 test vector (DNS namespace, "www.example.com")', () => {
    expect(uuidV5('www.example.com', '6ba7b810-9dad-11d1-80b4-00c04fd430c8')).toBe(
      '2ed6657d-e927-568b-95e1-2665a8aea6a2',
    );
  });

  it('rejects an invalid namespace', () => {
    expect(() => uuidV5('x', 'not-a-uuid')).toThrow();
  });
});

describe('category IDs (T15)', () => {
  it('are version-5 UUIDs', () => {
    expect(categoryId('electronics')).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-5[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
    );
  });

  it('are deterministic, so links survive restarts', () => {
    expect(categoryId("men's clothing")).toBe(categoryId("men's clothing"));
  });

  it('differ per category name', () => {
    expect(categoryId("men's clothing")).not.toBe(categoryId("women's clothing"));
  });

  it('NEW-23: match case-insensitively', () => {
    const id = categoryId('jewelery');
    expect(isSameCategoryId(id.toUpperCase(), id)).toBe(true);
    expect(isSameCategoryId(categoryId('electronics'), id)).toBe(false);
  });
});

describe('category labels (NEW-02)', () => {
  it.each([
    ["men's clothing", "Men's clothing"],
    ['electronics', 'Electronics'],
    ['jewelery', 'Jewelery'],
    ['', ''],
  ])('%j → %j', (name, label) => {
    expect(categoryLabel(name)).toBe(label);
  });

  it('toCategory combines ID and label', () => {
    expect(toCategory('electronics')).toEqual({
      id: categoryId('electronics'),
      name: 'Electronics',
    });
  });
});
