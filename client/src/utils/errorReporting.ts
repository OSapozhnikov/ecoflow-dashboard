/**
 * Error reporting utilities for frontend
 * Supports optional Sentry integration
 */

interface ErrorContext {
  userId?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

class ErrorReporter {
  private initialized = false;
  private sentryDsn: string | null = null;

  /**
   * Initialize error reporting (e.g., Sentry)
   */
  init(dsn?: string): void {
    if (dsn) {
      this.sentryDsn = dsn;
      // In production, you would initialize Sentry here
      // import * as Sentry from '@sentry/react';
      // Sentry.init({ dsn });
      this.initialized = true;
    }
  }

  /**
   * Report an error
   */
  reportError(error: Error, context?: ErrorContext): void {
    // Log to console in development
    if (import.meta.env.DEV) {
      console.error('Error reported:', error, context);
    }

    // In production, send to error reporting service
    if (this.initialized && this.sentryDsn) {
      // Sentry.captureException(error, {
      //   tags: context?.tags,
      //   extra: context?.extra,
      //   user: context?.userId ? { id: context.userId } : undefined,
      // });
    }

    // Fallback: log to console even in production for now
    console.error('Error:', error.message, context);
  }

  /**
   * Report a message
   */
  reportMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    if (import.meta.env.DEV) {
      console[level]('Message reported:', message, context);
    }

    if (this.initialized && this.sentryDsn) {
      // Sentry.captureMessage(message, level, {
      //   tags: context?.tags,
      //   extra: context?.extra,
      // });
    }
  }

  /**
   * Set user context
   */
  setUser(userId: string, email?: string): void {
    if (this.initialized && this.sentryDsn) {
      // Sentry.setUser({ id: userId, email });
    }
  }

  /**
   * Clear user context
   */
  clearUser(): void {
    if (this.initialized && this.sentryDsn) {
      // Sentry.setUser(null);
    }
  }
}

export const errorReporter = new ErrorReporter();

// Initialize if DSN is provided via environment variable
if (import.meta.env.VITE_SENTRY_DSN) {
  errorReporter.init(import.meta.env.VITE_SENTRY_DSN);
}

