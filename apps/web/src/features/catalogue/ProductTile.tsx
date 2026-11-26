import type { Product } from '@catalogue/shared';
import { Link } from 'react-router';
import { Price } from '../../components/Price.tsx';
import { Rating } from '../../components/Rating.tsx';
import { showPlaceholderOnError } from './product-image.ts';
import { productPath } from './paths.ts';
import styles from './ProductTile.module.css';

/**
 * A product in any listing (GLB-02): image, title, price and rating, the
 * whole tile one link to the product page (A20).
 */
export function ProductTile({ product }: { product: Product }) {
  return (
    <Link to={productPath(product.id)} className={styles.tile}>
      <img
        className={styles.image}
        src={product.imageUrl}
        alt={product.title}
        loading="lazy"
        onError={showPlaceholderOnError}
      />
      <div className={styles.body}>
        <h3 className={styles.title}>{product.title}</h3>
        <Price price={product.price} className={styles.price} />
        <Rating rating={product.rating} className={styles.rating} />
      </div>
    </Link>
  );
}
