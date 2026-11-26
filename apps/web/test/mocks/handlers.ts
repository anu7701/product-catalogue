import type {
  CategoriesResponse,
  CategoryProductsResponse,
  FeaturedProductsResponse,
  ProblemDetails,
  ProductResponse,
  SearchResponse,
} from '@catalogue/shared';
import { ErrorCode, errorMessages } from '@catalogue/shared';
import { http, HttpResponse } from 'msw';
import { categories, products } from './data.ts';

/** A Problem Details response exactly as the API sends it. */
export function problem(status: number, code: ErrorCode, errors?: Record<string, string>) {
  const body: ProblemDetails = {
    type: 'about:blank',
    title: errorMessages[code],
    status,
    code,
    requestId: 'test-request',
    ...(errors ? { errors } : {}),
  };
  return HttpResponse.json(body, {
    status,
    headers: { 'content-type': 'application/problem+json' },
  });
}

/** Default happy-path API, typed by the shared contract. Tests override per case with server.use(). */
export const handlers = [
  http.get('/api/v1/featured-products', () =>
    HttpResponse.json<FeaturedProductsResponse>({ items: products.slice(0, 2) }),
  ),
  http.get('/api/v1/categories', () =>
    HttpResponse.json<CategoriesResponse>({ items: categories }),
  ),
  http.get('/api/v1/categories/:categoryId/products', ({ params }) => {
    const category = categories.find((candidate) => candidate.id === params.categoryId);
    if (!category) return problem(404, ErrorCode.CATEGORY_NOT_FOUND);
    const inCategory = products.filter((product) => product.category.id === category.id);
    return HttpResponse.json<CategoryProductsResponse>({
      category,
      topRated: inCategory.slice(0, 1),
      more: inCategory.slice(1),
    });
  }),
  http.get('/api/v1/products', ({ request }) => {
    const q = new URL(request.url).searchParams.get('q')?.trim() ?? '';
    if (!q) return problem(400, ErrorCode.VALIDATION_FAILED, { q: 'Enter a search term' });
    const items = products.filter((product) =>
      product.title.toLowerCase().includes(q.toLowerCase()),
    );
    return HttpResponse.json<SearchResponse>({ query: q, items });
  }),
  http.get('/api/v1/products/:productId', ({ params }) => {
    const product = products.find((candidate) => candidate.id === params.productId);
    return product
      ? HttpResponse.json<ProductResponse>(product)
      : problem(404, ErrorCode.PRODUCT_NOT_FOUND);
  }),
  http.post('/api/v1/enquiries', () => new HttpResponse(null, { status: 202 })),
];
