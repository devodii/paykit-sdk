const STATUS_MAP: Record<number, string> = {
  401: 'unauthorized',
  403: 'forbidden',
  404: 'not_found',
  429: 'rate_limit',
  500: 'internal_server_error',
  502: 'bad_gateway',
  503: 'service_unavailable',
  504: 'gateway_timeout',
};

const CONNECTION_CODES =
  /ECONNREFUSED|ECONNRESET|ENOTFOUND|FETCH FAILED/;
const TIMEOUT_CODES = /ETIMEDOUT|ECONNABORTED|TIMEOUT/;

export function classifyError(err: unknown, status?: number) {
  if (status && STATUS_MAP[status]) return STATUS_MAP[status];

  if (err instanceof Error) {
    // HTTPClient errors embed the status as a "NNN:" prefix
    const statusPrefix = /^(\d{3}):/.exec(err.message);
    if (statusPrefix) {
      const mapped = STATUS_MAP[Number(statusPrefix[1])];
      if (mapped) return mapped;
    }

    // Network errors surface the syscall code on the error itself,
    // on its message, or on the cause (Node fetch: "fetch failed")
    const causeCode = String(
      (err.cause as { code?: string } | undefined)?.code ?? '',
    );
    const haystack = `${err.message} ${causeCode}`.toUpperCase();

    if (CONNECTION_CODES.test(haystack)) return 'connection';
    if (TIMEOUT_CODES.test(haystack)) return 'timeout';
  }

  return 'unknown';
}
