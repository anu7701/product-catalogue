import { Link } from 'react-router';
import { CategoryNav } from '../features/catalogue/CategoryNav.tsx';
import { SearchBar } from '../features/search/SearchBar.tsx';
import { STORE_NAME } from '../theme/branding.ts';
import styles from './Header.module.css';

/** Header on every page (GLB-01): store name → home, search, category links. */
export function Header() {
  return (
    <header className={styles.header}>
      <div className={styles.inner}>
        <Link to="/" className={styles.storeName}>
          {STORE_NAME}
        </Link>
        <div className={styles.search}>
          <SearchBar />
        </div>
        <CategoryNav className={styles.categories} />
      </div>
    </header>
  );
}
