import "server-only";

type LogContext = Record<string, boolean | number | string | null | undefined>;

function sanitized(context: LogContext) {
  return Object.fromEntries(
    Object.entries(context).filter(([, value]) => value !== undefined),
  );
}

export function logInfo(operation: string, context: LogContext = {}) {
  console.info(JSON.stringify({ level: "info", ...sanitized(context), operation }));
}

export function logError(operation: string, error: unknown, context: LogContext = {}) {
  const message = error instanceof Error ? error.message : "erro desconhecido";
  console.error(JSON.stringify({
    error: message.slice(0, 500),
    level: "error",
    ...sanitized(context),
    operation,
  }));
}
