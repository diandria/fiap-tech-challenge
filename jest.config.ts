import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testTimeout: 120_000,
  roots: ['<rootDir>/tests'],
  // The default patterns, plus the step files of the Gherkin scenarios.
  testMatch: ['**/?(*.)+(spec|test).[jt]s?(x)', '**/*.steps.ts'],
  // The end-to-end scenarios need the compose stack; they run with jest.e2e.config.ts.
  testPathIgnorePatterns: ['/node_modules/', '<rootDir>/tests/e2e/'],
  maxWorkers: 4,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/app.ts',
    '!src/frameworks/http/swagger/**',
    '!src/frameworks/database/connection.ts',
    '!src/frameworks/database/seed.ts',
    '!src/frameworks/database/models/**',
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: { lines: 80, branches: 80, functions: 80, statements: 80 },
  },
};

export default config;
