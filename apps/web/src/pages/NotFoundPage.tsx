import { NotFoundView } from '../components/NotFoundView.tsx';

/** Any unknown address (GLB-04.FR4, NEW-12). */
export function NotFoundPage() {
  return <NotFoundView title="Page not found" message="We couldn't find the page you asked for." />;
}
