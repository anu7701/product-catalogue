import { enquiryRequestSchema } from '@catalogue/shared';
import { EmailDeliveryFailedError, ProductUnavailableError } from '../domain/errors.ts';
import { LogEvent, type Logger } from '../logging/logger.ts';
import type { EnquiryRecorder } from '../ports/enquiry-recorder.ts';
import type { EnquiryNotification, Notifier } from '../ports/notifier.ts';
import type { ProductSource } from '../ports/product-source.ts';
import { parseOrThrow } from './validation.ts';

export interface EnquiryServiceOptions {
  productSource: ProductSource;
  recorder: EnquiryRecorder;
  notifier: Notifier;
  logger: Logger;
  /** Public site URL, for the product link in the email (ENQ-03.FR1). */
  publicSiteUrl: string;
  /** Clock, injectable for tests. */
  now?: () => Date;
}

/**
 * Handles an enquiry (ARCHITECTURE §3.4): validate → look up product →
 * record → notify. Resolves only once the email has been accepted for
 * sending, so the caller can show "Thank you" (A31).
 */
export class EnquiryService {
  private readonly productSource: ProductSource;
  private readonly recorder: EnquiryRecorder;
  private readonly notifier: Notifier;
  private readonly logger: Logger;
  private readonly publicSiteUrl: string;
  private readonly now: () => Date;

  constructor(options: EnquiryServiceOptions) {
    this.productSource = options.productSource;
    this.recorder = options.recorder;
    this.notifier = options.notifier;
    this.logger = options.logger;
    this.publicSiteUrl = options.publicSiteUrl.replace(/\/+$/, '');
    this.now = options.now ?? (() => new Date());
  }

  /**
   * @throws ValidationFailedError     invalid input, per field (ENQ-02)
   * @throws ProductUnavailableError   product no longer exists (NEW-36)
   * @throws UpstreamUnavailableError  product source down
   * @throws EmailDeliveryFailedError  email not accepted (ENQ-05)
   */
  async submit(input: unknown): Promise<void> {
    const request = parseOrThrow(enquiryRequestSchema, input);

    // Product details come from the catalogue, never from the request (A28).
    const product = await this.productSource.getProduct(request.productId);
    if (!product) {
      throw new ProductUnavailableError(request.productId);
    }

    const enquiry: EnquiryNotification = {
      customer: {
        name: request.name,
        email: request.email,
        phone: request.phone,
        message: request.message,
      },
      product: {
        id: product.id,
        title: product.title,
        price: product.price,
        url: `${this.publicSiteUrl}/product/${encodeURIComponent(product.id)}`,
      },
      submittedAt: this.now(),
    };

    await this.recorder.record(enquiry);

    try {
      await this.notifier.sendEnquiry(enquiry);
    } catch (error) {
      // No customer details in logs (A37): product ID and outcome only.
      this.logger.error(
        { event: LogEvent.enquiryFailed, productId: product.id, err: error },
        'Enquiry email was not sent',
      );
      throw error instanceof EmailDeliveryFailedError
        ? error
        : new EmailDeliveryFailedError('Enquiry email was not sent', { cause: error });
    }

    this.logger.info({ event: LogEvent.enquirySent, productId: product.id }, 'Enquiry sent');
  }
}
