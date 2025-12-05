'use client';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogData = Record<string, unknown>;

class ClientLogger {
  private pendingLogs: Array<{
    level: LogLevel;
    message: string;
    data?: LogData;
  }> = [];

  private log(level: LogLevel, message: string, data?: LogData) {
    // Log to console
    const consoleMethod = level === 'debug' ? 'log' : level;
    console[consoleMethod](`[${level.toUpperCase()}]`, message, data ?? '');

    // Store for potential batching/sending
    this.pendingLogs.push({ level, message, data });
  }

  debug(message: string, data?: LogData) {
    this.log('debug', message, data);
  }

  info(message: string, data?: LogData) {
    this.log('info', message, data);
  }

  warn(message: string, data?: LogData) {
    this.log('warn', message, data);
  }

  error(message: string, data?: LogData) {
    this.log('error', message, data);
  }

  async flush(): Promise<void> {
    this.pendingLogs = [];
    return Promise.resolve();
  }
}

export const clientLogger = new ClientLogger();

// Hook for component-level logging
export function useLogger() {
  return clientLogger;
}

// Placeholder WebVitals component - can be implemented with @vercel/analytics or similar
export function WebVitals() {
  return null;
}
