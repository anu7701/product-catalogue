import { errorMessages } from '@catalogue/shared';
import { useDocumentTitle } from './useDocumentTitle.ts';

/**
 * Shown when the page itself crashes (a bug, not an API error). Friendly and
 * free of technical details (A43); reloading is the only sensible action.
 */
export function ErrorFallback() {
  useDocumentTitle('Something went wrong');
  return (
    <section role="alert">
      <h1>Something went wrong</h1>
      <p>{errorMessages.INTERNAL_ERROR}</p>
      <p>
        <button type="button" onClick={() => window.location.reload()}>
          Reload the page
        </button>{' '}
        <a href="/">Back to the home page</a>
      </p>
    </section>
  );
}
