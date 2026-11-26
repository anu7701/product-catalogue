import { z } from 'zod';
import type { CatalogueProduct } from '../../domain/catalogue-product.ts';
import { UpstreamUnavailableError } from '../../domain/errors.ts';
import { LogEvent, type Logger } from '../../logging/logger.ts';
import type { ProductSource } from '../../ports/product-source.ts';

/** Upstream request timeout (NEW-09). */
export const FAKESTORE_TIMEOUT_MS = 5_000;

/**
 * Fake Store's product record. Extra fields are ignored. Field names used here
 * (`rating.rate`, `image`, numeric `id`) never leave this adapter (ARCHITECTURE §3.2).
 */
const upstreamProductSchema = z.object({
  id: z.union([z.number().int(), z.string().min(1)]),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string(),
  category: z.string().min(1),
  image: z.string().min(1),
  rating: z.object({ rate: z.number(), count: z.number().int() }).nullish(),
});

type UpstreamProduct = z.infer<typeof upstreamProductSchema>;

function toCatalogueProduct(upstream: UpstreamProduct): CatalogueProduct {
  return {
    id: String(upstream.id),
    title: upstream.title,
    price: upstream.price,
    description: upstream.description,
    categoryName: upstream.category,
    imageRef: upstream.image,
    rating: upstream.rating
      ? { average: upstream.rating.rate, count: upstream.rating.count }
      : null,
  };
}

export interface FakeStoreOptions {
  baseUrl: string;
  logger: Logger;
  timeoutMs?: number;
}

/** ProductSource backed by the live Fake Store API (ARCHITECTURE §3.3). */
export class FakeStoreProductSource implements ProductSource {
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly timeoutMs: number;

  constructor(options: FakeStoreOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.logger = options.logger;
    this.timeoutMs = options.timeoutMs ?? FAKESTORE_TIMEOUT_MS;
  }

  async listProducts(): Promise<CatalogueProduct[]> {
    const body = await this.getJson('/products');
    if (!Array.isArray(body)) {
      throw new UpstreamUnavailableError('Fake Store /products did not return a list');
    }
    return body.flatMap((record, index) => {
      const product = this.parseProduct(record, { index });
      return product ? [product] : [];
    });
  }

  async getProduct(id: string): Promise<CatalogueProduct | null> {
    // Fake Store answers unknown IDs with 200 and an empty body (verified
    // during build), so an empty/null body means "not found".
    const body = await this.getJson(`/products/${encodeURIComponent(id)}`, { allowNotFound: true });
    if (body === undefined || body === null) {
      return null;
    }
    return this.parseProduct(body, { productId: id });
  }

  async listCategories(): Promise<string[]> {
    const body = await this.getJson('/products/categories');
    const parsed = z.array(z.string().min(1)).safeParse(body);
    if (!parsed.success) {
      throw new UpstreamUnavailableError(
        'Fake Store /products/categories returned an unexpected shape',
      );
    }
    return parsed.data;
  }

  /** Malformed records are dropped and logged, never returned (NEW-10). */
  private parseProduct(record: unknown, context: Record<string, unknown>): CatalogueProduct | null {
    const parsed = upstreamProductSchema.safeParse(record);
    if (!parsed.success) {
      this.logger.warn(
        {
          event: LogEvent.productSourceRecordInvalid,
          source: 'fakestore',
          ...context,
          issues: parsed.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        },
        'Dropped malformed product record from Fake Store',
      );
      return null;
    }
    return toCatalogueProduct(parsed.data);
  }

  /**
   * GET a path and parse JSON. Returns `undefined` for an empty body, or for
   * 404 when `allowNotFound` is set. Every other failure (network error,
   * timeout, non-2xx, invalid JSON) becomes UpstreamUnavailableError.
   */
  private async getJson(path: string, { allowNotFound = false } = {}): Promise<unknown> {
    const url = `${this.baseUrl}${path}`;
    let response: Response;
    try {
      response = await fetch(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason =
        error instanceof DOMException && error.name === 'TimeoutError'
          ? `timed out after ${this.timeoutMs}ms`
          : 'request failed';
      throw new UpstreamUnavailableError(`Fake Store ${path} ${reason}`, { cause: error });
    }

    if (allowNotFound && response.status === 404) {
      return undefined;
    }
    if (!response.ok) {
      throw new UpstreamUnavailableError(`Fake Store ${path} responded ${response.status}`);
    }

    let text: string;
    try {
      text = await response.text();
    } catch (error) {
      throw new UpstreamUnavailableError(`Fake Store ${path} body could not be read`, {
        cause: error,
      });
    }
    if (text.trim() === '') {
      return undefined;
    }
    try {
      return JSON.parse(text) as unknown;
    } catch (error) {
      throw new UpstreamUnavailableError(`Fake Store ${path} returned invalid JSON`, {
        cause: error,
      });
    }
  }
}
