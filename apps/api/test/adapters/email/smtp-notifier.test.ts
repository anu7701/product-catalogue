import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { describe, expect, it } from 'vitest';
import { composeEnquiryEmail, SmtpNotifier } from '../../../src/adapters/email/smtp-notifier.ts';
import { EmailDeliveryFailedError } from '../../../src/domain/errors.ts';
import type { EnquiryNotification } from '../../../src/ports/notifier.ts';

const addresses = { from: 'no-reply@example.com', salesInbox: 'sales@example.com' };

const enquiry: EnquiryNotification = {
  customer: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '+44 20 7946 0000',
    message: 'Is this available in blue?\nThanks!',
  },
  product: {
    id: '1',
    title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops',
    price: 1109.5,
    url: 'http://localhost:8080/product/1',
  },
  submittedAt: new Date('2026-11-26T14:03:09.123Z'),
};

describe('composeEnquiryEmail (ENQ-03.FR1)', () => {
  const email = composeEnquiryEmail(enquiry, addresses);

  it('A30: to the sales inbox, from the configured sender, Reply-To the customer', () => {
    expect(email).toMatchObject({
      from: 'no-reply@example.com',
      to: 'sales@example.com',
      replyTo: 'jane@example.com',
    });
  });

  it('subject is "New enquiry: {title} (ID {id})"', () => {
    expect(email.subject).toBe(
      'New enquiry: Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops (ID 1)',
    );
  });

  it('body has customer details, product title/ID/price/link and UTC time', () => {
    expect(email.text).toContain('Name:    Jane Doe');
    expect(email.text).toContain('Email:   jane@example.com');
    expect(email.text).toContain('Phone:   +44 20 7946 0000');
    expect(email.text).toContain('Is this available in blue?\nThanks!');
    expect(email.text).toContain('Title:   Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops');
    expect(email.text).toContain('ID:      1');
    expect(email.text).toContain('Price:   $1,109.50');
    expect(email.text).toContain('Link:    http://localhost:8080/product/1');
    expect(email.text).toContain('Submitted: 2026-11-26 14:03:09 UTC');
  });

  it('missing phone and message → "Not provided" / "No message"', () => {
    const text = composeEnquiryEmail(
      { ...enquiry, customer: { ...enquiry.customer, phone: undefined, message: undefined } },
      addresses,
    ).text as string;
    expect(text).toContain('Phone:   Not provided');
    expect(text).toContain('No message');
  });

  it('ENQ-03.FR2: plain text only, no HTML part', () => {
    expect(email.html).toBeUndefined();
  });

  it('NEW-32: a line break in the product title cannot reach the subject header', () => {
    const subject = composeEnquiryEmail(
      { ...enquiry, product: { ...enquiry.product, title: 'Lamp\r\nBcc: x@evil.example' } },
      addresses,
    ).subject;
    expect(subject).toBe('New enquiry: Lamp Bcc: x@evil.example (ID 1)');
  });
});

describe('SmtpNotifier', () => {
  it('produces a plain-text MIME message with the right headers', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    let raw = '';
    const capture = {
      sendMail: async (message: SendMailOptions) => {
        const info = (await transport.sendMail(message)) as unknown as { message: Buffer };
        raw = info.message.toString('utf8');
        return { rejected: [] };
      },
    } as unknown as Transporter;

    await new SmtpNotifier({ transport: capture, ...addresses }).sendEnquiry(enquiry);

    expect(raw).toMatch(/^To: sales@example\.com$/m);
    expect(raw).toMatch(/^From: no-reply@example\.com$/m);
    expect(raw).toMatch(/^Reply-To: jane@example\.com$/m);
    expect(raw).toMatch(/^Content-Type: text\/plain/m);
    expect(raw).not.toMatch(/text\/html/);
  });

  it('A31: resolves once the mail server accepts the message', async () => {
    const transport = {
      sendMail: () => Promise.resolve({ rejected: [] }),
    } as unknown as Transporter;
    await expect(
      new SmtpNotifier({ transport, ...addresses }).sendEnquiry(enquiry),
    ).resolves.toBeUndefined();
  });

  it('ENQ-05: transport error → EmailDeliveryFailedError', async () => {
    const transport = {
      sendMail: () => Promise.reject(new Error('connect ECONNREFUSED 127.0.0.1:1025')),
    } as unknown as Transporter;
    await expect(
      new SmtpNotifier({ transport, ...addresses }).sendEnquiry(enquiry),
    ).rejects.toThrow(EmailDeliveryFailedError);
  });

  it('ENQ-05: sales inbox rejected by the server → EmailDeliveryFailedError', async () => {
    const transport = {
      sendMail: () => Promise.resolve({ rejected: ['sales@example.com'] }),
    } as unknown as Transporter;
    await expect(
      new SmtpNotifier({ transport, ...addresses }).sendEnquiry(enquiry),
    ).rejects.toThrow(EmailDeliveryFailedError);
  });
});
