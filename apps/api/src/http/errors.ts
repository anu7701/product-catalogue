import { randomUUID } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
import { ErrorCode, errorMessages, type ProblemDetails } from '@catalogue/shared';
import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  CategoryNotFoundError,
  EmailDeliveryFailedError,
  ProductNotFoundError,
  ProductUnavailableError,
  UpstreamUnavailableError,
  ValidationFailedError,
} from '../domain/errors.ts';
import { LogEvent } from '../logging/logger.ts';

export const REQUEST_ID_HEADER = 'x-request-id';

/** Incoming request IDs are reused only if short and log-safe; otherwise we make our own. */
const SAFE_REQUEST_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function generateRequestId(request: IncomingMessage): string {
  const incoming = request.headers[REQUEST_ID_HEADER];
  return typeof incoming === 'string' && SAFE_REQUEST_ID.test(incoming) ? incoming : randomUUID();
}

interface Mapped {
  status: number;
  code: ErrorCode;
  errors?: Record<string, string>;
}

/** Domain error → HTTP status and code (ARCHITECTURE §8.1). Unknown errors are not mapped. */
function mapDomainError(error: unknown): Mapped | undefined {
  if (error instanceof ValidationFailedError) {
    return { status: 400, code: ErrorCode.VALIDATION_FAILED, errors: error.fieldErrors };
  }
  if (error instanceof ProductNotFoundError)
    return { status: 404, code: ErrorCode.PRODUCT_NOT_FOUND };
  if (error instanceof CategoryNotFoundError)
    return { status: 404, code: ErrorCode.CATEGORY_NOT_FOUND };
  if (error instanceof ProductUnavailableError) {
    return { status: 422, code: ErrorCode.PRODUCT_UNAVAILABLE };
  }
  if (error instanceof UpstreamUnavailableError) {
    return { status: 502, code: ErrorCode.PRODUCT_SOURCE_UNAVAILABLE };
  }
  if (error instanceof EmailDeliveryFailedError) {
    return { status: 502, code: ErrorCode.EMAIL_DELIVERY_FAILED };
  }
  return undefined;
}

/** Errors Fastify itself raises for bad requests (invalid JSON, body too large, rate limit…). */
function mapFrameworkError(error: unknown): Mapped | undefined {
  const statusCode = (error as Partial<FastifyError> | null)?.statusCode;
  if (typeof statusCode !== 'number' || statusCode < 400 || statusCode >= 500) return undefined;
  if (statusCode === 429) return { status: 429, code: ErrorCode.RATE_LIMITED };
  if (statusCode === 404) return { status: 404, code: ErrorCode.NOT_FOUND };
  return { status: statusCode, code: ErrorCode.VALIDATION_FAILED };
}

export function problem(request: FastifyRequest, mapped: Mapped): ProblemDetails {
  return {
    type: 'about:blank',
    title: errorMessages[mapped.code],
    status: mapped.status,
    code: mapped.code,
    requestId: request.id,
    ...(mapped.errors ? { errors: mapped.errors } : {}),
  };
}

function send(reply: FastifyReply, body: ProblemDetails) {
  return reply.status(body.status).type('application/problem+json').send(body);
}

/**
 * Central error handling (ARCHITECTURE §8.2): every error leaves the API as
 * Problem Details with a stable code and the request ID. Stack traces,
 * upstream URLs and provider messages are logged, never returned (A43).
 * Upstream failures are never turned into "not found" (CAT-02, PRD-02).
 */
export function registerErrorHandling(app: FastifyInstance): void {
  app.addHook('onRequest', (request, reply, done) => {
    void reply.header(REQUEST_ID_HEADER, request.id);
    done();
  });

  app.setErrorHandler((error, request, reply) => {
    const mapped = mapDomainError(error) ?? mapFrameworkError(error);

    if (!mapped) {
      request.log.error({ err: error }, 'Unhandled error');
      return send(reply, problem(request, { status: 500, code: ErrorCode.INTERNAL_ERROR }));
    }
    if (error instanceof UpstreamUnavailableError) {
      request.log.error({ event: LogEvent.productSourceFailed, err: error }, error.message);
    } else if (mapped.status >= 500) {
      request.log.error({ err: error }, 'Request failed');
    }
    return send(reply, problem(request, mapped));
  });

  app.setNotFoundHandler((request, reply) =>
    send(reply, problem(request, { status: 404, code: ErrorCode.NOT_FOUND })),
  );
}
