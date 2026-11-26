import {
  type CategoriesResponse,
  type CategoryProductsResponse,
  type EnquiryRequestInput,
  ErrorCode,
  errorMessages,
  type FeaturedProductsResponse,
  problemDetailsSchema,
  type ProductResponse,
  type SearchResponse,
} from '@catalogue/shared';

/**
 * The only module that knows API URLs (ARCHITECTURE §2.2). Everything goes
 * to our own API on the same origin; the browser never calls the data source.
 */
const API_BASE = '/api/v1';

/** An API call that failed. `code` is what pages switch on (ARCHITECTURE §8.2). */
export class ApiError extends Error {
  /** HTTP status, or 0 when the request never got a response (offline, aborted). */
  readonly status: number;
  readonly code: ErrorCode;
  /** Per-field messages for VALIDATION_FAILED. */
  readonly fieldErrors: Record<string, string>;
  readonly requestId: string | undefined;

  constructor(options: {
    status: number;
    code: ErrorCode;
    message?: string;
    fieldErrors?: Record<string, string>;
    requestId?: string;
  }) {
    super(options.message ?? errorMessages[options.code]);
    this.name = 'ApiError';
    this.status = options.status;
    this.code = options.code;
    this.fieldErrors = options.fieldErrors ?? {};
    this.requestId = options.requestId;
  }
}

/** Product, category or page not found: show a not-found view, not an error. */
export function isNotFound(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === ErrorCode.PRODUCT_NOT_FOUND ||
      error.code === ErrorCode.CATEGORY_NOT_FOUND ||
      error.code === ErrorCode.NOT_FOUND)
  );
}

/** Worth retrying a read: the server or network failed, not the request (ARCHITECTURE §8.2). */
export function isRetryable(error: unknown): boolean {
  return error instanceof ApiError && (error.status === 0 || error.status >= 500);
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  const problem = problemDetailsSchema.safeParse(body);
  if (problem.success) {
    return new ApiError({
      status: response.status,
      code: problem.data.code,
      message: problem.data.title,
      fieldErrors: problem.data.errors,
      requestId: problem.data.requestId,
    });
  }
  // Not from our API (e.g. a proxy's HTML error page): treat as a generic failure.
  return new ApiError({ status: response.status, code: ErrorCode.INTERNAL_ERROR });
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const url = new URL(`${API_BASE}${path}`, window.location.origin);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: { accept: 'application/json', ...init.headers },
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error;
    throw new ApiError({ status: 0, code: ErrorCode.INTERNAL_ERROR });
  }

  if (!response.ok) {
    throw await toApiError(response);
  }
  if (response.status === 202 || response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

const segment = encodeURIComponent;

export const api = {
  featuredProducts: (signal?: AbortSignal) =>
    request<FeaturedProductsResponse>('/featured-products', { signal }),

  categories: (signal?: AbortSignal) => request<CategoriesResponse>('/categories', { signal }),

  categoryProducts: (categoryId: string, signal?: AbortSignal) =>
    request<CategoryProductsResponse>(`/categories/${segment(categoryId)}/products`, { signal }),

  search: (term: string, signal?: AbortSignal) =>
    request<SearchResponse>(`/products?${new URLSearchParams({ q: term }).toString()}`, {
      signal,
    }),

  product: (productId: string, signal?: AbortSignal) =>
    request<ProductResponse>(`/products/${segment(productId)}`, { signal }),

  /** Resolves when the API has accepted the enquiry (202); never retried (NEW-42). */
  submitEnquiry: (enquiry: EnquiryRequestInput) =>
    request<undefined>('/enquiries', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(enquiry),
    }),
};
