import { describe, expect, it } from 'vitest';
import { SEARCH_TERM_MAX_LENGTH, searchMessages, searchTermSchema } from '../src/search.ts';

function errorOf(input: unknown) {
  const result = searchTermSchema.safeParse(input);
  return result.success ? undefined : result.error.issues[0]?.message;
}

describe('searchTermSchema (SRC-01)', () => {
  it('A13: trims leading and trailing whitespace', () => {
    expect(searchTermSchema.parse('  backpack  ')).toBe('backpack');
  });

  it.each(['', '   ', '\t\n'])(
    'A13: empty or whitespace-only %j → "Enter a search term"',
    (input) => {
      expect(errorOf(input)).toBe(searchMessages.empty);
    },
  );

  it('NEW-24: exactly 100 characters is accepted', () => {
    expect(searchTermSchema.parse('a'.repeat(SEARCH_TERM_MAX_LENGTH))).toHaveLength(100);
  });

  it('NEW-24: 101 characters is rejected', () => {
    expect(errorOf('a'.repeat(SEARCH_TERM_MAX_LENGTH + 1))).toBe(searchMessages.tooLong);
  });

  it('NEW-24: the limit applies after trimming', () => {
    expect(searchTermSchema.safeParse(` ${'a'.repeat(100)} `).success).toBe(true);
  });

  it.each(["men's", 'a & b', '50%', 'what?', '.*', '<b>x</b>', 'slim  fit'])(
    'SRC-01: special characters and inner spaces are kept as typed: %j',
    (input) => {
      expect(searchTermSchema.parse(input)).toBe(input);
    },
  );

  it.each([undefined, null, 42, ['a', 'b']])(
    'a missing or non-text term %j is rejected',
    (input) => {
      expect(errorOf(input)).toBe(searchMessages.empty);
    },
  );
});
