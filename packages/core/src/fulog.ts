import colors from 'tailwindcss/colors';

// Types for log configuration
type LogLevel = 'info' | 'success' | 'warning' | 'error' | 'debug' | 'group';

interface LogConfig {
  badge?: string;
  icon?: string;
  color?: string;
}

interface LogMessage {
  message: string;
  badge?: string;
  icon?: string;
}

// Default configurations for different log levels
const LOG_CONFIGS: Record<LogLevel, LogConfig> = {
  info: {
    badge: 'INFO',
    icon: 'ℹ️',
    color: colors.blue[500],
  },
  success: {
    badge: 'SUCCESS',
    icon: '✅',
    color: colors.green[500],
  },
  warning: {
    badge: 'WARN',
    icon: '⚠️',
    color: colors.amber[500],
  },
  error: {
    badge: 'ERROR',
    icon: '❌',
    color: colors.red[500],
  },
  debug: {
    badge: 'DEBUG',
    icon: '🔍',
    color: colors.purple[500],
  },
  group: {
    badge: 'GROUP',
    icon: '📂',
    color: colors.slate[500],
  },
};

class fulog {
  private static formatBadge(
    messageArg: string | LogMessage,
    level: LogLevel,
  ): [string, string, string] {
    const config = LOG_CONFIGS[level];
    const isMessageObject = typeof messageArg === 'object' && messageArg !== null;

    const message = isMessageObject ? messageArg.message : messageArg;
    const badge = isMessageObject ? (messageArg.badge ?? config.badge) : config.badge;
    const icon = isMessageObject ? (messageArg.icon ?? config.icon) : config.icon;

    const styles = [
      `border: 1px solid ${config.color}`,
      `color: ${config.color}`,
      'padding: 2px 6px',
      'border-radius: 4px',
      'font-weight: bold',
    ].join(';');

    return [
      `%c${badge} ${icon}%c ${message}`,
      styles,
      'color: inherit',
    ];
  }

  static info(messageArg: string | LogMessage, ...args: unknown[]) {
    console.log(...this.formatBadge(messageArg, 'info'), ...args);
  }

  static success(messageArg: string | LogMessage, ...args: unknown[]) {
    console.log(...this.formatBadge(messageArg, 'success'), ...args);
  }

  static warn(messageArg: string | LogMessage, ...args: unknown[]) {
    console.warn(...this.formatBadge(messageArg, 'warning'), ...args);
  }

  static error(messageArg: string | LogMessage, ...args: unknown[]) {
    console.error(...this.formatBadge(messageArg, 'error'), ...args);
  }

  static debug(messageArg: string | LogMessage, ...args: unknown[]) {
    console.debug(...this.formatBadge(messageArg, 'debug'), ...args);
  }

  // Group methods
  static group(messageArg: string | LogMessage, collapsed = false) {
    const [header, ...styles] = this.formatBadge(messageArg, 'group');

    if (collapsed) {
      console.groupCollapsed(header, ...styles);
    }
    else {
      console.group(header, ...styles);
    }

    return new GroupScope();
  }

  static groupEnd() {
    console.groupEnd();
  }

  // Custom logger with full configuration
  static custom(message: string, config: LogConfig) {
    const styles = [
      `background: ${config.color || '#95a5a6'}`,
      'color: white',
      'padding: 2px 6px',
      'border-radius: 4px',
      'font-weight: bold',
    ].join(';');

    console.log(
      `%c${config.badge || 'CUSTOM'}%c ${config.icon || ''} ${message}`,
      styles,
      'color: inherit',
    );
  }
}

// Helper class for group scoping with 'using' statement
class GroupScope {
  [Symbol.dispose]() {
    fulog.groupEnd();
  }
}

export default fulog;
