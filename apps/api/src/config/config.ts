import { z } from 'zod';

/**
 * API configuration, loaded from environment variables and validated at
 * startup (ARCHITECTURE §3.7). Invalid or missing critical settings stop the
 * API from starting (NEW-48). Featured product IDs only produce warnings (CFG-01).
 */

/** Max featured products shown on the home page (HOM-01 BR2, NEW-46). */
export const MAX_FEATURED_PRODUCTS = 5;

/** Empty strings from a `.env` line like `SMTP_USER=` count as "not set". */
const optionalString = z.preprocess(
  (value) => (value === '' ? undefined : value),
  z.string().optional(),
);

const envSchema = z.object({
  PRODUCT_SOURCE: z.enum(['fakestore', 'fixture']).default('fakestore'),
  PRODUCT_SOURCE_URL: z.url().default('https://fakestoreapi.com'),
  FEATURED_PRODUCT_IDS: z.string().default(''),
  CATEGORY_TOP_RATED_COUNT: z.coerce.number().int().min(1).default(3),

  SALES_INBOX: z.email(),
  MAIL_FROM: z.email(),
  SMTP_HOST: z.string().min(1),
  SMTP_PORT: z.coerce.number().int().min(1).max(65535),
  SMTP_SECURE: z.stringbool().default(false),
  SMTP_USER: optionalString,
  SMTP_PASS: optionalString,

  ENQUIRY_RATE_LIMIT_MAX: z.coerce.number().int().min(1).default(5),
  ENQUIRY_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().int().min(1).default(15),

  PUBLIC_SITE_URL: z.url(),
  HOST: z.string().min(1).default('0.0.0.0'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  // Number of trusted proxy hops in front of the API (R-07). 0 = trust none.
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
});

export interface Config {
  productSource: {
    kind: 'fakestore' | 'fixture';
    url: string;
  };
  catalogue: {
    /** Normalised, ordered, at most MAX_FEATURED_PRODUCTS (CFG-01). */
    featuredProductIds: string[];
    categoryTopRatedCount: number;
  };
  email: {
    salesInbox: string;
    from: string;
    smtp: {
      host: string;
      port: number;
      secure: boolean;
      user: string | undefined;
      pass: string | undefined;
    };
  };
  enquiryRateLimit: {
    max: number;
    windowMinutes: number;
  };
  server: {
    publicSiteUrl: string;
    host: string;
    port: number;
    logLevel: string;
    trustProxyHops: number;
  };
}

/** A non-fatal configuration problem, logged at startup. */
export interface ConfigWarning {
  event: 'config.featured_normalised';
  message: string;
}

export interface LoadedConfig {
  config: Config;
  warnings: ConfigWarning[];
}

/** Thrown when configuration is invalid; the API must not start. */
export class ConfigError extends Error {
  readonly issues: string[];

  constructor(issues: string[]) {
    super(`Invalid configuration:\n${issues.map((issue) => `  - ${issue}`).join('\n')}`);
    this.name = 'ConfigError';
    this.issues = issues;
  }
}

/**
 * Normalise the owner's featured product list (CFG-01 BR3–BR7):
 * trim each entry, drop empties (NEW-45), drop duplicates keeping the first,
 * and keep at most the first 5 (NEW-46). IDs are opaque strings (A4a).
 */
export function normaliseFeaturedIds(raw: string): {
  ids: string[];
  warnings: ConfigWarning[];
} {
  const warnings: ConfigWarning[] = [];
  const entries = raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');

  if (entries.length === 0) {
    warnings.push({
      event: 'config.featured_normalised',
      message: 'FEATURED_PRODUCT_IDS is empty; the home page will show no featured products',
    });
    return { ids: [], warnings };
  }

  const unique: string[] = [];
  const duplicates: string[] = [];
  for (const id of entries) {
    if (unique.includes(id)) {
      duplicates.push(id);
    } else {
      unique.push(id);
    }
  }
  if (duplicates.length > 0) {
    warnings.push({
      event: 'config.featured_normalised',
      message: `FEATURED_PRODUCT_IDS has duplicate IDs, later copies ignored: ${duplicates.join(', ')}`,
    });
  }

  if (unique.length > MAX_FEATURED_PRODUCTS) {
    const dropped = unique.slice(MAX_FEATURED_PRODUCTS);
    warnings.push({
      event: 'config.featured_normalised',
      message: `FEATURED_PRODUCT_IDS lists more than ${MAX_FEATURED_PRODUCTS} products; ignored: ${dropped.join(', ')}`,
    });
  }

  return { ids: unique.slice(0, MAX_FEATURED_PRODUCTS), warnings };
}

/** Validate the environment. Throws ConfigError if any setting is invalid. */
export function loadConfig(env: NodeJS.ProcessEnv): LoadedConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    throw new ConfigError(
      parsed.error.issues.map((issue) => {
        const name = issue.path.join('.');
        return env[name] === undefined || env[name] === ''
          ? `${name} is required`
          : `${name}: ${issue.message}`;
      }),
    );
  }

  const e = parsed.data;
  const featured = normaliseFeaturedIds(e.FEATURED_PRODUCT_IDS);

  return {
    config: {
      productSource: { kind: e.PRODUCT_SOURCE, url: e.PRODUCT_SOURCE_URL },
      catalogue: {
        featuredProductIds: featured.ids,
        categoryTopRatedCount: e.CATEGORY_TOP_RATED_COUNT,
      },
      email: {
        salesInbox: e.SALES_INBOX,
        from: e.MAIL_FROM,
        smtp: {
          host: e.SMTP_HOST,
          port: e.SMTP_PORT,
          secure: e.SMTP_SECURE,
          user: e.SMTP_USER,
          pass: e.SMTP_PASS,
        },
      },
      enquiryRateLimit: {
        max: e.ENQUIRY_RATE_LIMIT_MAX,
        windowMinutes: e.ENQUIRY_RATE_LIMIT_WINDOW_MINUTES,
      },
      server: {
        publicSiteUrl: e.PUBLIC_SITE_URL,
        host: e.HOST,
        port: e.PORT,
        logLevel: e.LOG_LEVEL,
        trustProxyHops: e.TRUST_PROXY,
      },
    },
    warnings: featured.warnings,
  };
}
