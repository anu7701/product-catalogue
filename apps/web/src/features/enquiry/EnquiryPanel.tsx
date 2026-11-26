import {
  ENQUIRY_LIMITS,
  enquiryRequestSchema,
  ErrorCode,
  errorMessages,
  type Product,
} from '@catalogue/shared';
import { useMutation } from '@tanstack/react-query';
import { type FormEvent, useEffect, useId, useRef, useState } from 'react';
import { api, ApiError } from '../../api/client.ts';
import styles from './EnquiryPanel.module.css';

const FIELDS = ['name', 'email', 'phone', 'message'] as const;
type Field = (typeof FIELDS)[number];
type Values = Record<Field, string>;
type FieldErrors = Partial<Record<Field, string>>;

const EMPTY: Values = { name: '', email: '', phone: '', message: '' };

/** Check the form with the shared rules (A29); one message per field, as the API returns them. */
function validate(productId: string, values: Values) {
  const result = enquiryRequestSchema.safeParse({ productId, ...values });
  if (result.success) return { data: result.data, errors: {} as FieldErrors };
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0] as Field;
    if (FIELDS.includes(field)) errors[field] ??= issue.message;
  }
  return { data: undefined, errors };
}

/** Customer-facing message for a failed submission (ENQ-05, ENQ-06, NEW-36). */
function failureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === ErrorCode.PRODUCT_UNAVAILABLE) return errorMessages.PRODUCT_UNAVAILABLE;
    if (error.code === ErrorCode.RATE_LIMITED) return errorMessages.RATE_LIMITED;
  }
  return errorMessages.EMAIL_DELIVERY_FAILED;
}

/**
 * Enquire about the product on this page (ENQ-01 – ENQ-06). The product ID
 * comes from the page; the API attaches the product details (A28).
 */
export function EnquiryPanel({ product }: { product: Product }) {
  const [open, setOpen] = useState(false);
  // Kept while on this page, even if the form is closed (NEW-30).
  const [values, setValues] = useState<Values>(EMPTY);
  const [edited, setEdited] = useState<Partial<Record<Field, boolean>>>({});
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [thanks, setThanks] = useState<{ name: string; email: string } | null>(null);

  const ids = { form: useId(), heading: useId(), field: useId() };
  const fieldRefs = useRef<Partial<Record<Field, HTMLInputElement | HTMLTextAreaElement | null>>>(
    {},
  );
  const enquireButton = useRef<HTMLButtonElement>(null);
  const thanksRef = useRef<HTMLDivElement>(null);
  const focusAfterClose = useRef(false);

  const submission = useMutation({ mutationFn: api.submitEnquiry });

  // ENQ-01.FR1: opening moves focus to the first field; closing returns it to Enquire.
  useEffect(() => {
    if (open) {
      fieldRefs.current.name?.focus();
    } else if (focusAfterClose.current) {
      focusAfterClose.current = false;
      enquireButton.current?.focus();
    }
  }, [open]);

  // ENQ-04.FR2: move focus to the thank-you message so it is read out.
  useEffect(() => {
    if (thanks) thanksRef.current?.focus();
  }, [thanks]);

  function focusFirstInvalid(fieldErrors: FieldErrors) {
    const first = FIELDS.find((field) => fieldErrors[field]);
    if (first) fieldRefs.current[first]?.focus();
  }

  function change(field: Field, value: string) {
    const next = { ...values, [field]: value };
    setValues(next);
    setEdited((current) => ({ ...current, [field]: true }));
    // Once a field shows an error, re-check it as the customer fixes it.
    if (errors[field]) {
      setErrors((current) => ({ ...current, [field]: validate(product.id, next).errors[field] }));
    }
  }

  // NEW-35: check a field when leaving it, but only once it has been edited.
  function blur(field: Field) {
    if (!edited[field]) return;
    setErrors((current) => ({ ...current, [field]: validate(product.id, values).errors[field] }));
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission.isPending) return; // NEW-38: never two submissions at once

    const { data, errors: fieldErrors } = validate(product.id, values);
    setErrors(fieldErrors);
    setBanner(null);
    if (!data) {
      focusFirstInvalid(fieldErrors);
      return;
    }

    submission.mutate(data, {
      // A31: "Thank you" only once the API has accepted the enquiry (202).
      onSuccess: () => setThanks({ name: data.name, email: data.email }),
      onError: (error) => {
        // ENQ-05.FR2: input is kept; the customer can try again.
        if (error instanceof ApiError && error.code === ErrorCode.VALIDATION_FAILED) {
          const serverErrors: FieldErrors = {};
          for (const field of FIELDS) {
            if (error.fieldErrors[field]) serverErrors[field] = error.fieldErrors[field];
          }
          setErrors(serverErrors);
          focusFirstInvalid(serverErrors);
          if (Object.keys(serverErrors).length === 0) setBanner(failureMessage(error));
          return;
        }
        setBanner(failureMessage(error));
      },
    });
  }

  if (thanks) {
    // ENQ-04: replaces the form; Enquire isn't offered again on this visit (NEW-41).
    return (
      <div ref={thanksRef} className={styles.thanks} role="status" tabIndex={-1}>
        Thank you, {thanks.name}. We&apos;ve received your enquiry about {product.title} and will
        reply to {thanks.email}.
      </div>
    );
  }

  if (!open) {
    return (
      <button
        ref={enquireButton}
        type="button"
        className={styles.enquire}
        aria-expanded="false"
        aria-controls={ids.form}
        onClick={() => setOpen(true)}
      >
        Enquire
      </button>
    );
  }

  const describedBy = (field: Field, extra?: string) =>
    [errors[field] ? `${ids.field}-${field}-error` : null, extra].filter(Boolean).join(' ') ||
    undefined;

  const fieldProps = (field: Field) => ({
    id: `${ids.field}-${field}`,
    name: field,
    className: styles.input,
    value: values[field],
    'aria-invalid': errors[field] ? true : undefined,
    onBlur: () => blur(field),
  });

  const errorFor = (field: Field) =>
    errors[field] ? (
      <p id={`${ids.field}-${field}-error`} className={styles.fieldError}>
        {errors[field]}
      </p>
    ) : null;

  return (
    <section id={ids.form} className={styles.panel} aria-labelledby={ids.heading}>
      <h2 id={ids.heading} className={styles.heading}>
        Enquire about {product.title}
      </h2>
      {banner && (
        <p className={styles.banner} role="alert">
          {banner}
        </p>
      )}
      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${ids.field}-name`}>
            Name <span className={styles.optional}>(required)</span>
          </label>
          <input
            {...fieldProps('name')}
            ref={(element) => {
              fieldRefs.current.name = element;
            }}
            type="text"
            autoComplete="name"
            aria-required="true"
            aria-describedby={describedBy('name')}
            onChange={(event) => change('name', event.target.value)}
          />
          {errorFor('name')}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${ids.field}-email`}>
            Email <span className={styles.optional}>(required)</span>
          </label>
          <input
            {...fieldProps('email')}
            ref={(element) => {
              fieldRefs.current.email = element;
            }}
            type="email"
            autoComplete="email"
            aria-required="true"
            aria-describedby={describedBy('email')}
            onChange={(event) => change('email', event.target.value)}
          />
          {errorFor('email')}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${ids.field}-phone`}>
            Phone
          </label>
          <input
            {...fieldProps('phone')}
            ref={(element) => {
              fieldRefs.current.phone = element;
            }}
            type="tel"
            autoComplete="tel"
            aria-describedby={describedBy('phone')}
            onChange={(event) => change('phone', event.target.value)}
          />
          {errorFor('phone')}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={`${ids.field}-message`}>
            Message
          </label>
          <textarea
            {...fieldProps('message')}
            ref={(element) => {
              fieldRefs.current.message = element;
            }}
            rows={5}
            aria-describedby={describedBy('message', `${ids.field}-message-count`)}
            onChange={(event) => change('message', event.target.value)}
          />
          {/* ENQ-02.FR4: character counter. */}
          <p id={`${ids.field}-message-count`} className={styles.counter}>
            {values.message.length} / {ENQUIRY_LIMITS.messageMax} characters
          </p>
          {errorFor('message')}
        </div>

        <div className={styles.actions}>
          <button type="submit" className={styles.send} disabled={submission.isPending}>
            {submission.isPending ? 'Sending…' : 'Send enquiry'}
          </button>
          <button
            type="button"
            className={styles.cancel}
            onClick={() => {
              focusAfterClose.current = true;
              setOpen(false);
            }}
          >
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}
