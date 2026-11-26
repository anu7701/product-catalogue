import nodemailer, { type SendMailOptions, type Transporter } from 'nodemailer';
import { EmailDeliveryFailedError } from '../../domain/errors.ts';
import type { EnquiryNotification, Notifier } from '../../ports/notifier.ts';

/** Timeouts for every SMTP step (ARCHITECTURE §14.2 #11). */
export const SMTP_TIMEOUT_MS = 10_000;

export interface SmtpSettings {
  host: string;
  port: number;
  secure: boolean;
  user: string | undefined;
  pass: string | undefined;
}

/** SMTP transport for Mailpit locally or a real provider such as Amazon SES (A35, T7). */
export function createSmtpTransport(settings: SmtpSettings): Transporter {
  return nodemailer.createTransport({
    host: settings.host,
    port: settings.port,
    secure: settings.secure,
    auth: settings.user ? { user: settings.user, pass: settings.pass ?? '' } : undefined,
    connectionTimeout: SMTP_TIMEOUT_MS,
    greetingTimeout: SMTP_TIMEOUT_MS,
    socketTimeout: SMTP_TIMEOUT_MS,
  });
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });

/** Header values can't contain line breaks (header injection, NEW-32). */
function singleLine(value: string): string {
  return value.replace(/[\r\n]+/g, ' ').trim();
}

/** "2026-11-26 14:03:00 UTC" */
function formatUtc(date: Date): string {
  return `${date.toISOString().slice(0, 19).replace('T', ' ')} UTC`;
}

/**
 * The sales email for an enquiry (ENQ-03.FR1, NEW-37): to the sales inbox,
 * Reply-To the customer (A30), plain text only (ENQ-03.FR2).
 */
export function composeEnquiryEmail(
  enquiry: EnquiryNotification,
  addresses: { from: string; salesInbox: string },
): SendMailOptions {
  const { customer, product } = enquiry;
  return {
    from: addresses.from,
    to: addresses.salesInbox,
    replyTo: customer.email,
    subject: singleLine(`New enquiry: ${product.title} (ID ${product.id})`),
    text: [
      'A customer has sent an enquiry from the product catalogue.',
      '',
      'Customer',
      `  Name:    ${customer.name}`,
      `  Email:   ${customer.email}`,
      `  Phone:   ${customer.phone ?? 'Not provided'}`,
      '  Message:',
      customer.message ?? 'No message',
      '',
      'Product',
      `  Title:   ${product.title}`,
      `  ID:      ${product.id}`,
      `  Price:   ${usd.format(product.price)}`,
      `  Link:    ${product.url}`,
      '',
      `Submitted: ${formatUtc(enquiry.submittedAt)}`,
      '',
      'Reply to this email to answer the customer directly.',
    ].join('\n'),
  };
}

export interface SmtpNotifierOptions {
  transport: Transporter;
  from: string;
  salesInbox: string;
}

/** Notifier over SMTP (ARCHITECTURE §3.3). */
export class SmtpNotifier implements Notifier {
  private readonly transport: Transporter;
  private readonly from: string;
  private readonly salesInbox: string;

  constructor(options: SmtpNotifierOptions) {
    this.transport = options.transport;
    this.from = options.from;
    this.salesInbox = options.salesInbox;
  }

  /** Resolves once the mail server has accepted the message (A31). */
  async sendEnquiry(enquiry: EnquiryNotification): Promise<void> {
    let rejected: unknown[];
    try {
      const info = (await this.transport.sendMail(
        composeEnquiryEmail(enquiry, { from: this.from, salesInbox: this.salesInbox }),
      )) as { rejected?: unknown[] };
      rejected = info.rejected ?? [];
    } catch (error) {
      throw new EmailDeliveryFailedError('Mail server did not accept the enquiry email', {
        cause: error,
      });
    }
    if (rejected.length > 0) {
      throw new EmailDeliveryFailedError('Mail server rejected the sales inbox address');
    }
  }
}
