import { describe, expect, it } from 'vitest';
import { FixtureProductSource } from '../../src/adapters/fixture/fixture-product-source.ts';
import { LogEvent } from '../../src/logging/logger.ts';
import { categoryId } from '../../src/services/category.ts';
import { CatalogueService } from '../../src/services/catalogue-service.ts';
import { spyLogger } from '../helpers/doubles.ts';

async function serviceWith(featuredProductIds: string[]) {
  const logger = spyLogger();
  const service = new CatalogueService({
    productSource: await FixtureProductSource.load(),
    logger,
    featuredProductIds,
  });
  return { service, logger };
}

describe('CatalogueService.featured', () => {
  it('HOM-01 / A3: returns the configured products in configured order', async () => {
    const { service } = await serviceWith(['3', '7', '12', '1', '18']);

    expect((await service.featured()).map((product) => product.id)).toEqual([
      '3',
      '7',
      '12',
      '1',
      '18',
    ]);
  });

  it('HOM-01: maps to the API product shape (category ID + label, proxied image)', async () => {
    const { service } = await serviceWith(['1']);

    expect(await service.featured()).toEqual([
      {
        id: '1',
        title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops',
        price: 109.95,
        description: expect.any(String) as string,
        category: { id: categoryId("men's clothing"), name: "Men's clothing" },
        imageUrl: '/api/v1/products/1/image',
        rating: { average: 3.9, count: 120 },
      },
    ]);
  });

  it('A4: a stale ID is skipped (never replaced) and a warning names it', async () => {
    const { service, logger } = await serviceWith(['3', '7', '12', '1', '999']);

    expect((await service.featured()).map((product) => product.id)).toEqual(['3', '7', '12', '1']);
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn).toHaveBeenCalledWith(
      { event: LogEvent.featuredIdMissing, productId: '999' },
      expect.any(String),
    );
  });

  it('NEW-17: all IDs stale → empty list, one warning each', async () => {
    const { service, logger } = await serviceWith(['997', '998', '999']);

    expect(await service.featured()).toEqual([]);
    expect(logger.warn).toHaveBeenCalledTimes(3);
  });

  it('CFG-01 BR7: nothing configured → empty list without calling the source', async () => {
    const service = new CatalogueService({
      productSource: {
        listProducts: () => Promise.reject(new Error('should not be called')),
        getProduct: () => Promise.reject(new Error('should not be called')),
        listCategories: () => Promise.reject(new Error('should not be called')),
      },
      logger: spyLogger(),
      featuredProductIds: [],
    });

    expect(await service.featured()).toEqual([]);
  });
});
