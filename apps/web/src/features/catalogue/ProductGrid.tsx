import type { Product } from '@catalogue/shared';
import { ProductTile } from './ProductTile.tsx';
import styles from './ProductGrid.module.css';

/** A list of product tiles; `label` names the list for screen readers. */
export function ProductGrid({ products, label }: { products: Product[]; label: string }) {
  return (
    <ul className={styles.grid} aria-label={label}>
      {products.map((product) => (
        <li key={product.id}>
          <ProductTile product={product} />
        </li>
      ))}
    </ul>
  );
}
