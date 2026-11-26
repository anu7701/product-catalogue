import { describe, expect, it } from 'vitest';
import { categoryPath, productPath } from '../../../src/features/catalogue/paths.ts';

describe('page paths (GLB-04)', () => {
  it('product and category paths encode opaque IDs', () => {
    expect(productPath('1')).toBe('/product/1');
    expect(productPath('a/b?c')).toBe('/product/a%2Fb%3Fc');
    expect(categoryPath('8d88b533-1111-5000-8000-000000000001')).toBe(
      '/category/8d88b533-1111-5000-8000-000000000001',
    );
  });
});
