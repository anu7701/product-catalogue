import { readFile } from 'node:fs/promises';
import { basename, dirname, extname, join } from 'node:path';
import { z } from 'zod';
import type { CatalogueProduct } from '../../domain/catalogue-product.ts';
import { MAX_IMAGE_BYTES, type ProductImage } from '../../domain/product-image.ts';
import type { ProductSource } from '../../ports/product-source.ts';

/** Directory holding the committed snapshot and its images. */
export const FIXTURE_DIR = import.meta.dirname;

const catalogueProductSchema = z.strictObject({
  id: z.string().min(1),
  title: z.string().min(1),
  price: z.number().nonnegative(),
  description: z.string(),
  categoryName: z.string().min(1),
  imageRef: z.string().min(1),
  rating: z.strictObject({ average: z.number(), count: z.number().int() }).nullable(),
});

const snapshotSchema = z
  .array(catalogueProductSchema)
  .min(1)
  .refine((products) => new Set(products.map((p) => p.id)).size === products.length, {
    message: 'product IDs must be unique',
  });

const IMAGE_TYPES: Record<string, string> = {
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
};

/** The committed snapshot is unusable; the API must not start (ARCHITECTURE §7). */
export class FixtureLoadError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = 'FixtureLoadError';
  }
}

/**
 * Offline ProductSource backed by a committed JSON snapshot of the Fake Store
 * catalogue, already in our own shape (ARCHITECTURE §3.6, T13). Used for tests,
 * E2E and running without internet. Loaded and validated once at startup.
 */
export class FixtureProductSource implements ProductSource {
  private readonly products: readonly CatalogueProduct[];
  private readonly imagesDir: string;

  private constructor(products: CatalogueProduct[], imagesDir: string) {
    this.products = products;
    this.imagesDir = imagesDir;
  }

  /** Load and validate the snapshot. Throws FixtureLoadError if it is missing or invalid. */
  static async load(file = join(FIXTURE_DIR, 'products.json')): Promise<FixtureProductSource> {
    let json: unknown;
    try {
      json = JSON.parse(await readFile(file, 'utf8'));
    } catch (error) {
      throw new FixtureLoadError(`Cannot read product fixture ${file}`, { cause: error });
    }

    const parsed = snapshotSchema.safeParse(json);
    if (!parsed.success) {
      throw new FixtureLoadError(
        `Invalid product fixture ${file}: ${z.prettifyError(parsed.error)}`,
      );
    }
    return new FixtureProductSource(parsed.data, join(dirname(file), 'images'));
  }

  listProducts(): Promise<CatalogueProduct[]> {
    return Promise.resolve(this.products.map((product) => structuredClone(product)));
  }

  getProduct(id: string): Promise<CatalogueProduct | null> {
    const product = this.products.find((candidate) => candidate.id === id);
    return Promise.resolve(product ? structuredClone(product) : null);
  }

  /** Distinct category names, in order of first appearance. */
  listCategories(): Promise<string[]> {
    return Promise.resolve([...new Set(this.products.map((product) => product.categoryName))]);
  }

  /**
   * Serve a committed image from the snapshot's `images/` folder. Only a plain
   * file name with a known image extension is accepted, so a reference can't
   * reach outside that folder (path traversal).
   */
  async getImage(imageRef: string): Promise<ProductImage | null> {
    const contentType = IMAGE_TYPES[extname(imageRef).toLowerCase()];
    if (imageRef !== basename(imageRef) || imageRef.startsWith('.') || !contentType) {
      return null;
    }
    try {
      const body = await readFile(join(this.imagesDir, imageRef));
      return body.length > MAX_IMAGE_BYTES ? null : { contentType, body };
    } catch {
      return null;
    }
  }
}
