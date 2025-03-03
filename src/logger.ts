const LOG_LEVEL = new Set(
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  (process.env.LOG_LEVEL || '')
    .split(',')
    .map((i) => i.trim())
    .filter((i) => !!i),
);

type LogLevel = 'debug' | 'info' | 'warning' | 'error';

export const log = (level: LogLevel | LogLevel[], ...args: unknown[]) => {
  const shouldLog = Array.isArray(level) ? level.some((l) => LOG_LEVEL.has(l)) : LOG_LEVEL.has(level);
  if (shouldLog) {
    console.log(...args);
  }
};

export const logDebug = (...args: unknown[]) => log('debug', ...args);

export const logInfo = (...args: unknown[]) => log('info', ...args);

export const logWarning = (...args: unknown[]) => log('warning', ...args);

export const logError = (...args: unknown[]) => log('error', ...args);
