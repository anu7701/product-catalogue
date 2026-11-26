import type { z } from 'zod';
import { ValidationFailedError } from '../domain/errors.ts';

/**
 * Parse input with a shared schema, or throw ValidationFailedError with one
 * customer-facing message per field (the first problem found for each).
 */
export function parseOrThrow<T extends z.ZodType>(schema: T, input: unknown): z.output<T> {
  const result = schema.safeParse(input);
  if (result.success) {
    return result.data;
  }
  const fieldErrors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    const field = String(issue.path[0] ?? 'input');
    fieldErrors[field] ??= issue.message;
  }
  throw new ValidationFailedError(fieldErrors);
}
