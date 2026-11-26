import type { CategoryProductsResponse } from '@catalogue/shared';
import { describe, expect, it } from 'vitest';
import { FixtureProductSource } from '../../src/adapters/fixture/fixture-product-source.ts';
import type { CatalogueProduct } from '../../src/domain/catalogue-product.ts';
import { CategoryNotFoundError } from '../../src/domain/errors.ts';
import type { ProductSource } from '../../src/ports/product-source.ts';
import { categoryId } from '../../src/services/category.ts';
import {
  CatalogueService,
  rankByRating,
  topRatedLimit,
} from '../../src/services/catalogue-service.ts';
import { aProduct, inMemoryProductSource, spyLogger } from '../helpers/doubles.ts';

function serviceOver(productSource: ProductSource, categoryTopRatedCount = 3) {
  return new CatalogueService({
    productSource,
    logger: spyLogger(),
    featuredProductIds: [],
    categoryTopRatedCount,
  });
}

const fixtureService = async () => serviceOver(await FixtureProductSource.load());
const ids = (products: { id: string }[]) => products.map((product) => product.id);

describe('CatalogueService.categories', () => {
  it('GLB-01 / NEW-03: all categories, alphabetical by label, with UUID IDs (T15)', async () => {
    expect(await (await fixtureService()).categories()).toEqual([
      { id: categoryId('electronics'), name: 'Electronics' },
      { id: categoryId('jewelery'), name: 'Jewelery' },
      { id: categoryId("men's clothing"), name: "Men's clothing" },
      { id: categoryId("women's clothing"), name: "Women's clothing" },
    ]);
  });
});

describe('CatalogueService.categoryPage', () => {
  it('CAT-01: Electronics → top 3 by rating, the rest in source order', async () => {
    const page = await (await fixtureService()).categoryPage(categoryId('electronics'));

    expect(page.category).toEqual({ id: categoryId('electronics'), name: 'Electronics' });
    // 11 and 12 both average 4.8; 12 has more ratings (400 vs 319) so ranks first.
    expect(ids(page.topRated)).toEqual(['12', '11', '9']);
    expect(ids(page.more)).toEqual(['10', '13', '14']);
  });

  it('CAT-01: a 4-product category (Jewelery) → 3 top rated + 1 more', async () => {
    const page = await (await fixtureService()).categoryPage(categoryId('jewelery'));

    expect(ids(page.topRated)).toEqual(['5', '6', '7']);
    expect(ids(page.more)).toEqual(['8']);
  });

  it('CAT-01.FR5: every product in the category appears exactly once, and no other', async () => {
    const service = await fixtureService();
    const all = await (await FixtureProductSource.load()).listProducts();

    for (const name of ['electronics', 'jewelery', "men's clothing", "women's clothing"]) {
      const page: CategoryProductsResponse = await service.categoryPage(categoryId(name));
      const shown = [...ids(page.topRated), ...ids(page.more)];
      const expected = all.filter((product) => product.categoryName === name).map((p) => p.id);

      expect(shown.sort()).toEqual(expected.sort());
      expect(new Set(shown).size).toBe(shown.length);
    }
  });

  it('CAT-01 AC: A(4.5/100), B(4.5/300), C(4.0), D(3.0) → top rated B, A, C; more D', async () => {
    const products = [
      aProduct({ id: 'A', rating: { average: 4.5, count: 100 } }),
      aProduct({ id: 'B', rating: { average: 4.5, count: 300 } }),
      aProduct({ id: 'C', rating: { average: 4.0, count: 10 } }),
      aProduct({ id: 'D', rating: { average: 3.0, count: 10 } }),
    ];
    const page = await serviceOver(inMemoryProductSource(products)).categoryPage(
      categoryId('gadgets'),
    );

    expect(ids(page.topRated)).toEqual(['B', 'A', 'C']);
    expect(ids(page.more)).toEqual(['D']);
  });

  it('NEW-07: unrated products are never top rated; they go to "More in…"', async () => {
    const products = [
      aProduct({ id: 'unrated', rating: null }),
      aProduct({ id: 'low', rating: { average: 1, count: 1 } }),
    ];
    const page = await serviceOver(inMemoryProductSource(products)).categoryPage(
      categoryId('gadgets'),
    );

    expect(ids(page.topRated)).toEqual(['low']);
    expect(ids(page.more)).toEqual(['unrated']);
  });

  it('NEW-20: "More in…" keeps data source order, not rating order', async () => {
    const products = [5, 4, 3, 1, 2].map((average, index) =>
      aProduct({ id: `p${index}`, rating: { average, count: 1 } }),
    );
    const page = await serviceOver(inMemoryProductSource(products), 2).categoryPage(
      categoryId('gadgets'),
    );

    expect(ids(page.topRated)).toEqual(['p0', 'p1']);
    expect(ids(page.more)).toEqual(['p2', 'p3', 'p4']);
  });

  it('A8: the top rated count is configurable', async () => {
    const page = await serviceOver(await FixtureProductSource.load(), 1).categoryPage(
      categoryId('electronics'),
    );
    expect(ids(page.topRated)).toEqual(['12']);
    expect(page.more).toHaveLength(5);
  });

  it('NEW-23: the category ID matches case-insensitively', async () => {
    const page = await (
      await fixtureService()
    ).categoryPage(categoryId('electronics').toUpperCase());
    expect(page.category.name).toBe('Electronics');
  });

  it.each(['shoes', '00000000-0000-5000-8000-000000000000', ''])(
    'CAT-02: unknown category ID %j → CategoryNotFoundError',
    async (id) => {
      await expect((await fixtureService()).categoryPage(id)).rejects.toThrow(
        CategoryNotFoundError,
      );
    },
  );

  it('NEW-22: a listed category with no products → empty sections, not an error', async () => {
    const source: ProductSource = {
      listProducts: () => Promise.resolve([]),
      getProduct: () => Promise.resolve(null),
      listCategories: () => Promise.resolve(['empty']),
    };
    expect(await serviceOver(source).categoryPage(categoryId('empty'))).toEqual({
      category: { id: categoryId('empty'), name: 'Empty' },
      topRated: [],
      more: [],
    });
  });
});

describe('ranking rules', () => {
  it('R-08 default: equal average and count keep data source order (any ID format)', () => {
    const tie = { average: 4, count: 10 };
    const products: CatalogueProduct[] = [
      aProduct({ id: '9', rating: tie }),
      aProduct({ id: '10', rating: tie }),
      aProduct({ id: 'SKU-1', rating: tie }),
    ];
    expect(ids(rankByRating(products))).toEqual(['9', '10', 'SKU-1']);
  });

  it('R-04 default: the limit is the configured maximum (current spec)', () => {
    expect(topRatedLimit(6, 3)).toBe(3);
    expect(topRatedLimit(2, 3)).toBe(3);
  });
});
