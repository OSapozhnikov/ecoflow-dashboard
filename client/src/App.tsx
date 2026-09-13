/**
 * Main App Component
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorProvider } from './context/ErrorContext';
import { ThemeToggle } from './components/ThemeToggle';
import { Dashboard } from './pages/Dashboard';
import { DeviceDetail } from './pages/DeviceDetail';
import { ErrorBoundary } from './components/ErrorBoundary';
import { errorReporter } from './utils/errorReporting';

function App() {
  return (
    <ErrorBoundary
      onError={(error, errorInfo) => {
        // Report error to error reporting service
        errorReporter.reportError(error, {
          tags: {
            component: 'App',
            errorBoundary: 'true',
          },
          extra: {
            componentStack: errorInfo.componentStack,
          },
        });
      }}
    >
      <ErrorProvider>
        <ThemeProvider>
          <BrowserRouter>
            <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
              <header className="bg-white dark:bg-gray-800 shadow-sm">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    Ecoflow Monitor
                  </h1>
                  <ThemeToggle />
                </div>
              </header>

              <main>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/device/:deviceId" element={<DeviceDetail />} />
                </Routes>
              </main>
            </div>
          </BrowserRouter>
        </ThemeProvider>
      </ErrorProvider>
    </ErrorBoundary>
  );
}

export default App;

