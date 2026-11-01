import type { Config } from 'jest';

/**
 * The end-to-end scenarios, against the stack in e2e/docker-compose.yml.
 * No coverage (the code runs in the containers, not here), one file at a time,
 * and a timeout that fits a whole journey through the saga.
 */
const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests/e2e'],
  testMatch: ['**/*.steps.ts'],
  testTimeout: 180_000,
  maxWorkers: 1,
};

export default config;
