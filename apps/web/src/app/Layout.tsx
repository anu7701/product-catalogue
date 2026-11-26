import { Outlet } from 'react-router';
import { Header } from './Header.tsx';
import styles from './Layout.module.css';

/** Page shell shown on every route (GLB-01): header, then the page. */
export function Layout() {
  return (
    <>
      <Header />
      <main className={styles.main}>
        <Outlet />
      </main>
    </>
  );
}
