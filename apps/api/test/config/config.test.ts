import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig, normaliseFeaturedIds } from '../../src/config/config.ts';

/** The minimum valid environment: only settings without a default. */
const validEnv = {
  SALES_INBOX: 'sales@example.com',
  MAIL_FROM: 'no-reply@example.com',
  SMTP_HOST: 'mailpit',
  SMTP_PORT: '1025',
  PUBLIC_SITE_URL: 'http://localhost:8080',
  FEATURED_PRODUCT_IDS: '1,5,9,15,18',
};

function loadWith(overrides: Record<string, string | undefined>) {
  return loadConfig({ ...validEnv, ...overrides });
}

function configErrorOf(fn: () => unknown): ConfigError {
  try {
    fn();
  } catch (error) {
    if (error instanceof ConfigError) return error;
    throw error;
  }
  throw new Error('expected a ConfigError');
}

describe('loadConfig', () => {
  it('applies documented defaults', () => {
    const { config, warnings } = loadConfig(validEnv);

    expect(config.productSource).toEqual({ kind: 'fakestore', url: 'https://fakestoreapi.com' });
    expect(config.catalogue).toEqual({
      featuredProductIds: ['1', '5', '9', '15', '18'],
      categoryTopRatedCount: 3,
    });
    expect(config.email.smtp).toEqual({
      host: 'mailpit',
      port: 1025,
      secure: false,
      user: undefined,
      pass: undefined,
    });
    expect(config.enquiryRateLimit).toEqual({ max: 5, windowMinutes: 15 });
    expect(config.server).toMatchObject({ port: 3000, logLevel: 'info', trustProxyHops: 0 });
    expect(warnings).toEqual([]);
  });

  it('NEW-48: refuses to start when SALES_INBOX is missing', () => {
    const error = configErrorOf(() => loadWith({ SALES_INBOX: undefined }));
    expect(error.issues).toContain('SALES_INBOX is required');
  });

  it('NEW-48: refuses to start when SALES_INBOX is not a valid email', () => {
    const error = configErrorOf(() => loadWith({ SALES_INBOX: 'sales@' }));
    expect(error.issues.some((issue) => issue.startsWith('SALES_INBOX:'))).toBe(true);
  });

  it('NEW-48: refuses to start when MAIL_FROM is missing', () => {
    const error = configErrorOf(() => loadWith({ MAIL_FROM: '' }));
    expect(error.issues).toContain('MAIL_FROM is required');
  });

  it('reports every invalid setting at once', () => {
    const error = configErrorOf(() =>
      loadWith({ PRODUCT_SOURCE: 'database', CATEGORY_TOP_RATED_COUNT: '0', SMTP_PORT: 'abc' }),
    );
    expect(error.issues).toHaveLength(3);
    expect(error.message).toContain('PRODUCT_SOURCE');
  });

  it('accepts the fixture product source', () => {
    expect(loadWith({ PRODUCT_SOURCE: 'fixture' }).config.productSource.kind).toBe('fixture');
  });

  it('treats empty SMTP credentials as not set and parses SMTP_SECURE', () => {
    const { config } = loadWith({ SMTP_USER: '', SMTP_PASS: '', SMTP_SECURE: 'true' });
    expect(config.email.smtp).toMatchObject({ user: undefined, pass: undefined, secure: true });
  });

  it('R-07: TRUST_PROXY is a hop count, not "true"', () => {
    expect(loadWith({ TRUST_PROXY: '1' }).config.server.trustProxyHops).toBe(1);
    expect(() => loadWith({ TRUST_PROXY: 'true' })).toThrow(ConfigError);
  });

  it('CFG-01: featured ID problems warn but do not stop startup', () => {
    const { config, warnings } = loadWith({ FEATURED_PRODUCT_IDS: '3,3,7' });
    expect(config.catalogue.featuredProductIds).toEqual(['3', '7']);
    expect(warnings).toHaveLength(1);
  });
});

describe('normaliseFeaturedIds', () => {
  it('CFG-01: "3, 7 ,,12,3" → [3, 7, 12] with a duplicate warning', () => {
    const { ids, warnings } = normaliseFeaturedIds('3, 7 ,,12,3');
    expect(ids).toEqual(['3', '7', '12']);
    expect(warnings).toEqual([
      expect.objectContaining({
        event: 'config.featured_normalised',
        message: expect.stringContaining('duplicate') as string,
      }),
    ]);
  });

  it('CFG-01 / NEW-46: more than 5 IDs → first 5 kept, warning names the rest', () => {
    const { ids, warnings } = normaliseFeaturedIds('1,2,3,4,5,6,7');
    expect(ids).toEqual(['1', '2', '3', '4', '5']);
    expect(warnings[0]?.message).toContain('6, 7');
  });

  it('NEW-46: duplicates are removed before the cap of 5 is applied', () => {
    expect(normaliseFeaturedIds('1,1,2,3,4,5').ids).toEqual(['1', '2', '3', '4', '5']);
  });

  it('CFG-01 BR7: unset or empty → no featured products, with a warning', () => {
    for (const raw of ['', '  ', ',,']) {
      const { ids, warnings } = normaliseFeaturedIds(raw);
      expect(ids).toEqual([]);
      expect(warnings).toHaveLength(1);
    }
  });

  it('A4a: IDs are opaque strings and keep their exact form', () => {
    expect(normaliseFeaturedIds('SKU-1042, 007').ids).toEqual(['SKU-1042', '007']);
  });

  it('a clean list produces no warnings', () => {
    expect(normaliseFeaturedIds('1,5,9').warnings).toEqual([]);
  });
});
