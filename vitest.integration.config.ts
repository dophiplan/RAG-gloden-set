/**
 * Vitest Integration Test Configuration
 * 
 * SQLite 메모리 DB를 사용하는 통합 테스트 설정
 * 병렬 실행 및 커버리지 리포트 포함
 */

import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    name: 'integration',
    
    // Integration test environment - node (for SQLite access)
    environment: 'node',
    
    // Setup files
    setupFiles: ['./tests/integration/setup.ts'],
    
    // Test file patterns
    include: [
      'tests/integration/**/*.test.ts',
    ],
    
    // Exclude patterns
    exclude: [
      'node_modules',
      'dist',
      '.next',
      '**/*.unit.test.ts',
      'tests/integration/**/*.bak',
    ],
    
    // Sequential execution for database tests
    pool: 'forks',
    poolOptions: {
      forks: {
        singleFork: true,
      },
    },
    fileParallelism: false,
    
    // Test isolation
    isolate: true,
    
    // Timeout settings (integration tests need more time)
    testTimeout: 30000,
    hookTimeout: 30000,
    teardownTimeout: 30000,
    
    // Coverage configuration
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json'],
      include: [
        'src/repositories/**/*.ts',
        'src/lib/database/**/*.ts',
        'src/services/**/*.ts',
      ],
      exclude: [
        'src/**/*.d.ts',
        'src/**/*.config.ts',
        'src/**/*.test.ts',
        'src/**/__tests__/**',
        'src/**/index.ts',
      ],
      thresholds: {
        lines: 70,
        functions: 70,
        branches: 60,
        statements: 70,
      },
    },
    
    // Global test utilities
    globals: true,
    
    // reporters
    reporters: ['verbose'],
    
    // Output settings
    outputDiffLines: 10,
    
    // Retry flaky tests
    retry: 1,
    
    // Fail fast on CI
    bail: process.env.CI ? 5 : 0,
  },
  
  // Path resolution
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  
  // TypeScript configuration
  esbuild: {
    target: 'node22',
    platform: 'node',
  },
});
