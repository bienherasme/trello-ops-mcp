/**
 * Minimal stderr-only logger. The stdio transport uses stdout for the
 * JSON-RPC protocol stream, so any diagnostic output must go to stderr
 * or it will corrupt the MCP connection.
 */
const levels = ["debug", "info", "warn", "error"] as const;
export type LogLevel = (typeof levels)[number];

function shouldLog(configured: LogLevel, message: LogLevel): boolean {
  return levels.indexOf(message) >= levels.indexOf(configured);
}

export function createLogger(configuredLevel: LogLevel) {
  const log = (level: LogLevel, message: string, meta?: Record<string, unknown>) => {
    if (!shouldLog(configuredLevel, level)) return;
    const line = meta ? `[${level}] ${message} ${JSON.stringify(meta)}` : `[${level}] ${message}`;
    process.stderr.write(`${line}\n`);
  };

  return {
    debug: (message: string, meta?: Record<string, unknown>) => log("debug", message, meta),
    info: (message: string, meta?: Record<string, unknown>) => log("info", message, meta),
    warn: (message: string, meta?: Record<string, unknown>) => log("warn", message, meta),
    error: (message: string, meta?: Record<string, unknown>) => log("error", message, meta),
  };
}

export type Logger = ReturnType<typeof createLogger>;
