/* eslint-disable no-console */

type LogContext = Record<string, unknown>;

function format(level: string, message: string, context?: LogContext) {
  return context ? `[${level}] ${message} ${JSON.stringify(context)}` : `[${level}] ${message}`;
}

export const logger = {
  info(message: string, context?: LogContext) {
    console.log(format("info", message, context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(format("warn", message, context));
  },
  error(message: string, error?: unknown, context?: LogContext) {
    console.error(format("error", message, context), error);
  },
};
