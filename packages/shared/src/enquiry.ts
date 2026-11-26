import { z } from 'zod';

/** Field limits (ENQ-02 BR1, NEW-31). */
export const ENQUIRY_LIMITS = {
  nameMax: 100,
  emailMax: 254,
  phoneMin: 7,
  phoneMax: 20,
  messageMax: 1000,
  productIdMax: 128,
} as const;

/** Customer-facing field messages. Wording from ENQ-02.FR2 unless noted. */
export const enquiryMessages = {
  nameRequired: 'Please enter your name.',
  nameTooLong: `Name must be ${ENQUIRY_LIMITS.nameMax} characters or fewer.`,
  /** Not in the spec: NEW-32 rejects line breaks but defines no message. */
  nameLineBreak: 'Please enter your name on a single line.',
  emailRequired: 'Please enter your email address.',
  emailInvalid: 'Please enter a valid email address, like name@example.com.',
  phoneInvalid: 'Please enter a valid phone number.',
  messageTooLong: `Message must be ${ENQUIRY_LIMITS.messageMax} characters or fewer.`,
  /** Not in the spec: the form always sends it; only a tampered request lacks it. */
  productRequired: 'Please choose a product to enquire about.',
} as const;

/** Only digits, spaces, `+`, `-`, `(`, `)`; 7–20 characters (NEW-31). */
const PHONE_PATTERN = new RegExp(
  `^[0-9 +\\-()]{${ENQUIRY_LIMITS.phoneMin},${ENQUIRY_LIMITS.phoneMax}}$`,
);

/** Trim strings; an empty optional field counts as not given (NEW-34). */
function optionalTrimmed<T extends z.ZodType>(schema: T) {
  return z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
  }, schema.optional());
}

/**
 * An enquiry submission (ENQ-02). Used by the form for instant feedback and,
 * authoritatively, by the API (A29). Strings are trimmed before validation
 * (NEW-34); unknown fields (e.g. a product title or price) are stripped (A28).
 */
export const enquiryRequestSchema = z.object({
  productId: z
    .string({ error: enquiryMessages.productRequired })
    .trim()
    .min(1, { error: enquiryMessages.productRequired })
    .max(ENQUIRY_LIMITS.productIdMax, { error: enquiryMessages.productRequired }),
  name: z
    .string({ error: enquiryMessages.nameRequired })
    .trim()
    .min(1, { error: enquiryMessages.nameRequired })
    .max(ENQUIRY_LIMITS.nameMax, { error: enquiryMessages.nameTooLong })
    // NEW-32: a line break could inject email headers.
    .refine((name) => !/[\r\n]/.test(name), { error: enquiryMessages.nameLineBreak }),
  email: z
    .string({ error: enquiryMessages.emailRequired })
    .trim()
    .min(1, { error: enquiryMessages.emailRequired })
    .max(ENQUIRY_LIMITS.emailMax, { error: enquiryMessages.emailInvalid })
    // Format only, no deliverability check (NEW-33); also rejects line breaks (NEW-32).
    .pipe(z.email({ error: enquiryMessages.emailInvalid })),
  phone: optionalTrimmed(
    z
      .string({ error: enquiryMessages.phoneInvalid })
      .regex(PHONE_PATTERN, { error: enquiryMessages.phoneInvalid }),
  ),
  message: optionalTrimmed(
    z
      .string({ error: enquiryMessages.messageTooLong })
      .max(ENQUIRY_LIMITS.messageMax, { error: enquiryMessages.messageTooLong }),
  ),
});

/** Form input before validation. */
export type EnquiryRequestInput = z.input<typeof enquiryRequestSchema>;
/** A validated enquiry. */
export type EnquiryRequest = z.output<typeof enquiryRequestSchema>;
