import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./src/test/setup.ts'],
    include: ['src/**/*.test.ts'],
    exclude: ['node_modules', 'dist'],
    // historyDb uses a process-wide DatabaseSync singleton
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      clean: true, // Clean is safe in tmp directory
      reportsDirectory: './coverage-tmp', // Use tmp directory to avoid EBUSY errors
      exclude: [
        'node_modules/',
        'src/test/',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData/**',
        'src/scripts/**',
        'dist/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@ecoflow/shared': path.resolve(__dirname, '../shared/src/index.ts'),
    },
  },
});
