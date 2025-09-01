import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    environmentOptions: {
      jsdom: {
        resources: 'usable',
      },
    },
    // Exclude E2E tests from Vitest (they should run with Playwright)
    exclude: ['tests/e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/**',
        'dist/**',
        'tests/e2e/**',
        'tests/**',
        '*.config.js',
        'playwright.config.js',
      ],
    },
    // Mock WebAPI globals that are not available in jsdom
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
  },
  // Resolve modules for testing
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
    },
  },
});
