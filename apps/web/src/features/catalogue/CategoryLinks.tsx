import { Link } from 'react-router';
import styles from './CategoryLinks.module.css';
import { categoryPath } from './paths.ts';
import { useCategories } from './queries.ts';

/**
 * A link to every category, used as a route back into browsing (HOM-02,
 * CAT-02, SRC-03, PRD-02). Renders nothing if categories can't be loaded:
 * the page around it still works.
 */
export function CategoryLinks({ label }: { label: string }) {
  const { data } = useCategories();
  if (!data || data.items.length === 0) return null;

  return (
    <ul className={styles.list} aria-label={label}>
      {data.items.map((category) => (
        <li key={category.id}>
          <Link className={styles.link} to={categoryPath(category.id)}>
            {category.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}
