import { z } from 'zod';
import type { CatalogueProduct } from '../../domain/catalogue-product.ts';
import { UpstreamUnavailableError } from '../../domain/errors.ts';
import { MAX_IMAGE_BYTES, type ProductImage } from '../../domain/product-image.ts';
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
  maxImageBytes?: number;
}

/** ProductSource backed by the live Fake Store API (ARCHITECTURE §3.3). */
export class FakeStoreProductSource implements ProductSource {
  private readonly baseUrl: string;
  private readonly logger: Logger;
  private readonly timeoutMs: number;
  private readonly maxImageBytes: number;
  /** Images are only ever fetched from the configured Fake Store host (ARCHITECTURE §10.1, SSRF). */
  private readonly imageHost: string;

  constructor(options: FakeStoreOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this.logger = options.logger;
    this.timeoutMs = options.timeoutMs ?? FAKESTORE_TIMEOUT_MS;
    this.maxImageBytes = options.maxImageBytes ?? MAX_IMAGE_BYTES;
    this.imageHost = new URL(this.baseUrl).host;
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

  /**
   * Fetch a product image for the proxy (ARCHITECTURE §10.3). Refuses (null)
   * anything that isn't an http(s) URL on the configured Fake Store host,
   * isn't `image/*`, or exceeds the size cap; nothing else is ever fetched.
   */
  async getImage(imageRef: string): Promise<ProductImage | null> {
    let url: URL;
    try {
      url = new URL(imageRef);
    } catch {
      return this.refuseImage(imageRef, 'not a URL');
    }
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.host !== this.imageHost) {
      return this.refuseImage(imageRef, 'host or protocol not allowed');
    }

    const response = await this.fetchUpstream(url.href, url.pathname, 'image/*');
    if (response.status === 404) return null;
    if (!response.ok) {
      throw new UpstreamUnavailableError(`Fake Store image responded ${response.status}`);
    }

    const contentType = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
    if (!contentType.startsWith('image/')) {
      return this.refuseImage(imageRef, `content type ${contentType || 'missing'}`);
    }
    if (Number(response.headers.get('content-length') ?? 0) > this.maxImageBytes) {
      return this.refuseImage(imageRef, 'too large');
    }

    let body: Buffer;
    try {
      body = Buffer.from(await response.arrayBuffer());
    } catch (error) {
      throw new UpstreamUnavailableError('Fake Store image body could not be read', {
        cause: error,
      });
    }
    if (body.length > this.maxImageBytes) {
      return this.refuseImage(imageRef, 'too large');
    }
    return { contentType, body };
  }

  private refuseImage(imageRef: string, reason: string): null {
    this.logger.warn(
      { event: LogEvent.productSourceImageRefused, source: 'fakestore', imageRef, reason },
      'Refused to proxy product image',
    );
    return null;
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
    const response = await this.fetchUpstream(`${this.baseUrl}${path}`, path, 'application/json');

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

  /** GET with the upstream timeout (NEW-09); network errors and timeouts become UpstreamUnavailableError. */
  private async fetchUpstream(url: string, label: string, accept: string): Promise<Response> {
    try {
      return await fetch(url, {
        headers: { accept },
        redirect: 'error', // never follow a redirect to another host
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (error) {
      const reason =
        error instanceof DOMException && error.name === 'TimeoutError'
          ? `timed out after ${this.timeoutMs}ms`
          : 'request failed';
      throw new UpstreamUnavailableError(`Fake Store ${label} ${reason}`, { cause: error });
    }
  }
}
