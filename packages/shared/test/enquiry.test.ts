import { describe, expect, it } from 'vitest';
import { enquiryMessages as m, enquiryRequestSchema } from '../src/enquiry.ts';

const valid = { productId: '1', name: 'Jane Doe', email: 'jane@example.com' };

/** Field → message for the first problem with each field, or {} if valid. */
function errorsFor(input: Record<string, unknown>) {
  const result = enquiryRequestSchema.safeParse(input);
  if (result.success) return {};
  const errors: Record<string, string> = {};
  for (const issue of result.error.issues) {
    errors[String(issue.path[0])] ??= issue.message;
  }
  return errors;
}

describe('enquiryRequestSchema (ENQ-02)', () => {
  it('accepts name + email only; phone and message are optional', () => {
    expect(enquiryRequestSchema.parse(valid)).toEqual({
      ...valid,
      phone: undefined,
      message: undefined,
    });
  });

  it('NEW-34: trims every field; empty optional fields become undefined', () => {
    expect(
      enquiryRequestSchema.parse({
        productId: ' 1 ',
        name: '  Jane Doe ',
        email: ' jane@example.com ',
        phone: '   ',
        message: '  ',
      }),
    ).toEqual({
      productId: '1',
      name: 'Jane Doe',
      email: 'jane@example.com',
      phone: undefined,
      message: undefined,
    });
  });

  it('A28: unknown fields such as a product title or price are stripped', () => {
    const parsed = enquiryRequestSchema.parse({ ...valid, title: 'FREE ITEM', price: 0 });
    expect(parsed).not.toHaveProperty('title');
    expect(parsed).not.toHaveProperty('price');
  });

  // ENQ-02.FR2 messages, table-driven.
  it.each([
    ['name missing', { name: undefined }, { name: m.nameRequired }],
    ['name whitespace-only', { name: '   ' }, { name: m.nameRequired }],
    ['name 101 characters', { name: 'a'.repeat(101) }, { name: m.nameTooLong }],
    [
      'name with a line break (NEW-32)',
      { name: 'Jane\r\nBcc: x@evil.example' },
      { name: m.nameLineBreak },
    ],
    ['email missing', { email: undefined }, { email: m.emailRequired }],
    ['email empty', { email: '' }, { email: m.emailRequired }],
    ['email invalid', { email: 'not-an-email' }, { email: m.emailInvalid }],
    [
      'email with a line break (NEW-32)',
      { email: 'jane@example.com\nBcc: x@evil.example' },
      { email: m.emailInvalid },
    ],
    [
      'email over 254 characters',
      { email: `${'a'.repeat(250)}@example.com` },
      { email: m.emailInvalid },
    ],
    ['phone too short', { phone: '123' }, { phone: m.phoneInvalid }],
    ['phone with letters', { phone: '0800 CALL ME' }, { phone: m.phoneInvalid }],
    ['phone 21 characters', { phone: '1'.repeat(21) }, { phone: m.phoneInvalid }],
    ['message 1001 characters', { message: 'a'.repeat(1001) }, { message: m.messageTooLong }],
    ['product ID missing', { productId: undefined }, { productId: m.productRequired }],
    ['name as a number', { name: 42 }, { name: m.nameRequired }],
  ])('rejects %s', (_label, change, expected) => {
    expect(errorsFor({ ...valid, ...change })).toEqual(expected);
  });

  it('reports every invalid field at once, keeping the form input intact', () => {
    expect(errorsFor({ productId: '1', name: '', email: 'not-an-email' })).toEqual({
      name: m.nameRequired,
      email: m.emailInvalid,
    });
  });

  it.each([
    ['uppercase email', { email: 'Jane@Example.COM' }],
    ['accents and apostrophes in the name', { name: "Zoë O'Brien" }],
    ['name of exactly 100 characters', { name: 'a'.repeat(100) }],
    ['international phone', { phone: '+44 (20) 7946-0000' }],
    ['phone of exactly 7 digits', { phone: '1234567' }],
    [
      'message of exactly 1000 characters with inner line breaks',
      { message: `${'a'.repeat(499)}\n\n${'a'.repeat(499)}` },
    ],
    ['message containing HTML (kept as plain text)', { message: '<script>alert(1)</script>' }],
  ])('accepts %s', (_label, change) => {
    expect(errorsFor({ ...valid, ...change })).toEqual({});
  });
});
