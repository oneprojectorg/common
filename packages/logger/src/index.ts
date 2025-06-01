import { Axiom } from '@axiomhq/js';

const dataset = process.env.AXIOM_DATASET || 'common';
// Initialize Axiom client
export const axiom = new Axiom({
  token: process.env.AXIOM_API_TOKEN!,
});

// Logger interface for consistent logging
export const logger = {
  info: (message: string, data?: Record<string, any>) => {
    console.log(message, data);
    axiom.ingest(dataset, [
      {
        level: 'info',
        message,
        timestamp: new Date().toISOString(),
        ...data,
      },
    ]);
  },

  error: (message: string, error?: Error, data?: Record<string, any>) => {
    console.error(message, error, data);
    axiom.ingest(dataset, [
      {
        level: 'error',
        message,
        error: error?.message,
        stack: error?.stack,
        timestamp: new Date().toISOString(),
        ...data,
      },
    ]);
  },

  warn: (message: string, data?: Record<string, any>) => {
    console.warn(message, data);
    axiom.ingest(dataset, [
      {
        level: 'warn',
        message,
        timestamp: new Date().toISOString(),
        ...data,
      },
    ]);
  },

  debug: (message: string, data?: Record<string, any>) => {
    console.debug(message, data);
    axiom.ingest(dataset, [
      {
        level: 'debug',
        message,
        timestamp: new Date().toISOString(),
        ...data,
      },
    ]);
  },
};

// Flush logs before shutdown
export const flushLogs = async () => {
  await axiom.flush();
};

export { transformMiddlewareRequest } from '@axiomhq/nextjs';
export { nextLogger } from './lib/axiom/server';

// Export types for better TypeScript support
export type Logger = typeof logger;
export type LogLevel = 'info' | 'error' | 'warn' | 'debug';
export type LogData = Record<string, any>;
