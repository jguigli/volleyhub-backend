import * as Sentry from '@sentry/node';

const SENSITIVE_KEYS = [
  'password',
  'passwordHash',
  'password_hash',
  'newPassword',
  'oldPassword',
  'authorization',
  'token',
  'accessToken',
  'refreshToken',
  'jwt',
  'apiKey',
  'secret',
  'code', // password reset code
];

/**
 * Recursively scrubs sensitive fields from any object/array.
 * Replaces values with '[Filtered]' to avoid leaking secrets to Sentry.
 */
function scrub(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(scrub);
  if (typeof obj !== 'object') return obj;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj as Record<string, unknown>)) {
    const lower = key.toLowerCase();
    if (SENSITIVE_KEYS.some((k) => lower.includes(k.toLowerCase()))) {
      result[key] = '[Filtered]';
    } else {
      result[key] = scrub(value);
    }
  }
  return result;
}

/**
 * Initialize Sentry at the very start of the Node process.
 * Must be called BEFORE any other imports that might throw.
 *
 * Reads SENTRY_DSN from process.env directly (ConfigService is not yet
 * available at this point in the bootstrap).
 *
 * Option A: errors only, no performance monitoring.
 */
export function initSentry(): void {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    // No DSN configured — silently skip (useful for local dev)
    return;
  }

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',

    // No performance tracing (Option A)
    tracesSampleRate: 0,
    profilesSampleRate: 0,

    // Scrub sensitive data before sending
    beforeSend(event) {
      if (event.request) {
        if (event.request.data) {
          event.request.data = scrub(event.request.data);
        }
        if (event.request.headers) {
          event.request.headers = scrub(event.request.headers) as Record<
            string,
            string
          >;
        }
        if (event.request.cookies) {
          event.request.cookies = scrub(event.request.cookies) as Record<
            string,
            string
          >;
        }
        if (event.request.query_string) {
          event.request.query_string = '[Filtered]';
        }
      }
      if (event.extra) {
        event.extra = scrub(event.extra) as Record<string, unknown>;
      }
      if (event.contexts) {
        event.contexts = scrub(event.contexts) as typeof event.contexts;
      }
      return event;
    },

    // Ignore well-known expected errors to save quota
    ignoreErrors: [
      // 4xx client errors that are handled intentionally
      'BadRequestException',
      'UnauthorizedException',
      'ForbiddenException',
      'NotFoundException',
      'ConflictException',
      'ThrottlerException',
    ],
  });
}

export { Sentry };
