import { describe, expect, it } from 'vitest';
import { FixtureProductSource } from '../adapters/fixture/fixture-product-source.ts';
import { buildApp } from '../http/app.ts';
import { createLogger, REDACTED } from './create-logger.ts';
import { LogEvent } from './logger.ts';

function capture() {
  const lines: Record<string, unknown>[] = [];
  const logger = createLogger({
    level: 'info',
    destination: {
      write: (line: string) => lines.push(JSON.parse(line) as Record<string, unknown>),
    },
  });
  return { logger, lines };
}

const customer = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+44 20 7946 0000',
  message: 'Call me after 5pm',
};

describe('createLogger', () => {
  it('writes structured JSON with level, time and message', () => {
    const { logger, lines } = capture();
    logger.info({ event: LogEvent.enquirySent, productId: '1' }, 'Enquiry sent');

    expect(lines[0]).toMatchObject({
      level: 30,
      msg: 'Enquiry sent',
      event: 'enquiry.sent',
      productId: '1',
      time: expect.any(Number) as number,
    });
  });

  it('A37: an enquiry-shaped body is logged with name/email/phone/message redacted', () => {
    const { logger, lines } = capture();
    logger.info({ body: { productId: '1', ...customer } }, 'Enquiry received');

    expect(lines[0]?.body).toEqual({
      productId: '1',
      name: REDACTED,
      email: REDACTED,
      phone: REDACTED,
      message: REDACTED,
    });
  });

  it('A37: customer details inside a notification object are redacted', () => {
    const { logger, lines } = capture();
    logger.error(
      { event: LogEvent.enquiryFailed, enquiry: { customer, product: { id: '1' } } },
      'Enquiry failed',
    );

    const output = JSON.stringify(lines[0]);
    for (const value of Object.values(customer)) {
      expect(output).not.toContain(value);
    }
    expect(lines[0]).toMatchObject({ enquiry: { customer: REDACTED, product: { id: '1' } } });
  });

  it('redacts authorization and cookie headers', () => {
    const { logger, lines } = capture();
    logger.info({ req: { headers: { authorization: 'Bearer secret', cookie: 'sid=1' } } }, 'req');

    expect(JSON.stringify(lines[0])).not.toMatch(/secret|sid=1/);
  });

  it('request log lines carry the request ID returned to the client', async () => {
    const { logger, lines } = capture();
    const app = buildApp({
      logger,
      productSource: await FixtureProductSource.load(),
      trustProxyHops: 0,
    });

    const response = await app.inject({ url: '/api/v1/health' });
    await app.close();

    const requestLines = lines.filter((line) => line.reqId !== undefined);
    expect(requestLines.length).toBeGreaterThan(0);
    expect(requestLines.every((line) => line.reqId === response.headers['x-request-id'])).toBe(
      true,
    );
  });
});
