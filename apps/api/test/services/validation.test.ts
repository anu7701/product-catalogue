import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import { ValidationFailedError } from '../../src/domain/errors.ts';
import { parseOrThrow } from '../../src/services/validation.ts';

const schema = z.object({
  name: z.string().min(1, { error: 'Name needed' }).max(3, { error: 'Name too long' }),
  age: z.number({ error: 'Age needed' }),
});

describe('parseOrThrow', () => {
  it('returns the parsed value when valid', () => {
    expect(parseOrThrow(schema, { name: 'Al', age: 3, extra: true })).toEqual({
      name: 'Al',
      age: 3,
    });
  });

  it('throws ValidationFailedError with one message per field', () => {
    const error = (() => {
      try {
        parseOrThrow(schema, { name: '' });
      } catch (caught) {
        return caught;
      }
    })();

    expect(error).toBeInstanceOf(ValidationFailedError);
    expect((error as ValidationFailedError).fieldErrors).toEqual({
      name: 'Name needed',
      age: 'Age needed',
    });
  });

  it('keeps the first message when a field has several problems', () => {
    const multi = z.object({
      code: z.string().min(5, { error: 'first' }).regex(/^x/, { error: 'second' }),
    });
    expect(() => parseOrThrow(multi, { code: 'ab' })).toThrow(ValidationFailedError);
    try {
      parseOrThrow(multi, { code: 'ab' });
    } catch (error) {
      expect((error as ValidationFailedError).fieldErrors).toEqual({ code: 'first' });
    }
  });
});
