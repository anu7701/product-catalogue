import { useDocumentTitle } from '../app/useDocumentTitle.ts';
import { NotFoundView } from '../components/NotFoundView.tsx';

/** Any unknown address (GLB-04.FR4, NEW-12). */
export function NotFoundPage() {
  useDocumentTitle('Page not found');
  return <NotFoundView title="Page not found" message="We couldn't find the page you asked for." />;
}
