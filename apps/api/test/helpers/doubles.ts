import { vi } from 'vitest';
import type { CatalogueProduct } from '../../src/domain/catalogue-product.ts';
import { UpstreamUnavailableError } from '../../src/domain/errors.ts';
import type { Logger } from '../../src/logging/logger.ts';
import type { ProductSource } from '../../src/ports/product-source.ts';

/** Logger whose calls can be asserted. */
export function spyLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies Logger;
}

/** A ProductSource that is down: every call fails like an unreachable upstream. */
export function failingProductSource(): ProductSource {
  const fail = () => Promise.reject(new UpstreamUnavailableError('source down'));
  return { listProducts: fail, getProduct: fail, listCategories: fail };
}

/** An in-memory ProductSource over the given products, in the given order. */
export function inMemoryProductSource(products: CatalogueProduct[]): ProductSource {
  return {
    listProducts: () => Promise.resolve(products.map((product) => ({ ...product }))),
    getProduct: (id) => Promise.resolve(products.find((product) => product.id === id) ?? null),
    listCategories: () =>
      Promise.resolve([...new Set(products.map((product) => product.categoryName))]),
  };
}

let nextId = 1000;

/** A CatalogueProduct with sensible defaults. */
export function aProduct(overrides: Partial<CatalogueProduct> = {}): CatalogueProduct {
  nextId += 1;
  return {
    id: String(nextId),
    title: `Product ${nextId}`,
    price: 10,
    description: 'A product',
    categoryName: 'gadgets',
    imageRef: 'placeholder.svg',
    rating: { average: 3, count: 10 },
    ...overrides,
  };
}
