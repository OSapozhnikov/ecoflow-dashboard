/**
 * Main App Component
 */

import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { ErrorProvider } from './context/ErrorContext';
import { ThemeToggle } from './components/ThemeToggle';
import { Dashboard } from './pages/Dashboard';
import { DeviceDetail } from './pages/DeviceDetail';
import { Settings } from './pages/Settings';
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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center gap-4">
                  <div className="flex items-center gap-6 min-w-0">
                    <Link
                      to="/"
                      className="text-xl font-bold text-gray-900 dark:text-white truncate"
                    >
                      Ecoflow Monitor
                    </Link>
                    <nav className="flex items-center gap-4 text-sm">
                      <Link
                        to="/"
                        className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        Dashboard
                      </Link>
                      <Link
                        to="/settings"
                        className="text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white"
                      >
                        Settings
                      </Link>
                    </nav>
                  </div>
                  <ThemeToggle />
                </div>
              </header>

              <main>
                <Routes>
                  <Route path="/" element={<Dashboard />} />
                  <Route path="/device/:deviceId" element={<DeviceDetail />} />
                  <Route path="/settings" element={<Settings />} />
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
