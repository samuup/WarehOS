import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['src/test/unit/**/*.{test,spec}.ts'],
    exclude: ['node_modules/**', 'dist/**', 'dist-electron/**', 'test-results/**'],
    coverage: {
      provider: 'v8',
      include: ['src/shared/**/*.{ts,js}'],
      exclude: ['src/shared/types.ts'],
      reporter: ['text', 'json-summary'],
      thresholds: {
        lines: 70,
        statements: 70,
        functions: 70,
        branches: 70,
      },
    },
  },
});