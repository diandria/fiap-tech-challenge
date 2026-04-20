import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  maxWorkers: 4,
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/app.ts',
    '!src/infrastructure/**/*.ts',
  ],
  coverageReporters: ['text', 'lcov', 'clover'],
  coverageThreshold: {
    global: { lines: 95, branches: 95, functions: 95, statements: 95 },
  },
};

export default config;
