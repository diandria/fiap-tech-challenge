import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/main.ts',
    '!src/app.ts',
    '!src/infrastructure/**/*.ts',
  ],
  coverageThreshold: {
    global: { lines: 95, branches: 95, functions: 95, statements: 95 },
  },
};

export default config;
