import { useEffect } from 'react';
import { STORE_NAME } from '../theme/branding.ts';

/** "Page | Store", or just the store name (CFG-04, NEW-29). */
export function documentTitle(pageTitle?: string): string {
  return pageTitle ? `${pageTitle} | ${STORE_NAME}` : STORE_NAME;
}

/** Sets the browser tab title for the current page. */
export function useDocumentTitle(pageTitle?: string): void {
  useEffect(() => {
    document.title = documentTitle(pageTitle);
  }, [pageTitle]);
}
