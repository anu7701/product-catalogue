import { enquiryMessages, ErrorCode } from '@catalogue/shared';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { EmailDeliveryFailedError } from '../../../src/domain/errors.ts';
import { LogEvent } from '../../../src/logging/logger.ts';
import { failingProductSource, RecordingNotifier } from '../../helpers/doubles.ts';
import { expectProblem } from '../../helpers/http.ts';
import { buildTestApp, captureLogger, type TestAppOptions } from '../../helpers/test-app.ts';

let app: FastifyInstance | undefined;

afterEach(async () => {
  await app?.close();
  app = undefined;
});

const valid = {
  productId: '1',
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+44 20 7946 0000',
  message: 'Is this available in blue?',
};

async function setup(options: TestAppOptions = {}) {
  const notifier =
    options.notifier instanceof RecordingNotifier ? options.notifier : new RecordingNotifier();
  app = await buildTestApp({ notifier, ...options });
  const post = (payload: unknown, extra: Partial<InjectOptions> = {}) =>
    (app as FastifyInstance).inject({
      method: 'POST',
      url: '/api/v1/enquiries',
      payload: payload as InjectOptions['payload'],
      ...extra,
    });
  return { notifier, post };
}

describe('POST /api/v1/enquiries', () => {
  it('ENQ-03 / T12: 202 with no body once the email is accepted', async () => {
    const { notifier, post } = await setup();

    const response = await post(valid);

    expect(response.statusCode).toBe(202);
    expect(response.body).toBe('');
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0]?.product).toMatchObject({
      id: '1',
      price: 109.95,
      url: 'http://localhost:8080/product/1',
    });
  });

  it('A28: a product title or price in the request is ignored', async () => {
    const { notifier, post } = await setup();

    await post({ ...valid, title: 'FREE ITEM', price: 0 });

    expect(notifier.sent[0]?.product.title).toContain('Fjallraven');
    expect(notifier.sent[0]?.product.price).toBe(109.95);
  });

  it('ENQ-02.FR5: invalid input → 400 with per-field messages; nothing sent', async () => {
    const { notifier, post } = await setup();

    const response = await post({ productId: '1', name: '', email: 'not-an-email' });

    expect(expectProblem(response, 400, ErrorCode.VALIDATION_FAILED).errors).toEqual({
      name: enquiryMessages.nameRequired,
      email: enquiryMessages.emailInvalid,
    });
    expect(notifier.sent).toEqual([]);
  });

  it('malformed JSON → 400 VALIDATION_FAILED', async () => {
    const { post } = await setup();
    const response = await post('{"name":', { headers: { 'content-type': 'application/json' } });
    expectProblem(response, 400, ErrorCode.VALIDATION_FAILED);
  });

  it('NEW-36: product no longer exists → 422 PRODUCT_UNAVAILABLE', async () => {
    const { notifier, post } = await setup();

    expectProblem(await post({ ...valid, productId: '999' }), 422, ErrorCode.PRODUCT_UNAVAILABLE);
    expect(notifier.sent).toEqual([]);
  });

  it('ENQ-05: email not accepted → 502 EMAIL_DELIVERY_FAILED (no "Thank you")', async () => {
    const notifier = new RecordingNotifier();
    notifier.failWith = new EmailDeliveryFailedError('SMTP 554');
    const { post } = await setup({ notifier });

    expectProblem(await post(valid), 502, ErrorCode.EMAIL_DELIVERY_FAILED);
  });

  it('product source down → 502 PRODUCT_SOURCE_UNAVAILABLE', async () => {
    const { post } = await setup({ productSource: failingProductSource() });
    expectProblem(await post(valid), 502, ErrorCode.PRODUCT_SOURCE_UNAVAILABLE);
  });

  it('A36: a body over 10 KB → 413; nothing sent', async () => {
    const { notifier, post } = await setup();
    const response = await post({ ...valid, message: 'x'.repeat(11 * 1024) });

    expect(response.statusCode).toBe(413);
    expect(notifier.sent).toEqual([]);
  });

  it('A37: customer details never reach the logs, on success or failure', async () => {
    const { logger, lines } = captureLogger('debug');
    const notifier = new RecordingNotifier();
    const { post } = await setup({ logger, notifier });

    await post(valid);
    notifier.failWith = new Error('SMTP down');
    await post(valid);

    const logged = JSON.stringify(lines);
    for (const value of [valid.name, valid.email, valid.phone, valid.message]) {
      expect(logged).not.toContain(value);
    }
    expect(lines).toContainEqual(expect.objectContaining({ event: LogEvent.enquirySent }));
    expect(lines).toContainEqual(expect.objectContaining({ event: LogEvent.enquiryFailed }));
  });
});

describe('enquiry rate limit (ENQ-06)', () => {
  it('NEW-43: the 6th attempt in the window → 429 RATE_LIMITED with Retry-After; not sent', async () => {
    const { notifier, post } = await setup();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await post(valid)).statusCode).toBe(202);
    }
    const sixth = await post(valid);

    expectProblem(sixth, 429, ErrorCode.RATE_LIMITED);
    expect(sixth.headers['retry-after']).toBeDefined();
    expect(notifier.sent).toHaveLength(5);
  });

  it('NEW-44: invalid attempts count towards the limit too', async () => {
    const { post } = await setup();

    for (let attempt = 1; attempt <= 5; attempt += 1) {
      expect((await post({ name: '' })).statusCode).toBe(400);
    }
    expectProblem(await post(valid), 429, ErrorCode.RATE_LIMITED);
  });

  it('ENQ-06.FR2: logs enquiry.rate_limited without the client IP', async () => {
    const { logger, lines } = captureLogger();
    const { post } = await setup({ logger, enquiryRateLimit: { max: 1, windowMinutes: 15 } });

    await post(valid, { remoteAddress: '203.0.113.7' });
    await post(valid, { remoteAddress: '203.0.113.7' });

    const event = lines.find((line) => line.event === LogEvent.enquiryRateLimited);
    expect(event).toBeDefined();
    expect(JSON.stringify(event)).not.toContain('203.0.113.7');
  });

  it('limits are per client: another client is not affected', async () => {
    const { post } = await setup({ enquiryRateLimit: { max: 1, windowMinutes: 15 } });

    expect((await post(valid, { remoteAddress: '203.0.113.7' })).statusCode).toBe(202);
    expect((await post(valid, { remoteAddress: '203.0.113.7' })).statusCode).toBe(429);
    expect((await post(valid, { remoteAddress: '198.51.100.9' })).statusCode).toBe(202);
  });

  it('R-07: rotating a forged X-Forwarded-For does not get round the limit', async () => {
    const { post } = await setup({
      trustProxyHops: 1,
      enquiryRateLimit: { max: 2, windowMinutes: 15 },
    });
    // Same real client behind the one trusted proxy; the first entry is forged each time.
    const from = (forged: string) => ({
      remoteAddress: '10.0.0.2',
      headers: { 'x-forwarded-for': `${forged}, 203.0.113.7` },
    });

    expect((await post(valid, from('1.1.1.1'))).statusCode).toBe(202);
    expect((await post(valid, from('2.2.2.2'))).statusCode).toBe(202);
    expect((await post(valid, from('3.3.3.3'))).statusCode).toBe(429);
  });
});
