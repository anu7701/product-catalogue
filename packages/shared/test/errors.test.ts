import { describe, expect, it } from 'vitest';
import { ErrorCode, errorMessages, problemDetailsSchema } from '../src/errors.ts';

describe('error contract', () => {
  it('every error code has a customer-facing message', () => {
    for (const code of Object.values(ErrorCode)) {
      expect(errorMessages[code].trim()).not.toBe('');
    }
  });

  it('messages are plain sentences with no technical detail', () => {
    for (const message of Object.values(errorMessages)) {
      expect(message).not.toMatch(/http|error:|stack|exception|\d{3}/i);
    }
  });

  it('accepts a Problem Details body with field errors', () => {
    expect(
      problemDetailsSchema.safeParse({
        type: 'about:blank',
        title: errorMessages.VALIDATION_FAILED,
        status: 400,
        code: 'VALIDATION_FAILED',
        requestId: 'req-1',
        errors: { email: 'Please enter your email address.' },
      }).success,
    ).toBe(true);
  });

  it('rejects unknown codes and non-error statuses', () => {
    const base = { type: 'about:blank', title: 't', requestId: 'r' };
    expect(problemDetailsSchema.safeParse({ ...base, status: 400, code: 'OOPS' }).success).toBe(
      false,
    );
    expect(
      problemDetailsSchema.safeParse({ ...base, status: 200, code: 'INTERNAL_ERROR' }).success,
    ).toBe(false);
  });
});
