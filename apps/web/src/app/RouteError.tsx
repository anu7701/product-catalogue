import { useRouteError } from 'react-router';
import { ErrorFallback } from './ErrorFallback.tsx';

/** A page crashed while rendering: keep the header, show the fallback in the page area. */
export function RouteError() {
  const error = useRouteError();
  console.error('Page failed to render', error);
  return <ErrorFallback />;
}
