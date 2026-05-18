type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  ts: string;
  level: LogLevel;
  msg: string;
  [key: string]: unknown;
}

function log(level: LogLevel, msg: string, meta: Record<string, unknown> = {}) {
  const entry: LogEntry = {
    ts: new Date().toISOString(),
    level,
    msg,
    ...meta,
  };
  const line = JSON.stringify(entry);
  if (level === 'error') {
    console.error(line);
  } else {
    console.log(line);
  }
}

export const logger = {
  info:  (msg: string, meta?: Record<string, unknown>) => log('info',  msg, meta),
  warn:  (msg: string, meta?: Record<string, unknown>) => log('warn',  msg, meta),
  error: (msg: string, meta?: Record<string, unknown>) => log('error', msg, meta),
};
