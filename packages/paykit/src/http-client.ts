import {
  ERR,
  OK,
  Result,
  buildError,
  executeWithRetryWithHandler,
} from './tools';
import { classifyError } from './tools/classify-error';

export type HTTPClientConfig = {
  baseUrl: string;
  headers: Record<string, string>;
  retryOptions: { max: number; baseDelay: number; debug: boolean };
};

type HTTPMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export class HTTPClient {
  constructor(private config: HTTPClientConfig) {}

  private errorHandler = (err: unknown) => {
    const errorType = classifyError(
      err,
      (err as { status?: number })?.status,
    );
    return ERR(buildError(errorType, err));
  };

  private getFullUrl(endpoint: string): string {
    const cleanEndpoint = endpoint.startsWith('/')
      ? endpoint.slice(1)
      : endpoint;
    return `${this.config.baseUrl}/${cleanEndpoint}`;
  }

  private getRequestOptions(
    options?: Omit<RequestInit, 'method'>,
  ): RequestInit {
    return {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...this.config.headers,
        ...options?.headers,
      },
    };
  }

  private retryErrorHandler = (error: unknown, attempt: number) => {
    const errorType = classifyError(
      error,
      (error as { status?: number })?.status,
    );
    const retryableTypes = [
      'rate_limit',
      'connection',
      'timeout',
      'internal_server_error',
      'bad_gateway',
      'service_unavailable',
      'gateway_timeout',
    ];

    const shouldRetry = retryableTypes.includes(errorType);

    if (this.config.retryOptions.debug) {
      console.info(
        `[HTTPClient] Attempt ${attempt} failed: ${errorType} - Retry: ${shouldRetry}`,
      );
    }

    return { retry: shouldRetry, data: null };
  };

  private async withRetry<T>(
    apiCall: () => Promise<Result<T>>,
  ): Promise<Result<T>> {
    return executeWithRetryWithHandler(
      apiCall,
      this.retryErrorHandler,
      this.config.retryOptions.max,
      this.config.retryOptions.baseDelay,
    );
  }

  private request = async <T>(
    method: HTTPMethod,
    endpoint: string,
    options?: Omit<RequestInit, 'method'>,
  ): Promise<Result<T>> => {
    return this.withRetry<T>(async () => {
      const url = this.getFullUrl(endpoint);
      const requestOptions = this.getRequestOptions(options);

      const res = await fetch(url, { method, ...requestOptions });
      const text = await res.text();

      let data: unknown = null;
      if (text) {
        try {
          data = JSON.parse(text);
        } catch (parseError) {
          if (res.ok) {
            return ERR(
              buildError('Failed to parse response body', parseError),
            );
          }
          data = text;
        }
      }

      if (!res.ok) {
        // Throw so the retry handler can classify (and retry) it;
        // the outer catch normalizes it back into a Result
        const error = buildError(`${res.status}: ${text}`, data);
        (error as Error & { status: number }).status = res.status;
        throw error;
      }

      return OK(data as T);
    }).catch(err => this.errorHandler(err));
  };

  get = async <T>(
    endpoint: string,
    options?: Omit<RequestInit, 'method'>,
  ): Promise<Result<T>> => {
    return this.request<T>('GET', endpoint, options);
  };

  post = async <T>(
    endpoint: string,
    options?: Omit<RequestInit, 'method'>,
  ): Promise<Result<T>> => {
    return this.request<T>('POST', endpoint, options);
  };

  delete = async <T>(
    endpoint: string,
    options?: Omit<RequestInit, 'method'>,
  ): Promise<Result<T>> => {
    return this.request<T>('DELETE', endpoint, options);
  };

  put = async <T>(
    endpoint: string,
    options?: Omit<RequestInit, 'method'>,
  ): Promise<Result<T>> => {
    return this.request<T>('PUT', endpoint, options);
  };

  patch = async <T>(
    endpoint: string,
    options?: Omit<RequestInit, 'method'>,
  ): Promise<Result<T>> => {
    return this.request<T>('PATCH', endpoint, options);
  };
}
