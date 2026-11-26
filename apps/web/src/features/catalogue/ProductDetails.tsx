import type { Product } from '@catalogue/shared';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { Price } from '../../components/Price.tsx';
import { Rating } from '../../components/Rating.tsx';
import { categoryPath } from './paths.ts';
import { showPlaceholderOnError } from './product-image.ts';
import styles from './ProductDetails.module.css';

/**
 * Everything about one product (PRD-01, A21): image, title, price, rating,
 * category link and the full description. `actions` (the Enquire button and
 * form) sits above the description, so it is visible without scrolling (NEW-28).
 */
export function ProductDetails({ product, actions }: { product: Product; actions?: ReactNode }) {
  return (
    <article className={styles.product}>
      <img
        className={styles.image}
        src={product.imageUrl}
        alt={product.title}
        onError={showPlaceholderOnError}
      />
      <div className={styles.info}>
        <h1 className={styles.title}>{product.title}</h1>
        <Price price={product.price} className={styles.price} />
        <div className={styles.meta}>
          <Rating rating={product.rating} />
          <span>
            Category: <Link to={categoryPath(product.category.id)}>{product.category.name}</Link>
          </span>
        </div>
        {actions}
        <p className={styles.description}>{product.description}</p>
      </div>
    </article>
  );
}
