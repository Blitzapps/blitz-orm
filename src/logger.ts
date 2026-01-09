const LOG_TAGS = new Set(
  // eslint-disable-next-line turbo/no-undeclared-env-vars
  (process.env.BORM_LOG_TAGS || '')
    .split(',')
    .map((i) => i.trim())
    .filter((i) => !!i),
);

export const log = (tags: string | string[], ...args: unknown[]) => {
  const shouldLog =
    LOG_TAGS.has('*') || (Array.isArray(tags) ? tags.some((l) => LOG_TAGS.has(l)) : LOG_TAGS.has(tags) || tags === '*');
  if (shouldLog) {
    console.log(...args);
  }
};

export const logDebug = (...args: unknown[]) => log('debug', ...args);

export const logInfo = (...args: unknown[]) => log('info', ...args);

export const logWarning = (...args: unknown[]) => log('warning', ...args);

export const logError = (...args: unknown[]) => log('error', ...args);
