import { vi } from 'vitest';
import type { CatalogueProduct } from '../../src/domain/catalogue-product.ts';
import { UpstreamUnavailableError } from '../../src/domain/errors.ts';
import type { Logger } from '../../src/logging/logger.ts';
import type { EnquiryRecorder } from '../../src/ports/enquiry-recorder.ts';
import type { EnquiryNotification, Notifier } from '../../src/ports/notifier.ts';
import type { ProductSource } from '../../src/ports/product-source.ts';

/** Logger whose calls can be asserted. */
export function spyLogger() {
  return { info: vi.fn(), warn: vi.fn(), error: vi.fn() } satisfies Logger;
}

/** A ProductSource that is down: every call fails like an unreachable upstream. */
export function failingProductSource(): ProductSource {
  const fail = () => Promise.reject(new UpstreamUnavailableError('source down'));
  return { listProducts: fail, getProduct: fail, listCategories: fail, getImage: fail };
}

/** A ProductSource that fails the test if anything calls it. */
export function untouchableProductSource(): ProductSource {
  const fail = () => Promise.reject(new Error('the product source should not be called'));
  return { listProducts: fail, getProduct: fail, listCategories: fail, getImage: fail };
}

/** Bytes served by inMemoryProductSource for any imageRef ending in `.png`. */
export const FAKE_PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** An in-memory ProductSource over the given products, in the given order. */
export function inMemoryProductSource(products: CatalogueProduct[]): ProductSource {
  return {
    listProducts: () => Promise.resolve(products.map((product) => ({ ...product }))),
    getProduct: (id) => Promise.resolve(products.find((product) => product.id === id) ?? null),
    listCategories: () =>
      Promise.resolve([...new Set(products.map((product) => product.categoryName))]),
    getImage: (imageRef) =>
      Promise.resolve(
        imageRef.endsWith('.png') ? { contentType: 'image/png', body: FAKE_PNG } : null,
      ),
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

/** A Notifier that records what it was asked to send, or fails on demand. */
export class RecordingNotifier implements Notifier {
  readonly sent: EnquiryNotification[] = [];
  failWith: Error | undefined;
  private readonly calls: string[];

  constructor(calls: string[] = []) {
    this.calls = calls;
  }

  sendEnquiry(enquiry: EnquiryNotification): Promise<void> {
    this.calls.push('notify');
    if (this.failWith) return Promise.reject(this.failWith);
    this.sent.push(enquiry);
    return Promise.resolve();
  }
}

/** An EnquiryRecorder that records calls, so ordering can be asserted. */
export class RecordingRecorder implements EnquiryRecorder {
  readonly recorded: EnquiryNotification[] = [];
  private readonly calls: string[];

  constructor(calls: string[] = []) {
    this.calls = calls;
  }

  record(enquiry: EnquiryNotification): Promise<void> {
    this.calls.push('record');
    this.recorded.push(enquiry);
    return Promise.resolve();
  }
}
