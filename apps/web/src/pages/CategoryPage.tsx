import { useParams } from 'react-router';
import { useDocumentTitle } from '../app/useDocumentTitle.ts';
import { NotFoundView } from '../components/NotFoundView.tsx';
import { QueryView } from '../components/PageState.tsx';
import { CategoryLinks } from '../features/catalogue/CategoryLinks.tsx';
import { ProductGrid } from '../features/catalogue/ProductGrid.tsx';
import { useCategoryProducts } from '../features/catalogue/queries.ts';
import styles from './pages.module.css';

/**
 * Category page (CAT-01): "Top rated in…" then "More in…", already split by
 * the API. Unknown category → not-found with links to real ones (CAT-02);
 * an unavailable source shows the error state, never "not found".
 */
export function CategoryPage() {
  const { categoryId = '' } = useParams();
  const query = useCategoryProducts(categoryId);
  useDocumentTitle(query.data?.category.name ?? (query.isError ? 'Category' : undefined));

  return (
    <QueryView
      query={query}
      notFound={
        <NotFoundView title="We couldn't find that category.">
          <CategoryLinks label="All categories" />
        </NotFoundView>
      }
    >
      {({ category, topRated, more }) => (
        <>
          <h1 className={styles.title}>{category.name}</h1>
          {topRated.length === 0 && more.length === 0 && (
            // NEW-22: the category exists but has nothing in it right now.
            <p className={styles.muted}>There are no products in this category yet.</p>
          )}
          {topRated.length > 0 && (
            <section className={styles.section} aria-labelledby="top-rated-heading">
              <h2 id="top-rated-heading" className={styles.heading}>
                Top rated in {category.name}
              </h2>
              <ProductGrid products={topRated} label={`Top rated in ${category.name}`} />
            </section>
          )}
          {more.length > 0 && (
            <section className={styles.section} aria-labelledby="more-heading">
              <h2 id="more-heading" className={styles.heading}>
                More in {category.name}
              </h2>
              <ProductGrid products={more} label={`More in ${category.name}`} />
            </section>
          )}
        </>
      )}
    </QueryView>
  );
}
