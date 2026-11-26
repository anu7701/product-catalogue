import { z } from 'zod';

/** Longest accepted search term (SRC-01 BR4, NEW-24). */
export const SEARCH_TERM_MAX_LENGTH = 100;

/** Customer-facing search validation messages. */
export const searchMessages = {
  /** SRC-01 BR3. */
  empty: 'Enter a search term',
  tooLong: `Search terms can be up to ${SEARCH_TERM_MAX_LENGTH} characters.`,
} as const;

/**
 * A search term (SRC-01): trimmed (A13), 1–100 characters (NEW-24), kept as
 * literal text; special characters have no meaning (NEW-27).
 * Used by the search bar and, authoritatively, by the API.
 */
export const searchTermSchema = z
  .string({ error: searchMessages.empty })
  .trim()
  .min(1, { error: searchMessages.empty })
  .max(SEARCH_TERM_MAX_LENGTH, { error: searchMessages.tooLong });
