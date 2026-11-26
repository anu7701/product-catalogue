import { enquiryMessages } from '@catalogue/shared';
import { describe, expect, it } from 'vitest';
import { FixtureProductSource } from '../../src/adapters/fixture/fixture-product-source.ts';
import {
  EmailDeliveryFailedError,
  ProductUnavailableError,
  UpstreamUnavailableError,
  ValidationFailedError,
} from '../../src/domain/errors.ts';
import { LogEvent } from '../../src/logging/logger.ts';
import type { ProductSource } from '../../src/ports/product-source.ts';
import { EnquiryService } from '../../src/services/enquiry-service.ts';
import {
  failingProductSource,
  RecordingNotifier,
  RecordingRecorder,
  spyLogger,
} from '../helpers/doubles.ts';

const NOW = new Date('2026-11-26T14:03:00.000Z');

async function setup(productSource?: ProductSource) {
  const calls: string[] = [];
  const notifier = new RecordingNotifier(calls);
  const recorder = new RecordingRecorder(calls);
  const logger = spyLogger();
  const service = new EnquiryService({
    productSource: productSource ?? (await FixtureProductSource.load()),
    recorder,
    notifier,
    logger,
    publicSiteUrl: 'http://localhost:8080/',
    now: () => NOW,
  });
  return { service, notifier, recorder, logger, calls };
}

const valid = {
  productId: '1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+44 20 7946 0000',
  message: 'Is this available in blue?',
};

describe('EnquiryService.submit', () => {
  it('ENQ-03: sends one notification with the customer and catalogue product details', async () => {
    const { service, notifier } = await setup();

    await service.submit(valid);

    expect(notifier.sent).toEqual([
      {
        customer: {
          name: 'Jane Doe',
          email: 'jane@example.com',
          phone: '+44 20 7946 0000',
          message: 'Is this available in blue?',
        },
        product: {
          id: '1',
          title: 'Fjallraven - Foldsack No. 1 Backpack, Fits 15 Laptops',
          price: 109.95,
          url: 'http://localhost:8080/product/1',
        },
        submittedAt: NOW,
      },
    ]);
  });

  it('A28: product details come from the catalogue, never from the request', async () => {
    const { service, notifier } = await setup();

    await service.submit({ ...valid, title: 'FREE ITEM', price: 0 });

    expect(notifier.sent[0]?.product).toMatchObject({
      title: expect.stringContaining('Fjallraven') as string,
      price: 109.95,
    });
  });

  it('A34: records before notifying', async () => {
    const { service, recorder, calls } = await setup();

    await service.submit(valid);

    expect(calls).toEqual(['record', 'notify']);
    expect(recorder.recorded).toHaveLength(1);
  });

  it('NEW-34: optional fields left blank are passed on as not provided', async () => {
    const { service, notifier } = await setup();

    await service.submit({ productId: '1', name: ' Jane ', email: 'jane@example.com', phone: '' });

    expect(notifier.sent[0]?.customer).toEqual({
      name: 'Jane',
      email: 'jane@example.com',
      phone: undefined,
      message: undefined,
    });
  });

  it('ENQ-02: invalid input → ValidationFailedError per field; nothing sent', async () => {
    const { service, notifier, calls } = await setup();

    const error = await service
      .submit({ productId: '1', name: '', email: 'nope' })
      .catch((caught: unknown) => caught);

    expect(error).toBeInstanceOf(ValidationFailedError);
    expect((error as ValidationFailedError).fieldErrors).toEqual({
      name: enquiryMessages.nameRequired,
      email: enquiryMessages.emailInvalid,
    });
    expect(notifier.sent).toEqual([]);
    expect(calls).toEqual([]);
  });

  it('NEW-36: product no longer exists → ProductUnavailableError; nothing sent', async () => {
    const { service, notifier } = await setup();

    await expect(service.submit({ ...valid, productId: '999' })).rejects.toThrow(
      ProductUnavailableError,
    );
    expect(notifier.sent).toEqual([]);
  });

  it('product source down → UpstreamUnavailableError; nothing sent', async () => {
    const { service, notifier } = await setup(failingProductSource());

    await expect(service.submit(valid)).rejects.toThrow(UpstreamUnavailableError);
    expect(notifier.sent).toEqual([]);
  });

  it('ENQ-05: email not accepted → EmailDeliveryFailedError, logged as enquiry.failed', async () => {
    const { service, notifier, logger } = await setup();
    notifier.failWith = new EmailDeliveryFailedError('SMTP 554');

    await expect(service.submit(valid)).rejects.toThrow(EmailDeliveryFailedError);
    expect(logger.error).toHaveBeenCalledWith(
      expect.objectContaining({ event: LogEvent.enquiryFailed, productId: '1' }),
      expect.any(String),
    );
  });

  it('ENQ-05: any other notifier failure is also reported as EmailDeliveryFailedError', async () => {
    const { service, notifier } = await setup();
    notifier.failWith = new Error('socket hang up');

    await expect(service.submit(valid)).rejects.toThrow(EmailDeliveryFailedError);
  });

  it('A37: logs enquiry.sent with the product ID only, no customer details', async () => {
    const { service, logger } = await setup();

    await service.submit(valid);

    expect(logger.info).toHaveBeenCalledWith(
      { event: LogEvent.enquirySent, productId: '1' },
      'Enquiry sent',
    );
    const logged = JSON.stringify([...logger.info.mock.calls, ...logger.error.mock.calls]);
    for (const value of [valid.name, valid.email, valid.phone, valid.message]) {
      expect(logged).not.toContain(value);
    }
  });
});
