import { searchMessages } from '@catalogue/shared';
import { describe, expect, it } from 'vitest';
import { FixtureProductSource } from '../../src/adapters/fixture/fixture-product-source.ts';
import { ValidationFailedError } from '../../src/domain/errors.ts';
import { SearchService } from '../../src/services/search-service.ts';
import { aProduct, inMemoryProductSource } from '../helpers/doubles.ts';

const fixtureSearch = async () =>
  new SearchService({ productSource: await FixtureProductSource.load() });

async function idsFor(term: string) {
  return (await (await fixtureSearch()).search(term)).items.map((product) => product.id);
}

describe('SearchService.search', () => {
  // SRC-02 edge-case table, against the fixture catalogue.
  it.each([
    ['backpack', ['1']],
    ['BACKPACK', ['1']], // case-insensitive
    ['pack', ['1']], // substring
    ["men's", ['1', '2', '3', '4', '5', '15', '16', '17', '18', '19', '20']], // "women's" contains "men's"
    ['jewelry', []], // no fuzzy match to "jewelery"
    ['slim fit', ['2', '4']], // whole phrase, not separate words
    ['electronics', ['9', '10', '11', '12', '13', '14']], // category is searched
    ['.*', []], // literal, not a pattern
    ['a'.repeat(100), []], // max length works
  ])('SRC-02: %j → %j', async (term, expected) => {
    expect(await idsFor(term)).toEqual(expected);
  });

  it('A13: trims the term and returns the term as applied', async () => {
    const result = await (await fixtureSearch()).search('  Backpack ');
    expect(result.query).toBe('Backpack');
    expect(result.items.map((product) => product.id)).toEqual(['1']);
  });

  it('SRC-02 BR1: matches title, description or category, and nothing else', async () => {
    const products = [
      aProduct({ id: 'title', title: 'Red Lamp' }),
      aProduct({ id: 'description', description: 'a red finish' }),
      aProduct({ id: 'category', categoryName: 'red things' }),
      aProduct({ id: 'image-only', imageRef: 'red.png' }),
    ];
    const result = await new SearchService({
      productSource: inMemoryProductSource(products),
    }).search('RED');
    expect(result.items.map((product) => product.id)).toEqual(['title', 'description', 'category']);
  });

  it('NEW-20: results keep data source order', async () => {
    const products = ['z', 'a', 'm'].map((id) => aProduct({ id, title: 'match' }));
    const result = await new SearchService({
      productSource: inMemoryProductSource(products),
    }).search('match');
    expect(result.items.map((product) => product.id)).toEqual(['z', 'a', 'm']);
  });

  it('returns API products (category ID + label, proxied image)', async () => {
    const [product] = (await (await fixtureSearch()).search('backpack')).items;
    expect(product?.category.name).toBe("Men's clothing");
    expect(product?.imageUrl).toBe('/api/v1/products/1/image');
  });

  it.each([
    [undefined, searchMessages.empty],
    ['   ', searchMessages.empty],
    ['a'.repeat(101), searchMessages.tooLong],
  ])('SRC-01: invalid term %j → ValidationFailedError on q', async (term, message) => {
    const error = await (await fixtureSearch()).search(term).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ValidationFailedError);
    expect((error as ValidationFailedError).fieldErrors).toEqual({ q: message });
  });
});
