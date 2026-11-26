import { enquiryMessages, ErrorCode, errorMessages } from '@catalogue/shared';
import { screen, waitFor } from '@testing-library/react';
import { delay, http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { renderApp } from '../../helpers/render.tsx';
import { problem } from '../../mocks/handlers.ts';
import { server } from '../../mocks/server.ts';

/** Product 1 in the mock data is "Backpack". */
async function openProduct() {
  const rendered = renderApp('/product/1');
  await screen.findByRole('heading', { level: 1, name: 'Backpack' });
  return rendered;
}

async function openForm() {
  const rendered = await openProduct();
  await rendered.user.click(screen.getByRole('button', { name: 'Enquire' }));
  return rendered;
}

const field = {
  name: () => screen.getByRole('textbox', { name: 'Name (required)' }),
  email: () => screen.getByRole('textbox', { name: 'Email (required)' }),
  phone: () => screen.getByRole('textbox', { name: 'Phone' }),
  message: () => screen.getByRole('textbox', { name: 'Message' }),
};
const sendButton = () => screen.getByRole('button', { name: /Send enquiry|Sending…/ });

/** Record enquiry requests; respond with `respond` (202 by default). */
function trackEnquiries(
  respond: () => Response | Promise<Response> = () => new HttpResponse(null, { status: 202 }),
) {
  const bodies: unknown[] = [];
  server.use(
    http.post('/api/v1/enquiries', async ({ request }) => {
      bodies.push(await request.json());
      return respond();
    }),
  );
  return bodies;
}

describe('EnquiryPanel: opening the form (ENQ-01)', () => {
  it('ENQ-01 AC: Enquire opens a form titled "Enquire about {product}"', async () => {
    await openForm();

    expect(screen.getByRole('heading', { name: 'Enquire about Backpack' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Enquire' })).not.toBeInTheDocument();
  });

  it('ENQ-01.FR1: focus moves to the first field', async () => {
    await openForm();
    expect(field.name()).toHaveFocus();
  });

  it('ENQ-02.FR1: required fields say so in text', async () => {
    await openForm();

    expect(field.name()).toBeRequired();
    expect(field.email()).toBeRequired();
    expect(field.phone()).not.toBeRequired();
    expect(field.message()).not.toBeRequired();
  });

  it('the Enquire button is a disclosure control', async () => {
    await openProduct();
    expect(screen.getByRole('button', { name: 'Enquire' })).toHaveAttribute(
      'aria-expanded',
      'false',
    );
  });

  it('NEW-30: Cancel closes the form, keeps the input, and returns focus to Enquire', async () => {
    const { user } = await openForm();
    await user.type(field.name(), 'Jane Doe');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(
      screen.queryByRole('heading', { name: 'Enquire about Backpack' }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Enquire' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Enquire' }));
    expect(field.name()).toHaveValue('Jane Doe');
  });

  it('ENQ-02.FR4: the message has a character counter', async () => {
    const { user } = await openForm();

    await user.type(field.message(), 'Hello');

    expect(field.message()).toHaveAccessibleDescription('5 / 1000 characters');
  });
});

describe('EnquiryPanel: validation (ENQ-02)', () => {
  it('ENQ-02 AC: empty name + invalid email → both messages, input kept, nothing sent', async () => {
    const enquiries = trackEnquiries();
    const { user } = await openForm();
    await user.type(field.email(), 'not-an-email');
    await user.type(field.message(), 'Keep me');

    await user.click(sendButton());

    expect(field.name()).toHaveAccessibleDescription(enquiryMessages.nameRequired);
    expect(field.name()).toHaveAttribute('aria-invalid', 'true');
    expect(field.email()).toHaveAccessibleDescription(enquiryMessages.emailInvalid);
    expect(field.message()).toHaveValue('Keep me');
    expect(field.name()).toHaveFocus(); // first invalid field
    expect(enquiries).toEqual([]);
  });

  it('NEW-35: an edited field is checked when leaving it', async () => {
    const { user } = await openForm();

    await user.type(field.phone(), '123');
    await user.tab();

    expect(field.phone()).toHaveAccessibleDescription(enquiryMessages.phoneInvalid);
  });

  it('NEW-35: tabbing through untouched fields shows no errors', async () => {
    const { user } = await openForm();

    await user.tab(); // name → email
    await user.tab(); // email → phone

    expect(screen.queryByText(enquiryMessages.nameRequired)).not.toBeInTheDocument();
    expect(screen.queryByText(enquiryMessages.emailRequired)).not.toBeInTheDocument();
  });

  it('an error clears as soon as the field is fixed', async () => {
    const { user } = await openForm();
    await user.click(sendButton());
    expect(screen.getByText(enquiryMessages.nameRequired)).toBeInTheDocument();

    await user.type(field.name(), 'J');

    expect(screen.queryByText(enquiryMessages.nameRequired)).not.toBeInTheDocument();
  });

  it('ENQ-02: name and email only is a valid enquiry', async () => {
    const enquiries = trackEnquiries();
    const { user } = await openForm();
    await user.type(field.name(), 'Jane');
    await user.type(field.email(), 'jane@example.com');

    await user.click(sendButton());

    await screen.findByRole('status');
    expect(enquiries).toHaveLength(1);
  });
});

describe('EnquiryPanel: submitting (ENQ-03 – ENQ-06)', () => {
  async function fillValid(user: Awaited<ReturnType<typeof openForm>>['user']) {
    await user.type(field.name(), '  Jane Doe ');
    await user.type(field.email(), 'Jane@Example.com');
    await user.type(field.phone(), '+44 20 7946 0000');
    await user.type(field.message(), 'Is this available in blue?');
  }

  it('ENQ-03: sends the page product ID and trimmed details only (A28)', async () => {
    const enquiries = trackEnquiries();
    const { user } = await openForm();
    await fillValid(user);

    await user.click(sendButton());

    await screen.findByRole('status');
    expect(enquiries).toEqual([
      {
        productId: '1',
        name: 'Jane Doe',
        email: 'Jane@Example.com',
        phone: '+44 20 7946 0000',
        message: 'Is this available in blue?',
      },
    ]);
  });

  it('ENQ-04 AC: after 202 the thank-you replaces the form, naming the product (NEW-40)', async () => {
    trackEnquiries();
    const { user } = await openForm();
    await fillValid(user);

    await user.click(sendButton());

    const thanks = await screen.findByRole('status');
    expect(thanks).toHaveTextContent(
      "Thank you, Jane Doe. We've received your enquiry about Backpack and will reply to Jane@Example.com.",
    );
    expect(thanks).toHaveFocus();
    expect(
      screen.queryByRole('heading', { name: 'Enquire about Backpack' }),
    ).not.toBeInTheDocument();
    // NEW-41: no Enquire button again on this visit.
    expect(screen.queryByRole('button', { name: 'Enquire' })).not.toBeInTheDocument();
  });

  it('NEW-38: while sending, the button says "Sending…" and is disabled; a double click sends once', async () => {
    const enquiries = trackEnquiries(async () => {
      await delay(100);
      return new HttpResponse(null, { status: 202 });
    });
    const { user } = await openForm();
    await fillValid(user);

    await user.dblClick(sendButton());

    expect(sendButton()).toHaveTextContent('Sending…');
    expect(sendButton()).toBeDisabled();
    await screen.findByRole('status');
    expect(enquiries).toHaveLength(1);
  });

  it.each([
    [
      'email not accepted (502)',
      () => problem(502, ErrorCode.EMAIL_DELIVERY_FAILED),
      errorMessages.EMAIL_DELIVERY_FAILED,
    ],
    [
      'product source down (502)',
      () => problem(502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE),
      errorMessages.EMAIL_DELIVERY_FAILED,
    ],
    [
      'unexpected server error',
      () => new HttpResponse('<html>', { status: 500 }),
      errorMessages.EMAIL_DELIVERY_FAILED,
    ],
    ['network failure', () => HttpResponse.error(), errorMessages.EMAIL_DELIVERY_FAILED],
    [
      'product no longer exists (422)',
      () => problem(422, ErrorCode.PRODUCT_UNAVAILABLE),
      errorMessages.PRODUCT_UNAVAILABLE,
    ],
    ['rate limited (429)', () => problem(429, ErrorCode.RATE_LIMITED), errorMessages.RATE_LIMITED],
  ])(
    'ENQ-05/06: %s → message, input kept, can retry, no thank-you',
    async (_label, respond, message) => {
      const enquiries = trackEnquiries(respond);
      const { user } = await openForm();
      await fillValid(user);

      await user.click(sendButton());

      expect(await screen.findByRole('alert')).toHaveTextContent(message);
      expect(field.message()).toHaveValue('Is this available in blue?');
      expect(sendButton()).toBeEnabled();
      expect(sendButton()).toHaveTextContent('Send enquiry');
      expect(screen.queryByText(/Thank you/)).not.toBeInTheDocument();
      // NEW-42: never resubmitted automatically.
      expect(enquiries).toHaveLength(1);
    },
  );

  it('ENQ-05 AC: retry after a failure succeeds and shows the thank-you', async () => {
    server.use(
      http.post('/api/v1/enquiries', () => problem(502, ErrorCode.EMAIL_DELIVERY_FAILED), {
        once: true,
      }),
    );
    const { user } = await openForm();
    await fillValid(user);

    await user.click(sendButton());
    await screen.findByRole('alert');
    await user.click(sendButton());

    expect(await screen.findByRole('status')).toHaveTextContent(/^Thank you/);
  });

  it('ENQ-02.FR5: the server’s field errors are shown on the fields', async () => {
    trackEnquiries(() =>
      problem(400, ErrorCode.VALIDATION_FAILED, { email: enquiryMessages.emailInvalid }),
    );
    const { user } = await openForm();
    await fillValid(user);

    await user.click(sendButton());

    await waitFor(() =>
      expect(field.email()).toHaveAccessibleDescription(enquiryMessages.emailInvalid),
    );
    expect(field.email()).toHaveFocus();
  });
});

describe('keyboard-only enquiry journey (GLB-05 AC)', () => {
  it('can go from product page to thank-you without a mouse', async () => {
    trackEnquiries();
    const { user } = await openProduct();

    // Tab until the Enquire button has focus, then press Enter.
    const enquire = screen.getByRole('button', { name: 'Enquire' });
    for (let step = 0; step < 30 && document.activeElement !== enquire; step += 1) {
      await user.tab();
    }
    expect(enquire).toHaveFocus();
    await user.keyboard('{Enter}');

    await user.keyboard('Jane Doe');
    await user.tab();
    await user.keyboard('jane@example.com{Enter}');

    expect(await screen.findByRole('status')).toHaveTextContent(/^Thank you, Jane Doe/);
  });
});
