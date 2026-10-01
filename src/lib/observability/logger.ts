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
  // Erros do Supabase chegam como objetos simples com "message", não como Error.
  const message = error instanceof Error
    ? error.message
    : error && typeof error === "object" && "message" in error && typeof error.message === "string"
      ? error.message
      : "erro desconhecido";
  console.error(JSON.stringify({
    error: message.slice(0, 500),
    level: "error",
    ...sanitized(context),
    operation,
  }));
}
