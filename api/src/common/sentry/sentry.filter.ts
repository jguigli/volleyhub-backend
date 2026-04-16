import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { Sentry } from './sentry.init';

/**
 * Global exception filter that:
 * 1. Returns a consistent JSON error response to the client
 * 2. Reports 5xx / non-HTTP errors to Sentry (if configured)
 *
 * 4xx errors (BadRequest, Unauthorized, etc.) are NOT reported to Sentry
 * because they are expected and handled — we don't want to pollute Sentry
 * with "user mistakes".
 */
@Catch()
export class SentryExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(SentryExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | object = 'Internal server error';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      message =
        typeof res === 'string' ? res : (res as { message: string }).message ?? res;
    } else if (exception instanceof Error) {
      message = exception.message;
    }

    // Only report 5xx (server errors) and unexpected errors to Sentry
    const shouldReport =
      status >= 500 || !(exception instanceof HttpException);

    if (shouldReport) {
      Sentry.withScope((scope) => {
        // Add request context (user, URL, method)
        scope.setTag('path', request.url);
        scope.setTag('method', request.method);
        scope.setContext('request', {
          url: request.url,
          method: request.method,
          query: request.query,
        });

        // Attach user if authenticated (id + email only, no tokens)
        const user = (request as Request & { user?: { id: string; email: string } })
          .user;
        if (user) {
          scope.setUser({ id: user.id, email: user.email });
        }

        Sentry.captureException(exception);
      });

      this.logger.error(
        `${request.method} ${request.url} → ${status}`,
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    response.status(status).json({
      statusCode: status,
      message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
