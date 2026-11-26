import { useDocumentTitle } from '../app/useDocumentTitle.ts';
import { QueryView } from '../components/PageState.tsx';
import { CategoryLinks } from '../features/catalogue/CategoryLinks.tsx';
import { ProductGrid } from '../features/catalogue/ProductGrid.tsx';
import { useFeaturedProducts } from '../features/catalogue/queries.ts';
import styles from './pages.module.css';

/**
 * Home (HOM-01, HOM-02): the owner's featured products, then a way into every
 * category. Search is in the header (A5).
 */
export function HomePage() {
  useDocumentTitle();
  const featured = useFeaturedProducts();

  return (
    <>
      <h1 className="visually-hidden">Home</h1>
      <QueryView query={featured}>
        {({ items }) =>
          // NEW-17: nothing to show → no section at all; the rest of the page stays.
          items.length > 0 && (
            <section className={styles.section} aria-labelledby="featured-heading">
              <h2 id="featured-heading" className={styles.heading}>
                Top rated
              </h2>
              <ProductGrid products={items} label="Top rated products" />
            </section>
          )
        }
      </QueryView>
      <section className={styles.section} aria-labelledby="categories-heading">
        <h2 id="categories-heading" className={styles.heading}>
          Shop by category
        </h2>
        <CategoryLinks label="Categories" />
      </section>
    </>
  );
}
