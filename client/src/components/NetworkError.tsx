/**
 * Network Error Component with troubleshooting tips
 */

interface NetworkErrorProps {
  message: string;
}

export function NetworkError({ message }: NetworkErrorProps) {
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 max-w-2xl mx-auto mt-8">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-red-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3 flex-1">
          <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
            Network Error
          </h3>
          <div className="mt-2 text-sm text-red-700 dark:text-red-300">
            <p>{message}</p>
          </div>
          <div className="mt-4">
            <div className="text-sm text-red-600 dark:text-red-400">
              <p className="font-medium mb-2">Troubleshooting:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Make sure the backend server is running on port 5000</li>
                <li>Check if CORS is properly configured</li>
                <li>Verify the API URL in browser console</li>
                <li>If using Docker, ensure both containers are running</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

