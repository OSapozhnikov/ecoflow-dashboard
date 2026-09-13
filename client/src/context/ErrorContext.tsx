/**
 * Global error context for React
 */

import { createContext, useContext, useCallback, ReactNode } from 'react';
import { errorReporter } from '../utils/errorReporting';

interface ErrorContextType {
  reportError: (error: Error, context?: Record<string, unknown>) => void;
  reportMessage: (message: string, level?: 'info' | 'warning' | 'error') => void;
}

const ErrorContext = createContext<ErrorContextType | undefined>(undefined);

export function ErrorProvider({ children }: { children: ReactNode }) {
  const reportError = useCallback((error: Error, context?: Record<string, unknown>) => {
    errorReporter.reportError(error, {
      tags: {
        component: context?.component as string || 'unknown',
        action: context?.action as string || 'unknown',
      },
      extra: context,
    });
  }, []);

  const reportMessage = useCallback((message: string, level: 'info' | 'warning' | 'error' = 'info') => {
    errorReporter.reportMessage(message, level);
  }, []);

  return (
    <ErrorContext.Provider value={{ reportError, reportMessage }}>
      {children}
    </ErrorContext.Provider>
  );
}

export function useErrorReporting() {
  const context = useContext(ErrorContext);
  if (!context) {
    throw new Error('useErrorReporting must be used within ErrorProvider');
  }
  return context;
}

