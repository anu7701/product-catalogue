import { searchTermSchema } from '@catalogue/shared';
import { Link, useSearchParams } from 'react-router';
import { useDocumentTitle } from '../app/useDocumentTitle.ts';
import { QueryView } from '../components/PageState.tsx';
import { CategoryLinks } from '../features/catalogue/CategoryLinks.tsx';
import { ProductGrid } from '../features/catalogue/ProductGrid.tsx';
import { useSearch } from '../features/search/queries.ts';
import styles from './pages.module.css';

/** "1 product" / "N products" (SRC-02.FR1). */
export function productCount(count: number): string {
  return `${count} ${count === 1 ? 'product' : 'products'}`;
}

/**
 * Search results (SRC-02, SRC-03) for `?q=`. The term is checked with the
 * shared rules first: blank (NEW-26) or too long (R-14) shows a message
 * and no request is made. The search bar stays pre-filled (NEW-25).
 */
export function SearchPage() {
  const [searchParams] = useSearchParams();
  const parsed = searchTermSchema.safeParse(searchParams.get('q') ?? '');
  const term = parsed.success ? parsed.data : '';
  const query = useSearch(term, parsed.success);
  useDocumentTitle(parsed.success ? `Results for "${term}"` : 'Search');

  if (!parsed.success) {
    return (
      <>
        <h1 className={styles.title}>Search</h1>
        <p className={styles.muted}>{parsed.error.issues[0]?.message}</p>
      </>
    );
  }

  return (
    <>
      {/* The term is rendered as text, never as markup (SRC-02.FR3). */}
      <h1 className={styles.title}>Results for &ldquo;{term}&rdquo;</h1>
      <QueryView query={query}>
        {({ items }) =>
          items.length === 0 ? (
            <section aria-labelledby="no-results">
              <p id="no-results" role="status">
                No products match &ldquo;{term}&rdquo;.
              </p>
              <p>
                <Link to="/">Back to the home page</Link> or browse a category:
              </p>
              <CategoryLinks label="Categories" />
            </section>
          ) : (
            <>
              <p className={styles.muted} role="status">
                {productCount(items.length)}
              </p>
              <ProductGrid products={items} label="Search results" />
            </>
          )
        }
      </QueryView>
    </>
  );
}
