import { Axiom } from '@axiomhq/js';

// Initialize Axiom client
export const axiom = new Axiom({
  token: process.env.AXIOM_API_TOKEN!,
  // dataset: process.env.AXIOM_DATASET!,
});

// Logger interface for consistent logging
export const logger = {
  info: (message: string, data?: Record<string, any>) => {
    console.log(message, data);
    axiom.ingest('common', [
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
    axiom.ingest('common', [
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
    axiom.ingest('common', [
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
    axiom.ingest('common', [
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

// Export types for better TypeScript support
export type Logger = typeof logger;
export type LogLevel = 'info' | 'error' | 'warn' | 'debug';
export type LogData = Record<string, any>;