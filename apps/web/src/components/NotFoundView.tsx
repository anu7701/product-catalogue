import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface NotFoundViewProps {
  title: string;
  message?: string;
  /** Extra routes back into the catalogue, e.g. category links (CAT-02, PRD-02). */
  children?: ReactNode;
}

/** Friendly not-found content with a way back to browsing (GLB-04.FR4). */
export function NotFoundView({ title, message, children }: NotFoundViewProps) {
  return (
    <section>
      <h1>{title}</h1>
      {message && <p>{message}</p>}
      {children}
      <p>
        <Link to="/">Back to the home page</Link>
      </p>
    </section>
  );
}
