import { defineConfig } from 'vitest/config';

/**
 * ZN-0004 Vitest config — laws/components.
 * Does not start providers by itself; harness resolves admitted profiles.
 */
export default defineConfig({
  test: {
    include: ['tests/laws/**/*.test.*', 'tests/component/**/*.test.*'],
    exclude: ['**/node_modules/**', '**/*.plan.md'],
    // Fail closed: no pass-with-no-tests
    passWithNoTests: false,
    environment: 'node',
  },
});
