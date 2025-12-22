/** @type {import('jest').Config} */
module.exports = {
  // Use ts-jest for TypeScript
  preset: 'ts-jest',

  // Test environment
  testEnvironment: 'node',

  // Root directory
  rootDir: '.',

  // Module path aliases (match tsconfig paths)
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },

  // Setup files
  globalSetup: '<rootDir>/tests/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/tests/setup/globalTeardown.ts',
  setupFilesAfterEnv: ['<rootDir>/tests/setup/setupTests.ts'],

  // Test file patterns - focus on service integration tests
  // API tests are excluded due to better-auth ESM compatibility issues
  testMatch: [
    '<rootDir>/tests/integration/services/**/*.test.ts',
  ],

  // Ignore patterns
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
  ],

  // Transform ESM packages
  transformIgnorePatterns: [
    'node_modules/(?!(@faker-js/faker)/)',
  ],

  // Module file extensions
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],

  // Transform TypeScript and ESM files
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.json',
      useESM: true,
    }],
    '^.+\\.js$': 'babel-jest',
  },

  // Coverage configuration
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/index.ts',
    '!src/server.ts',
    '!src/types/**/*',
  ],

  // Coverage thresholds (start low, increase over time)
  // Current: 7% statements, 6% branches, 7% lines, 9% functions
  // Target: Increase gradually as more tests are added
  coverageThreshold: {
    global: {
      branches: 5,
      functions: 5,
      lines: 5,
      statements: 5,
    },
  },

  // Coverage reporters
  coverageReporters: ['text', 'text-summary', 'lcov', 'html'],

  // Coverage directory
  coverageDirectory: '<rootDir>/coverage',

  // Verbose output
  verbose: true,

  // Force exit after tests complete
  forceExit: true,

  // Detect open handles
  detectOpenHandles: true,

  // Clear mocks between tests
  clearMocks: true,

  // Timeout for each test (30 seconds)
  testTimeout: 30000,

  // Run tests in parallel
  maxWorkers: '50%',
};
