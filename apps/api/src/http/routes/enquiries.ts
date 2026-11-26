import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { LogEvent } from '../../logging/logger.ts';
import type { EnquiryService } from '../../services/enquiry-service.ts';

export interface EnquiryRateLimit {
  /** Attempts allowed per client per window (NEW-43). */
  max: number;
  windowMinutes: number;
}

/**
 * POST /api/v1/enquiries (ENQ-03, ARCHITECTURE §6.2). `202 Accepted` once the
 * email has been accepted for sending (T12, A31); errors are Problem Details.
 *
 * Rate limited per client IP (ENQ-06). The limiter runs before the body is
 * parsed, so every attempt counts, including invalid ones (NEW-44). The IP
 * respects the trusted-proxy hop count, so X-Forwarded-For can't be spoofed (R-07).
 */
export function enquiryRoutes(
  app: FastifyInstance,
  deps: { enquiry: EnquiryService; rateLimit: EnquiryRateLimit },
): void {
  // Registered as one plugin so the limiter is in place before the route.
  void app.register(async (scope) => {
    await scope.register(rateLimit, {
      global: false,
      onExceeded: (request) => {
        // No IP or customer data in logs (A37).
        request.log.warn({ event: LogEvent.enquiryRateLimited }, 'Enquiry rate limit exceeded');
      },
    });

    scope.post(
      '/api/v1/enquiries',
      {
        config: {
          rateLimit: {
            max: deps.rateLimit.max,
            timeWindow: deps.rateLimit.windowMinutes * 60_000,
          },
        },
      },
      async (request, reply) => {
        await deps.enquiry.submit(request.body);
        return reply.code(202).send();
      },
    );
  });
}
