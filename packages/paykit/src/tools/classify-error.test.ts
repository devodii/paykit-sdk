import { describe, expect, it } from 'vitest';
import { classifyError } from './classify-error';

describe('classifyError', () => {
  it('classifies by explicit status code first', () => {
    expect(classifyError(new Error('x'), 429)).toBe('rate_limit');
    expect(classifyError(new Error('x'), 401)).toBe('unauthorized');
    expect(classifyError(new Error('x'), 503)).toBe(
      'service_unavailable',
    );
  });

  it('classifies HTTPClient-style status-prefixed messages', () => {
    expect(classifyError(new Error('429: {"msg":"slow down"}'))).toBe(
      'rate_limit',
    );
    expect(classifyError(new Error('500: {"error":"oops"}'))).toBe(
      'internal_server_error',
    );
    expect(classifyError(new Error('401: {"error":"nope"}'))).toBe(
      'unauthorized',
    );
    expect(classifyError(new Error('404: not here'))).toBe(
      'not_found',
    );
  });

  it('does not misfire on unrelated digits in the message', () => {
    expect(classifyError(new Error('amount 4290 rejected'))).toBe(
      'unknown',
    );
  });

  it('classifies connection errors', () => {
    expect(classifyError(new Error('ECONNREFUSED'))).toBe(
      'connection',
    );
    expect(classifyError(new Error('econnreset'))).toBe('connection');
    expect(classifyError(new TypeError('fetch failed'))).toBe(
      'connection',
    );
  });

  it('classifies connection errors from the cause code', () => {
    const err = new Error('request to host failed');
    err.cause = { code: 'ECONNREFUSED' };
    expect(classifyError(err)).toBe('connection');
  });

  it('classifies timeout errors', () => {
    expect(classifyError(new Error('ETIMEDOUT'))).toBe('timeout');
    const err = new Error('boom');
    err.cause = { code: 'ETIMEDOUT' };
    expect(classifyError(err)).toBe('timeout');
  });

  it('returns unknown for non-Error values', () => {
    expect(classifyError('oops')).toBe('unknown');
    expect(classifyError(undefined)).toBe('unknown');
  });
});
