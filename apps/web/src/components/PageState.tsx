import { ErrorCode, errorMessages } from '@catalogue/shared';
import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ApiError, isNotFound } from '../api/client.ts';
import styles from './PageState.module.css';

/** Shown while data loads (GLB-03.FR1); announced politely to screen readers. */
export function LoadingState() {
  return (
    <p className={styles.state} role="status">
      Loading…
    </p>
  );
}

/**
 * Friendly error with Try again (GLB-03.FR2). Never shows technical details
 * (A43): only the customer-facing message for the error's code.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  const message =
    error instanceof ApiError && error.code !== ErrorCode.INTERNAL_ERROR
      ? error.message
      : errorMessages.INTERNAL_ERROR;
  return (
    <div className={`${styles.state} ${styles.error}`} role="alert">
      <p>{message}</p>
      <button type="button" className={styles.retry} onClick={onRetry}>
        Try again
      </button>
    </div>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.state}>{children}</div>;
}

interface QueryViewProps<T> {
  query: UseQueryResult<T>;
  children: (data: T) => ReactNode;
  /** Shown for PRODUCT/CATEGORY/NOT_FOUND errors instead of the error state (CAT-02, PRD-02). */
  notFound?: ReactNode;
  /** Shown when `isEmpty(data)` (GLB-03.FR3). */
  empty?: ReactNode;
  isEmpty?: (data: T) => boolean;
}

/**
 * One place that decides what a page shows for a request (GLB-03):
 * loading → not found → error with Try again → empty → content.
 * "Unavailable" is never shown as "not found" (it's a different code).
 */
export function QueryView<T>({ query, children, notFound, empty, isEmpty }: QueryViewProps<T>) {
  if (query.isPending) {
    return <LoadingState />;
  }
  if (query.isError) {
    if (notFound !== undefined && isNotFound(query.error)) {
      return <>{notFound}</>;
    }
    return <ErrorState error={query.error} onRetry={() => void query.refetch()} />;
  }
  if (empty !== undefined && isEmpty?.(query.data)) {
    return <EmptyState>{empty}</EmptyState>;
  }
  return <>{children(query.data)}</>;
}
