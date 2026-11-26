import { Outlet } from 'react-router';

/** Page shell shown on every route (GLB-01): header, then the page. */
export function Layout() {
  return (
    <>
      <header>Catalogue</header>
      <main>
        <Outlet />
      </main>
    </>
  );
}
