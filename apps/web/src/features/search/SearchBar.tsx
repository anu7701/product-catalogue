import { SEARCH_TERM_MAX_LENGTH, searchTermSchema } from '@catalogue/shared';
import { type FormEvent, useId, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import styles from './SearchBar.module.css';

/** Address of the results page for a term (SRC-01, A16). */
export function searchPath(term: string): string {
  return `/search?${new URLSearchParams({ q: term }).toString()}`;
}

/**
 * Search bar on every page (SRC-01, A19). Search button or Enter submits
 * (A15); the term is trimmed and checked with the shared rules (A13,
 * NEW-24); a blank term shows a hint and goes nowhere. On the results page
 * it is pre-filled with the current term (NEW-25).
 */
export function SearchBar() {
  const [searchParams] = useSearchParams();
  const currentTerm = searchParams.get('q') ?? '';
  // Keep the field in step when the URL's term changes (back/forward, new search).
  const [shownTerm, setShownTerm] = useState(currentTerm);
  const [term, setTerm] = useState(currentTerm);
  if (shownTerm !== currentTerm) {
    setShownTerm(currentTerm);
    setTerm(currentTerm);
  }

  const [hint, setHint] = useState<string | null>(null);
  const navigate = useNavigate();
  const inputId = useId();
  const hintId = useId();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = searchTermSchema.safeParse(term);
    if (!parsed.success) {
      setHint(parsed.error.issues[0]?.message ?? null);
      return;
    }
    setHint(null);
    void navigate(searchPath(parsed.data));
  }

  return (
    <form role="search" className={styles.form} onSubmit={submit} noValidate>
      <label htmlFor={inputId} className="visually-hidden">
        Search products
      </label>
      <input
        id={inputId}
        className={styles.input}
        type="search"
        name="q"
        placeholder="Search products"
        maxLength={SEARCH_TERM_MAX_LENGTH}
        value={term}
        onChange={(event) => {
          setTerm(event.target.value);
          setHint(null);
        }}
        aria-describedby={hint ? hintId : undefined}
        aria-invalid={hint ? true : undefined}
      />
      <button type="submit" className={styles.button}>
        Search
      </button>
      <p id={hintId} className={styles.hint} aria-live="polite">
        {hint}
      </p>
    </form>
  );
}
